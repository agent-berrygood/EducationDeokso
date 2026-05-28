import { queryMany, queryOne } from '@/lib/db';

/**
 * GET /api/debug/fees
 * fees_config 테이블 상태 + 마이그레이션 적용 이력 점검.
 * 운영 진단용. 운영 안정화 후 제거 가능.
 */
export async function GET() {
  try {
    const fees = await queryOne(`SELECT * FROM fees_config LIMIT 1`);

    // 스키마(컬럼 존재 여부)
    const columns = await queryMany(
      `SELECT column_name, data_type
         FROM information_schema.columns
        WHERE table_name = 'fees_config'
        ORDER BY ordinal_position`
    );

    const presentColumns = new Set(columns.map((c: any) => c.column_name));
    const required = [
      'kinder', 'kids', 'teens',
      'child_waterpark', 'parent_waterpark',
      'kinder_account', 'kids_account', 'teens_account', 'waterpark_account',
    ];
    const missingColumns = required.filter((c) => !presentColumns.has(c));

    // 마이그레이션 이력
    let migrations: any[] = [];
    try {
      migrations = await queryMany(`SELECT version, description, applied_at FROM schema_migrations ORDER BY version`);
    } catch {
      // schema_migrations 테이블 자체가 없는 경우
    }

    return Response.json({
      success: true,
      data: {
        feesRow: fees,
        feesRowExists: !!fees,
        columnsPresent: Array.from(presentColumns),
        missingColumns,
        migrationsApplied: migrations.map((m: any) => m.version),
        migrations,
      },
    });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
