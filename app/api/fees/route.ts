import { queryOne, query } from '@/lib/db';

/**
 * GET /api/fees
 * 요금 설정 조회
 */
export async function GET(request: Request) {
  try {
    const data = await queryOne(
      `SELECT * FROM fees_config LIMIT 1`
    );

    return Response.json({ success: true, data });
  } catch (error) {
    console.error('GET /fees 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/fees
 * 요금 설정 업데이트 (관리자)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { kinder, kids, teens, parentWaterpark } = body;

    // 기존 요금 설정이 있는지 확인
    let feesConfig = await queryOne(`SELECT id FROM fees_config LIMIT 1`);

    if (!feesConfig) {
      // 신규 생성
      feesConfig = await queryOne(
        `INSERT INTO fees_config (kinder, kids, teens, parent_waterpark)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [kinder || 10000, kids || 15000, teens || 20000, parentWaterpark || 30000]
      );
    } else {
      // 기존 업데이트
      feesConfig = await queryOne(
        `UPDATE fees_config SET
          kinder = COALESCE($1, kinder),
          kids = COALESCE($2, kids),
          teens = COALESCE($3, teens),
          parent_waterpark = COALESCE($4, parent_waterpark),
          updated_at = NOW()
         WHERE id = $5 RETURNING *`,
        [kinder, kids, teens, parentWaterpark, feesConfig.id]
      );
    }

    return Response.json({ success: true, data: feesConfig });
  } catch (error) {
    console.error('POST /fees 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
