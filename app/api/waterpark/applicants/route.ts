import { cookies } from 'next/headers';
import { queryMany } from '@/lib/db';
import { checkDepartmentAccess } from '@/lib/auth';
import { trackSubDepartments } from '@/lib/track-query';
import type { DepartmentId } from '@/lib/types';

function safeParse(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val !== 'string') return [];
  try { return JSON.parse(val); } catch { return []; }
}

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
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');

    // 어드민 세션이 있으면 부서 접근 권한 검증 (applications 라우트와 동일 패턴)
    if (department) {
      const cookieStore = await cookies();
      const token = cookieStore.get('admin_session')?.value
        || request.headers.get('authorization') || '';
      if (token) {
        const check = await checkDepartmentAccess(
          token.startsWith('Bearer ') ? token.slice(7) : token,
          department as DepartmentId
        );
        if (!check.ok) {
          return Response.json({ success: false, error: check.reason }, { status: 403 });
        }
      }
    }

    const track = searchParams.get('track');

    const params: any[] = [];
    let deptHaving = '';
    if (department) {
      params.push(department);
      // 해당 부서 자녀 중 워터풀 참석자가 1명 이상인 가족만
      let deptCond = `ac.attends_waterpark AND ac.department = $1`;
      // 트랙(분리) 필터: 트랙이 커버하는 세부부서로 추가 제한
      if (track) {
        const trackSubs = await trackSubDepartments(department, track);
        if (trackSubs.length > 0) {
          params.push(trackSubs);
          deptCond += ` AND ac.sub_department = ANY($${params.length}::text[])`;
        }
      }
      deptHaving = `AND bool_or(${deptCond})`;
    }

    const rows = await queryMany(
      `SELECT
         a.id, a.parent_name, a.parent_phone, a.depositor_name,
         a.waterfall_parents, a.created_at,
         json_agg(
           json_build_object(
             'id', ac.id,
             'name', ac.name,
             'gender', ac.gender,
             'department', ac.department,
             'subDepartment', ac.sub_department,
             'birthDate', ac.birth_date
           ) ORDER BY ac.department, ac.name
         ) FILTER (WHERE ac.attends_waterpark) AS waterpark_children
       FROM applications a
       INNER JOIN application_children ac ON a.id = ac.application_id
       GROUP BY a.id
       HAVING bool_or(ac.attends_waterpark) ${deptHaving}
       ORDER BY a.created_at DESC`,
      params
    );

    const data = rows.map((r: any) => {
      const parents = safeParse(r.waterfall_parents);
      const children = Array.isArray(r.waterpark_children) ? r.waterpark_children : [];
      return {
        id: r.id,
        parentName: r.parent_name,
        parentPhone: r.parent_phone,
        depositorName: r.depositor_name,
        createdAt: r.created_at,
        parents,            // 워터풀 동반 보호자 명단 [{name, relation, phone}]
        children,           // 워터풀 참석 자녀 명단
        parentCount: parents.length,
        childCount: children.length,
        totalCount: parents.length + children.length,
      };
    });

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
