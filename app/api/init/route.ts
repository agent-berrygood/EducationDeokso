import { initializeDatabase } from '@/lib/db';

/**
 * GET /api/init
 * 데이터베이스 테이블 초기화
 * 한 번만 실행하면 됨 (멱등성)
 */
export async function GET(request: Request) {
  try {
    console.log('🔄 데이터베이스 초기화 시작...');
    await initializeDatabase();

    return Response.json(
      {
        success: true,
        message: '✅ 데이터베이스 테이블 생성 완료!'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ 초기화 오류:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}
