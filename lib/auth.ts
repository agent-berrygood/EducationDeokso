/**
 * 어드민 인증 유틸리티 (jose 기반 JWE)
 * - 부서별 비밀번호는 서버사이드 환경 변수로만 관리
 * - 발급되는 토큰에 allowed_departments claim 포함
 * - 모든 어드민 API는 checkDepartmentAccess로 통과 가능한 부서 확인
 */
import { EncryptJWT, jwtDecrypt } from 'jose';
import type { DepartmentId } from './types';

const SECRET_KEY = process.env.JWT_SECRET || 'deokso-education-church-summer-camp-2026-secret-key-32bytes-length!';
const key = new TextEncoder().encode(SECRET_KEY.slice(0, 32));

export interface AdminSession {
  role: 'admin';
  authenticated: boolean;
  /** 단일 부서 (레거시 호환) */
  department?: DepartmentId;
  /** 접근 허용된 부서 목록 (신규) */
  allowed_departments: DepartmentId[];
}

export async function encryptSession(payload: AdminSession): Promise<string> {
  return await new EncryptJWT({ ...payload })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .encrypt(key);
}

export async function decryptSession(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtDecrypt(token, key);
    return payload as unknown as AdminSession;
  } catch (err) {
    return null;
  }
}

/**
 * 어드민 비밀번호 검증 → 통합 권한(전체 부서) 세션 토큰 발급
 *
 * 교역자 단일 운영 정책에 따라 인증 통과 시 항상 모든 부서 접근 권한 부여.
 * 우선순위:
 *   1. ADMIN_PASSWORD (서버사이드)
 *   2. NEXT_PUBLIC_ADMIN_PASSWORD (레거시 호환)
 *   3. ADMIN_PASSWORD_ALL / ADMIN_PASSWORD_KINDER / KIDS / TEENS
 *      (어떤 키든 통과하면 통합 권한으로 발급)
 *
 * @param password 사용자 입력 비밀번호
 * @param _requestedDept 호환성을 위해 시그니처는 유지 (값은 무시)
 */
export async function authenticateAdmin(
  password: string,
  _requestedDept?: DepartmentId | 'all'
): Promise<string | null> {
  const validPasswords = [
    process.env.ADMIN_PASSWORD,
    process.env.NEXT_PUBLIC_ADMIN_PASSWORD,
    process.env.ADMIN_PASSWORD_ALL,
    process.env.ADMIN_PASSWORD_KINDER,
    process.env.ADMIN_PASSWORD_KIDS,
    process.env.ADMIN_PASSWORD_TEENS,
  ].filter(Boolean) as string[];

  if (validPasswords.length === 0) return null;
  if (!validPasswords.includes(password)) return null;

  const allowed: DepartmentId[] = ['kinder', 'kids', 'teens'];

  return await encryptSession({
    role: 'admin',
    authenticated: true,
    allowed_departments: allowed,
  });
}

/**
 * 헤더/쿠키에서 토큰 추출 + 부서 권한 확인
 */
export async function checkDepartmentAccess(
  token: string | null | undefined,
  requiredDept: DepartmentId
): Promise<{ ok: true; session: AdminSession } | { ok: false; reason: string }> {
  if (!token) return { ok: false, reason: '인증 토큰이 없습니다.' };
  const cleaned = token.startsWith('Bearer ') ? token.slice(7) : token;
  const session = await decryptSession(cleaned);
  if (!session) return { ok: false, reason: '인증 토큰이 유효하지 않습니다.' };
  if (!session.allowed_departments?.includes(requiredDept)) {
    return { ok: false, reason: `${requiredDept} 부서 접근 권한이 없습니다.` };
  }
  return { ok: true, session };
}
