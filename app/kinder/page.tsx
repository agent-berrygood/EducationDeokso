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
  title: '2026 나우킨더 여름성경학교',
  event_type: '여름성경학교',
  subtitle: '<p>예수님 안에서 자라나는 <strong>나우킨더 바이블 캠프</strong>!</p>',
  scripture: '<p><em>"오직 우리 주 곧 구주 예수 그리스도의 은혜와 그를 아는 지식에서 자라 가라"</em> (베드로후서 3:18)</p>',
  primary_color: '#EAB308',
  bg_color: '#FEF08A',
};

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const CountdownTimer = ({ targetDate }: { targetDate: string }) => {
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
    return <p className="text-xl font-bold mt-4" style={{ color: DEFAULT_CONFIG.primary_color }}>캠프가 시작되었습니다! 🎉</p>;
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
          <div className="text-3xl md:text-5xl font-extrabold rounded-xl px-4 py-3 min-w-[70px] text-center"
            style={{ backgroundColor: `${DEFAULT_CONFIG.primary_color}20`, color: DEFAULT_CONFIG.primary_color }}>
            {String(u.value).padStart(2, '0')}
          </div>
          <span className="text-xs font-semibold text-gray-400 mt-1">{u.label}</span>
        </div>
      ))}
    </div>
  );
};

export default function KinderPage() {
  const [config, setConfig] = useState<EventConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config/kinder');
        if (!res.ok) return;
        const { data } = await res.json();
        if (data) setConfig(data);
      } catch (err) {
        console.error('나우킨더 설정 로드 실패:', err);
      }
    };
    fetchConfig();
  }, []);

  const primaryColor = config.primary_color || DEFAULT_CONFIG.primary_color;

  return (
    <div
      className="min-h-screen font-sans transition-all duration-500 pb-20"
      style={{
        backgroundColor: `${config.bg_color || DEFAULT_CONFIG.bg_color}15`,
        '--primary-color': primaryColor,
      } as React.CSSProperties}
    >
      {/* 네비게이션 */}
      <nav className="container mx-auto px-6 py-6 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span style={{ color: primaryColor }}>🏠</span> 지금세대 홈으로
        </Link>
        <span className="text-sm font-semibold px-4 py-1.5 rounded-full tracking-wider"
          style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
          👶 나우킨더 · {config.event_type}
        </span>
      </nav>

      {/* 히어로 배너 */}
      <main className="container mx-auto px-6 mt-10 max-w-5xl">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 p-8 md:p-16 text-center space-y-8">

          <div className="inline-block px-6 py-2 rounded-full text-sm font-bold tracking-widest mb-4"
            style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
            나우킨더 (미취학 부서)
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight">
            {config.title}
          </h1>

          <div className="text-lg md:text-2xl text-gray-600 prose max-w-none mx-auto"
            dangerouslySetInnerHTML={{ __html: config.subtitle }} />

          {/* 카운트다운 */}
          {config.camp_start_date && (
            <div className="py-4 border-t border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-400 mb-2">📅 캠프 시작까지</p>
              <CountdownTimer targetDate={config.camp_start_date} />
            </div>
          )}

          {/* 성경 구절 */}
          <div className="p-8 md:p-12 rounded-2xl text-left my-8 border-l-4"
            style={{ borderLeftColor: primaryColor, backgroundColor: `${primaryColor}08` }}>
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">올해의 주제 성구</h4>
            <div className="text-lg md:text-xl font-medium text-gray-700 italic leading-relaxed prose max-w-none"
              dangerouslySetInnerHTML={{ __html: config.scripture }} />
          </div>

          {/* 메인 페이지 이동 안내 */}
          <Link
            href="/"
            className="inline-block px-12 py-5 font-bold text-xl rounded-full shadow-lg transform hover:scale-105 transition-all duration-300 text-white"
            style={{ backgroundColor: primaryColor, boxShadow: `0 10px 20px -5px ${primaryColor}50` }}
          >
            ✏️ 메인 페이지에서 신청하기
          </Link>
        </div>
      </main>
    </div>
  );
}
