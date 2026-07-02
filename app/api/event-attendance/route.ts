import { queryOne, queryMany, query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

/**
 * GET /api/event-attendance
 * 행사 참석 현황 조회 (관리자 전용)
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');
    const eventId = searchParams.get('eventId');

    let sql = 'SELECT * FROM event_attendance WHERE 1=1';
    const params: any[] = [];

    if (childId) {
      sql += ` AND child_id = $${params.length + 1}`;
      params.push(childId);
    }
    if (eventId) {
      sql += ` AND event_id = $${params.length + 1}`;
      params.push(eventId);
    }

    const data = await queryMany(sql, params);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('GET /event-attendance 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/event-attendance
 * 행사 참석 현황 추가
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { childId, eventId, eventTitle, attendanceType, partialDates, notes } = body;

    const result = await queryOne(
      `INSERT INTO event_attendance (
        child_id, event_id, event_title, attendance_type, partial_dates, notes
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [childId, eventId, eventTitle, attendanceType, JSON.stringify(partialDates || []), notes || null]
    );

    return Response.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('POST /event-attendance 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * PUT /api/event-attendance
 * 행사 참석 현황 수정 (관리자)
 */
export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { id, attendanceType, partialDates, notes } = body;

    const result = await queryOne(
      `UPDATE event_attendance SET
        attendance_type = $1, partial_dates = $2, notes = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [attendanceType, JSON.stringify(partialDates || []), notes || null, id]
    );

    return Response.json({ success: true, data: result });
  } catch (error) {
    console.error('PUT /event-attendance 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * DELETE /api/event-attendance
 * 행사 참석 현황 삭제
 */
export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    await query(`DELETE FROM event_attendance WHERE id = $1`, [id]);
    return Response.json({ success: true, message: '삭제 완료' });
  } catch (error) {
    console.error('DELETE /event-attendance 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
