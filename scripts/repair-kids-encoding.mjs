// kids 행 mojibake 복구: UTF-8 bytes가 Latin-1로 잘못 디코딩된 문자열을 역변환
import { readFileSync } from 'fs';
import pg from 'pg';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// mojibake 여부: Latin-1 재인코딩 → UTF-8 디코딩이 유효한 한글을 만들면 mojibake였던 것
function unmojibake(s) {
  if (typeof s !== 'string' || !/[-ÿ]/.test(s)) return s; // ASCII는 그대로
  const reversed = Buffer.from(s, 'latin1').toString('utf8');
  // 역변환 결과에 U+FFFD(복구 불가 바이트)가 있으면 원본 유지
  if (reversed.includes('�')) return s;
  return reversed;
}

function deepFix(v) {
  if (typeof v === 'string') return unmojibake(v);
  if (Array.isArray(v)) return v.map(deepFix);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[unmojibake(k)] = deepFix(val);
    return out;
  }
  return v;
}

const dryRun = !process.argv.includes('--apply');

const row = (await pool.query(`SELECT * FROM event_configs WHERE department = 'kids'`)).rows[0];
if (!row) { console.error('kids row not found'); process.exit(1); }

const textCols = ['title', 'event_type', 'subtitle', 'scripture', 'camp_type'];
const jsonbCols = ['sub_departments', 'events', 'tshirt_sizes', 'custom_field_mappings', 'camp_schedule'];

const updates = {};
for (const c of textCols) {
  const fixed = unmojibake(row[c]);
  if (fixed !== row[c]) { updates[c] = fixed; console.log(`[text] ${c}:\n  before: ${row[c]}\n  after : ${fixed}`); }
}
for (const c of jsonbCols) {
  const fixed = deepFix(row[c]);
  const before = JSON.stringify(row[c]);
  const after = JSON.stringify(fixed);
  if (before !== after) { updates[c] = after; console.log(`[jsonb] ${c}:\n  before: ${before}\n  after : ${after}`); }
}

if (Object.keys(updates).length === 0) {
  console.log('No mojibake detected — nothing to fix.');
} else if (dryRun) {
  console.log(`\n[DRY RUN] ${Object.keys(updates).length} columns would be updated. Run with --apply to fix.`);
} else {
  const cols = Object.keys(updates);
  const set = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
  await pool.query(
    `UPDATE event_configs SET ${set}, updated_at = NOW() WHERE department = 'kids'`,
    cols.map((c) => updates[c])
  );
  console.log(`\n[APPLIED] ${cols.length} columns updated: ${cols.join(', ')}`);
}

await pool.end();
