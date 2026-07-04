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

// ── 대부서 (전체 표기, 어드민 헤더용) ───────────────────────
const DEPT_FULL_LABELS: Record<string, string> = {
  kinder: '나우킨더 (미취학)',
  kids: '나우키즈 (취학부서)',
  teens: '나우틴즈 (중고등부)',
};
export function departmentFullLabel(value: any): string {
  if (!value) return '';
  const key = String(value).toLowerCase().trim();
  return DEPT_FULL_LABELS[key] ?? departmentLabel(value);
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

// ── 세부 부서 약칭 (입금자명 안내용: "약칭 + 자녀 이름") ──
const SUB_DEPT_SHORT: Record<string, string> = {
  // 킨더
  integrated_preschool: '통미',
  infant: '영유',
  kindergarten: '유치',
  // 키즈
  integrated_kids: '통아',
  junior: '유년',
  senior: '소년',
  // 틴즈
  middle: '중등',
  high: '고등',
};

// 어드민에서 세부부서를 직접 등록하면 id가 한글 라벨 그대로 저장되므로
// (예: id="통합아동부") 한글 풀네임 기준 매핑도 함께 둔다.
const SUB_DEPT_SHORT_BY_LABEL: Record<string, string> = {
  '통합미취학부': '통미',
  '영유아부': '영유',
  '유치부': '유치',
  '통합아동부': '통아',
  '유년부': '유년',
  '소년부': '소년',
  '중등부': '중등',
  '고등부': '고등',
};

/**
 * 세부 부서 ID 또는 한글 라벨 → 입금자명용 약칭
 * (통미/영유/유치/통아/유년/소년/중등/고등).
 * 약칭이 정의되지 않은 커스텀 세부 부서는 풀 라벨로 fallback.
 */
export function subDepartmentShortLabel(id: any): string {
  if (!id) return '';
  const key = String(id).trim();
  if (SUB_DEPT_SHORT[key]) return SUB_DEPT_SHORT[key];
  if (SUB_DEPT_SHORT_BY_LABEL[key]) return SUB_DEPT_SHORT_BY_LABEL[key];
  // 영문 id → 풀 라벨 → 약칭 경유 변환
  const full = SUB_DEPT_FALLBACK[key];
  if (full && SUB_DEPT_SHORT_BY_LABEL[full]) return SUB_DEPT_SHORT_BY_LABEL[full];
  return full ?? key;
}

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
