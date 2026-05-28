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
  customFieldMappings: CustomField[];
  camp_start_date?: string;
  camp_schedule?: EventScheduleSlot[];
  camp_type?: 'continuous' | 'partial';
  camp_duration?: number;
  poster_url?: string;
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
  kinder: number;
  kids: number;
  teens: number;
  parent_waterpark: number;
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
