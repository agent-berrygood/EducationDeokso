'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface EventConfig {
  title: string;
  event_type: string;
  subtitle: string;
  scripture: string;
  primary_color?: string;
  bg_color?: string;
  camp_start_date?: string;
}

const DEFAULT_CONFIG: EventConfig = {
  title: '2026 나우틴즈 여름수련회',
  event_type: '여름수련회',
  subtitle: '<p>어두운 세상에서 그리스도의 빛을 발하는 <strong>나우틴즈 네온 캠프</strong>!</p>',
  scripture: '<p><em>"너희는 세상의 빛이라 산 위에 있는 동네가 숨겨지지 못할 것이요"</em> (마태복음 5:14)</p>',
  primary_color: '#22C55E',
  bg_color: '#0F172A',
};

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const CountdownTimer = ({ targetDate, primaryColor }: { targetDate: string; primaryColor: string }) => {
  const calc = useCallback((): TimeLeft | null => {
    const diff = +new Date(targetDate) - +new Date();
    if (diff <= 0) return null;
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / 1000 / 60) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }, [targetDate]);

  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(calc());

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(timer);
  }, [calc]);

  if (!timeLeft) {
    return <p className="text-xl font-bold mt-4" style={{ color: primaryColor }}>수련회가 시작되었습니다! 🎉</p>;
  }

  const units = [
    { label: '일', value: timeLeft.days },
    { label: '시간', value: timeLeft.hours },
    { label: '분', value: timeLeft.minutes },
    { label: '초', value: timeLeft.seconds },
  ];

  return (
    <div className="flex justify-center gap-3 mt-6 flex-wrap">
      {units.map((u) => (
        <div key={u.label} className="flex flex-col items-center">
          <div
            className="text-3xl md:text-5xl font-extrabold rounded-xl px-4 py-3 min-w-[70px] text-center bg-slate-800"
            style={{ color: primaryColor, boxShadow: `0 0 15px ${primaryColor}40` }}
          >
            {String(u.value).padStart(2, '0')}
          </div>
          <span className="text-xs font-semibold text-slate-400 mt-1">{u.label}</span>
        </div>
      ))}
    </div>
  );
};

export default function TeensPage() {
  const [config, setConfig] = useState<EventConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config/teens');
        if (!res.ok) return;
        const { data } = await res.json();
        if (data) setConfig(data);
      } catch (err) {
        console.error('나우틴즈 설정 로드 실패:', err);
      }
    };
    fetchConfig();
  }, []);

  const primaryColor = config.primary_color || DEFAULT_CONFIG.primary_color!;

  return (
    <div
      className="min-h-screen font-sans transition-all duration-500 pb-20 text-white bg-slate-950"
      style={{ '--primary-color': primaryColor } as React.CSSProperties}
    >
      {/* 네비게이션 */}
      <nav className="container mx-auto px-6 py-6 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span style={{ color: primaryColor }}>🏠</span> 지금세대 홈으로
        </Link>
        <span
          className="text-sm font-semibold px-4 py-1.5 rounded-full tracking-wider bg-slate-800 border border-slate-700"
          style={{ color: primaryColor }}
        >
          🧑 나우틴즈 · {config.event_type}
        </span>
      </nav>

      {/* 히어로 배너 */}
      <main className="container mx-auto px-6 mt-10 max-w-5xl">
        <div
          className="rounded-3xl shadow-2xl overflow-hidden p-8 md:p-16 text-center space-y-8 bg-slate-900 border"
          style={{ borderColor: `${primaryColor}30` }}
        >
          <div
            className="inline-block px-6 py-2 rounded-full text-sm font-bold tracking-widest mb-4 border"
            style={{ borderColor: `${primaryColor}50`, backgroundColor: `${primaryColor}10`, color: primaryColor }}
          >
            나우틴즈 (중고등부 부서)
          </div>

          <h1
            className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight bg-clip-text text-transparent"
            style={{ backgroundImage: `linear-gradient(to right, #ffffff, ${primaryColor})` }}
          >
            {config.title}
          </h1>

          <div
            className="text-lg md:text-2xl text-slate-300 prose dark:prose-invert max-w-none mx-auto"
            dangerouslySetInnerHTML={{ __html: config.subtitle }}
          />

          {/* 카운트다운 */}
          {config.camp_start_date && (
            <div className="py-4 border-t border-b border-slate-700">
              <p className="text-sm font-semibold text-slate-500 mb-2">📅 수련회 시작까지</p>
              <CountdownTimer targetDate={config.camp_start_date} primaryColor={primaryColor} />
            </div>
          )}

          {/* 성경 구절 */}
          <div
            className="p-8 md:p-12 rounded-2xl text-left my-8 border-l-4"
            style={{ borderLeftColor: primaryColor, backgroundColor: '#05070c', boxShadow: `inset 0 0 20px ${primaryColor}08` }}
          >
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">올해의 주제 성구</h4>
            <div
              className="text-lg md:text-xl font-medium text-slate-300 italic leading-relaxed prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: config.scripture }}
            />
          </div>

          {/* 메인 페이지 이동 안내 */}
          <Link
            href="/"
            className="inline-block px-12 py-5 font-bold text-xl rounded-full shadow-lg transform hover:scale-105 transition-all duration-300 text-slate-950"
            style={{ backgroundColor: primaryColor, boxShadow: `0 10px 30px -5px ${primaryColor}60` }}
          >
            ✏️ 메인 페이지에서 신청하기
          </Link>
        </div>
      </main>
    </div>
  );
}
