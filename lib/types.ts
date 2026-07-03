/**
 * 프로젝트 공용 타입 정의
 * 모든 API/컴포넌트에서 일관된 데이터 모델 사용을 위해 단일 출처로 관리.
 */

export type DepartmentId = 'kinder' | 'kids' | 'teens';

export type SubDepartmentId =
  | 'integrated_preschool' | 'infant' | 'kindergarten'   // kinder
  | 'integrated_kids' | 'junior' | 'senior'              // kids
  | 'middle' | 'high';                                   // teens

export type Gender = 'male' | 'female';

export type WaterfallRelation = '부' | '모' | '조부' | '조모' | '기타';

export interface WaterfallParent {
  name: string;
  relation: WaterfallRelation;
  phone?: string;
}

export interface SubDepartment {
  id: string;
  label: string;
}

export interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
  columnIndex: number;
}

export interface EventScheduleSlot {
  date: string;       // YYYY-MM-DD
  title?: string;
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
}

export interface EventConfig {
  id: string;
  department: DepartmentId;
  title: string;
  event_type: string;
  subtitle: string;
  scripture: string;
  primary_color: string;
  bg_color: string;
  subDepartments: SubDepartment[];
  events: any[];
  tshirtSizes: string[];
  stepTshirtSizes?: string[];
  customFieldMappings: CustomField[];
  camp_start_date?: string;
  camp_schedule?: EventScheduleSlot[];
  camp_type?: 'continuous' | 'partial';
  camp_duration?: number;
  poster_url?: string;
  is_step_recruitment_active?: boolean;
  tshirt_deadline?: string;
  is_waterpark_active?: boolean;
  /** 부서별 워터풀선데이 커스텀 정보 (틴즈 등 일정이 다른 부서 대응) */
  waterpark_info?: WaterparkInfo;
  /** 트랙(연합/분리) — 기본 'main'. @see lib/tracks */
  track_key?: string;
  track_label?: string | null;
  /** 이 트랙이 커버하는 세부부서 id 배열 ([] = 대부서 전체 = 연합) */
  sub_department_ids?: string[];
  /** 대부서 운영 모드 ('union' | 'split') */
  operating_mode?: 'union' | 'split';
  /** 부서 단위 "올해 수련회 운영 여부" (department-wide, 기본 true). false = 수련회 없음 */
  is_camp_active?: boolean;
  /** 부서 단위 외부(구글폼 등) 신청 사용 여부 (department-wide) */
  is_external_apply?: boolean;
  /** 외부 신청 링크 URL (is_external_apply=true일 때 메인페이지에 노출) */
  external_apply_url?: string | null;
}

export interface WaterparkInfo {
  title?: string;
  date?: string;     // YYYY-MM-DD
  time?: string;     // 예: "14:00 - 18:00"
  location?: string;
  note?: string;
}

export interface ChildInput {
  name: string;
  birthDate: string;
  gender?: Gender;
  department: DepartmentId;
  subDepartment: string;
  tshirtSize?: string;
  allergies?: string;
  customAllergy?: string;
  attendsWaterpark?: boolean;
  partialAttendanceReason?: string;
  /** 부분 참석 세션 키 배열 (예: ["1-morning", "1-afternoon", "2-evening"]) */
  attendedSessions?: string[];
  custom1?: string | null; custom2?: string | null; custom3?: string | null;
  custom4?: string | null; custom5?: string | null; custom6?: string | null;
  custom7?: string | null; custom8?: string | null; custom9?: string | null;
  custom10?: string | null; custom11?: string | null; custom12?: string | null;
  custom13?: string | null; custom14?: string | null; custom15?: string | null;
  custom16?: string | null; custom17?: string | null; custom18?: string | null;
  custom19?: string | null; custom20?: string | null;
}

export interface ChildRecord extends ChildInput {
  id: string;
  application_id: string;
  created_at: string;
}

export interface Application {
  id: string;
  parent_name: string;
  parent_phone: string;
  depositor_name: string;
  grand_total: number;
  waterfall_parents: WaterfallParent[];
  created_at: string;
  children?: ChildRecord[];
}

export interface PaymentStatus {
  id?: string;
  application_id: string;
  kinder_paid: boolean;
  kids_paid: boolean;
  teens_paid: boolean;
  waterpark_paid: boolean;
}

export interface FeesConfig {
  id: string;
  /** 킨더 부서 회비 */
  kinder: number;
  /** 키즈 부서 회비 */
  kids: number;
  /** 틴즈 부서 회비 */
  teens: number;
  /** 워터풀선데이 자녀 1인 입장료 */
  child_waterpark: number;
  /** 워터풀선데이 학부모 1인 입장료 */
  parent_waterpark: number;
  /** 부서별 회비 입금 계좌 (예: "국민 123-45-6789 홍길동") */
  kinder_account?: string | null;
  kids_account?: string | null;
  teens_account?: string | null;
  /** 워터풀선데이 입장료 입금 계좌 */
  waterpark_account?: string | null;
}

/**
 * JWT payload — 어드민 로그인 시 발급되는 토큰 구조
 */
export interface AdminJwtPayload {
  sub: 'admin';
  allowed_departments: DepartmentId[];
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
