import { query, queryMany } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

/**
 * POST /api/applications/merge
 * 여러 신청서를 한 가족(형제)으로 병합한다. (관리자 전용)
 * body: { ids: string[] }  — 병합 대상 신청서 id 2개 이상
 *
 * 규칙:
 *  - 가장 먼저 신청한(created_at 최소) 행을 keeper로 유지, 나머지는 병합 후 삭제
 *  - 자녀(application_children)는 모두 keeper로 이관하고, (이름+생년월일+부서) 중복은 제거
 *  - grand_total 은 합산, 워터풀 보호자는 합쳐서 중복 제거
 *  - 입금자/차량/카풀 정보는 keeper 값이 비어 있으면 다른 신청서의 값으로 보완
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((v: any) => typeof v === 'string') : [];
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length < 2) {
      return Response.json({ success: false, error: '병합하려면 신청서 2개 이상이 필요합니다.' }, { status: 400 });
    }

    // created_at 오름차순 — 가장 오래된 신청서를 keeper로
    const apps = await queryMany(
      `SELECT id, parent_name, parent_phone, depositor_name, grand_total, waterfall_parents,
              vehicle_info, carpool_available, carpool_capacity, created_at
         FROM applications
        WHERE id = ANY($1::uuid[])
        ORDER BY created_at ASC`,
      [uniqueIds]
    );
    if (apps.length < 2) {
      return Response.json({ success: false, error: '병합 대상 신청서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const keeper = apps[0];
    const others = apps.slice(1);
    const otherIds = others.map((a: any) => a.id);

    // 부모 레벨 필드 보완 계산
    const firstNonEmpty = (vals: any[]) => vals.find((v) => v != null && String(v).trim() !== '') ?? null;
    const depositorName = firstNonEmpty([keeper.depositor_name, ...others.map((a: any) => a.depositor_name)]);
    const vehicleInfo = firstNonEmpty([keeper.vehicle_info, ...others.map((a: any) => a.vehicle_info)]);

    // 카풀: 지원 가능한 신청서가 하나라도 있으면 지원으로, 인원은 그 중 첫 값
    const carpoolSource = apps.find((a: any) => a.carpool_available);
    const carpoolAvailable = !!carpoolSource;
    const carpoolCapacity = carpoolSource?.carpool_capacity ?? null;

    // grand_total 합산
    const grandTotal = apps.reduce((sum: number, a: any) => sum + Number(a.grand_total || 0), 0);

    // 워터풀 보호자 병합 (중복 제거)
    const parseWf = (v: any): any[] => {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } }
      return [];
    };
    const mergedWf: any[] = [];
    const seenWf = new Set<string>();
    for (const a of apps) {
      for (const p of parseWf(a.waterfall_parents)) {
        const key = `${(p?.name || '').trim()}|${p?.relation || ''}|${(p?.phone || '').trim()}`;
        if (!seenWf.has(key)) { seenWf.add(key); mergedWf.push(p); }
      }
    }

    // 1) keeper 부모 정보 갱신
    await query(
      `UPDATE applications
          SET depositor_name = $1, grand_total = $2, waterfall_parents = $3::jsonb,
              vehicle_info = $4, carpool_available = $5, carpool_capacity = $6, updated_at = NOW()
        WHERE id = $7`,
      [depositorName || keeper.parent_name, grandTotal, JSON.stringify(mergedWf),
       vehicleInfo, carpoolAvailable, carpoolAvailable ? carpoolCapacity : null, keeper.id]
    );

    // 2) 다른 신청서의 자녀를 keeper로 이관
    await query(
      `UPDATE application_children SET application_id = $1 WHERE application_id = ANY($2::uuid[])`,
      [keeper.id, otherIds]
    );

    // 3) (이름+생년월일+부서) 중복 자녀 제거 — 가장 작은 id 하나만 남김
    await query(
      `DELETE FROM application_children a
         USING application_children b
        WHERE a.application_id = $1 AND b.application_id = $1
          AND a.name = b.name AND a.birth_date = b.birth_date AND a.department = b.department
          AND a.id > b.id`,
      [keeper.id]
    );

    // 4) 병합된 나머지 신청서 삭제 (자녀는 이미 이관되어 CASCADE 영향 없음)
    await query(`DELETE FROM applications WHERE id = ANY($1::uuid[])`, [otherIds]);

    return Response.json({ success: true, data: { keeperId: keeper.id, mergedCount: others.length } });
  } catch (error) {
    console.error('POST /applications/merge 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
