// 워터풀 엑셀 "가족단위" 시트 컬럼 생성 검증 — DB 불필요(순수 로직).
// 실행: node scripts/test-waterpark-export-columns.mjs
//
// app/api/export/waterpark/route.ts의 Sheet1 컬럼 구성과 동일해야 한다.
// 이름은 한 셀에 한 명씩 들어가고, 컬럼 수는 실제 최대 인원에 맞춰 늘어난다.
// 변경 시 route.ts와 이 테스트를 함께 갱신할 것.
import ExcelJS from 'exceljs';

const DEPT_LABELS = { kinder: '나우킨더', kids: '나우키즈', teens: '나우틴즈' };

// route.ts Sheet1 구성과 동일
function buildFamilySheet(ws, families) {
  const maxParents = Math.max(1, ...families.map((f) => f.parents.length));
  const maxChildren = Math.max(1, ...families.map((f) => f.children.length));
  const parentCols = Array.from({ length: maxParents }, (_, i) => `보호자${i + 1}`);
  const childCols = Array.from({ length: maxChildren }, (_, i) => `자녀${i + 1}`);
  ws.addRow(['대표 보호자', '연락처', '입금자', ...parentCols, ...childCols, '보호자 수', '자녀 수', '총 인원', '신청일']);

  let totalParents = 0, totalChildren = 0;
  for (const f of families) {
    totalParents += f.parents.length;
    totalChildren += f.children.length;
    ws.addRow([
      f.parentName ?? '', f.parentPhone ?? '', f.depositorName ?? '',
      ...parentCols.map((_, i) => {
        const p = f.parents[i];
        return p ? `${p.name}${p.relation ? `(${p.relation})` : ''}` : '';
      }),
      ...childCols.map((_, i) => {
        const c = f.children[i];
        return c ? `${c.name}(${DEPT_LABELS[c.department] || c.department})` : '';
      }),
      f.parents.length, f.children.length, f.parents.length + f.children.length,
      f.createdAt ? new Date(f.createdAt).toISOString().slice(0, 10) : '',
    ]);
  }
  if (families.length > 0) {
    ws.addRow(['합계', '', '', ...parentCols.map(() => ''), ...childCols.map(() => ''),
      totalParents, totalChildren, totalParents + totalChildren, '']);
  }
  return { maxParents, maxChildren };
}

function assert(cond, msg) { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; } else console.log('PASS -', msg); }

const families = [
  { parentName: '강경인', parentPhone: '010-6620-2551', depositorName: '최시언', createdAt: '2026-07-04',
    parents: [{ name: '강경인', relation: '모' }],
    children: [{ name: '최시언', department: 'kids' }] },
  // 실데이터 최대치: 보호자 4명 / 자녀 2명
  { parentName: '이영선', parentPhone: '010-2906-8914', depositorName: '이영선', createdAt: '2026-07-05',
    parents: [{ name: '이영선', relation: '모' }, { name: '이진호', relation: '부' }, { name: '이지인', relation: '기타' }, { name: '김효정', relation: '기타' }],
    children: [{ name: '이해나', department: 'kids' }, { name: '이든', department: 'kinder' }] },
  // 관계가 비어 있는 보호자 → 괄호 없이 이름만
  { parentName: '한지혜', parentPhone: '010-1234-5678', depositorName: '한지혜', createdAt: '2026-07-06',
    parents: [{ name: '정효현', relation: '' }],
    children: [{ name: '정연주', department: 'teens' }] },
];

const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('가족단위');
const { maxParents, maxChildren } = buildFamilySheet(ws, families);

assert(maxParents === 4, `보호자 컬럼 = 최대 인원 4 (실제 ${maxParents})`);
assert(maxChildren === 2, `자녀 컬럼 = 최대 인원 2 (실제 ${maxChildren})`);

const header = ws.getRow(1).values.slice(1);
assert(header.join(',') === '대표 보호자,연락처,입금자,보호자1,보호자2,보호자3,보호자4,자녀1,자녀2,보호자 수,자녀 수,총 인원,신청일',
  `헤더 구성 정확 (실제 ${header.join(',')})`);

// 이름 셀에 쉼표(= 두 명 이상)가 남아 있으면 안 된다
const nameColStart = 4, nameColEnd = 3 + maxParents + maxChildren;
let commaFound = null;
for (let r = 2; r <= ws.rowCount; r++) {
  for (let c = nameColStart; c <= nameColEnd; c++) {
    const v = String(ws.getRow(r).getCell(c).value ?? '');
    if (v.includes(',')) commaFound = `행${r} 열${c}: ${v}`;
  }
}
assert(commaFound === null, `모든 이름 셀에 1명만 (${commaFound ?? '쉼표 없음'})`);

const lee = ws.getRow(3).values.slice(1);
assert(lee.slice(3, 7).join(',') === '이영선(모),이진호(부),이지인(기타),김효정(기타)', `보호자 4명 각 셀 분리 (실제 ${lee.slice(3, 7).join(',')})`);
assert(lee.slice(7, 9).join(',') === '이해나(나우키즈),이든(나우킨더)', `자녀 2명 각 셀 분리 (실제 ${lee.slice(7, 9).join(',')})`);

// 인원이 적은 가족은 남는 칸이 빈 문자열로 채워져 컬럼이 밀리지 않아야 한다
const kang = ws.getRow(2).values.slice(1);
assert(kang.slice(3, 7).join('|') === '강경인(모)|||', `인원 적은 가족은 빈 칸 유지 (실제 ${kang.slice(3, 7).join('|')})`);
assert(kang[9] === 1 && kang[10] === 1 && kang[11] === 2, `집계 컬럼 위치 유지 (실제 ${kang[9]}/${kang[10]}/${kang[11]})`);

// 관계 없는 보호자는 빈 괄호가 붙지 않아야 한다
const han = ws.getRow(4).values.slice(1);
assert(han[3] === '정효현', `관계 없으면 이름만 (실제 ${han[3]})`);

const total = ws.getRow(5).values.slice(1);
assert(total[0] === '합계' && total[9] === 6 && total[10] === 4 && total[11] === 10,
  `합계 행 위치/값 정확 (실제 ${total[9]}/${total[10]}/${total[11]})`);

console.log(process.exitCode ? '\n=== 일부 실패 ===' : '\n=== 전체 통과 ===');
