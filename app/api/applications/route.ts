import { cookies } from 'next/headers';
import { queryOne, queryMany, query } from '@/lib/db';
import { applicationSubmitSchema } from '@/lib/schemas';
import { checkDepartmentAccess, decryptSession } from '@/lib/auth';
import type { DepartmentId } from '@/lib/types';
import { validateSessionKeys, deriveDayCount } from '@/lib/session-grid';

/**
 * 마이그레이션이 운영 DB에 적용되지 않은 상황에서도 GET/POST가 정상 작동하도록
 * 신청 관련 핵심 컬럼들을 ALTER TABLE IF NOT EXISTS로 자동 보장.
 * 이미 적용된 환경에서는 noop이며 트랜잭션 비용도 미미하다.
 */
async function ensureApplicationsSchema() {
  await query(`ALTER TABLE applications ADD COLUMN IF NOT EXISTS waterfall_parents JSONB DEFAULT '[]'::jsonb`);
  await query(`ALTER TABLE application_children ADD COLUMN IF NOT EXISTS gender VARCHAR(10)`);
  await query(`ALTER TABLE application_children ADD COLUMN IF NOT EXISTS attended_sessions JSONB DEFAULT '[]'::jsonb`);
  await query(`CREATE INDEX IF NOT EXISTS idx_children_dept_sub ON application_children(department, sub_department)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_apps_created ON applications(created_at DESC)`);
}

/**
 * GET /api/applications
 * 신청 목록 조회 (부서별, 페이징, 정렬)
 */
