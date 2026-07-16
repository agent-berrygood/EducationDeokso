// 워터풀 가족 병합 검증 — 라이브 DB를 건드리지 않는 pg-mem(가상 인메모리 Postgres) 테스트.
// 실행: node scripts/test-waterpark-merge.mjs
//
// 병합 로직은 lib/waterpark.ts 의 mergeWaterparkFamilies 와 동일해야 한다(순수 함수).
// 변경 시 양쪽을 함께 수정할 것.
import { newDb } from 'pg-mem';

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

await q(`CREATE TABLE applications (
  id uuid PRIMARY KEY, parent_name text, parent_phone text, depositor_name text,
  waterfall_parents jsonb DEFAULT '[]', created_at timestamp)`);
await q(`CREATE TABLE application_children (
  id uuid PRIMARY KEY, application_id uuid, name text, birth_date date,
  gender text, department text, sub_department text, attends_waterpark boolean DEFAULT false)`);

const A='11111111-1111-1111-1111-111111111111';
const B='22222222-2222-2222-2222-222222222222';
const C='33333333-3333-3333-3333-333333333333';
await q(`INSERT INTO applications (id,parent_name,parent_phone,depositor_name,waterfall_parents,created_at) VALUES
  ($1,'김철수','010-1111-2222','김철수',$4,'2026-07-01'),
  ($2,'김철수 ','01011112222','김철수',$5,'2026-07-02'),
  ($3,'박민수','010-9999-8888','박민수','[]','2026-07-03')`,
  [A,B,C,
   JSON.stringify([{name:'김철수',relation:'부',phone:'01011112222'}]),
   JSON.stringify([{name:'김철수',relation:'부',phone:'01011112222'},{name:'이영희',relation:'모',phone:'01033334444'}])]);
await q(`INSERT INTO application_children (id,application_id,name,birth_date,department,sub_department,attends_waterpark) VALUES
  ('a1111111-1111-1111-1111-111111111111',$1,'김하나','2016-05-05','kids','junior',true),
  ('a2222222-2222-2222-2222-222222222222',$1,'김세찬','2018-01-01','kids','junior',false),
  ('b1111111-1111-1111-1111-111111111111',$2,'김두리','2020-03-03','kinder','infant',true),
  ('c1111111-1111-1111-1111-111111111111',$3,'박알','2015-09-09','kids','senior',true)`,
  [A,B,C]);

// pg-mem은 다인자 json_build_object 미지원 → 워터풀 자녀를 평면 조회 후 신청서별로 조립
// (실제 GET SQL의 HAVING/FILTER 등가: attends_waterpark=true 자녀만, 그 자녀가 있는 신청서만)
async function fetchWaterparkRows() {
  const flat = (await q(`SELECT a.id, a.parent_name, a.parent_phone, a.depositor_name,
      a.waterfall_parents, a.created_at,
      ac.id AS child_id, ac.name AS child_name, ac.department, ac.sub_department
    FROM applications a INNER JOIN application_children ac ON a.id = ac.application_id
    WHERE ac.attends_waterpark = true
    ORDER BY a.created_at DESC, ac.department, ac.name`)).rows;
  const byApp = new Map();
  for (const r of flat) {
    if (!byApp.has(r.id)) byApp.set(r.id, {
      id: r.id, parent_name: r.parent_name, parent_phone: r.parent_phone,
      depositor_name: r.depositor_name, waterfall_parents: r.waterfall_parents,
      created_at: r.created_at, waterpark_children: [],
    });
    byApp.get(r.id).waterpark_children.push({ id: r.child_id, name: r.child_name, department: r.department, subDepartment: r.sub_department });
  }
  return [...byApp.values()];
}

function assert(cond,msg){ if(!cond){ console.error('FAIL:',msg); process.exitCode=1;} else console.log('PASS -',msg); }

const before = await fetchWaterparkRows();
assert(before.length===3, `병합 전 신청서 단위 3건 (실제 ${before.length})`);

const fams = mergeWaterparkFamilies(before);
assert(fams.length===2, `병합 후 가족 2가정 (실제 ${fams.length})`);
const kim = fams.find(f=>f.parentName.trim()==='김철수');
assert(!!kim, '김철수 가족 존재');
assert(kim && kim.applicationIds.length===2, `김철수 = 신청서 2건 병합 (실제 ${kim&&kim.applicationIds.length})`);
assert(kim && kim.children.length===2, `워터풀 자녀 2명(미참석 제외) (실제 ${kim&&kim.children.length})`);
assert(kim && kim.children.map(c=>c.name).sort().join(',')==='김두리,김하나', '자녀 이름 정확');
assert(kim && kim.parents.length===2, `보호자 중복제거 2명 (실제 ${kim&&kim.parents.length})`);
assert(kim && kim.totalCount===4, `총 인원 4 (실제 ${kim&&kim.totalCount})`);

// 실제 PATCH 코드경로: application_id = ANY($1::uuid[])
const res = await q(`UPDATE application_children SET attends_waterpark = FALSE
   WHERE attends_waterpark = TRUE AND application_id = ANY($1::uuid[])`, [kim.applicationIds]);
assert((res.rowCount??0)===2, `PATCH로 병합가족 자녀 2명 제외 (rowCount=${res.rowCount})`);

const after = mergeWaterparkFamilies(await fetchWaterparkRows());
assert(after.length===1 && after[0].parentName==='박민수', `제외 후 박민수 1가정만 (실제 ${after.map(f=>f.parentName).join('/')||'없음'})`);

await pool.end();
console.log(process.exitCode ? '\n=== 일부 실패 ===' : '\n=== 전체 통과 ===');
