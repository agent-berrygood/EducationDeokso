import { queryOne, query } from '@/lib/db';

function safeParse(val: any) {
  if (!val) return [];
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch (e) {
      return [];
    }
  }
  return val;
}

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
        primary_color, bg_color, camp_start_date, camp_schedule,
        camp_type, camp_duration, poster_url,
        is_step_recruitment_active, tshirt_deadline,
        sub_departments, events, tshirt_sizes, custom_field_mappings
       FROM event_configs WHERE department = $1`,
      [department]
    );

    if (!config) {
      return Response.json({ success: false, error: '설정을 찾을 수 없습니다' }, { status: 404 });
    }

    return Response.json({
      success: true,
      data: {
        ...config,
        camp_start_date: config.camp_start_date || null,
        campType: config.camp_type || 'continuous',
        campDuration: Number(config.camp_duration || 3),
        posterUrl: config.poster_url || '',
        isStepRecruitmentActive: config.is_step_recruitment_active || false,
        tshirtDeadline: config.tshirt_deadline || null,
        subDepartments: safeParse(config.sub_departments),
        events: safeParse(config.events),
        tshirtSizes: safeParse(config.tshirt_sizes),
        customFieldMappings: safeParse(config.custom_field_mappings),
        campSchedule: safeParse(config.camp_schedule)
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
      title, eventType, subtitle, scripture, primaryColor, bgColor,
      subDepartments, events, tshirtSizes, customFieldMappings,
      campStartDate, campSchedule, campType, campDuration, posterUrl,
      isStepRecruitmentActive, tshirtDeadline
    } = body;

    const validatedStartDate = campStartDate && campStartDate.trim() !== '' ? campStartDate : null;
    const validatedTshirtDeadline = tshirtDeadline && tshirtDeadline.trim() !== '' ? tshirtDeadline : null;

    // 기존 설정 조회
    let config = await queryOne(
      `SELECT id FROM event_configs WHERE department = $1`,
      [department]
    );

    if (!config) {
      // 신규 생성
        config = await queryOne(
          `INSERT INTO event_configs (
            department, title, event_type, subtitle, scripture,
            primary_color, bg_color, sub_departments, events,
            tshirt_sizes, custom_field_mappings, camp_start_date, camp_schedule,
            camp_type, camp_duration, poster_url, is_step_recruitment_active, tshirt_deadline
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id`,
          [
            department,
            title || null,
            eventType || null,
            subtitle || null,
            scripture || null,
            primaryColor || null,
            bgColor || null,
            JSON.stringify(subDepartments || []),
            JSON.stringify(events || []),
            JSON.stringify(tshirtSizes || []),
            JSON.stringify(customFieldMappings || []),
            validatedStartDate,
            JSON.stringify(campSchedule || []),
            campType || 'continuous',
            Number(campDuration || 3),
            posterUrl || null,
            isStepRecruitmentActive || false,
            validatedTshirtDeadline
          ]
        );
    } else {
      // 기존 업데이트
      await query(
        `UPDATE event_configs SET
          title = $1, event_type = $2, subtitle = $3, scripture = $4,
          primary_color = $5, bg_color = $6,
          sub_departments = $7, events = $8,
          tshirt_sizes = $9, custom_field_mappings = $10,
          camp_start_date = $11,
          camp_schedule = $12,
          camp_type = $13,
          camp_duration = $14,
          poster_url = $15,
          is_step_recruitment_active = $16,
          tshirt_deadline = $17,
          updated_at = NOW()
         WHERE department = $18`,
        [
          title || null,
          eventType || null,
          subtitle || null,
          scripture || null,
          primaryColor || null,
          bgColor || null,
          JSON.stringify(subDepartments || []),
          JSON.stringify(events || []),
          JSON.stringify(tshirtSizes || []),
          JSON.stringify(customFieldMappings || []),
          validatedStartDate,
          JSON.stringify(campSchedule || []),
          campType || 'continuous',
          Number(campDuration || 3),
          posterUrl || null,
          isStepRecruitmentActive || false,
          validatedTshirtDeadline,
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
