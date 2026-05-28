import { queryOne } from '@/lib/db';

/**
 * GET /api/poster/[dept]
 * 부서 포스터 이미지 전용 엔드포인트.
 * 응답에 캐시 헤더를 적용하여 부서 변경 시 반복 다운로드를 회피한다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dept: string }> }
) {
  let department = '';
  try {
    const { dept } = await params;
    department = dept;

    const row = await queryOne(
      `SELECT poster_url FROM event_configs WHERE department = $1`,
      [department]
    );

    if (!row || !row.poster_url) {
      return Response.json({ success: true, data: { posterUrl: null } }, {
        headers: { 'Cache-Control': 'public, max-age=60' },
      });
    }

    return Response.json(
      { success: true, data: { posterUrl: row.poster_url } },
      { headers: { 'Cache-Control': 'public, max-age=3600' } }
    );
  } catch (error) {
    console.error(`GET /poster/${department} 오류:`, error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
