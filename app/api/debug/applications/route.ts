import { queryMany } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

/**
 * GET /api/debug/applications?department=kids
 * 부서 필터 + 부서 없는 쿼리 두 결과를 한 번에 반환하여
 * 운영 데이터 무결성 점검 (가공/JOIN 없는 raw 상태).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');

    const apps = await queryMany(
      `SELECT id, parent_name, parent_phone, depositor_name, grand_total, created_at
         FROM applications ORDER BY created_at DESC LIMIT 50`
    );

    const children = await queryMany(
      `SELECT id, application_id, name, birth_date, department, sub_department, attended_sessions
         FROM application_children ORDER BY created_at DESC LIMIT 200`
    );

    let filtered: any[] = [];
    if (department) {
      filtered = await queryMany(
        `SELECT id, application_id, name, birth_date, department, sub_department
           FROM application_children WHERE department = $1`,
        [department]
      );
    }

    // department 컬럼의 distinct 값
    const deptDistinct = await queryMany(
      `SELECT department, COUNT(*)::int AS count
         FROM application_children GROUP BY department ORDER BY department`
    );

    return Response.json({
      success: true,
      data: {
        applicationCount: apps.length,
        childCount: children.length,
        applications: apps,
        children,
        filteredByDepartment: department ? { department, count: filtered.length, rows: filtered } : null,
        departmentDistribution: deptDistinct,
      },
    });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
