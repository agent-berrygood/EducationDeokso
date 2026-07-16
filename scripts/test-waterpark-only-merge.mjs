// 워터풀 "단독 신청" + 성경학교 워터풀 참석자 통합 병합 검증 — 라이브 DB를 건드리지 않는 pg-mem 테스트.
// 실행: node scripts/test-waterpark-only-merge.mjs
//
// lib/waterpark-query.ts의 fetchWaterparkFamilies 동작(두 소스 union → mergeWaterparkFamilies)을 재현한다.
// 병합/부서필터/단독신청 삭제 경로를 검증한다. 로직 변경 시 이 테스트도 함께 갱신할 것.
import { newDb } from 'pg-mem';

// lib/waterpark.ts mergeWaterparkFamilies와 동일 규칙 (dedup: 보호자=이름, 자녀=이름|부서)
const safeParse = (v)=>Array.isArray(v)?v:(typeof v!=='string'?[]:(()=>{try{return JSON.parse(v)}catch{return[]}})());
const normPhone = p=>String(p??'').replace(/\D/g,'');
const normName = n=>String(n??'').trim();
const nameKey = n=>String(n??'').replace(/\s+/g,'');
function backfill(t,e,fs){ if(!t||!e) return; for(const f of fs){ const c=t[f]; if((c===undefined||c===null||c==='')&&e[f]) t[f]=e[f]; } }
function mergeWaterparkFamilies(rows){
  const groups=new Map();
  for(const r of rows){const key=`${normPhone(r.parent_phone)}|${nameKey(r.parent_name)}`;const a=groups.get(key)||[];a.push(r);groups.set(key,a);}
  const fam=[];
  for(const arr of groups.values()){
    const sorted=[...arr].sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime());
    const head=sorted[0];const parents=[],sp=new Map(),children=[],sc=new Map();
    for(const r of sorted){
      for(const p of safeParse(r.waterfall_parents)){const pk=nameKey(p?.name);const k=sp.get(pk);if(k){backfill(k,p,['relation','phone']);continue;}const cp={...p,name:normName(p?.name)};sp.set(pk,cp);parents.push(cp);}
      for(const c of (Array.isArray(r.waterpark_children)?r.waterpark_children:[])){const ck=`${nameKey(c?.name)}|${c?.department??''}`;const k=sc.get(ck);if(k){backfill(k,c,['gender','birthDate','subDepartment']);continue;}const cc={...c,name:normName(c?.name)};sc.set(ck,cc);children.push(cc);}
    }
    fam.push({id:head.id,applicationIds:sorted.map(r=>r.id),parentName:head.parent_name,parents,children,parentCount:parents.length,childCount:children.length,totalCount:parents.length+children.length});
  }
  return fam;
}

const db = newDb();
const { Pool } = db.adapters.createPg();
const pool = new Pool();
const q = (sql, params) => pool.query(sql, params);

// 성경학교 신청 테이블
await q(`CREATE TABLE applications (
  id uuid PRIMARY KEY, parent_name text, parent_phone text, depositor_name text,
  waterfall_parents jsonb DEFAULT '[]', created_at timestamp)`);
await q(`CREATE TABLE application_children (
  id uuid PRIMARY KEY, application_id uuid, name text, department text, sub_department text,
  attends_waterpark boolean DEFAULT false)`);
// 워터풀 단독 신청 테이블 (신규)
await q(`CREATE TABLE waterpark_applications (
  id uuid PRIMARY KEY, parent_name text, parent_phone text, depositor_name text,
  waterfall_parents jsonb DEFAULT '[]', created_at timestamp)`);
await q(`CREATE TABLE waterpark_application_children (
  id uuid PRIMARY KEY, waterpark_application_id uuid, name text, department text, sub_department text)`);

const A='11111111-1111-1111-1111-111111111111'; // 성경학교 김철수
const W='22222222-2222-2222-2222-222222222222'; // 워터풀단독 김철수 (같은 가족)
const V='33333333-3333-3333-3333-333333333333'; // 워터풀단독 정보라 (단독만)

