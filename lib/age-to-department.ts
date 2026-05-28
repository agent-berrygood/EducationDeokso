/**
 * 한국 나이 / 만나이 기반 부서 자동 추천 로직
 * 결과는 "추천"으로만 사용되어야 하며, 사용자가 수동으로 변경할 수 있어야 한다.
 */
import type { DepartmentId } from './types';

/**
 * 만 나이 계산 (2024년 만나이 통일법 기준)
 */
export function calculateAge(birthDate: string, reference: Date = new Date()): number {
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return 0;
  let age = reference.getFullYear() - birth.getFullYear();
  const m = reference.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && reference.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * 한국 나이 (만나이 + 1)
 */
export function calculateKoreanAge(birthDate: string, reference: Date = new Date()): number {
  return calculateAge(birthDate, reference) + 1;
}

interface DepartmentRange {
  dept: DepartmentId;
  minAge: number;
  maxAge: number;
  description: string;
}

/**
 * 만 나이 기준 부서 범위
 * - kinder: 0~7세 (영아부 - 유치부)
 * - kids: 8~13세 (초등 1~6학년)
 * - teens: 14~19세 (중1 ~ 고3)
 */
const AGE_RANGES: DepartmentRange[] = [
  { dept: 'kinder', minAge: 0, maxAge: 7, description: '영아부 - 유치부' },
  { dept: 'kids', minAge: 8, maxAge: 13, description: '초등 1~6학년' },
  { dept: 'teens', minAge: 14, maxAge: 19, description: '중1 ~ 고3' },
];

export interface DepartmentSuggestion {
  recommended: DepartmentId;
  age: number;
  reason: string;
  candidates: DepartmentId[];
}

export function suggestDepartment(birthDate: string, reference: Date = new Date()): DepartmentSuggestion | null {
  if (!birthDate) return null;
  const age = calculateAge(birthDate, reference);
  const matched = AGE_RANGES.find((r) => age >= r.minAge && age <= r.maxAge);

  if (!matched) {
    // 19세 초과는 teens로 기본 (졸업생 등)
    return {
      recommended: 'teens',
      age,
      reason: `만 ${age}세 기준 자동 추천 불가. teens 부서로 임시 매핑되었습니다. 수동 확인이 필요합니다.`,
      candidates: ['kinder', 'kids', 'teens'],
    };
  }

  // 경계 케이스: minAge == age (해당 부서의 첫 해) 또는 maxAge == age (마지막 해)
  const isBoundary = age === matched.minAge || age === matched.maxAge;

  return {
    recommended: matched.dept,
    age,
    reason: isBoundary
      ? `만 ${age}세 → ${matched.description} 추천. 학년에 따라 다른 부서일 수 있으니 확인하세요.`
      : `만 ${age}세 → ${matched.description} 추천.`,
    candidates: AGE_RANGES.map((r) => r.dept),
  };
}
