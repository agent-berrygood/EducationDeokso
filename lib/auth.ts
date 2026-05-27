import { EncryptJWT, jwtDecrypt } from 'jose';

const SECRET_KEY = process.env.JWT_SECRET || 'deokso-education-church-summer-camp-2026-secret-key-32bytes-length!';
// Generate a 256-bit key by hashing or slicing the secret key
const key = new TextEncoder().encode(SECRET_KEY.slice(0, 32));

export interface AdminSession {
  role: string;
  authenticated: boolean;
  department: 'kinder' | 'kids' | 'teens';
}

export async function encryptSession(payload: AdminSession): Promise<string> {
  return await new EncryptJWT({ ...payload })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .encrypt(key);
}

export async function decryptSession(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtDecrypt(token, key);
    return payload as unknown as AdminSession;
  } catch (err) {
    console.error("JWT decryption failed:", err);
    return null;
  }
}
