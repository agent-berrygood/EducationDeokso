import type { DepartmentId, SubDepartment } from './types';

/**
 * 부서별 세부부서 프리셋 — 유일한 출처(single source of truth).
 * CMS에서 관리자가 임의로 추가/삭제할 수 없고, 항상 이 목록만 사용한다.
 * (예전에는 관리자 화면에서 자유 입력으로 추가/삭제가 가능했으나,
 * 운영 중 실수로 목록이 비워지는 사고가 발생해 프리셋 고정으로 전환)
 */
export const DEPARTMENT_SUB_DEPARTMENTS: Record<DepartmentId, SubDepartment[]> = {
  kinder: [
    { id: 'integrated_preschool', label: '통합미취학부' },
    { id: 'infant', label: '영유아부' },
    { id: 'kindergarten', label: '유치부' },
  ],
  kids: [
    { id: 'integrated_kids', label: '통합아동부' },
    { id: 'junior', label: '유년부' },
    { id: 'senior', label: '소년부' },
  ],
  teens: [
    { id: 'middle', label: '중등부' },
    { id: 'high', label: '고등부' },
  ],
};

export function getPresetSubDepartments(department: string): SubDepartment[] {
  return DEPARTMENT_SUB_DEPARTMENTS[department as DepartmentId] || [];
}
