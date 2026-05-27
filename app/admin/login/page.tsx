'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const deptParam = searchParams.get('dept') || 'kinder';
  const callbackUrl = searchParams.get('callback') || `/${deptParam}/admin`;

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Department Styling Settings
  const deptStyles = {
    kinder: {
      title: 'Now Kinder 어드민 로그인',
      primaryColor: '#EAB308', // Yellow
      gradient: 'from-amber-400 to-yellow-500',
      btnHover: 'hover:bg-yellow-600',
      bgColor: 'bg-yellow-50/10',
      cardBorder: 'border-yellow-200',
    },
    kids: {
      title: 'Now Kids 어드민 로그인',
      primaryColor: '#3B82F6', // Blue
      gradient: 'from-blue-500 to-indigo-600',
      btnHover: 'hover:bg-blue-700',
      bgColor: 'bg-blue-50/10',
      cardBorder: 'border-blue-200',
    },
    teens: {
      title: 'Now Teens 어드민 로그인',
      primaryColor: '#22C55E', // Green
      gradient: 'from-emerald-500 to-green-600',
      btnHover: 'hover:bg-green-700',
      bgColor: 'bg-slate-900',
      cardBorder: 'border-green-500/30',
    },
  };

  const currentStyle = deptStyles[deptParam as 'kinder' | 'kids' | 'teens'] || deptStyles.kinder;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, department: deptParam }),
      });

      const data = await res.json();

      if (data.success) {
        // Redirect to protected admin dashboard
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
    <div className={`min-h-screen flex items-center justify-center p-6 ${deptParam === 'teens' ? 'bg-slate-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className={`w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border p-8 space-y-6 ${deptParam === 'teens' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
        {/* Header decoration */}
        <div className="text-center space-y-2">
          <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl shadow-lg bg-gradient-to-tr ${currentStyle.gradient} text-white`}>
            🔒
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{currentStyle.title}</h2>
          <p className="text-sm text-gray-500">교사 전용 대시보드 접근을 위해 비밀번호를 입력해 주세요.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">어드민 패스워드</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition duration-200 ${
                deptParam === 'teens' 
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
            className={`w-full py-3 rounded-lg text-white font-bold transition-all duration-300 transform active:scale-95 shadow-md shadow-slate-950/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r ${currentStyle.gradient} ${currentStyle.btnHover}`}
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

// Sub-import of Link to keep standard
import Link from 'next/link';
