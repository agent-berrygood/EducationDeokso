import { NextRequest, NextResponse } from 'next/server';
import { encryptSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { password, department } = await req.json();

    const expectedPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'deokso1234';

    if (password !== expectedPassword) {
      return NextResponse.json(
        { success: false, error: '비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // Encrypt the session payload
    const sessionToken = await encryptSession({
      role: 'admin',
      authenticated: true,
      department: department as 'kinder' | 'kids' | 'teens',
    });

    const response = NextResponse.json({ success: true });

    // Set the HttpOnly and Secure cookie
    response.cookies.set({
      name: 'admin_session',
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 2, // 2 hours
      path: '/',
    });

    return response;
  } catch (err) {
    console.error("Login API error:", err);
    return NextResponse.json(
      { success: false, error: '서버 에러가 발생했습니다.' },
      { status: 500 }
    );
  }
}
