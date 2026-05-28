import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth';
import { adminLoginSchema } from '@/lib/schemas';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = adminLoginSchema.safeParse({
      department: body.department || 'all',
      password: body.password,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: '입력값이 유효하지 않습니다.' },
        { status: 400 }
      );
    }

    const sessionToken = await authenticateAdmin(parsed.data.password, parsed.data.department);

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: '비밀번호가 올바르지 않거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set({
      name: 'admin_session',
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 12, // 12 hours
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Login API error:', err);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
