import { query, queryOne } from '@/lib/db';
import { applicationSubmitSchema } from '@/lib/schemas';
import { requireAdmin } from '@/lib/auth';
import type { DepartmentId } from '@/lib/types';
import { deriveDayCount, validateAttendedDates } from '@/lib/session-grid';

/**
 * PUT /api/applications/[id]
 * 신청서 업데이트 (어드민용: 부모 정보 및 자녀 정보 전면 수정)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!id) {
      return Response.json({ success: false, error: 'ID 필수' }, { status: 400 });
    }

    // 차량/카풀 컬럼 자동 보장 (POST 미실행 환경 대비)
    await query(`ALTER TABLE applications ADD COLUMN IF NOT EXISTS vehicle_info TEXT`);
    await query(`ALTER TABLE applications ADD COLUMN IF NOT EXISTS carpool_available BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE applications ADD COLUMN IF NOT EXISTS carpool_capacity INTEGER`);

    const body = await request.json();
    const parsed = applicationSubmitSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { success: false, error: '입력값 검증 실패', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { parentName, parentPhone, depositorName, waterfallParents, children, grandTotal,
            vehicleInfo, carpoolAvailable, carpoolCapacity } = parsed.data;

    // 부서별 일차 상한 사전 로드 (세션 키 검증용)
    const usedDepts = Array.from(new Set(children.map((c) => c.department))) as DepartmentId[];
    const deptDayLimit = new Map<DepartmentId, number>();
    if (usedDepts.length > 0) {
      const cfgRows = await query(
        `SELECT department, camp_schedule, camp_duration
           FROM event_configs
          WHERE department = ANY($1::text[])`,
        [usedDepts]
      );
      for (const row of cfgRows.rows as any[]) {
        const schedule = Array.isArray(row.camp_schedule)
          ? row.camp_schedule
          : (typeof row.camp_schedule === 'string'
              ? (() => { try { return JSON.parse(row.camp_schedule); } catch { return []; } })()
              : []);
        deptDayLimit.set(row.department, deriveDayCount(schedule, row.camp_duration));
      }
    }

    // 참석 날짜 검증
    for (const child of children) {
      const dates = child.attendedSessions || [];
      if (dates.length === 0) continue;
      const ok = validateAttendedDates(dates);
      if (!ok.ok) {
        return Response.json(
          { success: false, error: `${child.name || '자녀'}의 ${ok.reason}` },
          { status: 422 }
        );
      }
    }

    // 1. 기존 신청서 메인 정보 업데이트
    await query(
      `UPDATE applications
       SET parent_name = $1, parent_phone = $2, depositor_name = $3, grand_total = $4, waterfall_parents = $5::jsonb,
           vehicle_info = $7, carpool_available = $8, carpool_capacity = $9, updated_at = NOW()
       WHERE id = $6`,
      [
        parentName, parentPhone, depositorName, grandTotal || 0, JSON.stringify(waterfallParents), id,
        vehicleInfo?.trim() || null,
        carpoolAvailable || false,
        carpoolAvailable && carpoolCapacity ? carpoolCapacity : null,
      ]
    );

    // 2. 기존 자녀 정보 삭제
    await query(`DELETE FROM application_children WHERE application_id = $1`, [id]);

    // 3. 자녀 정보 다시 삽입
    for (const child of children) {
      await query(
        `INSERT INTO application_children (
          application_id, name, birth_date, gender, department, sub_department,
          tshirt_size, allergies, custom_allergy, attends_waterpark, attended_sessions, partial_attendance_reason,
          custom_1, custom_2, custom_3, custom_4, custom_5, custom_6, custom_7, custom_8, custom_9, custom_10,
          custom_11, custom_12, custom_13, custom_14, custom_15, custom_16, custom_17, custom_18, custom_19, custom_20
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)`,
        [
          id,
          child.name,
          child.birthDate,
          child.gender || null,
          child.department,
          child.subDepartment,
          child.tshirtSize || null,
          child.allergies || null,
          child.customAllergy || null,
          child.attendsWaterpark || false,
          JSON.stringify(child.attendedSessions || []),
          child.partialAttendanceReason || null,
          child.custom1 || null, child.custom2 || null, child.custom3 || null, child.custom4 || null, child.custom5 || null,
          child.custom6 || null, child.custom7 || null, child.custom8 || null, child.custom9 || null, child.custom10 || null,
          child.custom11 || null, child.custom12 || null, child.custom13 || null, child.custom14 || null, child.custom15 || null,
          child.custom16 || null, child.custom17 || null, child.custom18 || null, child.custom19 || null, child.custom20 || null,
        ]
      );
    }

    return Response.json({ success: true, message: '신청 정보 업데이트 완료' });
  } catch (error) {
    console.error('PUT /applications/[id] 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
