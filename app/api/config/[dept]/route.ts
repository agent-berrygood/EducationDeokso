import { queryOne, query } from '@/lib/db';

/**
 * GET /api/config/[dept]
 * 부서별 설정 조회 (title, colors, custom fields, 셔츠 사이즈, 행사 등)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ dept: string }> }
) {
  let department: string = '';
  try {
    const { dept } = await params;
    department = dept;

    const config = await queryOne(
      `SELECT
        id, department, title, event_type, subtitle, scripture,
        primary_color, bg_color,
        sub_departments, events, tshirt_sizes, custom_field_mappings
       FROM event_configs WHERE department = $1`,
      [department]
    );

    if (!config) {
      return Response.json({ success: false, error: '설정을 찾을 수 없습니다' }, { status: 404 });
    }

    // JSON 파싱
    return Response.json({
      success: true,
      data: {
        ...config,
        subDepartments: JSON.parse(config.sub_departments || '[]'),
        events: JSON.parse(config.events || '[]'),
        tshirtSizes: JSON.parse(config.tshirt_sizes || '[]'),
        customFieldMappings: JSON.parse(config.custom_field_mappings || '[]')
      }
    });
  } catch (error) {
    console.error(`GET /config/${department} 오류:`, error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/config/[dept]
 * 부서별 설정 업데이트 (관리자)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ dept: string }> }
) {
  let department: string = '';
  try {
    const { dept } = await params;
    department = dept;
    const body = await request.json();
    const {
      title, subtitle, scripture, primaryColor, bgColor,
      subDepartments, events, tshirtSizes, customFieldMappings
    } = body;

    // 기존 설정 조회
    let config = await queryOne(
      `SELECT id FROM event_configs WHERE department = $1`,
      [department]
    );

    if (!config) {
      // 신규 생성
      config = await queryOne(
        `INSERT INTO event_configs (
          department, title, subtitle, scripture,
          primary_color, bg_color, sub_departments, events,
          tshirt_sizes, custom_field_mappings
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          department,
          title || null,
          subtitle || null,
          scripture || null,
          primaryColor || null,
          bgColor || null,
          JSON.stringify(subDepartments || []),
          JSON.stringify(events || []),
          JSON.stringify(tshirtSizes || []),
          JSON.stringify(customFieldMappings || [])
        ]
      );
    } else {
      // 기존 업데이트
      await query(
        `UPDATE event_configs SET
          title = $1, subtitle = $2, scripture = $3,
          primary_color = $4, bg_color = $5,
          sub_departments = $6, events = $7,
          tshirt_sizes = $8, custom_field_mappings = $9,
          updated_at = NOW()
         WHERE department = $10`,
        [
          title || null,
          subtitle || null,
          scripture || null,
          primaryColor || null,
          bgColor || null,
          JSON.stringify(subDepartments || []),
          JSON.stringify(events || []),
          JSON.stringify(tshirtSizes || []),
          JSON.stringify(customFieldMappings || []),
          department
        ]
      );
    }

    return Response.json({ success: true, message: '설정 저장 완료' }, { status: 200 });
  } catch (error) {
    console.error(`POST /config/${department} 오류:`, error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
