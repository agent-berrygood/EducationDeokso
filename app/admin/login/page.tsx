'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type DeptOption = 'kinder' | 'kids' | 'teens' | 'all';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const deptParam = (searchParams.get('dept') || 'all') as DeptOption;
  const callbackUrl = searchParams.get('callback')
    || (deptParam === 'all' ? '/admin' : `/${deptParam}/admin`);

  const [department, setDepartment] = useState<DeptOption>(deptParam);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const deptStyles: Record<DeptOption, { title: string; gradient: string; btnHover: string }> = {
    kinder: { title: '나우킨더 관리자 로그인', gradient: 'from-amber-400 to-yellow-500', btnHover: 'hover:opacity-90' },
    kids:   { title: '나우키즈 관리자 로그인',  gradient: 'from-blue-500 to-indigo-600',  btnHover: 'hover:opacity-90' },
    teens:  { title: '나우틴즈 관리자 로그인',  gradient: 'from-emerald-500 to-green-600', btnHover: 'hover:opacity-90' },
    all:    { title: '통합 관리자 로그인',       gradient: 'from-cyan-500 to-blue-600',    btnHover: 'hover:opacity-90' },
  };

  const currentStyle = deptStyles[department] || deptStyles.all;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, department }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(department === 'all' ? '/admin' : callbackUrl);
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
    <div className={`min-h-screen flex items-center justify-center p-6 ${department === 'teens' ? 'bg-slate-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border p-8 space-y-6 ${department === 'teens' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
        <div className="text-center space-y-2">
          <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl shadow-lg bg-gradient-to-tr ${currentStyle.gradient} text-white`}>
            🔒
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{currentStyle.title}</h2>
          <p className="text-sm text-gray-500">교사 전용 대시보드 접근을 위해 비밀번호를 입력해 주세요.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">접근 권한</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value as DeptOption)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition duration-200 ${
                department === 'teens'
                  ? 'bg-slate-800 border-slate-700 focus:ring-green-500'
                  : 'bg-white border-gray-300 focus:ring-indigo-500'
              }`}
            >
              <option value="all">통합 관리자 (전체 부서)</option>
              <option value="kinder">나우킨더 관리자</option>
              <option value="kids">나우키즈 관리자</option>
              <option value="teens">나우틴즈 관리자</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">비밀번호</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition duration-200 ${
                department === 'teens'
                  ? 'bg-slate-800 border-slate-700 focus:ring-green-500 focus:border-green-500'
                  : 'bg-white border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
              }`}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}

          <button
            type="submit"
            disabled={isLoading || !password}
            className={`w-full py-3 rounded-lg text-white font-bold transition-all duration-300 transform active:scale-95 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r ${currentStyle.gradient} ${currentStyle.btnHover}`}
          >
            {isLoading ? '인증 확인 중...' : '로그인'}
          </button>
        </form>

        <div className="text-center pt-2">
          <Link href="/" className="text-sm text-gray-400 hover:text-cyan-400 transition-colors">
            🏠 일반 신청자 홈페이지로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">로딩 중...</div>}>
      <AdminLoginForm />
    </Suspense>
  );
}
