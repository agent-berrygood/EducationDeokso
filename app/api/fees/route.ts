import { queryOne } from '@/lib/db';

/**
 * GET /api/fees
 * 글로벌 요금 및 입금 계좌 조회
 */
export async function GET() {
  try {
    const data = await queryOne(`SELECT * FROM fees_config LIMIT 1`);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('GET /fees 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/fees
 * 글로벌 요금 및 입금 계좌 업데이트 (관리자)
 * - 부서별 회비: kinder / kids / teens
 * - 워터풀선데이: childWaterpark / parentWaterpark
 * - 입금 계좌: kinderAccount / kidsAccount / teensAccount / waterparkAccount
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      kinder,
      kids,
      teens,
      childWaterpark,
      parentWaterpark,
      kinderAccount,
      kidsAccount,
      teensAccount,
      waterparkAccount,
    } = body;

    const toNum = (v: any) => (v === undefined || v === null || v === '' ? null : Number(v));

    const existing = await queryOne(`SELECT id FROM fees_config LIMIT 1`);

    let saved;
    if (!existing) {
      saved = await queryOne(
        `INSERT INTO fees_config (
            kinder, kids, teens, child_waterpark, parent_waterpark,
            kinder_account, kids_account, teens_account, waterpark_account
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          toNum(kinder) ?? 0,
          toNum(kids) ?? 0,
          toNum(teens) ?? 0,
          toNum(childWaterpark) ?? 0,
          toNum(parentWaterpark) ?? 0,
          kinderAccount ?? null,
          kidsAccount ?? null,
          teensAccount ?? null,
          waterparkAccount ?? null,
        ]
      );
    } else {
      saved = await queryOne(
        `UPDATE fees_config SET
            kinder = COALESCE($1, kinder),
            kids = COALESCE($2, kids),
            teens = COALESCE($3, teens),
            child_waterpark = COALESCE($4, child_waterpark),
            parent_waterpark = COALESCE($5, parent_waterpark),
            kinder_account = COALESCE($6, kinder_account),
            kids_account = COALESCE($7, kids_account),
            teens_account = COALESCE($8, teens_account),
            waterpark_account = COALESCE($9, waterpark_account),
            updated_at = NOW()
          WHERE id = $10 RETURNING *`,
        [
          toNum(kinder),
          toNum(kids),
          toNum(teens),
          toNum(childWaterpark),
          toNum(parentWaterpark),
          kinderAccount,
          kidsAccount,
          teensAccount,
          waterparkAccount,
          existing.id,
        ]
      );
    }

    return Response.json({ success: true, data: saved });
  } catch (error) {
    console.error('POST /fees 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
