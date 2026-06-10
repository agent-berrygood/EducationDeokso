// 워터풀선데이 기능 검증: config round-trip(한글 보존), 가족단위 명단 API, 엑셀 추출
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

let testAppId = null;
try {
  // ── 1. config GET에 새 필드 존재 ──
  const g1 = await (await fetch(`${BASE}/api/config/teens`)).json();
  log('config GET에 isWaterparkActive/waterparkInfo 포함',
    g1.success && typeof g1.data.isWaterparkActive === 'boolean' && typeof g1.data.waterparkInfo === 'object',
    `active=${g1.data.isWaterparkActive}, info=${JSON.stringify(g1.data.waterparkInfo)}`);

  // ── 2. config POST round-trip (teens 커스텀 일정, 한글 보존) ──
  const d = g1.data;
  const origBody = {
    title: d.title, eventType: d.event_type, subtitle: d.subtitle, scripture: d.scripture,
    primaryColor: d.primary_color, bgColor: d.bg_color,
    tshirtSizes: d.tshirtSizes, customFieldMappings: d.customFieldMappings,
    subDepartments: d.subDepartments, campStartDate: d.camp_start_date,
    campSchedule: d.campSchedule, campType: d.campType, campDuration: d.campDuration,
    posterUrl: d.posterUrl, events: d.events,
    isStepRecruitmentActive: d.isStepRecruitmentActive, tshirtDeadline: d.tshirtDeadline,
  };
  const customInfo = {
    title: '나우틴즈 워터풀데이',
    date: '2026-08-15',
    time: '10:00 - 16:00',
    location: '청소년 수련원 야외풀',
    note: '나우틴즈는 본 캠프와 별도 일정으로 진행됩니다.',
  };
  const p1 = await fetch(`${BASE}/api/config/teens`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...origBody, isWaterparkActive: true, waterparkInfo: customInfo }),
  });
  const g2 = await (await fetch(`${BASE}/api/config/teens`)).json();
  const roundtripOk = p1.status === 200
    && g2.data.isWaterparkActive === true
    && g2.data.waterparkInfo.title === customInfo.title
    && g2.data.waterparkInfo.note === customInfo.note
    && g2.data.title === d.title; // 기존 한글 필드 보존
  log('config POST round-trip (틴즈 커스텀 일정, 한글 보존)', roundtripOk,
    JSON.stringify(g2.data.waterparkInfo));

  // ── 3. 비활성화 토글 동작 ──
  const p2 = await fetch(`${BASE}/api/config/teens`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...origBody, isWaterparkActive: false, waterparkInfo: customInfo }),
  });
  const g3 = await (await fetch(`${BASE}/api/config/teens`)).json();
  log('워터풀 비활성화 토글', p2.status === 200 && g3.data.isWaterparkActive === false,
    `active=${g3.data.isWaterparkActive}`);
  // 원복: 활성(디폴트) + 커스텀 정보 비움
  await fetch(`${BASE}/api/config/teens`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...origBody, isWaterparkActive: true, waterparkInfo: {} }),
  });

  // ── 4. 테스트 가족 신청 생성 (워터풀 참석 자녀 2명: kids/teens + 보호자 2명) ──
  const appRes = await fetch(`${BASE}/api/applications`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parentName: '워터풀테스트부모',
      parentPhone: '010-9999-0001',
      depositorName: '워터풀테스트부모',
      grandTotal: 0,
      waterfallParents: [
        { name: '워터풀테스트부모', relation: '모', phone: '010-9999-0001' },
        { name: '워터풀테스트조모', relation: '조모', phone: '010-9999-0002' },
      ],
      children: [
        { name: '워터풀테스트자녀1', birthDate: '2017-05-01', gender: 'male', department: 'kids', subDepartment: 'junior', attendsWaterpark: true, attendedSessions: [] },
        { name: '워터풀테스트자녀2', birthDate: '2011-03-01', gender: 'female', department: 'teens', subDepartment: 'middle', attendsWaterpark: true, attendedSessions: [] },
        { name: '워터풀테스트자녀3', birthDate: '2019-07-01', gender: 'male', department: 'kinder', subDepartment: 'infant', attendsWaterpark: false, attendedSessions: [] },
      ],
    }),
  });
  const appJson = await appRes.json();
  testAppId = appJson?.data?.id;
  log('테스트 가족 신청 생성', appRes.status === 201 && !!testAppId, `id=${testAppId}`);

  // ── 5. 워터풀 명단: 가족단위 그룹 확인 ──
  const w1 = await (await fetch(`${BASE}/api/waterpark/applicants`)).json();
  const fam = w1.data?.find((f) => f.id === testAppId);
  const famOk = !!fam && fam.parentCount === 2 && fam.childCount === 2
    && fam.children.every((c) => c.name !== '워터풀테스트자녀3'); // 미참석 자녀 제외
  log('가족단위 명단 (보호자 2 + 참석자녀 2, 미참석 제외)', famOk,
    fam ? `parents=${fam.parentCount}, children=${fam.children.map((c) => c.name).join(',')}` : 'family not found');

  // ── 6. 부서 필터: kids 필터 시 가족 포함 + 가족 내 teens 자녀도 함께 반환 ──
  const w2 = await (await fetch(`${BASE}/api/waterpark/applicants?department=kids`)).json();
  const fam2 = w2.data?.find((f) => f.id === testAppId);
  log('부서 필터 (kids) — 가족 전체 자녀 포함', !!fam2 && fam2.childCount === 2,
    fam2 ? `children=${fam2.children.map((c) => `${c.name}(${c.department})`).join(',')}` : 'not found');

  // ── 7. 부서 필터: kinder(참석 자녀 없음) 필터 시 이 가족 제외 ──
  const w3 = await (await fetch(`${BASE}/api/waterpark/applicants?department=kinder`)).json();
  const fam3 = w3.data?.find((f) => f.id === testAppId);
  log('부서 필터 (kinder) — 워터풀 참석자 없는 부서는 제외', !fam3, fam3 ? 'unexpectedly included' : 'correctly excluded');

  // ── 8. 엑셀 추출 ──
  const x1 = await fetch(`${BASE}/api/export/waterpark?department=kids`);
  const buf = await x1.arrayBuffer();
  log('엑셀 추출 (가족단위+개별명단)', x1.status === 200 && buf.byteLength > 1000,
    `status=${x1.status}, bytes=${buf.byteLength}, type=${x1.headers.get('content-type')?.slice(0, 40)}`);
} catch (err) {
  console.error('TEST ERROR:', err);
} finally {
  if (testAppId) {
    await pool.query(`DELETE FROM applications WHERE id = $1`, [testAppId]);
    console.log('test family deleted');
  }
  await pool.end();
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}
