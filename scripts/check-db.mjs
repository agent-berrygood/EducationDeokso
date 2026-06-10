// 읽기 전용 DB 상태 점검 스크립트
import { readFileSync } from 'fs';
import pg from 'pg';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: m[1].trim(),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  const t0 = Date.now();
  const ping = await pool.query('SELECT NOW() as now, current_database() as db, version() as ver');
  console.log(`[OK] Connected in ${Date.now() - t0}ms`);
  console.log('  db:', ping.rows[0].db, '| time:', ping.rows[0].now);

  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  );
  console.log('\n[Tables]', tables.rows.map(r => r.table_name).join(', ') || '(none)');

  const hasMigrations = tables.rows.some(r => r.table_name === 'schema_migrations');
  if (hasMigrations) {
    const mig = await pool.query('SELECT version, description, applied_at FROM schema_migrations ORDER BY version');
    console.log('\n[Migrations applied]');
    for (const r of mig.rows) console.log(`  v${r.version}: ${r.description} (${r.applied_at?.toISOString?.() ?? r.applied_at})`);
  } else {
    console.log('\n[Migrations] schema_migrations table MISSING');
  }

  const hasEventConfigs = tables.rows.some(r => r.table_name === 'event_configs');
  if (hasEventConfigs) {
    const cols = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='event_configs' ORDER BY ordinal_position`
    );
    console.log('\n[event_configs columns]');
    for (const r of cols.rows) console.log(`  ${r.column_name} (${r.data_type})`);

    const rows = await pool.query(
      `SELECT department, title, event_type, updated_at, length(poster_url) as poster_len FROM event_configs ORDER BY department`
    );
    console.log('\n[event_configs rows]');
    for (const r of rows.rows) console.log(`  ${r.department}: title="${r.title}", type="${r.event_type}", poster_len=${r.poster_len ?? 0}, updated_at=${r.updated_at?.toISOString?.() ?? r.updated_at}`);
  } else {
    console.log('\n[event_configs] table MISSING');
  }
} catch (err) {
  console.error('[FAIL]', err.message);
  if (err.code) console.error('  code:', err.code);
} finally {
  await pool.end();
}
