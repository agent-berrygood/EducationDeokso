// 트랙(연합/분리) 기반 통합 테스트. kinder를 임시 split 운영 → 검증 → 원복.
import { readFileSync } from 'fs';
import pg from 'pg';

const url = readFileSync(new URL('../.env.local', import.meta.url), 'utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const BASE = 'http://localhost:3000';

const results = [];
const log = (name, pass, detail) => { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ` :: ${detail}` : ''}`); };
const getJson = async (u) => (await fetch(BASE + u)).json();
const post = async (u, body) => { const r = await fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json() }; };

const TRACK_KEY = 'track_test_yuchi';
let testAppId = null;
let mainSnapshot = null;

try {
  // 0. kinder main 설정 스냅샷 (원복용)
  const before = await getJson('/api/config/kinder');
  mainSnapshot = before.data;
  log('기본 GET 하위호환 (main + 트랙 필드 노출)',
    before.success && before.data.trackKey === 'main' && before.data.operatingMode === 'union',
    `trackKey=${before.data.trackKey}, mode=${before.data.operatingMode}, title="${before.data.title}"`);

  const mainBody = {
    title: mainSnapshot.title, eventType: mainSnapshot.event_type, subtitle: mainSnapshot.subtitle,
    scripture: mainSnapshot.scripture, primaryColor: mainSnapshot.primary_color, bgColor: mainSnapshot.bg_color,
    tshirtSizes: mainSnapshot.tshirtSizes, customFieldMappings: mainSnapshot.customFieldMappings,
    subDepartments: mainSnapshot.subDepartments, campStartDate: mainSnapshot.camp_start_date,
    campSchedule: mainSnapshot.campSchedule, campType: mainSnapshot.campType, campDuration: mainSnapshot.campDuration,
    posterUrl: mainSnapshot.posterUrl, events: mainSnapshot.events,
    isStepRecruitmentActive: mainSnapshot.isStepRecruitmentActive, tshirtDeadline: mainSnapshot.tshirtDeadline,
    isWaterparkActive: mainSnapshot.isWaterparkActive, waterparkInfo: mainSnapshot.waterparkInfo,
  };

  // 1. split 전환 (main 데이터 보존하며 operatingMode만)
  await post('/api/config/kinder', { ...mainBody, trackKey: 'main', operatingMode: 'split' });
  const afterMode = await getJson('/api/config/kinder?list=1');
  log('운영모드 split 전환', afterMode.data.operatingMode === 'split', `tracks=${afterMode.data.tracks.length}`);

  // 2. 트랙 생성 (유치부 단독 = kindergarten)
  const created = await post('/api/config/kinder', {
    ...mainBody,
    title: '유치부 단독 캠프', trackKey: TRACK_KEY, trackLabel: '유치부 단독',
    subDepartmentIds: ['kindergarten'], operatingMode: 'split',
  });
  const list2 = await getJson('/api/config/kinder?list=1');
  const found = list2.data.tracks.find((t) => t.trackKey === TRACK_KEY);
  log('트랙 생성 + 목록 노출', created.status === 200 && !!found && found.subDepartmentIds.includes('kindergarten'),
    found ? `label=${found.label}, subs=${found.subDepartmentIds}` : 'not found');

  // 3. 트랙별 설정 조회 + 세부부서 리졸브
  const byTrack = await getJson(`/api/config/kinder?track=${TRACK_KEY}`);
  const bySub = await getJson('/api/config/kinder?sub=kindergarten');
  const bySubOther = await getJson('/api/config/kinder?sub=infant');
  log('트랙별 설정 조회 (title 분리)', byTrack.data.title === '유치부 단독 캠프', `title="${byTrack.data.title}"`);
  log('세부부서→트랙 리졸브 (kindergarten→유치트랙)', bySub.data.trackKey === TRACK_KEY, `resolved=${bySub.data.trackKey}`);
  log('미배정 세부부서→main 폴백 (infant→main)', bySubOther.data.trackKey === 'main', `resolved=${bySubOther.data.trackKey}`);
  log('main 한글 데이터 보존', bySubOther.data.title === mainSnapshot.title, `title="${bySubOther.data.title}"`);

  // 4. 테스트 가족: kinder 자녀 2명 (kindergarten 1, infant 1)
  const appRes = await post('/api/applications', {
    parentName: '트랙테스트부모', parentPhone: '010-7777-0001', depositorName: '트랙테스트부모', grandTotal: 0,
    waterfallParents: [{ name: '트랙테스트부모', relation: '모', phone: '010-7777-0001' }],
    children: [
      { name: '유치자녀', birthDate: '2020-03-01', gender: 'male', department: 'kinder', subDepartment: 'kindergarten', attendsWaterpark: true, attendedSessions: [] },
      { name: '영유자녀', birthDate: '2022-03-01', gender: 'female', department: 'kinder', subDepartment: 'infant', attendsWaterpark: true, attendedSessions: [] },
    ],
  });
  testAppId = appRes.json?.data?.id;
  log('테스트 가족 신청 생성', appRes.status === 201 && !!testAppId, `id=${testAppId}`);

  // 5. 신청 DB 트랙 필터: 유치트랙 → 유치자녀만
  const filtered = await getJson(`/api/applications?department=kinder&track=${TRACK_KEY}`);
  const filteredApp = (filtered.data || []).find((a) => a.id === testAppId);
  const names = filteredApp ? filteredApp.children.map((c) => c.name) : [];
  log('신청 DB 트랙 필터 (유치트랙=유치자녀만)',
    !!filteredApp && names.includes('유치자녀') && !names.includes('영유자녀'),
    `children=${names.join(',')}`);

  // 6. 워터풀 트랙 필터 — 가족 단위: 유치트랙 자녀가 있는 가족이 포함됨 (가족 전체 표시는 의도된 동작)
  const wp = await getJson(`/api/waterpark/applicants?department=kinder&track=${TRACK_KEY}`);
  const wpFam = (wp.data || []).find((f) => f.id === testAppId);
  const wpNames = wpFam ? wpFam.children.map((c) => c.name) : [];
  log('워터풀 트랙 필터 (유치트랙 가족 포함)', !!wpFam && wpNames.includes('유치자녀'),
    `children=${wpNames.join(',')}`);

  // 6-1. 워터풀 트랙 필터 — 유치트랙 자녀가 없는 가족은 제외되어야 함 (별도 확인)
  const onlyInfantRes = await post('/api/applications', {
    parentName: '영유전용부모', parentPhone: '010-7777-0002', depositorName: '영유전용부모', grandTotal: 0,
    waterfallParents: [{ name: '영유전용부모', relation: '모', phone: '010-7777-0002' }],
    children: [{ name: '영유전용자녀', birthDate: '2022-05-01', gender: 'male', department: 'kinder', subDepartment: 'infant', attendsWaterpark: true, attendedSessions: [] }],
  });
  const onlyInfantId = onlyInfantRes.json?.data?.id;
  const wp2 = await getJson(`/api/waterpark/applicants?department=kinder&track=${TRACK_KEY}`);
  log('워터풀 트랙 필터 (유치 자녀 없는 가족 제외)', !(wp2.data || []).find((f) => f.id === onlyInfantId),
    onlyInfantId ? 'excluded' : 'create failed');
  if (onlyInfantId) await pool.query('DELETE FROM applications WHERE id = $1', [onlyInfantId]);

  // 7. 트랙 삭제
  const del = await fetch(`${BASE}/api/config/kinder?track=${TRACK_KEY}`, { method: 'DELETE' });
  const list3 = await getJson('/api/config/kinder?list=1');
  log('트랙 삭제', del.status === 200 && !list3.data.tracks.find((t) => t.trackKey === TRACK_KEY),
    `tracks=${list3.data.tracks.map((t) => t.trackKey).join(',')}`);

  // 8. main 트랙 삭제 거부
  const delMain = await fetch(`${BASE}/api/config/kinder?track=main`, { method: 'DELETE' });
  log('main 트랙 삭제 거부 (400)', delMain.status === 400);
} catch (err) {
  console.error('TEST ERROR:', err);
} finally {
  // 정리: 테스트 가족 삭제, 잔여 테스트 트랙 삭제, kinder union 원복
  if (testAppId) { await pool.query('DELETE FROM applications WHERE id = $1', [testAppId]); console.log('test family deleted'); }
  await pool.query(`DELETE FROM event_configs WHERE department = 'kinder' AND track_key = $1`, [TRACK_KEY]);
  await pool.query(`UPDATE event_configs SET operating_mode = 'union' WHERE department = 'kinder'`);
  const finalMode = (await pool.query(`SELECT operating_mode, title FROM event_configs WHERE department='kinder' AND track_key='main'`)).rows[0];
  console.log(`kinder 원복: mode=${finalMode.operating_mode}, title="${finalMode.title}"`);
  await pool.end();
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}
