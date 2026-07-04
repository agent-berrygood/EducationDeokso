/**
 * zod 스키마 정의
 * 클라이언트/서버 양측에서 동일한 검증 규칙을 적용하기 위한 단일 출처.
 */
import { z } from 'zod';

export const departmentSchema = z.enum(['kinder', 'kids', 'teens']);

export const waterfallRelationSchema = z.enum(['부', '모', '조부', '조모', '기타']);

export const waterfallParentSchema = z.object({
  name: z.string().min(1, '보호자 이름 필수'),
  relation: waterfallRelationSchema,
  phone: z.string().min(1, '보호자 연락처 필수'),
});

const attendedDateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  '참석 날짜 포맷이 올바르지 않습니다 (YYYY-MM-DD).'
);

export const childInputSchema = z.object({
  name: z.string().min(1),
  birthDate: z.string().min(1),
  gender: z.enum(['male', 'female']).optional(),
  department: departmentSchema,
  subDepartment: z.string().min(1),
  tshirtSize: z.string().optional(),
  allergies: z.string().optional(),
  customAllergy: z.string().optional(),
  attendsWaterpark: z.boolean().optional(),
  attendedSessions: z.array(attendedDateSchema).optional(),
  partialAttendanceReason: z.string().optional(),
  custom1: z.string().nullable().optional(),
  custom2: z.string().nullable().optional(),
  custom3: z.string().nullable().optional(),
  custom4: z.string().nullable().optional(),
  custom5: z.string().nullable().optional(),
  custom6: z.string().nullable().optional(),
  custom7: z.string().nullable().optional(),
  custom8: z.string().nullable().optional(),
  custom9: z.string().nullable().optional(),
  custom10: z.string().nullable().optional(),
  custom11: z.string().nullable().optional(),
  custom12: z.string().nullable().optional(),
  custom13: z.string().nullable().optional(),
  custom14: z.string().nullable().optional(),
  custom15: z.string().nullable().optional(),
  custom16: z.string().nullable().optional(),
  custom17: z.string().nullable().optional(),
  custom18: z.string().nullable().optional(),
  custom19: z.string().nullable().optional(),
  custom20: z.string().nullable().optional(),
});

export const applicationSubmitSchema = z.object({
  parentName: z.string().min(1, '부모 이름 필수'),
  parentPhone: z.string().min(1, '연락처 필수'),
  depositorName: z.string().min(1, '입금자 이름 필수'),
  // 워터풀 비활성 부서만 신청하는 경우 0명 허용 — 활성 부서 포함 시 클라이언트에서 1명 이상 검증
  waterfallParents: z.array(waterfallParentSchema),
  children: z.array(childInputSchema).min(1, '자녀 1명 이상 필수'),
  grandTotal: z.number().nonnegative(),
  /** 학부모 차량 정보 (차량번호/차종 등, 선택) */
  vehicleInfo: z.string().optional(),
  /** 덕소지역 카풀 차량 지원 가능 여부 */
  carpoolAvailable: z.boolean().optional(),
  /** 지원 차량이 태울 수 있는 인원 (carpoolAvailable=true일 때) */
  carpoolCapacity: z.number().int().nonnegative().optional(),
});

export const customFieldSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  type: z.enum(['text', 'textarea', 'select', 'checkbox']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  columnIndex: z.number().int().min(1).max(20),
});

export const subDepartmentSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const eventConfigUpdateSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  scripture: z.string().optional(),
  eventType: z.string().optional(),
  primaryColor: z.string().optional(),
  bgColor: z.string().optional(),
  subDepartments: z.array(subDepartmentSchema).optional(),
  events: z.array(z.any()).optional(),
  tshirtSizes: z.array(z.string()).optional(),
  customFieldMappings: z.array(customFieldSchema).optional(),
  campStartDate: z.string().optional(),
  campSchedule: z.array(z.any()).optional(),
  campType: z.string().optional(),
  campDuration: z.number().optional(),
  isStepRecruitmentActive: z.boolean().optional(),
  tshirtDeadline: z.string().nullable().optional(),
  stepTshirtSizes: z.array(z.string()).optional(),
  isWaterparkActive: z.boolean().optional(),
  waterparkInfo: z.object({
    title: z.string().optional(),
    date: z.string().optional(),
    time: z.string().optional(),
    location: z.string().optional(),
    note: z.string().optional(),
  }).optional(),
});

export const adminLoginSchema = z.object({
  department: z.union([departmentSchema, z.literal('all')]),
  password: z.string().min(1),
});

/** 스텝 신청 — 캠프(부서·트랙)별 참석 형태 */
export const staffEntrySchema = z.object({
  department: departmentSchema,
  /** 분리 운영 부서의 트랙 키 (미지정 시 'main') */
  trackKey: z.string().optional(),
  /** 표시용 트랙(캠프) 이름 — 관리자 화면 표기 편의를 위해 저장 */
  trackLabel: z.string().optional(),
  attendanceType: z.enum(['full', 'partial']),
  /** 부분 참석 시 세션 키 배열 (예: ["1-morning", "2-evening"]) */
  attendedSessions: z.array(z.string()).default([]),
  /** 스텝 티셔츠 사이즈 (해당 캠프에 step_tshirt_sizes가 설정된 경우) */
  tshirtSize: z.string().optional(),
});

export const staffApplicationSubmitSchema = z.object({
  name: z.string().min(1, '이름 필수'),
  phone: z.string().min(1, '연락처 필수'),
  note: z.string().optional(),
  entries: z.array(staffEntrySchema).min(1, '신청할 캠프를 1개 이상 선택하세요'),
});

export type ApplicationSubmit = z.infer<typeof applicationSubmitSchema>;
export type EventConfigUpdate = z.infer<typeof eventConfigUpdateSchema>;
export type AdminLogin = z.infer<typeof adminLoginSchema>;
export type StaffApplicationSubmit = z.infer<typeof staffApplicationSubmitSchema>;
