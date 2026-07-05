/** AdminDashboard / AdminSettingsPanel에서 공유하는 CMS 설정 폼 타입 (API의 camelCase 응답 형태와 1:1) */

export interface SettingsCustomField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
  columnIndex: number;
}

export interface SettingsSubDepartment {
  id: string;
  label: string;
}

export interface SettingsScheduleItem {
  id: string;
  day: number;
  time: string;
  title: string;
  description: string;
}

export interface SettingsWaterparkInfo {
  title: string;
  date: string;
  time: string;
  location: string;
  note: string;
}

export interface SettingsForm {
  title: string;
  eventType: string;
  subtitle: string;
  scripture: string;
  primaryColor: string;
  bgColor: string;
  tshirtSizes: string[];
  customFields: SettingsCustomField[];
  subDepartments: SettingsSubDepartment[];
  campStartDate: string;
  campSchedule: SettingsScheduleItem[];
  campType: 'continuous' | 'weekly';
  campDuration: number;
  posterUrl: string;
  events: unknown[];
  isStepRecruitmentActive: boolean;
  tshirtDeadline: string;
  stepTshirtSizes: string[];
  isWaterparkActive: boolean;
  waterparkInfo: SettingsWaterparkInfo;
  /** 부서 단위 "올해 수련회 운영 여부" (기본 true). false = 수련회 없음 */
  isCampActive: boolean;
  /** 부서 단위 외부(구글폼 등) 신청 사용 여부 */
  isExternalApply: boolean;
  /** 외부 신청 링크 URL */
  externalApplyUrl: string;
  /** 해당 트랙의 표시 이름 (편집용) */
  trackLabel: string;
  /** 이 트랙 전용 입금 계좌 (비우면 글로벌 요금설정 계좌로 폴백) */
  account: string;
}

export interface TrackInfo {
  trackKey: string;
  label: string;
  subDepartmentIds: string[];
}

export interface NewCustomFieldDraft {
  label: string;
  type: SettingsCustomField['type'];
  required: boolean;
  options: string;
  columnIndex: number;
}