await q(`INSERT INTO applications (id,parent_name,parent_phone,depositor_name,waterfall_parents,created_at) VALUES
  ($1,'김철수','010-1111-2222','김철수',$2,'2026-07-01')`,
  [A, JSON.stringify([{name:'김철수',relation:'부',phone:'01011112222'}])]);
await q(`INSERT INTO application_children (id,application_id,name,department,sub_department,attends_waterpark) VALUES
  ('a1111111-1111-1111-1111-111111111111',$1,'김하나','kids','junior',true),
  ('a2222222-2222-2222-2222-222222222222',$1,'김세찬','kids','junior',false)`,[A]);

// 김철수 단독신청의 보호자 '김철수'는 성경학교 쪽과 같은 사람이지만 관계/연락처가 비어 있다
// (실데이터의 "김민철(부) x2" 케이스) → 이름 기준 1명으로 합쳐지고 빈 값은 채워져야 한다.
await q(`INSERT INTO waterpark_applications (id,parent_name,parent_phone,depositor_name,waterfall_parents,created_at) VALUES
  ($1,'김철수 ','01011112222','김철수',$3,'2026-07-05'),
  ($2,'정보라','010-5555-6666','정보라',$4,'2026-07-06')`,
  [W,V,
   JSON.stringify([{name:'김철수'},{name:'이영희',relation:'모',phone:'01033334444'}]),
   JSON.stringify([{name:'정보라',relation:'모',phone:'01055556666'}])]);
// '김하나 '는 성경학교에도 있는 같은 아이 — 테이블이 달라 id가 다르므로 id 기준 dedup으로는 안 걸린다.
await q(`INSERT INTO waterpark_application_children (id,waterpark_application_id,name,department,sub_department) VALUES
  ('d1111111-1111-1111-1111-111111111111',$1,'김막내','kinder','infant'),
  ('d2222222-2222-2222-2222-222222222222',$1,'김하나 ','kids','junior'),
  ('e1111111-1111-1111-1111-111111111111',$2,'정하늘','kids','senior')`,[W,V]);

// pg-mem은 다인자 json_build_object/json_agg를 완전히 지원하지 않으므로 평면 조회 후 조립
async function fetchBibleRows() {
  const flat = (await q(`SELECT a.id,a.parent_name,a.parent_phone,a.depositor_name,a.waterfall_parents,a.created_at,
      ac.id AS child_id, ac.name AS child_name, ac.department, ac.sub_department
    FROM applications a INNER JOIN application_children ac ON a.id=ac.application_id
    WHERE ac.attends_waterpark = true`)).rows;
  const byApp = new Map();
  for (const r of flat) {
    if(!byApp.has(r.id)) byApp.set(r.id,{id:r.id,parent_name:r.parent_name,parent_phone:r.parent_phone,depositor_name:r.depositor_name,waterfall_parents:r.waterfall_parents,created_at:r.created_at,waterpark_children:[]});
    byApp.get(r.id).waterpark_children.push({id:r.child_id,name:r.child_name,department:r.department,subDepartment:r.sub_department});
  }
  return [...byApp.values()];
}
async function fetchWpOnlyRows() {
  const flat = (await q(`SELECT wa.id,wa.parent_name,wa.parent_phone,wa.depositor_name,wa.waterfall_parents,wa.created_at,
      c.id AS child_id, c.name AS child_name, c.department, c.sub_department
    FROM waterpark_applications wa LEFT JOIN waterpark_application_children c ON wa.id=c.waterpark_application_id`)).rows;
  const byApp = new Map();
  for (const r of flat) {
    if(!byApp.has(r.id)) byApp.set(r.id,{id:r.id,parent_name:r.parent_name,parent_phone:r.parent_phone,depositor_name:r.depositor_name,waterfall_parents:r.waterfall_parents,created_at:r.created_at,waterpark_children:[]});
    if(r.child_id) byApp.get(r.id).waterpark_children.push({id:r.child_id,name:r.child_name,department:r.department,subDepartment:r.sub_department});
  }
  return [...byApp.values()];
}

