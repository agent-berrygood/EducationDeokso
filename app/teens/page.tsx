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
  campSchedule?: any[];
  campType?: string;
  campDuration?: number;
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
  const [activeDay, setActiveDay] = useState<number>(1);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config/teens');
        if (!res.ok) return;
        const { data } = await res.json();
        if (data) {
          setConfig(data);
          if (data.campSchedule && data.campSchedule.length > 0) {
            const days = data.campSchedule.map((s: any) => s.day);
            setActiveDay(Math.min(...days));
          }
        }
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

          {/* 수련회 세부 일정 (2차원 격자 매트릭스 시간표) */}
          {config.campSchedule && config.campSchedule.length > 0 && (
            <div className="py-12 border-t border-slate-800 text-left">
              <h3 className="text-2xl font-extrabold text-white mb-6 flex items-center gap-2">
                <span style={{ color: primaryColor }}>📅</span> 수련회 전체 일정표
              </h3>
              
              <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-2xl bg-slate-900/40 backdrop-blur-md">
                <table className="w-full border-collapse text-left min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <th className="p-4 border-r border-slate-800 w-40 text-center font-black text-slate-350">시간대</th>
                      {Array.from(new Set(config.campSchedule.map((s) => s.day)))
                        .sort((a, b) => a - b)
                        .map((dayNum) => (
                          <th key={dayNum} className="p-4 border-r border-slate-800 last:border-r-0 text-center font-black text-sm" style={{ color: primaryColor }}>
                            {dayNum}{config.campType === 'continuous' ? '일차' : '주차'}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {Array.from(new Set(config.campSchedule.map((s) => s.time)))
                      .sort((a, b) => a.localeCompare(b))
                      .map((timeRange) => {
                        const days = Array.from(new Set(config.campSchedule!.map((s) => s.day))).sort((a, b) => a - b);
                        return (
                          <tr key={timeRange} className="hover:bg-slate-900/20 transition duration-150">
                            {/* 시간축 셀 */}
                            <td className="p-4 border-r border-slate-800 text-xs font-extrabold text-indigo-400 bg-slate-950/20 text-center select-none" style={{ color: primaryColor }}>
                              🕒 {timeRange}
                            </td>
                            {/* 각 일차별 스케줄 카드 셀 */}
                            {days.map((dayNum) => {
                              const matchItem = config.campSchedule!.find((s) => s.day === dayNum && s.time === timeRange);
                              return (
                                <td key={dayNum} className="p-3 border-r border-slate-800 last:border-r-0 align-top h-28 w-1/4">
                                  {matchItem ? (
                                    <div
                                      className="h-full p-3 rounded-xl border transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg text-left"
                                      style={{
                                        backgroundColor: matchItem.color ? `${matchItem.color}15` : 'rgba(15, 23, 42, 0.6)',
                                        borderColor: matchItem.color || 'rgb(30, 41, 59)',
                                        boxShadow: `0 4px 10px -2px rgba(0, 0, 0, 0.5)`
                                      }}
                                    >
                                      <h4 className="font-extrabold text-sm text-white line-clamp-2 leading-tight">
                                        {matchItem.title}
                                      </h4>
                                      {matchItem.description && (
                                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed font-semibold">
                                          {matchItem.description}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="h-full rounded-xl border border-dashed border-slate-800/40 bg-slate-950/10 flex items-center justify-center text-[10px] text-slate-700 select-none font-medium">
                                      -
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
