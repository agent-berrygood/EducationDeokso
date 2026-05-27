'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ApplicationForm from '@/components/ApplicationForm';

// --- TYPE DEFINITIONS ---

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface DepartmentCardProps {
  href: string;
  title: string;
  subtitle: string;
  className: string;
  glowColor: string;
}

// --- SUB-COMPONENTS ---

const CountdownTimer = ({ targetDate }: { targetDate: string }) => {
  const calculateTimeLeft = useCallback((): TimeLeft | null => {
    const difference = +new Date(targetDate) - +new Date();
    if (difference > 0) {
      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }
    return null;
  }, [targetDate]);

  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeLeft]);

  if (!timeLeft) {
    return <div className="text-2xl font-bold text-cyan-300 mt-6">여름성경학교가 시작되었습니다!</div>;
  }

  const timeUnits = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hours', value: timeLeft.hours },
    { label: 'Minutes', value: timeLeft.minutes },
    { label: 'Seconds', value: timeLeft.seconds },
  ];

  return (
    <div className="flex justify-center items-center gap-4 md:gap-8 mt-6">
      {timeUnits.map((unit) => (
        <div key={unit.label} className="flex flex-col items-center">
          <div className="text-4xl md:text-6xl font-bold text-white bg-slate-700/50 rounded-lg p-4 w-[70px] md:w-[100px] text-center">
            {String(unit.value).padStart(2, '0')}
          </div>
          <div className="text-sm md:text-base text-slate-300 mt-2">{unit.label}</div>
        </div>
      ))}
    </div>
  );
};

const DepartmentCard = ({ href, title, subtitle, className, glowColor }: DepartmentCardProps) => (
  <Link href={href} passHref className="block">
    <div
      className={`group relative p-8 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 overflow-hidden ${className}`}
      style={{ '--glow-color': glowColor } as React.CSSProperties}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent transition-all duration-300 opacity-0 group-hover:opacity-100"></div>
      <div className="relative z-10">
        <h3 className="text-3xl font-bold">{title}</h3>
        <p className="text-lg mt-1">{subtitle}</p>
      </div>
    </div>
  </Link>
);

// --- MAIN PAGE COMPONENT ---

export default function HomePage() {
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  const departments: DepartmentCardProps[] = [
    {
      href: '/kinder',
      title: 'Now Kinder',
      subtitle: '영아부 - 유치부',
      className: 'bg-yellow-200/80 border-yellow-300 text-yellow-900',
      glowColor: '#fde047', // yellow-300
    },
    {
      href: '/kids',
      title: 'Now Kids',
      subtitle: '유년부 - 초등부',
      className: 'bg-blue-300/80 border-blue-400 text-blue-900',
      glowColor: '#60a5fa', // blue-400
    },
    {
      href: '/teens',
      title: 'Now Teens',
      subtitle: '중등부 - 고등부',
      className: 'bg-gray-900 border-lime-400 text-lime-300',
      glowColor: '#a3e635', // lime-400
    },
  ];

  return (
    <>
      {/* Application Form Modal */}
      {showApplicationForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={() => setShowApplicationForm(false)}>
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end p-3 pb-0 shrink-0">
              <button
                onClick={() => setShowApplicationForm(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700 hover:bg-red-500 text-slate-400 hover:text-white text-lg transition-all duration-200"
                aria-label="Close application form"
              >
                ✕
              </button>
            </div>
            <div className="p-8 pt-2 overflow-y-auto">
              <ApplicationForm />
            </div>
          </div>
        </div>
      )}

      {/* Main Page Content */}
      <div className="bg-slate-900 text-white min-h-screen font-sans flex flex-col justify-between">
        <main className="container mx-auto px-6 py-12 flex-1">
          {/* Hero Section */}
          <header className="text-center py-16 md:py-24 mb-20 rounded-2xl bg-gradient-to-b from-slate-800 via-slate-900 to-slate-900 border border-slate-700 shadow-2xl">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white to-cyan-300">
              높은뜻덕소교회 지금세대
            </h1>
            <h2 className="text-3xl md:text-4xl text-cyan-400 font-semibold mb-10">
              2026 여름성경학교 & 여름수련회
            </h2>
            
            <CountdownTimer targetDate="2026-07-25T00:00:00" />

            <button
              onClick={() => setShowApplicationForm(true)}
              className="mt-16 px-10 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-xl rounded-full shadow-lg shadow-cyan-500/30 transform hover:scale-105 transition-all duration-300 ease-in-out cursor-pointer"
            >
              성경학교 / 수련회 신청하기
            </button>
          </header>

          {/* Department Cards Section */}
          <section>
            <h3 className="text-center text-4xl font-bold mb-12">부서 바로가기</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {departments.map((dept) => (
                <DepartmentCard key={dept.href} {...dept} />
              ))}
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="text-center py-10 border-t border-slate-800 mt-20">
          <div className="flex flex-col md:flex-row justify-center items-center gap-4 md:gap-8">
            <Link href="/kinder/admin" className="text-slate-400 hover:text-cyan-300 transition-colors">
              나우킨더 관리자
            </Link>
            <span className="hidden md:inline text-slate-600">|</span>
            <Link href="/kids/admin" className="text-slate-400 hover:text-cyan-300 transition-colors">
              나우키즈 관리자
            </Link>
            <span className="hidden md:inline text-slate-600">|</span>
            <Link href="/teens/admin" className="text-slate-400 hover:text-cyan-300 transition-colors">
              나우틴즈 관리자
            </Link>
          </div>
          <p className="text-slate-500 mt-6 text-sm">
            &copy; {new Date().getFullYear()} High Will Deokso Church. All rights reserved.
          </p>
        </footer>
      </div>
    </>
  );
}
