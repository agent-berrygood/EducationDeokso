import { queryMany, queryOne } from '@/lib/db';
import ExcelJS from 'exceljs';

/**
 * GET /api/export/xlsx
 * 신청 현황을 Excel로 추출
 * Query: ?department=kids&format=xlsx
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const format = searchParams.get('format') || 'xlsx';

    if (!department) {
      return Response.json({ success: false, error: 'department 필수' }, { status: 400 });
    }

    // 부서 설정 조회 (헤더 정보 + 커스텀 필드)
    const config = await queryOne(
      `SELECT custom_field_mappings FROM event_configs WHERE department = $1`,
      [department]
    );

    const customFields = config ? JSON.parse(config.custom_field_mappings || '[]') : [];

    // 신청 데이터 조회
    const applications = await queryMany(
      `SELECT
        a.id, a.parent_name, a.parent_phone, a.depositor_name, a.grand_total, a.created_at,
        ac.id AS child_id, ac.name, ac.birth_date, ac.sub_department,
        ac.tshirt_size, ac.allergies, ac.custom_allergy, ac.attends_waterpark,
        ac.custom_1, ac.custom_2, ac.custom_3, ac.custom_4, ac.custom_5,
        ac.custom_6, ac.custom_7, ac.custom_8, ac.custom_9, ac.custom_10,
        ac.custom_11, ac.custom_12, ac.custom_13, ac.custom_14, ac.custom_15,
        ac.custom_16, ac.custom_17, ac.custom_18, ac.custom_19, ac.custom_20,
        ps.kinder_paid, ps.kids_paid, ps.teens_paid, ps.waterpark_paid
       FROM applications a
       LEFT JOIN application_children ac ON a.id = ac.application_id AND ac.department = $1
       LEFT JOIN payment_status ps ON a.id = ps.application_id
       WHERE ac.id IS NOT NULL OR a.id IN (
         SELECT DISTINCT application_id FROM application_children WHERE department = $1
       )
       ORDER BY a.created_at DESC`,
      [department]
    );

    // Excel 생성
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('신청현황');

    // 헤더 정의
    const headers = [
      '부모이름',
      '부모폰',
      '입금자',
      '자녀이름',
      '생년월일',
      '하위부서',
      '셔츠사이즈',
      '알러지',
      '물놀이',
      ...customFields.map((f: any) => f.label),
      '결제상태',
      '신청날짜'
    ];

    worksheet.addRow(headers);

    // 데이터 행
    applications.forEach((app: any) => {
      const row = [
        app.parent_name,
        app.parent_phone,
        app.depositor_name,
        app.name,
        app.birth_date,
        app.sub_department,
        app.tshirt_size,
        app.allergies,
        app.attends_waterpark ? 'Y' : 'N',
        // 커스텀 필드 순서대로
        ...customFields.map((f: any) => {
          const fieldNum = f.columnIndex;
          return app[`custom_${fieldNum}`] || '';
        }),
        // 결제상태
        [
          app.kinder_paid ? '✓' : '',
          app.kids_paid ? '✓' : '',
          app.teens_paid ? '✓' : '',
          app.waterpark_paid ? '✓' : ''
        ].filter(x => x).join('/') || '미결제',
        app.created_at
      ];
      worksheet.addRow(row);
    });

    // 셀 너비 자동 조정
    worksheet.columns.forEach(column => {
      column.width = 15;
    });

    // Excel 바이너리로 변환
    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="신청현황_${department}_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });
  } catch (error) {
    console.error('GET /export 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
