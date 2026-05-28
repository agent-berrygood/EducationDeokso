import { cookies } from 'next/headers';
import { queryMany, query } from '@/lib/db';
import { checkDepartmentAccess } from '@/lib/auth';
import { isSessionKey, SLOTS, type SessionSlot } from '@/lib/session-grid';
import type { DepartmentId } from '@/lib/types';

async function ensureSchema() {
  await query(`ALTER TABLE application_children ADD COLUMN IF NOT EXISTS attended_sessions JSONB DEFAULT '[]'::jsonb`);
  await query(`CREATE INDEX IF NOT EXISTS idx_children_sessions ON application_children USING GIN (attended_sessions)`);
}

/**
 * GET /api/admin/meals?department=kids
 *   → 부서별 일차×슬롯 매트릭스 [{day, morning, afternoon, evening, total}]
 *
 * GET /api/admin/meals?department=kids&day=2&slot=morning
 *   → 특정 슬롯 인원수 { count }
 */
export async function GET(request: Request) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department') as DepartmentId | null;
    const day = searchParams.get('day');
    const slot = searchParams.get('slot') as SessionSlot | null;

    if (!department) {
      return Response.json({ success: false, error: 'department 필수' }, { status: 400 });
    }

    // 권한 검증
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session')?.value;
    const check = await checkDepartmentAccess(token, department);
    if (!check.ok) {
      return Response.json({ success: false, error: check.reason }, { status: 403 });
    }

    // 특정 슬롯 단일 조회
    if (day && slot) {
      const key = `${day}-${slot}`;
      if (!isSessionKey(key)) {
        return Response.json({ success: false, error: '세션 키 포맷 오류' }, { status: 400 });
      }
      const rows = await queryMany(
        `SELECT COUNT(*)::int AS count
           FROM application_children
          WHERE department = $1
            AND attended_sessions @> $2::jsonb`,
        [department, JSON.stringify([key])]
      );
      return Response.json({ success: true, data: { count: rows[0]?.count ?? 0 } });
    }

    // 전체 매트릭스 — JSON 키 펼쳐서 집계
    const rows = await queryMany(
      `SELECT s::text AS session_key, COUNT(*)::int AS count
         FROM application_children, jsonb_array_elements_text(attended_sessions) AS s
        WHERE department = $1
        GROUP BY s::text
        ORDER BY s::text`,
      [department]
    );

    // day별로 그룹핑
    const matrix = new Map<number, { day: number; morning: number; afternoon: number; evening: number; total: number }>();
    let grandTotal = 0;
    for (const r of rows as any[]) {
      if (!isSessionKey(r.session_key)) continue;
      const [dayStr, slotStr] = r.session_key.split('-');
      const d = Number(dayStr);
      const cell = matrix.get(d) || { day: d, morning: 0, afternoon: 0, evening: 0, total: 0 };
      (cell as any)[slotStr] = r.count;
      cell.total = cell.morning + cell.afternoon + cell.evening;
      matrix.set(d, cell);
      grandTotal += r.count;
    }

    return Response.json({
      success: true,
      data: {
        department,
        slots: SLOTS,
        rows: Array.from(matrix.values()).sort((a, b) => a.day - b.day),
        grandTotal,
      },
    });
  } catch (error) {
    console.error('GET /admin/meals 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
