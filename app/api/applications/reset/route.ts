import pool from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import type { DepartmentId } from '@/lib/types';

const VALID_DEPARTMENTS: DepartmentId[] = ['kinder', 'kids', 'teens'];

/**
 * POST /api/applications/reset
 * 특정 대부서의 신청 자녀 데이터를 일괄 삭제(초기화)한다.
 *
 * 안전장치:
 *  - 어드민 세션 필수 + 해당 부서 접근 권한 확인
 *  - body.confirmationPhrase 가 body.department 와 정확히 일치해야 실행 (오작동 방지)
 *  - 자녀(application_children) 단위로만 삭제 → 다른 부서 형제자매 데이터 보존
 *  - 자녀가 모두 사라진 신청서(applications)만 정리
 *  - event_attendance는 FK ON DELETE CASCADE로 자동 정리됨
 *  - 별도 라우트로 분리해 단건 삭제(?id=)와 혼동/오작동 불가
 */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const department = body?.department;
  const confirmationPhrase = body?.confirmationPhrase;

  if (!department || !VALID_DEPARTMENTS.includes(department)) {
    return Response.json({ success: false, error: '유효하지 않은 부서입니다.' }, { status: 400 });
  }

  // 세션의 허용 부서에 포함되는지 확인 (현재는 전 부서 허용이지만 방어적으로 검증)
  if (!auth.session.allowed_departments?.includes(department)) {
    return Response.json({ success: false, error: `${department} 부서 접근 권한이 없습니다.` }, { status: 403 });
  }

  if (confirmationPhrase !== department) {
    return Response.json(
      { success: false, error: '확인 문구가 부서명과 일치하지 않습니다.' },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. 해당 부서 자녀 행 삭제 (event_attendance는 CASCADE로 자동 삭제)
    const childrenResult = await client.query(
      `DELETE FROM application_children WHERE department = $1 RETURNING id`,
      [department]
    );

    // 2. 자녀가 하나도 남지 않은 신청서만 정리 (다른 부서 형제자매가 있으면 보존)
    const appsResult = await client.query(
      `DELETE FROM applications
        WHERE id NOT IN (SELECT DISTINCT application_id FROM application_children)
        RETURNING id`
    );

    await client.query('COMMIT');

    return Response.json({
      success: true,
      message: `${department} 부서 신청 데이터를 초기화했습니다.`,
      data: {
        childrenRemoved: childrenResult.rowCount ?? 0,
        applicationsRemoved: appsResult.rowCount ?? 0,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`POST /applications/reset (${department}) 오류:`, error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  } finally {
    client.release();
  }
}
