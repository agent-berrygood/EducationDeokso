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
 * 마이그레이션(/api/init) 미적용 환경에서도 스텝 신청이 깨지지 않도록
 * 스텝 관련 테이블/컬럼을 멱등하게 보장. (config/applications 라우트와 동일 패턴)
 */
async function ensureStaffSchema() {
  await query(`CREATE TABLE IF NOT EXISTS staff_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS staff_application_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_application_id UUID NOT NULL REFERENCES staff_applications(id) ON DELETE CASCADE,
    department VARCHAR(50) NOT NULL,
    attendance_type VARCHAR(20) NOT NULL DEFAULT 'full',
    attended_sessions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (staff_application_id, department)
  )`);
  // 스텝 티셔츠 사이즈 컬럼 — 나중에 추가된 마이그레이션(v12)이 미적용된 DB 대응
  await query(`ALTER TABLE staff_application_entries ADD COLUMN IF NOT EXISTS tshirt_size VARCHAR(20)`);
  // 트랙(분리 운영) 지원 — 부서 내 트랙별로 독립 스텝 모집 가능하도록
  await query(`ALTER TABLE staff_application_entries ADD COLUMN IF NOT EXISTS track_key VARCHAR(50) DEFAULT 'main'`);
  await query(`ALTER TABLE staff_application_entries ADD COLUMN IF NOT EXISTS track_label VARCHAR(100)`);
  await query(`UPDATE staff_application_entries SET track_key = 'main' WHERE track_key IS NULL`);
  // UNIQUE(app, department) → UNIQUE(app, department, track_key) (멱등)
  await query(`ALTER TABLE staff_application_entries DROP CONSTRAINT IF EXISTS staff_application_entries_staff_application_id_department_key`);
  await query(`DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'staff_application_entries'::regclass AND conname = 'staff_entries_app_dept_track_key'
      ) THEN
        ALTER TABLE staff_application_entries ADD CONSTRAINT staff_entries_app_dept_track_key UNIQUE (staff_application_id, department, track_key);
      END IF;
    END $$;`);
}

/**
 * POST /api/step-apply
 * 스텝 신청 제출 — 모집 활성화된 부서(캠프)에 한해 복수 신청 가능,
 * 캠프별로 전체 참석(full) 또는 부분 참석(partial + 세션 키) 지정.
 */
export async function POST(request: Request) {
  try {
    await ensureStaffSchema();
    const body = await request.json();
    const parsed = staffApplicationSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: '입력값 검증 실패: ' + parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }
    const { name, phone, note, entries } = parsed.data;

    // 캠프(부서·트랙) 중복 신청 방지
    const seen = new Set<string>();
    for (const e of entries) {
      const tk = (e.trackKey && e.trackKey.trim()) || 'main';
      const key = `${e.department}::${tk}`;
      if (seen.has(key)) {
        return Response.json({ success: false, error: `중복 신청된 캠프: ${e.department} / ${tk}` }, { status: 400 });
      }
      seen.add(key);
    }

    // 캠프별 검증: 해당 트랙의 스텝 모집 활성화 여부 + 부분 참석 세션 키 유효성
    for (const e of entries) {
      const tk = (e.trackKey && e.trackKey.trim()) || 'main';
      // 특정 트랙 행을 조회하고, 없으면 main 폴백
      let cfg = await queryOne(
        `SELECT is_step_recruitment_active, camp_schedule, camp_duration
           FROM event_configs WHERE department = $1 AND track_key = $2`,
        [e.department, tk]
      );
      if (!cfg && tk !== 'main') {
        cfg = await queryOne(
          `SELECT is_step_recruitment_active, camp_schedule, camp_duration
             FROM event_configs WHERE department = $1 AND track_key = 'main'`,
          [e.department]
        );
      }
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
      const tk = (e.trackKey && e.trackKey.trim()) || 'main';
      await query(
        `INSERT INTO staff_application_entries
           (staff_application_id, department, attendance_type, attended_sessions, tshirt_size, track_key, track_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          app.id,
          e.department,
          e.attendanceType,
          JSON.stringify(e.attendanceType === 'full' ? [] : e.attendedSessions),
          e.tshirtSize || null,
          tk,
          e.trackLabel || null,
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

    await ensureStaffSchema();
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');

    const rows = await queryMany(
      `SELECT
         sa.id, sa.name, sa.phone, sa.note, sa.created_at,
         se.department, se.attendance_type, se.attended_sessions, se.tshirt_size,
         se.track_key, se.track_label
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
        trackKey: r.track_key || 'main',
        trackLabel: r.track_label || null,
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

/**
 * DELETE /api/step-apply?id=<staff_application_id>
 * 스텝 신청 1건 삭제 (관리자). entries는 FK ON DELETE CASCADE로 함께 제거.
 */
export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return Response.json({ success: false, error: 'id 필수' }, { status: 400 });
    }
    await query(`DELETE FROM staff_applications WHERE id = $1`, [id]);
    return Response.json({ success: true, message: '스텝 신청 삭제 완료' });
  } catch (error) {
    console.error('DELETE /step-apply 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
