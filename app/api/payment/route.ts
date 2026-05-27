import { queryOne, queryMany, query } from '@/lib/db';

/**
 * GET /api/payment
 * 결제 상태 조회
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId');

    if (!applicationId) {
      return Response.json({ success: false, error: 'applicationId 필수' }, { status: 400 });
    }

    const data = await queryOne(
      `SELECT * FROM payment_status WHERE application_id = $1`,
      [applicationId]
    );

    return Response.json({ success: true, data });
  } catch (error) {
    console.error('GET /payment 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * PUT /api/payment
 * 결제 상태 업데이트 (관리자)
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { applicationId, kinderPaid, kidsPaid, teensPaid, waterparkPaid } = body;

    const result = await queryOne(
      `UPDATE payment_status SET
        kinder_paid = COALESCE($1, kinder_paid),
        kids_paid = COALESCE($2, kids_paid),
        teens_paid = COALESCE($3, teens_paid),
        waterpark_paid = COALESCE($4, waterpark_paid),
        updated_at = NOW()
       WHERE application_id = $5 RETURNING *`,
      [kinderPaid, kidsPaid, teensPaid, waterparkPaid, applicationId]
    );

    return Response.json({ success: true, data: result });
  } catch (error) {
    console.error('PUT /payment 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
