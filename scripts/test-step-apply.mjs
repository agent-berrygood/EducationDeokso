// /api/step-apply 초안 동작 검증 (임시 플래그 활성화 → 테스트 → 원복)
import { readFileSync } from 'fs';
import pg from 'pg';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const BASE = 'http://localhost:3000';

const results = [];
function log(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ` :: ${detail}` : ''}`);
}

async function post(body) {
  const res = await fetch(`${BASE}/api/step-apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

let createdId = null;
try {
  // 사전 상태 저장
  const before = (await pool.query(
    `SELECT department, is_step_recruitment_active FROM event_configs ORDER BY department`
  )).rows;
  console.log('flags before:', JSON.stringify(before));

  // 1. 모집 비활성 부서 신청 → 400
  const r1 = await post({ name: '테스트', phone: '010-1111-2222', entries: [{ department: 'kinder', attendanceType: 'full', attendedSessions: [] }] });
  log('비활성 부서 신청 거부 (400)', r1.status === 400, r1.json.error);

  // 임시 활성화: kids, teens
  await pool.query(`UPDATE event_configs SET is_step_recruitment_active = TRUE WHERE department IN ('kids','teens')`);

  // 2. 복수 캠프 신청 (kids 전체 / teens 부분) → 201
  const r2 = await post({
    name: '스텝테스트', phone: '010-1234-5678', note: '찬양팀 희망',
    entries: [
      { department: 'kids', attendanceType: 'full', attendedSessions: [] },
      { department: 'teens', attendanceType: 'partial', attendedSessions: ['1-morning', '1-afternoon', '2-evening'] },
    ],
  });
  log('복수 캠프 신청 성공 (201)', r2.status === 201 && r2.json.success, JSON.stringify(r2.json));
  createdId = r2.json?.data?.id;

  // 3. 부분 참석인데 세션 미선택 → 400
  const r3 = await post({ name: '테스트', phone: '010-1111-2222', entries: [{ department: 'kids', attendanceType: 'partial', attendedSessions: [] }] });
  log('부분 참석 세션 미선택 거부 (400)', r3.status === 400, r3.json.error);

  // 4. 잘못된 세션 키 → 400
  const r4 = await post({ name: '테스트', phone: '010-1111-2222', entries: [{ department: 'kids', attendanceType: 'partial', attendedSessions: ['99-morning'] }] });
  log('허용 일차 초과 세션 거부 (400)', r4.status === 400, r4.json.error);

  // 5. GET 목록 조회
  const gres = await fetch(`${BASE}/api/step-apply?department=teens`);
  const gjson = await gres.json();
  const found = gjson.data?.find((a) => a.id === createdId);
  log('GET 목록 조회 (teens 필터)', gres.status === 200 && !!found,
    found ? `entries=${JSON.stringify(found.entries)}` : 'not found');
} catch (err) {
  console.error('TEST ERROR:', err.message);
} finally {
  // 정리: 테스트 데이터 삭제 + 플래그 원복
  if (createdId) {
    await pool.query(`DELETE FROM staff_applications WHERE id = $1`, [createdId]);
    console.log('test row deleted');
  }
  await pool.query(`UPDATE event_configs SET is_step_recruitment_active = FALSE WHERE department IN ('kids','teens')`);
  const after = (await pool.query(
    `SELECT department, is_step_recruitment_active FROM event_configs ORDER BY department`
  )).rows;
  console.log('flags after :', JSON.stringify(after));
  await pool.end();
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}
