import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { checkDepartmentAccess, requireAdmin } from '@/lib/auth';
import type { DepartmentId } from '@/lib/types';
import { fetchWaterparkFamilies } from '@/lib/waterpark-query';

/**
 * GET /api/waterpark/applicants?department=kids
 * 워터풀선데이 신청 명단 — 가족(신청서) 단위 그룹.
 *
 * 성경학교 신청이 가족 단위(applications + waterfall_parents + children)로
 * 들어오는 구조를 그대로 활용한다:
 *  - 보호자 = applications.waterfall_parents (워터풀 동반 보호자)
 *  - 자녀   = application_children 중 attends_waterpark = TRUE
 *  - 자녀 1명 이상 워터풀 참석하는 가족만 명단에 포함 (요금 정책과 동일 기준)
 *
 * department 지정 시: 해당 부서 자녀가 워터풀에 참석하는 가족만 필터.
 * 가족 내 다른 부서 자녀도 함께 반환된다 (가족 단위 명단이므로).
 */
export async function GET(request: Request) {
  try {
    // 명단에 보호자 연락처 등 개인정보 포함 → 어드민 세션 필수
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');

    // 부서 지정 시 부서 접근 권한 추가 검증
    if (department) {
      const cookieStore = await cookies();
      const token = cookieStore.get('admin_session')?.value
        || request.headers.get('authorization') || '';
      const check = await checkDepartmentAccess(
        token.startsWith('Bearer ') ? token.slice(7) : token,
        department as DepartmentId
      );
      if (!check.ok) {
        return Response.json({ success: false, error: check.reason }, { status: 403 });
      }
    }

    const track = searchParams.get('track');

    // 성경학교 워터풀 참석자 + 워터풀 단독 신청을 전화+이름 기준으로 병합한 명단
    const data = (await fetchWaterparkFamilies({ department, track }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const summary = {
      familyCount: data.length,
      parentCount: data.reduce((s, f) => s + f.parentCount, 0),
      childCount: data.reduce((s, f) => s + f.childCount, 0),
    };

    return Response.json({ success: true, data, summary });
  } catch (error) {
    console.error('GET /waterpark/applicants 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * PATCH /api/waterpark/applicants
 * 워터풀 참석에서만 제외한다 (성경학교/수련회 신청 자체는 보존).
 * 자녀의 attends_waterpark 플래그를 false로 바꾸는 것이므로 신청 데이터는 삭제되지 않는다.
 *
 * body:
 *  - { applicationId } : 특정 가족(신청서) 제외
 *  - { all: true }     : 현재 보고 있는 명단 전체 제외
 *  - department 지정 시 해당 부서 자녀만 대상으로 제한 (부서 탭 범위와 일치)
 */
export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ success: false, error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
    }

    const department = body?.department as string | undefined;
    // 병합된 가족은 신청서가 여러 건일 수 있어 배열(applicationIds)도 허용
    const applicationIds: string[] = Array.isArray(body?.applicationIds)
      ? body.applicationIds.filter((v: any) => typeof v === 'string')
      : (typeof body?.applicationId === 'string' ? [body.applicationId] : []);
    const all = body?.all === true;

    if (applicationIds.length === 0 && !all) {
      return Response.json(
        { success: false, error: 'applicationId(s) 또는 all 플래그가 필요합니다.' },
        { status: 400 }
      );
    }

    // 부서 지정 시 접근 권한 검증 (GET과 동일)
    if (department) {
      const cookieStore = await cookies();
      const token = cookieStore.get('admin_session')?.value
        || request.headers.get('authorization') || '';
      const check = await checkDepartmentAccess(
        token.startsWith('Bearer ') ? token.slice(7) : token,
        department as DepartmentId
      );
      if (!check.ok) {
        return Response.json({ success: false, error: check.reason }, { status: 403 });
      }
    }

    const conditions = ['attends_waterpark = TRUE'];
    const params: any[] = [];
    if (applicationIds.length > 0) {
      params.push(applicationIds);
      conditions.push(`application_id = ANY($${params.length}::uuid[])`);
    }
    // 부서 지정 시 해당 부서 자녀만 제외 (다른 부서 자녀의 워터풀 참석은 보존)
    if (department) {
      params.push(department);
      conditions.push(`department = $${params.length}`);
    }

    const result = await query(
      `UPDATE application_children SET attends_waterpark = FALSE WHERE ${conditions.join(' AND ')}`,
      params
    );

    // 워터풀 단독 신청 제외 — 성경학교 신청과 달리 보존할 다른 참가 정보가 없으므로 삭제한다.
    // 병합된 가족의 applicationIds에는 두 테이블의 id가 섞여 있으므로 각 테이블에 대해 안전하게 처리한다.
    let waterparkOnlyRemoved = 0;
    try {
      if (department) {
        // 해당 부서 자녀만 제거 후, 자녀가 모두 사라진 단독 신청 정리
        const delParams: any[] = [department];
        let idCond = '';
        if (applicationIds.length > 0) {
          delParams.push(applicationIds);
          idCond = ` AND waterpark_application_id = ANY($2::uuid[])`;
        }
        const del = await query(
          `DELETE FROM waterpark_application_children WHERE department = $1${idCond}`,
          delParams
        );
        waterparkOnlyRemoved = del.rowCount ?? 0;
        await query(
          `DELETE FROM waterpark_applications wa
             WHERE NOT EXISTS (
               SELECT 1 FROM waterpark_application_children c WHERE c.waterpark_application_id = wa.id
             )${applicationIds.length > 0 ? ' AND wa.id = ANY($1::uuid[])' : ''}`,
          applicationIds.length > 0 ? [applicationIds] : []
        );
      } else if (applicationIds.length > 0) {
        const del = await query(`DELETE FROM waterpark_applications WHERE id = ANY($1::uuid[])`, [applicationIds]);
        waterparkOnlyRemoved = del.rowCount ?? 0;
      } else if (all) {
        const del = await query(`DELETE FROM waterpark_applications`);
        waterparkOnlyRemoved = del.rowCount ?? 0;
      }
    } catch (e) {
      // 워터풀 단독 테이블이 없는 환경 등에서는 성경학교 제외만 수행하고 무시
      console.error('워터풀 단독 신청 제외 처리 오류:', e);
    }

    return Response.json({
      success: true,
      message: '워터풀 명단에서 제외했습니다. (성경학교 신청은 유지됩니다)',
      data: { childrenRemoved: (result.rowCount ?? 0) + waterparkOnlyRemoved },
    });
  } catch (error) {
    console.error('PATCH /waterpark/applicants 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
