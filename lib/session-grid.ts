/**
 * 부분 참석 세션 그리드 단일 출처 모듈
 *
 * 세션 키 포맷: `${day}-${slot}` (예: "1-morning", "3-evening")
 * - day: 1 이상 정수
 * - slot: morning(08:00~12:00) / afternoon(12:00~18:00) / evening(18:00~22:00)
 *
 * 클라이언트와 서버 양측 검증에 동일하게 사용.
 */

export type SessionSlot = 'morning' | 'afternoon' | 'evening';
export type SessionKey = `${number}-${SessionSlot}`;

export const SLOTS: SessionSlot[] = ['morning', 'afternoon', 'evening'];
export const SLOT_LABELS: Record<SessionSlot, string> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁',
};
export const SLOT_SHORT_LABELS: Record<SessionSlot, string> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁',
};
export const SLOT_HOURS: Record<SessionSlot, [number, number]> = {
  morning: [8, 12],
  afternoon: [12, 18],
  evening: [18, 22],
};

const SESSION_KEY_REGEX = /^[1-9][0-9]*-(morning|afternoon|evening)$/;

export function isSessionKey(value: unknown): value is SessionKey {
  return typeof value === 'string' && SESSION_KEY_REGEX.test(value);
}

export function buildSessionKey(day: number, slot: SessionSlot): SessionKey {
  if (!Number.isInteger(day) || day < 1) {
    throw new Error(`Invalid day for session key: ${day}`);
  }
  return `${day}-${slot}` as SessionKey;
}

export function parseSessionKey(key: string): { day: number; slot: SessionSlot } | null {
  if (!SESSION_KEY_REGEX.test(key)) return null;
  const [dayStr, slot] = key.split('-');
  return { day: Number(dayStr), slot: slot as SessionSlot };
}

/**
 * HH:mm 시간 문자열 → 슬롯 자동 추정 (fallback 용도, 관리자 명시 선택 우선)
 */
export function hourToSlot(hhmm: string): SessionSlot | null {
  if (!hhmm) return null;
  const [hStr] = hhmm.split(':');
  const h = Number(hStr);
  if (!Number.isFinite(h)) return null;
  if (h < 8) return null;
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  if (h < 22) return 'evening';
  return null;
}

/**
 * camp_schedule 배열에서 최대 day 값 추출. 비어있으면 camp_duration fallback.
 */
export function deriveDayCount(
  campSchedule: any[] | null | undefined,
  campDuration?: number | null
): number {
  let max = 0;
  if (Array.isArray(campSchedule)) {
    for (const item of campSchedule) {
      const d = Number(item?.day);
      if (Number.isInteger(d) && d > max) max = d;
    }
  }
  if (max > 0) return max;
  if (campDuration && campDuration > 0) return campDuration;
  return 3; // 안전 디폴트
}

/**
 * 전체 그리드 생성 (1일~N일 × 3슬롯). UI 그리드 렌더링용.
 */
export function allSessionKeys(dayCount: number): SessionKey[] {
  const out: SessionKey[] = [];
  for (let d = 1; d <= dayCount; d++) {
    for (const slot of SLOTS) {
      out.push(buildSessionKey(d, slot));
    }
  }
  return out;
}

/**
 * 시간표 카드 → 세션 키 매핑 (UI 마스킹용)
 * 각 일정 카드가 어느 슬롯에 속하는지 추정.
 */
export function scheduleItemToKey(item: { day?: number | string; time?: string | null; slot?: SessionSlot | null }): SessionKey | null {
  const day = Number(item.day);
  if (!Number.isInteger(day) || day < 1) return null;
  const slot: SessionSlot | null = item.slot
    ? item.slot
    : (item.time ? hourToSlot(item.time) : null);
  if (!slot) return null;
  return buildSessionKey(day, slot);
}

/**
 * 서버 사이드 검증: 모든 세션 키가 정상 포맷이고 day가 허용 범위 이내인지.
 */
export function validateSessionKeys(keys: string[], maxDay: number): { ok: true } | { ok: false; reason: string } {
  for (const k of keys) {
    if (!isSessionKey(k)) {
      return { ok: false, reason: `세션 키 포맷 오류: ${k}` };
    }
    const parsed = parseSessionKey(k)!;
    if (parsed.day > maxDay) {
      return { ok: false, reason: `허용 일차(${maxDay})를 초과한 세션: ${k}` };
    }
  }
  return { ok: true };
}
