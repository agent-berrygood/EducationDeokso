/**
 * 워터풀선데이 명단 조회 — 서버 사이드 DB 헬퍼 (lib/waterpark는 순수 병합 함수).
 *
 * 두 출처를 한 명단으로 합친다:
 *  1) 성경학교/수련회 신청 중 워터풀 참석 자녀 (applications + application_children.attends_waterpark)
 *  2) 워터풀 단독 신청 (waterpark_applications + waterpark_application_children)
 *
 * 두 출처의 행을 mergeWaterparkFamilies()로 전화번호+이름 기준 병합하므로,
 * 같은 가족이 성경학교와 워터풀 단독을 따로 신청해도 한 그룹으로 합쳐진다.
 */
import { queryMany } from '@/lib/db';
import { trackSubDepartments } from '@/lib/track-query';
import { mergeWaterparkFamilies, type RawWaterparkRow, type MergedWaterparkFamily } from '@/lib/waterpark';

/** waterpark_applications 테이블이 없는(마이그레이션 미적용) 환경에서도 명단 조회가 깨지지 않도록 보장 */
async function ensureWaterparkApplyTables() {
  await queryMany(`CREATE TABLE IF NOT EXISTS waterpark_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_name VARCHAR(100) NOT NULL,
    parent_phone VARCHAR(20) NOT NULL,
    depositor_name VARCHAR(100) NOT NULL,
    grand_total DECIMAL(10, 2) DEFAULT 0,
    waterfall_parents JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await queryMany(`CREATE TABLE IF NOT EXISTS waterpark_application_children (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    waterpark_application_id UUID NOT NULL REFERENCES waterpark_applications(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    birth_date DATE,
    gender VARCHAR(10),
    department VARCHAR(50),
    sub_department VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
  )`);
}

export interface FetchWaterparkOpts {
  department?: string | null;
  track?: string | null;
}

/**
 * 두 출처를 병합한 워터풀 가족 명단을 반환한다. (정렬은 호출부 책임)
 */
export async function fetchWaterparkFamilies(opts: FetchWaterparkOpts = {}): Promise<MergedWaterparkFamily[]> {
  await ensureWaterparkApplyTables();

  const department = opts.department || null;
  const track = opts.track || null;

  // 분리 운영 트랙 필터용 세부부서 목록 (연합/미지정이면 빈 배열 = 필터 없음)
  let trackSubs: string[] = [];
  if (department && track) {
    trackSubs = await trackSubDepartments(department, track);
  }

  // ── 1) 성경학교 신청 기반 워터풀 참석자 ──
  const bibleParams: any[] = [];
  let deptHaving = '';
  if (department) {
    bibleParams.push(department);
    let deptCond = `ac.attends_waterpark AND ac.department = $1`;
    if (trackSubs.length > 0) {
      bibleParams.push(trackSubs);
      deptCond += ` AND ac.sub_department = ANY($${bibleParams.length}::text[])`;
    }
    deptHaving = `AND bool_or(${deptCond})`;
  }

  const bibleRows = await queryMany(
    `SELECT
       a.id, a.parent_name, a.parent_phone, a.depositor_name,
       a.waterfall_parents, a.created_at,
       json_agg(
         json_build_object(
           'id', ac.id,
           'name', ac.name,
           'gender', ac.gender,
           'department', ac.department,
           'subDepartment', ac.sub_department,
           'birthDate', ac.birth_date
         ) ORDER BY ac.department, ac.name
       ) FILTER (WHERE ac.attends_waterpark) AS waterpark_children
     FROM applications a
     INNER JOIN application_children ac ON a.id = ac.application_id
     GROUP BY a.id
     HAVING bool_or(ac.attends_waterpark) ${deptHaving}`,
    bibleParams
  );

  // ── 2) 워터풀 단독 신청 ──
  const wpRows = await queryMany(
    `SELECT
       wa.id, wa.parent_name, wa.parent_phone, wa.depositor_name,
       wa.waterfall_parents, wa.created_at,
       json_agg(
         json_build_object(
           'id', c.id,
           'name', c.name,
           'gender', c.gender,
           'department', c.department,
           'subDepartment', c.sub_department,
           'birthDate', c.birth_date
         ) ORDER BY c.department, c.name
       ) FILTER (WHERE c.id IS NOT NULL) AS waterpark_children
     FROM waterpark_applications wa
     LEFT JOIN waterpark_application_children c ON wa.id = c.waterpark_application_id
     GROUP BY wa.id`
  );

  // 워터풀 단독 신청은 부서/트랙 필터를 JS에서 적용 (해당 부서 자녀를 1명 이상 포함하는 가족만)
  let wpFiltered = wpRows as any[];
  if (department) {
    const subSet = trackSubs.length > 0 ? new Set(trackSubs) : null;
    wpFiltered = wpFiltered.filter((r) => {
      const kids = Array.isArray(r.waterpark_children) ? r.waterpark_children : [];
      return kids.some(
        (c: any) => c?.department === department && (!subSet || subSet.has(c?.subDepartment))
      );
    });
  }

  return mergeWaterparkFamilies([
    ...(bibleRows as RawWaterparkRow[]),
    ...(wpFiltered as RawWaterparkRow[]),
  ]);
}
