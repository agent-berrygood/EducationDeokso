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
