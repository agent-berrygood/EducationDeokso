import { queryOne, queryMany, query } from '@/lib/db';

/**
 * GET /api/applications
 * 신청 목록 조회 (부서별, 페이징, 정렬)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'DESC';

    // 신청서 + 자녀들 + 결제상태 한번에 조회
    let sql = `
      SELECT
        a.id, a.parent_name, a.parent_phone, a.depositor_name,
        a.grand_total, a.created_at,
        json_agg(
          json_build_object(
            'id', ac.id,
            'name', ac.name,
            'birthDate', ac.birth_date,
            'department', ac.department,
            'subDepartment', ac.sub_department,
            'tshirtSize', ac.tshirt_size,
            'allergies', ac.allergies,
            'customAllergy', ac.custom_allergy,
            'attendsWaterpark', ac.attends_waterpark,
            'custom1', ac.custom_1,
            'custom2', ac.custom_2,
            'custom3', ac.custom_3,
            'custom4', ac.custom_4,
            'custom5', ac.custom_5,
            'custom6', ac.custom_6,
            'custom7', ac.custom_7,
            'custom8', ac.custom_8,
            'custom9', ac.custom_9,
            'custom10', ac.custom_10,
            'custom11', ac.custom_11,
            'custom12', ac.custom_12,
            'custom13', ac.custom_13,
            'custom14', ac.custom_14,
            'custom15', ac.custom_15,
            'custom16', ac.custom_16,
            'custom17', ac.custom_17,
            'custom18', ac.custom_18,
            'custom19', ac.custom_19,
            'custom20', ac.custom_20
          )
        ) FILTER (WHERE ac.id IS NOT NULL) AS children,
        ps.id AS payment_id,
        ps.kinder_paid, ps.kids_paid, ps.teens_paid, ps.waterpark_paid
      FROM applications a
      LEFT JOIN application_children ac ON a.id = ac.application_id
      LEFT JOIN payment_status ps ON a.id = ps.application_id
    `;

    // 부서별 필터: 해당 부서 자녀가 있는 신청서만 정확히 반환
    if (department) {
      sql += ` WHERE ac.department = $1`;
    }

    sql += ` GROUP BY a.id, ps.id`;
    sql += ` ORDER BY a.${sortBy === 'createdAt' ? 'created_at' : 'parent_name'} ${sortOrder}`;
    sql += ` LIMIT $${department ? 2 : 1} OFFSET $${department ? 3 : 2}`;

    const params = department ? [department, limit, offset] : [limit, offset];
    const result = await query(sql, params);

    return Response.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('GET /applications 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/applications
 * 신청서 생성 (부모 + 자녀들 한번에)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      parentName,
      parentPhone,
      depositorName,
      children,
      grandTotal
    } = body;

    // 신청서 생성
    const applicationResult = await queryOne(
      `INSERT INTO applications (parent_name, parent_phone, depositor_name, grand_total)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [parentName, parentPhone, depositorName, grandTotal || 0]
    );

    const applicationId = applicationResult.id;

    // 자녀들 추가
    for (const child of children) {
      await query(
        `INSERT INTO application_children (
          application_id, name, birth_date, department, sub_department,
          tshirt_size, allergies, custom_allergy, attends_waterpark,
          custom_1, custom_2, custom_3, custom_4, custom_5, custom_6, custom_7, custom_8, custom_9, custom_10,
          custom_11, custom_12, custom_13, custom_14, custom_15, custom_16, custom_17, custom_18, custom_19, custom_20
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)`,
        [
          applicationId,
          child.name,
          child.birthDate,
          child.department,
          child.subDepartment,
          child.tshirtSize || null,
          child.allergies || null,
          child.customAllergy || null,
          child.attendsWaterpark || false,
          child.custom1 || null, child.custom2 || null, child.custom3 || null, child.custom4 || null, child.custom5 || null,
          child.custom6 || null, child.custom7 || null, child.custom8 || null, child.custom9 || null, child.custom10 || null,
          child.custom11 || null, child.custom12 || null, child.custom13 || null, child.custom14 || null, child.custom15 || null,
          child.custom16 || null, child.custom17 || null, child.custom18 || null, child.custom19 || null, child.custom20 || null
        ]
      );
    }

    // 결제 상태 생성
    await query(
      `INSERT INTO payment_status (application_id) VALUES ($1)`,
      [applicationId]
    );

    return Response.json({ success: true, data: { id: applicationId } }, { status: 201 });
  } catch (error) {
    console.error('POST /applications 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * DELETE /api/applications
 * 신청서 삭제
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ success: false, error: 'ID 필수' }, { status: 400 });
    }

    // CASCADE DELETE 자동 처리 (FK 설정됨)
    await query(`DELETE FROM applications WHERE id = $1`, [id]);

    return Response.json({ success: true, message: '신청서 삭제 완료' });
  } catch (error) {
    console.error('DELETE /applications 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
