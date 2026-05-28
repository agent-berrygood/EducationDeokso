'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 부서별 어드민 직접 접근을 위한 callback 호환 유지 (모든 권한은 통합으로 발급됨)
  const callbackUrl = searchParams.get('callback') || '/admin';

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, department: 'all' }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(callbackUrl);
      } else {
        setError(data.error || '로그인에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 text-white">
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-800 bg-slate-900 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl shadow-lg bg-gradient-to-tr from-cyan-500 to-blue-600 text-white">
            🔒
          </div>
          <h2 className="text-2xl font-bold tracking-tight">교역자 관리자 로그인</h2>
          <p className="text-sm text-slate-400">교역자 전용 대시보드 접근을 위해 비밀번호를 입력해 주세요.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">비밀번호</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition duration-200 bg-slate-800 border-slate-700 focus:ring-cyan-500 focus:border-cyan-500"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-400 font-medium text-center">{error}</p>}

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full py-3 rounded-lg text-white font-bold transition-all duration-300 transform active:scale-95 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90"
          >
            {isLoading ? '인증 확인 중...' : '로그인'}
          </button>
        </form>

        <div className="text-center pt-2">
          <Link href="/" className="text-sm text-slate-500 hover:text-cyan-400 transition-colors">
            🏠 신청자 홈페이지로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">로딩 중...</div>}>
      <AdminLoginForm />
    </Suspense>
  );
}
