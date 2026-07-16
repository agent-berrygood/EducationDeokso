/**
 * 워터풀선데이 명단 — 가족 병합 유틸.
 *
 * 성경학교 신청이 신청서(application) 단위로 들어오기 때문에, 한 가족이 자녀를
 * 따로 신청하면(신청서 2건 이상) 워터풀 명단에서도 서로 다른 그룹으로 쪼개진다.
 * 워터풀 당일 운영에서는 "한 가족 = 한 그룹"이어야 하므로, 전화번호(숫자만)+이름이
 * 동일한 신청서들을 하나의 가족으로 합친다.
 */

function safeParse(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val !== 'string') return [];
  try { return JSON.parse(val); } catch { return []; }
}

const normPhone = (p: any) => String(p ?? '').replace(/\D/g, '');
const normName = (n: any) => String(n ?? '').trim();
/** 중복 판정용 이름 키 — 표기 흔들림("전은총 " vs "전은총")을 흡수한다. */
const nameKey = (n: any) => String(n ?? '').replace(/\s+/g, '');

/** 먼저 잡힌 사람 레코드에, 뒤에 온 중복 레코드의 값으로 빈 항목만 채워 넣는다. */
function backfill(target: any, extra: any, fields: string[]) {
  if (!target || !extra) return;
  for (const f of fields) {
    const cur = target[f];
    if ((cur === undefined || cur === null || cur === '') && extra[f]) target[f] = extra[f];
  }
}

export interface RawWaterparkRow {
  id: string;
  parent_name: string;
  parent_phone: string;
  depositor_name?: string;
  waterfall_parents: any;
  waterpark_children: any;
  created_at: any;
}

export interface MergedWaterparkFamily {
  id: string;                 // 대표 신청서 id (React key/하위호환)
  applicationIds: string[];   // 이 가족에 속한 모든 신청서 id
  parentName: string;
  parentPhone: string;
  depositorName: string;
  createdAt: any;
  parents: any[];
  children: any[];
  parentCount: number;
  childCount: number;
  totalCount: number;
}

/**
 * 신청서 단위 원본 행을 전화번호+이름 기준으로 가족 병합한다.
 *
 * 중복 제거는 "한 가족 안에서 같은 이름 = 같은 사람"을 전제로 이름 기준으로 한다.
 *  - 보호자: 이름만. 관계/연락처는 신청서마다 빠지거나 달라서 키에 넣으면 같은 사람이 갈라진다.
 *  - 자녀: 이름+부서. id는 성경학교(application_children)와 워터풀 단독
 *    (waterpark_application_children)이 서로 다른 테이블이라 같은 아이도 id가 달라
 *    키로 쓸 수 없다. 두 경로로 신청한 가족의 자녀가 두 번 세어진다.
 * 중복된 레코드에만 있는 값(연락처/성별 등)은 대표 레코드의 빈 항목에 채워 넣는다.
 */
export function mergeWaterparkFamilies(rows: RawWaterparkRow[]): MergedWaterparkFamily[] {
  const groups = new Map<string, RawWaterparkRow[]>();
  for (const r of rows) {
    const key = `${normPhone(r.parent_phone)}|${nameKey(r.parent_name)}`;
    const arr = groups.get(key) || [];
    arr.push(r);
    groups.set(key, arr);
  }

  const families: MergedWaterparkFamily[] = [];
  for (const arr of groups.values()) {
    // 가장 먼저 신청한 행을 대표로
    const sorted = [...arr].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const head = sorted[0];

    const parents: any[] = [];
    const seenParent = new Map<string, any>();
    const children: any[] = [];
    const seenChild = new Map<string, any>();

    for (const r of sorted) {
      for (const p of safeParse(r.waterfall_parents)) {
        const pk = nameKey(p?.name);
        const kept = seenParent.get(pk);
        if (kept) { backfill(kept, p, ['relation', 'phone']); continue; }
        const copy = { ...p, name: normName(p?.name) };
        seenParent.set(pk, copy);
        parents.push(copy);
      }
      const kids = Array.isArray(r.waterpark_children) ? r.waterpark_children : [];
      for (const c of kids) {
        const ck = `${nameKey(c?.name)}|${c?.department ?? ''}`;
        const kept = seenChild.get(ck);
        if (kept) { backfill(kept, c, ['gender', 'birthDate', 'subDepartment']); continue; }
        const copy = { ...c, name: normName(c?.name) };
        seenChild.set(ck, copy);
        children.push(copy);
      }
    }

    families.push({
      id: head.id,
      applicationIds: sorted.map((r) => r.id),
      parentName: head.parent_name,
      parentPhone: head.parent_phone,
      depositorName: head.depositor_name ?? '',
      createdAt: head.created_at,
      parents,
      children,
      parentCount: parents.length,
      childCount: children.length,
      totalCount: parents.length + children.length,
    });
  }

  return families;
}
