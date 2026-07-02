import { query, queryOne, queryMany } from '@/lib/db';
import { staffApplicationSubmitSchema } from '@/lib/schemas';
import { requireAdmin } from '@/lib/auth';
import { deriveDayCount, validateSessionKeys } from '@/lib/session-grid';

function safeParse(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val !== 'string') return [];
  try { return JSON.parse(val); } catch { return []; }
}

/**
 * POST /api/step-apply
 * 스텝 신청 제출 — 모집 활성화된 부서(캠프)에 한해 복수 신청 가능,
 * 캠프별로 전체 참석(full) 또는 부분 참석(partial + 세션 키) 지정.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = staffApplicationSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: '입력값 검증 실패: ' + parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }
    const { name, phone, note, entries } = parsed.data;

    // 부서 중복 신청 방지
    const seen = new Set<string>();
    for (const e of entries) {
      if (seen.has(e.department)) {
        return Response.json({ success: false, error: `중복 신청된 캠프: ${e.department}` }, { status: 400 });
      }
      seen.add(e.department);
    }

    // 부서별 검증: 스텝 모집 활성화 여부 + 부분 참석 세션 키 유효성
    for (const e of entries) {
      const cfg = await queryOne(
        `SELECT is_step_recruitment_active, camp_schedule, camp_duration
           FROM event_configs WHERE department = $1`,
        [e.department]
      );
      if (!cfg) {
        return Response.json({ success: false, error: `부서 설정 없음: ${e.department}` }, { status: 400 });
      }
      if (!cfg.is_step_recruitment_active) {
        return Response.json(
          { success: false, error: `현재 스텝 모집 중이 아닌 캠프입니다: ${e.department}` },
          { status: 400 }
        );
      }
      if (e.attendanceType === 'partial') {
        if (e.attendedSessions.length === 0) {
          return Response.json(
            { success: false, error: '부분 참석 시 참석할 세션을 1개 이상 선택하세요' },
            { status: 400 }
          );
        }
        const maxDay = deriveDayCount(safeParse(cfg.camp_schedule), cfg.camp_duration);
        const v = validateSessionKeys(e.attendedSessions, maxDay);
        if (!v.ok) {
          return Response.json({ success: false, error: v.reason }, { status: 400 });
        }
      }
    }

    const app = await queryOne(
      `INSERT INTO staff_applications (name, phone, note) VALUES ($1, $2, $3) RETURNING id`,
      [name, phone, note || null]
    );

    for (const e of entries) {
      await query(
        `INSERT INTO staff_application_entries
           (staff_application_id, department, attendance_type, attended_sessions, tshirt_size)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          app.id,
          e.department,
          e.attendanceType,
          JSON.stringify(e.attendanceType === 'full' ? [] : e.attendedSessions),
          e.tshirtSize || null,
        ]
      );
    }

    return Response.json({ success: true, data: { id: app.id } }, { status: 201 });
  } catch (error) {
    console.error('POST /step-apply 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * GET /api/step-apply?department=kids
 * 스텝 신청 목록 조회 (어드민용). department 미지정 시 전체.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');

    const rows = await queryMany(
      `SELECT
         sa.id, sa.name, sa.phone, sa.note, sa.created_at,
         se.department, se.attendance_type, se.attended_sessions, se.tshirt_size
       FROM staff_applications sa
       INNER JOIN staff_application_entries se ON sa.id = se.staff_application_id
       ${department ? 'WHERE se.department = $1' : ''}
       ORDER BY sa.created_at DESC, se.department`,
      department ? [department] : []
    );

    // 신청자 단위로 entries 그룹핑
    const byId = new Map<string, any>();
    for (const r of rows) {
      if (!byId.has(r.id)) {
        byId.set(r.id, { id: r.id, name: r.name, phone: r.phone, note: r.note, created_at: r.created_at, entries: [] });
      }
      byId.get(r.id).entries.push({
        department: r.department,
        attendanceType: r.attendance_type,
        attendedSessions: safeParse(r.attended_sessions),
        tshirtSize: r.tshirt_size || null,
      });
    }

    return Response.json({ success: true, data: Array.from(byId.values()) });
  } catch (error) {
    console.error('GET /step-apply 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
