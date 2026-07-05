// 부분참석 엑셀 필터 로직 검증 — DB 불필요(순수 로직). 실행: node scripts/test-partial-attendance-export.mjs
//
// app/api/export/route.ts의 buildCampDates + 부분참석자 판별 로직과 동일해야 한다.
// 신청서는 참석 일정을 날짜(YYYY-MM-DD)로 저장하며, "전체 일정 중 일부 날짜만" 참석한 자녀만 시트에 포함된다.
// 변경 시 route.ts와 이 테스트를 함께 갱신할 것.

function buildCampDates(campStartDate, dayCount, campType) {
  if (!campStartDate) return [];
  const start = new Date(campStartDate);
  if (isNaN(start.getTime())) return [];
  const step = campType === 'weekly' ? 7 : 1;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const out = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * step);
    const iso = d.toISOString().slice(0, 10);
    out.push({ date: iso, label: `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})` });
  }
  return out;
}

function pickPartialNames(rows, campDates) {
  const campDateSet = new Set(campDates.map((c) => c.date));
  const names = [];
  for (const r of rows) {
    const list = (Array.isArray(r.attended_sessions) ? r.attended_sessions : []).filter((s) => typeof s === 'string');
    if (campDates.length > 0) {
      const inCamp = list.filter((d) => campDateSet.has(d));
      if (inCamp.length > 0 && inCamp.length < campDates.length) names.push(r.name);
    } else {
      if (list.length > 0) names.push(r.name);
    }
  }
  return names;
}

function assert(cond, msg) { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; } else console.log('PASS -', msg); }
const eq = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

// ── buildCampDates ──
const cont = buildCampDates('2026-07-25', 3, 'continuous');
assert(eq(cont.map((c) => c.date), ['2026-07-25', '2026-07-26', '2026-07-27']), `연속 3일차 날짜 생성 (실제 ${cont.map((c) => c.date).join(',')})`);
const weekly = buildCampDates('2026-07-05', 3, 'weekly');
assert(eq(weekly.map((c) => c.date), ['2026-07-05', '2026-07-12', '2026-07-19']), `주간 3주차 날짜 생성 (실제 ${weekly.map((c) => c.date).join(',')})`);
assert(buildCampDates(null, 3, 'continuous').length === 0, '시작일 없으면 캠프 날짜 빈 배열');

// ── 부분참석자 판별 (연속 3일 캠프) ──
const campDates = cont;
const rows = [
  { name: '전체참석', attended_sessions: ['2026-07-25', '2026-07-26', '2026-07-27'] }, // 전체 → 제외
  { name: '이틀참석', attended_sessions: ['2026-07-25', '2026-07-26'] },                 // 부분 → 포함
  { name: '하루참석', attended_sessions: ['2026-07-25'] },                               // 부분 → 포함
  { name: '미지정',   attended_sessions: [] },                                           // 빈값 → 제외(전체/미지정)
  { name: '캠프밖',   attended_sessions: ['2026-08-01'] },                               // 캠프 밖만 → 제외
  { name: '부분+밖',  attended_sessions: ['2026-07-27', '2026-08-01'] },                 // 캠프 내 1일 → 포함
  { name: '문자열아님', attended_sessions: '["2026-07-25"]' },                            // Array 아님(문자열) → filter 통과 못 함 → 제외(route는 safeParse로 처리하나 여기선 배열만)
];
const partial = pickPartialNames(rows, campDates);
assert(eq(partial, ['이틀참석', '하루참석', '부분+밖']), `부분참석자만 포함 (실제 ${partial.join(',') || '없음'})`);
assert(!partial.includes('전체참석'), '전체참석자 제외');
assert(!partial.includes('미지정'), '미지정(빈값) 제외');
assert(!partial.includes('캠프밖'), '캠프 밖 날짜만 있는 자녀 제외');

// ── 캠프 날짜를 못 만들 때(시작일 미설정) 폴백: 참석일정 지정한 자녀만 ──
const fb = pickPartialNames(
  [{ name: 'A', attended_sessions: ['2026-07-25'] }, { name: 'B', attended_sessions: [] }],
  []
);
assert(eq(fb, ['A']), `폴백: 참석일정 지정한 자녀만 (실제 ${fb.join(',') || '없음'})`);

console.log(process.exitCode ? '\n=== 일부 실패 ===' : '\n=== 전체 통과 ===');