// fetchWaterparkFamilies(dept) 재현: 워터풀 단독은 JS에서 부서 필터
async function fetchFamilies(department){
  const bible = await fetchBibleRows();
  let wp = await fetchWpOnlyRows();
  if (department) {
    wp = wp.filter(r => (r.waterpark_children||[]).some(c => c.department === department));
    // 성경학교 쪽도 부서 필터가 있으나 이 테스트에서는 전체 비교 위주이므로 생략
  }
  return mergeWaterparkFamilies([...bible, ...wp]);
}

function assert(cond,msg){ if(!cond){ console.error('FAIL:',msg); process.exitCode=1;} else console.log('PASS -',msg); }

// 1) 전체 명단: 김철수(성경학교+워터풀단독 병합) + 정보라(단독) = 2가정
const all = await fetchFamilies(null);
assert(all.length===2, `통합 병합 후 2가정 (실제 ${all.length})`);
const kim = all.find(f=>f.parentName.trim()==='김철수');
assert(!!kim, '김철수 가족 존재');
assert(kim && kim.applicationIds.length===2, `김철수 = 성경학교+워터풀단독 2건 병합 (실제 ${kim&&kim.applicationIds.length})`);
// 김하나(성경학교 워터풀) + 김막내(워터풀단독), 김세찬은 미참석 제외
// 김하나는 단독신청에도 중복 등록됐지만 이름+부서 기준으로 1명이어야 한다.
assert(kim && kim.children.map(c=>c.name).sort().join(',')==='김막내,김하나', `자녀 통합 정확 (실제 ${kim&&kim.children.map(c=>c.name).sort().join(',')})`);
assert(kim && kim.childCount===2, `두 경로 중복 신청 자녀 1명으로 집계 (실제 ${kim&&kim.childCount})`);
assert(kim && kim.parents.map(p=>p.name).sort().join(',')==='김철수,이영희', `보호자 통합(성경학교+단독) (실제 ${kim&&kim.parents.map(p=>p.name).sort().join(',')})`);
assert(kim && kim.parentCount===2, `연락처 없는 동명 보호자 1명으로 집계 (실제 ${kim&&kim.parentCount})`);
const cs = kim && kim.parents.find(p=>p.name==='김철수');
assert(cs && cs.relation==='부' && cs.phone==='01011112222', `중복 병합 시 관계/연락처 보존 (실제 ${cs&&cs.relation}/${cs&&cs.phone})`);
assert(kim && kim.totalCount===4, `총 인원 4 (실제 ${kim&&kim.totalCount})`);
const jung = all.find(f=>f.parentName.trim()==='정보라');
assert(jung && jung.children.length===1 && jung.children[0].name==='정하늘', '정보라 단독 가정 존재');

// 2) 부서 필터(kinder): 정보라(자녀 kids만)는 단독 목록에서 제외, 김철수는 kinder 자녀(김막내) 있어 포함
const kinderList = await fetchFamilies('kinder');
assert(kinderList.some(f=>f.parentName.trim()==='김철수'), 'kinder 필터: 김철수 포함');
assert(!kinderList.some(f=>f.parentName.trim()==='정보라'), 'kinder 필터: 정보라(단독, kids만) 제외');

// 3) PATCH 경로: 워터풀 단독 신청 삭제 (department 없음 → id로 삭제)
//    실제 라우트는 `id = ANY($1::uuid[])`로 배치 삭제하지만, pg-mem은 PK uuid 컬럼에 대한
//    ANY 삭제 매칭에 결함이 있어 여기서는 단일 id 등가로 동일 경로를 검증한다.
const del = await q(`DELETE FROM waterpark_applications WHERE id = $1`, [V]);
assert((del.rowCount??0)===1, `워터풀 단독(정보라) 삭제 (rowCount=${del.rowCount})`);
const afterDel = await fetchFamilies(null);
assert(!afterDel.some(f=>f.parentName.trim()==='정보라'), '삭제 후 정보라 명단에서 제거됨');
assert(afterDel.some(f=>f.parentName.trim()==='김철수'), '삭제 후에도 김철수(성경학교) 유지');

await pool.end();
console.log(process.exitCode ? '\n=== 일부 실패 ===' : '\n=== 전체 통과 ===');
