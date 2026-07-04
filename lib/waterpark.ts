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
 * 자녀는 id(없으면 이름+부서+세부부서) 기준, 보호자는 이름+관계+연락처 기준으로 중복 제거.
 */
export function mergeWaterparkFamilies(rows: RawWaterparkRow[]): MergedWaterparkFamily[] {
  const groups = new Map<string, RawWaterparkRow[]>();
  for (const r of rows) {
    const key = `${normPhone(r.parent_phone)}|${normName(r.parent_name)}`;
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
    const seenParent = new Set<string>();
    const children: any[] = [];
    const seenChild = new Set<string>();

    for (const r of sorted) {
      for (const p of safeParse(r.waterfall_parents)) {
        const pk = `${normName(p?.name)}|${p?.relation ?? ''}|${normPhone(p?.phone)}`;
        if (!seenParent.has(pk)) { seenParent.add(pk); parents.push(p); }
      }
      const kids = Array.isArray(r.waterpark_children) ? r.waterpark_children : [];
      for (const c of kids) {
        const ck = c?.id ? String(c.id) : `${normName(c?.name)}|${c?.department ?? ''}|${c?.subDepartment ?? ''}`;
        if (!seenChild.has(ck)) { seenChild.add(ck); children.push(c); }
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
