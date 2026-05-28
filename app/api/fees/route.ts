import { queryOne, query } from '@/lib/db';

/**
 * 신규 컬럼(자녀 워터풀 + 계좌 4개)이 운영 DB에 없을 경우를 대비해
 * GET/POST 진입 시 항상 ALTER TABLE IF NOT EXISTS를 보장한다.
 * 이미 적용된 환경에서는 noop이므로 안전하다.
 */
async function ensureFeesSchema() {
  await query(`CREATE TABLE IF NOT EXISTS fees_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kinder DECIMAL(10, 2) DEFAULT 0,
    kids DECIMAL(10, 2) DEFAULT 0,
    teens DECIMAL(10, 2) DEFAULT 0,
    parent_waterpark DECIMAL(10, 2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await query(`ALTER TABLE fees_config ADD COLUMN IF NOT EXISTS child_waterpark DECIMAL(10, 2) DEFAULT 0`);
  await query(`ALTER TABLE fees_config ADD COLUMN IF NOT EXISTS kinder_account VARCHAR(120)`);
  await query(`ALTER TABLE fees_config ADD COLUMN IF NOT EXISTS kids_account VARCHAR(120)`);
  await query(`ALTER TABLE fees_config ADD COLUMN IF NOT EXISTS teens_account VARCHAR(120)`);
  await query(`ALTER TABLE fees_config ADD COLUMN IF NOT EXISTS waterpark_account VARCHAR(120)`);
}

/**
 * GET /api/fees
 * 글로벌 요금 및 입금 계좌 조회
 */
export async function GET() {
  try {
    await ensureFeesSchema();
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
 */
export async function POST(request: Request) {
  try {
    await ensureFeesSchema();
    const body = await request.json();
    const {
      kinder, kids, teens,
      childWaterpark, parentWaterpark,
      kinderAccount, kidsAccount, teensAccount, waterparkAccount,
    } = body;

    // 빈 문자열은 null로 변환하여 COALESCE가 기존값을 유지하도록 처리
    const toNum = (v: any) => (v === undefined || v === null || v === '' ? null : Number(v));
    const toText = (v: any) => {
      if (v === undefined || v === null) return null;
      if (typeof v !== 'string') return String(v);
      const trimmed = v.trim();
      return trimmed === '' ? null : trimmed;
    };

    // INSERT 전용 변환: 명시적으로 비워두려면 빈 문자열, 미입력은 null
    const accInsert = (v: any) => {
      if (v === undefined || v === null) return null;
      if (typeof v !== 'string') return String(v);
      return v.trim();
    };

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
          accInsert(kinderAccount),
          accInsert(kidsAccount),
          accInsert(teensAccount),
          accInsert(waterparkAccount),
        ]
      );
    } else {
      // POST는 부분 업데이트가 아니라 명시 저장으로 처리:
      //   - 숫자: 입력값 그대로 적용 (빈 칸은 0 처리하지 않고 기존값 유지)
      //   - 계좌: 빈 문자열로 비우려는 경우와 미입력 구분 어렵기 때문에
      //           프런트에서 항상 trim된 값을 보내는 것을 신뢰하고 그대로 저장
      saved = await queryOne(
        `UPDATE fees_config SET
            kinder           = COALESCE($1, kinder),
            kids             = COALESCE($2, kids),
            teens            = COALESCE($3, teens),
            child_waterpark  = COALESCE($4, child_waterpark),
            parent_waterpark = COALESCE($5, parent_waterpark),
            kinder_account   = $6,
            kids_account     = $7,
            teens_account    = $8,
            waterpark_account= $9,
            updated_at = NOW()
          WHERE id = $10 RETURNING *`,
        [
          toNum(kinder),
          toNum(kids),
          toNum(teens),
          toNum(childWaterpark),
          toNum(parentWaterpark),
          toText(kinderAccount),
          toText(kidsAccount),
          toText(teensAccount),
          toText(waterparkAccount),
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
