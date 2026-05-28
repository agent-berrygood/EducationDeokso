/**
 * 코드값 → 한글 라벨 변환 단일 출처 모듈
 * 모든 UI/엑셀/리포트는 이 모듈을 통해 한글 라벨로만 노출되어야 한다.
 */
import type { DepartmentId, Gender, WaterfallRelation, SubDepartment } from './types';

// ── 성별 ─────────────────────────────────────────────────────
export function genderLabel(value: any): string {
  if (!value) return '';
  const v = String(value).toLowerCase().trim();
  if (v === 'male' || v === 'm' || v === '남' || v === '남자') return '남';
  if (v === 'female' || v === 'f' || v === '여' || v === '여자') return '여';
  return String(value);
}

// ── 대부서 ───────────────────────────────────────────────────
export function departmentLabel(value: any): string {
  if (!value) return '';
  const v = String(value).toLowerCase().trim();
  if (v === 'kinder') return '나우킨더';
  if (v === 'kids') return '나우키즈';
  if (v === 'teens') return '나우틴즈';
  return String(value);
}

// ── 워터풀 보호자 관계 ─────────────────────────────────────
const RELATION_LABELS: Record<string, string> = {
  '부': '부', '모': '모', '조부': '조부', '조모': '조모', '기타': '기타',
  father: '부', mother: '모', grandfather: '조부', grandmother: '조모', other: '기타',
};
export function relationLabel(value: any): string {
  if (!value) return '';
  return RELATION_LABELS[String(value).toLowerCase()] ?? String(value);
}

// ── 세부 부서 (event_configs.sub_departments 기반 + fallback) ────
const SUB_DEPT_FALLBACK: Record<string, string> = {
  // 킨더
  integrated_preschool: '통합미취학부',
  infant: '영유아부',
  kindergarten: '유치부',
  // 키즈
  integrated_kids: '통합아동부',
  junior: '유년부',
  senior: '소년부',
  // 틴즈
  middle: '중등부',
  high: '고등부',
};

/**
 * 세부 부서 ID → 한글 라벨.
 * 1) DB의 event_configs.sub_departments에서 받은 매핑이 있으면 그것을 우선 사용
 * 2) 없으면 시스템 디폴트 매핑(SUB_DEPT_FALLBACK)
 * 3) 그래도 없으면 원본 ID 반환
 */
export function subDepartmentLabel(
  id: any,
  configMap?: Map<string, string> | Record<string, string> | null
): string {
  if (!id) return '';
  const key = String(id);
  if (configMap) {
    if (configMap instanceof Map) {
      const v = configMap.get(key);
      if (v) return v;
    } else if (typeof configMap === 'object') {
      const v = (configMap as Record<string, string>)[key];
      if (v) return v;
    }
  }
  if (SUB_DEPT_FALLBACK[key]) return SUB_DEPT_FALLBACK[key];
  return key;
}

/**
 * event_configs.sub_departments(배열) → id→label 맵 변환
 */
export function buildSubDeptMap(subDepartments: SubDepartment[] | any[] | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(subDepartments)) return map;
  for (const sd of subDepartments) {
    if (sd?.id && sd?.label) map.set(String(sd.id), String(sd.label));
  }
  return map;
}

// ── 시간 슬롯 (SLOT_LABELS는 session-grid에 있지만 호환을 위해 재노출) ──
export const SLOT_LABELS_KO: Record<string, string> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁',
};
