import { queryOne, queryMany } from '@/lib/db';

/**
 * GET /api/config
 * 모든 부서 설정 + 요금 조회
 */
export async function GET(request: Request) {
  try {
    // 모든 부서 설정
    const configs = await queryMany(
      `SELECT id, department, title, event_type, subtitle, scripture,
              primary_color, bg_color,
              sub_departments, events, tshirt_sizes, custom_field_mappings
       FROM event_configs`
    );

    // 요금
    const fees = await queryOne(
      `SELECT id, kinder, kids, teens, parent_waterpark FROM fees_config LIMIT 1`
    );

    // JSON 파싱
    const parsedConfigs = configs.map((c: any) => ({
      ...c,
      subDepartments: JSON.parse(c.sub_departments || '[]'),
      events: JSON.parse(c.events || '[]'),
      tshirtSizes: JSON.parse(c.tshirt_sizes || '[]'),
      customFieldMappings: JSON.parse(c.custom_field_mappings || '[]')
    }));

    return Response.json({
      success: true,
      data: { configs: parsedConfigs, fees }
    });
  } catch (error) {
    console.error('GET /config 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