export async function GET(request: Request) {
  try {
    await ensureApplicationsSchema();
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const subDepartment = searchParams.get('subDepartment');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // 토큰 추출 (있을 경우 권한 기반 필터링에 사용)
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session')?.value
      || request.headers.get('authorization') || '';
    const session = token ? await decryptSession(token.startsWith('Bearer ') ? token.slice(7) : token) : null;
    const allowedDepartments = session?.allowed_departments ?? null;

    // 부서별 필터링 시 권한 검증
    if (department) {
      if (token) {
        const check = await checkDepartmentAccess(token, department as DepartmentId);
        if (!check.ok) {
          return Response.json({ success: false, error: check.reason }, { status: 403 });
        }
      }
    } else if (allowedDepartments && allowedDepartments.length > 0) {
      // department 미지정 + 토큰 있음 → 토큰의 부서들로만 필터링 (다른 부서 데이터 유출 방지)
    } else if (token) {
      // 토큰은 있는데 부서 정보가 없는 경우 → 차단
      return Response.json({ success: false, error: '권한 정보가 없습니다.' }, { status: 403 });
    }
    // 토큰이 아예 없는 경우는 그대로 진행 (공개/내부 호출 호환)

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (department) {
      conditions.push(`ac.department = $${idx++}`);
      params.push(department);
    } else if (allowedDepartments && allowedDepartments.length > 0) {
      conditions.push(`ac.department = ANY($${idx++}::text[])`);
      params.push(allowedDepartments);
    }
    if (subDepartment) {
      conditions.push(`ac.sub_department = $${idx++}`);
      params.push(subDepartment);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumn = sortBy === 'createdAt' ? 'created_at' : 'parent_name';

    params.push(limit, offset);

    const sql = `
      SELECT
        a.id, a.parent_name, a.parent_phone, a.depositor_name,
        a.grand_total, a.waterfall_parents, a.created_at,
        json_agg(
          json_build_object(
            'id', ac.id,
            'name', ac.name,
            'birthDate', ac.birth_date,
            'gender', ac.gender,
            'department', ac.department,
            'subDepartment', ac.sub_department,
            'tshirtSize', ac.tshirt_size,
            'allergies', ac.allergies,
            'customAllergy', ac.custom_allergy,
            'attendsWaterpark', ac.attends_waterpark,
            'attendedSessions', ac.attended_sessions,
            'custom1', ac.custom_1, 'custom2', ac.custom_2, 'custom3', ac.custom_3,
            'custom4', ac.custom_4, 'custom5', ac.custom_5, 'custom6', ac.custom_6,
            'custom7', ac.custom_7, 'custom8', ac.custom_8, 'custom9', ac.custom_9,
            'custom10', ac.custom_10, 'custom11', ac.custom_11, 'custom12', ac.custom_12,
            'custom13', ac.custom_13, 'custom14', ac.custom_14, 'custom15', ac.custom_15,
            'custom16', ac.custom_16, 'custom17', ac.custom_17, 'custom18', ac.custom_18,
            'custom19', ac.custom_19, 'custom20', ac.custom_20
          )
        ) FILTER (WHERE ac.id IS NOT NULL) AS children,
        ps.id AS payment_id,
        ps.kinder_paid, ps.kids_paid, ps.teens_paid, ps.waterpark_paid
      FROM applications a
      LEFT JOIN application_children ac ON a.id = ac.application_id
      LEFT JOIN payment_status ps ON a.id = ps.application_id
      ${whereClause}
      GROUP BY a.id, ps.id
      ORDER BY a.${sortColumn} ${sortOrder}
      LIMIT $${idx++} OFFSET $${idx}
    `;

    const result = await query(sql, params);
    return Response.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('GET /applications 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/applications
 * 신청서 생성 (부모 + 워터풀 보호자 + 자녀들 한번에)
 */
export async function POST(request: Request) {
  try {
    await ensureApplicationsSchema();
    const body = await request.json();
    const parsed = applicationSubmitSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { success: false, error: '입력값 검증 실패', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { parentName, parentPhone, depositorName, waterfallParents, children, grandTotal } = parsed.data;

    // 부서별 일차 상한 사전 로드 (세션 키 검증용)
    const usedDepts = Array.from(new Set(children.map((c) => c.department))) as DepartmentId[];
    const deptDayLimit = new Map<DepartmentId, number>();
    if (usedDepts.length > 0) {
      const cfgRows = await queryMany(
        `SELECT department, camp_schedule, camp_duration
           FROM event_configs
          WHERE department = ANY($1::text[])`,
        [usedDepts]
      );
      for (const row of cfgRows as any[]) {
        const schedule = Array.isArray(row.camp_schedule)
          ? row.camp_schedule
          : (typeof row.camp_schedule === 'string'
              ? (() => { try { return JSON.parse(row.camp_schedule); } catch { return []; } })()
              : []);
        deptDayLimit.set(row.department, deriveDayCount(schedule, row.camp_duration));
      }
    }

    // 세션 키 검증
    for (const child of children) {
      const keys = child.attendedSessions || [];
      if (keys.length === 0) continue;
      const maxDay = deptDayLimit.get(child.department as DepartmentId) || 7;
      const ok = validateSessionKeys(keys, maxDay);
      if (!ok.ok) {
        return Response.json(
          { success: false, error: `${child.name || '자녀'}의 ${ok.reason}` },
          { status: 422 }
        );
      }
    }

    // 신청서 생성
    const applicationResult = await queryOne(
      `INSERT INTO applications (parent_name, parent_phone, depositor_name, grand_total, waterfall_parents)
       VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING *`,
      [parentName, parentPhone, depositorName, grandTotal || 0, JSON.stringify(waterfallParents)]
    );

    const applicationId = applicationResult.id;

    for (const child of children) {
      await query(
        `INSERT INTO application_children (
          application_id, name, birth_date, gender, department, sub_department,
          tshirt_size, allergies, custom_allergy, attends_waterpark, attended_sessions,
          custom_1, custom_2, custom_3, custom_4, custom_5, custom_6, custom_7, custom_8, custom_9, custom_10,
          custom_11, custom_12, custom_13, custom_14, custom_15, custom_16, custom_17, custom_18, custom_19, custom_20
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)`,
        [
          applicationId,
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
          child.custom1 || null, child.custom2 || null, child.custom3 || null, child.custom4 || null, child.custom5 || null,
          child.custom6 || null, child.custom7 || null, child.custom8 || null, child.custom9 || null, child.custom10 || null,
          child.custom11 || null, child.custom12 || null, child.custom13 || null, child.custom14 || null, child.custom15 || null,
          child.custom16 || null, child.custom17 || null, child.custom18 || null, child.custom19 || null, child.custom20 || null,
        ]
      );
    }

    await query(`INSERT INTO payment_status (application_id) VALUES ($1) ON CONFLICT DO NOTHING`, [applicationId]);

    return Response.json({ success: true, data: { id: applicationId } }, { status: 201 });
  } catch (error) {
    console.error('POST /applications 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * DELETE /api/applications?id=...
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ success: false, error: 'ID 필수' }, { status: 400 });
    }

    await query(`DELETE FROM applications WHERE id = $1`, [id]);
    return Response.json({ success: true, message: '신청서 삭제 완료' });
  } catch (error) {
    console.error('DELETE /applications 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
