/**
 * 트랙 관련 서버 사이드 DB 헬퍼 (lib/tracks는 순수함수, 여기는 DB 접근).
 */
import { queryOne } from '@/lib/db';
import { parseStringArray } from '@/lib/tracks';

/**
 * 트랙이 커버하는 세부부서 id 목록.
 * 반환 [] = 연합(전체) 또는 트랙 없음 → 호출부에서 "필터 없음"으로 처리.
 */
export async function trackSubDepartments(department: string, trackKey: string): Promise<string[]> {
  const row = await queryOne(
    `SELECT sub_department_ids FROM event_configs WHERE department = $1 AND track_key = $2`,
    [department, trackKey]
  );
  return row ? parseStringArray(row.sub_department_ids) : [];
}
