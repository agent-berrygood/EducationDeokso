/**
 * 이벤트 트랙(연합/분리 운영) 단일 출처 모듈.
 *
 * 트랙 = 대부서(department) 내 운영 단위. track_key로 식별하고 세부부서 집합을 커버한다.
 *  - 'main' 트랙: sub_department_ids가 비어 있으면 대부서 전체 = 연합(union).
 *  - operating_mode='split'이면 관리자가 정의한 여러 트랙이 각자 세부부서 그룹을 가진다.
 *
 * 클라이언트/서버 양측에서 동일 규칙을 적용하기 위해 순수 함수만 둔다.
 */

export const MAIN_TRACK_KEY = 'main';
export type OperatingMode = 'union' | 'split';

export interface EventTrack {
  trackKey: string;
  label: string;
  /** 이 트랙이 커버하는 세부부서 id 배열 ([] = 대부서 전체) */
  subDepartmentIds: string[];
}

/**
 * 세부부서 id → 소속 트랙 key.
 * split 모드에서 sub_department_ids에 해당 세부부서를 포함하는 트랙을 찾고,
 * 없으면(연합/미배정) MAIN_TRACK_KEY로 폴백한다.
 */
export function resolveTrackKey(
  tracks: EventTrack[] | null | undefined,
  subDepartment: string | null | undefined,
  operatingMode: OperatingMode = 'union'
): string {
  if (operatingMode !== 'split' || !subDepartment || !Array.isArray(tracks)) {
    return MAIN_TRACK_KEY;
  }
  const hit = tracks.find(
    (t) => t.trackKey !== MAIN_TRACK_KEY && Array.isArray(t.subDepartmentIds) && t.subDepartmentIds.includes(subDepartment)
  );
  return hit ? hit.trackKey : MAIN_TRACK_KEY;
}

/**
 * 트랙이 커버하는 세부부서 목록.
 * subDepartmentIds가 비어 있으면 allSubDepartments(대부서 전체)를 반환한다(연합).
 */
export function subDeptsForTrack(
  track: EventTrack | null | undefined,
  allSubDepartmentIds: string[]
): string[] {
  if (!track || !Array.isArray(track.subDepartmentIds) || track.subDepartmentIds.length === 0) {
    return allSubDepartmentIds;
  }
  return track.subDepartmentIds;
}

export function isUnion(operatingMode: OperatingMode | string | null | undefined): boolean {
  return operatingMode !== 'split';
}

/**
 * 프리셋 세부부서 중 어느 non-main 트랙에도 배정되지 않은 것들.
 * 분리 모드에서 관리자에게 배정 누락을 경고하는 데 사용한다.
 */
export function unassignedSubDepartmentIds(
  allSubDepartmentIds: string[],
  tracks: EventTrack[] | null | undefined
): string[] {
  const covered = new Set<string>();
  if (Array.isArray(tracks)) {
    for (const t of tracks) {
      if (t.trackKey === MAIN_TRACK_KEY || !Array.isArray(t.subDepartmentIds)) continue;
      for (const id of t.subDepartmentIds) covered.add(id);
    }
  }
  return allSubDepartmentIds.filter((id) => !covered.has(id));
}

/** 안전 파서 — JSONB가 string으로 올 수도 있으므로 배열로 정규화 */
export function parseStringArray(val: any): string[] {
  if (Array.isArray(val)) return val.filter((x) => typeof x === 'string');
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? p.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}
