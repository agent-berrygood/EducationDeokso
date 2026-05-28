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

interface DepartmentCredential {
  allowed: DepartmentId[];
}

/**
 * 환경 변수에서 비밀번호 → 허용 부서 매핑 로드
 *   - ADMIN_PASSWORD_ALL    : 전체 부서
 *   - ADMIN_PASSWORD_KINDER : kinder
 *   - ADMIN_PASSWORD_KIDS   : kids
 *   - ADMIN_PASSWORD_TEENS  : teens
 *   - ADMIN_PASSWORD        : 레거시 fallback (전체 부서)
 *   - NEXT_PUBLIC_ADMIN_PASSWORD : 레거시 호환만 유지 (보안상 사용 자제)
 */
function loadCredentials(): Map<string, DepartmentCredential> {
  const creds = new Map<string, DepartmentCredential>();
  const ALL = process.env.ADMIN_PASSWORD_ALL;
  if (ALL) creds.set(ALL, { allowed: ['kinder', 'kids', 'teens'] });

  const KIN = process.env.ADMIN_PASSWORD_KINDER;
  if (KIN) creds.set(KIN, { allowed: ['kinder'] });

  const KID = process.env.ADMIN_PASSWORD_KIDS;
  if (KID) creds.set(KID, { allowed: ['kids'] });

  const TEEN = process.env.ADMIN_PASSWORD_TEENS;
  if (TEEN) creds.set(TEEN, { allowed: ['teens'] });

  const LEGACY = process.env.ADMIN_PASSWORD || process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
  if (LEGACY && !creds.has(LEGACY)) {
    creds.set(LEGACY, { allowed: ['kinder', 'kids', 'teens'] });
  }
  return creds;
}

/**
 * 비밀번호 검증 후 세션 토큰 발급
 * @param password 사용자 입력 비밀번호
 * @param requestedDept 요청 부서 또는 'all'(통합)
 */
export async function authenticateAdmin(
  password: string,
  requestedDept: DepartmentId | 'all'
): Promise<string | null> {
  const creds = loadCredentials();
  const cred = creds.get(password);
  if (!cred) return null;

  if (requestedDept !== 'all' && !cred.allowed.includes(requestedDept)) {
    return null;
  }

  const allowed: DepartmentId[] =
    requestedDept === 'all' ? cred.allowed : [requestedDept];

  return await encryptSession({
    role: 'admin',
    authenticated: true,
    department: allowed.length === 1 ? allowed[0] : undefined,
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
