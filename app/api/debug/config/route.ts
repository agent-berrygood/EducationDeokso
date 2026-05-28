import { queryMany } from '@/lib/db';

/**
 * GET /api/debug/config
 * event_configs 테이블의 raw 데이터를 그대로 노출하여 한글 인코딩/시드 무결성을 점검.
 * 운영 진단 후 제거 가능.
 */
export async function GET() {
  try {
    const rows = await queryMany(`
      SELECT
        department,
        title,
        event_type,
        sub_departments,
        tshirt_sizes,
        custom_field_mappings,
        primary_color,
        bg_color
      FROM event_configs
      ORDER BY department
    `);

    const diagnostics = rows.map((r: any) => {
      const subRaw = r.sub_departments;
      const subText = typeof subRaw === 'string' ? subRaw : JSON.stringify(subRaw ?? []);
      const looksCorrupted =
        (r.title && /\?/.test(r.title)) ||
        (r.event_type && /\?/.test(r.event_type)) ||
        /\?/.test(subText);
      const subDepartments = Array.isArray(subRaw)
        ? subRaw
        : (() => { try { return JSON.parse(subText); } catch { return null; } })();
      return {
        department: r.department,
        title: r.title,
        event_type: r.event_type,
        primary_color: r.primary_color,
        bg_color: r.bg_color,
        subDepartmentsCount: Array.isArray(subDepartments) ? subDepartments.length : null,
        subDepartments,
        tshirtSizes: r.tshirt_sizes,
        looksCorrupted,
      };
    });

    return Response.json({ success: true, data: diagnostics });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
