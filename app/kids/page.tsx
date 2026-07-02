'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useDepartmentTrackConfig } from '@/hooks/useDepartmentTrackConfig';
import TrackPicker from '@/components/public/TrackPicker';

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
  posterUrl?: string;
  isStepRecruitmentActive?: boolean;
}

const DEFAULT_CONFIG: EventConfig = {
  title: '2026 나우키즈 여름성경학교',
  event_type: '여름성경학교',
  subtitle: '<p>기쁨으로 충만한 <strong>나우키즈 바이블 스토리</strong> 캠프!</p>',
  scripture: '<p><em>"주께서 생명의 길을 내게 보이시리니 주의 앞에는 충만한 기쁨이 있고"</em> (시편 16:11)</p>',
  primary_color: '#3B82F6',
  bg_color: '#DBEAFE',
  posterUrl: '',
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
    return <p className="text-xl font-bold mt-4" style={{ color: primaryColor }}>캠프가 시작되었습니다! 🎉</p>;
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
            style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
            {String(u.value).padStart(2, '0')}
          </div>
          <span className="text-xs font-semibold text-gray-400 mt-1">{u.label}</span>
        </div>
      ))}
    </div>
  );
};

export default function KidsPage() {
  const [config, setConfig] = useState<EventConfig>(DEFAULT_CONFIG);
  const [activeDay, setActiveDay] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // 08:00부터 22:00까지 30분 슬롯 목록 생성 (총 28개)
  const START_HOUR = 8;
  const END_HOUR = 22;
  const totalSlots = (END_HOUR - START_HOUR) * 2;
  
  const slots = Array.from({ length: totalSlots }, (_, i) => {
    const h = START_HOUR + Math.floor(i / 2);
    const m = i % 2 === 0 ? '00' : '30';
    return `${String(h).padStart(2, '0')}:${m}`;
  });

  const parseTimeRange = (timeStr: string) => {
    const parts = (timeStr || '').split('-').map(s => s.trim());
    const startTime = parts[0] || '09:00';
    const endTime = parts[1] || '10:30';
    return { startTime, endTime };
  };

  const timeToRowIndex = (timeStr: string): number => {
    const [h, m] = (timeStr || '09:00').split(':').map(Number);
    const hourDiff = h - START_HOUR;
    const slotIndex = hourDiff * 2 + (m >= 30 ? 1 : 0);
    // Row 1은 헤더이므로 최소 2부터 최대 totalSlots + 1 까지 매핑
    return Math.max(0, Math.min(totalSlots - 1, slotIndex)) + 2;
  };

  const { phase, tracks, config: trackConfig, selectTrack } = useDepartmentTrackConfig('kids');

  useEffect(() => {
    if (phase !== 'ready') return;
    if (trackConfig) {
      setConfig(trackConfig);
      if (trackConfig.campSchedule && trackConfig.campSchedule.length > 0) {
        const days = trackConfig.campSchedule.map((s: any) => s.day);
        setActiveDay(Math.min(...days));
      }
    }
    setLoading(false);
  }, [phase, trackConfig]);

  const primaryColor = config.primary_color || DEFAULT_CONFIG.primary_color!;

  if (phase === 'picker') {
    return (
      <TrackPicker
        tracks={tracks}
        onSelect={selectTrack}
        primaryColor={DEFAULT_CONFIG.primary_color!}
        title="나우키즈 — 세부부서를 선택해주세요"
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium text-sm animate-pulse">설정 데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

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
          👦 나우키즈 · {config.event_type}
        </span>
      </nav>

      {/* 히어로 배너 */}
      <main className="container mx-auto px-6 mt-10 max-w-5xl">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 p-8 md:p-16 text-center space-y-8">

          <div className="inline-block px-6 py-2 rounded-full text-sm font-bold tracking-widest mb-4"
            style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
            나우키즈 (아동부 부서)
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight">
            {config.title}
          </h1>

          <div className="text-lg md:text-2xl text-gray-600 prose max-w-none mx-auto"
            dangerouslySetInnerHTML={{ __html: config.subtitle }} />

          {/* 홍보 포스터 */}
          {config.posterUrl && (
            <div className="w-full max-w-3xl mx-auto my-6 overflow-hidden rounded-2xl border border-gray-200 shadow-lg">
              <img 
                src={config.posterUrl} 
                alt={`${config.title} 홍보 포스터`} 
                className="w-full h-auto object-contain block"
              />
            </div>
          )}

          {/* 카운트다운 */}
          {config.camp_start_date && (
            <div className="py-4 border-t border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-400 mb-2">📅 캠프 시작까지</p>
              <CountdownTimer targetDate={config.camp_start_date} primaryColor={primaryColor} />
            </div>
          )}

          {/* 성경 구절 */}
          <div className="p-8 md:p-12 rounded-2xl text-left my-8 border-l-4"
            style={{ borderLeftColor: primaryColor, backgroundColor: `${primaryColor}08` }}>
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">올해의 주제 성구</h4>
            <div className="text-lg md:text-xl font-medium text-gray-700 italic leading-relaxed prose max-w-none"
              dangerouslySetInnerHTML={{ __html: config.scripture }} />
          </div>

          {/* 수련회 세부 일정 (2차원 동적 시간표 그리드 플래너) */}
          {config.campSchedule && config.campSchedule.length > 0 && (() => {
            const uniqueDays = Array.from(new Set(config.campSchedule.map((s) => s.day))).sort((a, b) => a - b);
            
            return (
              <div className="py-12 border-t border-gray-100 text-left">
                <h3 className="text-2xl font-extrabold text-gray-900 mb-6 flex items-center gap-2">
                  <span style={{ color: primaryColor }}>📅</span> 수련회 전체 일정표
                </h3>
                
                <div className="overflow-x-auto rounded-2xl border border-gray-200/80 shadow-lg bg-white/50 backdrop-blur-sm p-4 min-w-[750px]">
                  {/* CSS Grid 타임 슬롯 플래너 보드 */}
                  <div 
                    className="grid relative"
                    style={{
                      gridTemplateColumns: `100px repeat(${uniqueDays.length}, 1fr)`,
                      gridTemplateRows: `50px repeat(${totalSlots}, 45px)`, // 헤더 50px, 각 30분 슬롯당 45px 높이
                    }}
                  >
                    {/* 1. 가로축 일차 헤더 (Row 1) */}
                    <div 
                      className="border-b border-gray-200/60 bg-gray-50/80 flex items-center justify-center font-black text-slate-700 text-xs rounded-tl-xl select-none"
                      style={{ gridRow: '1 / 2', gridColumn: '1 / 2' }}
                    >
                      시간대
                    </div>
                    {uniqueDays.map((dayNum, dayIdx) => (
                      <div 
                        key={dayNum}
                        className="border-b border-r last:border-r-0 border-gray-200/60 bg-gray-50/80 flex items-center justify-center font-black text-slate-800 text-sm select-none"
                        style={{ 
                          gridRow: '1 / 2', 
                          gridColumn: `${dayIdx + 2} / ${dayIdx + 3}`,
                          color: primaryColor,
                          borderTopRightRadius: dayIdx === uniqueDays.length - 1 ? '12px' : '0px'
                        }}
                      >
                        {dayNum}{config.campType === 'continuous' ? '일차' : '주차'}
                      </div>
                    ))}

                    {/* 2. 세로축 30분 단위 배경 슬롯 격자판 생성 */}
                    {slots.map((slotTime, slotIdx) => {
                      const rowNum = slotIdx + 2;
                      return (
                        <React.Fragment key={slotTime}>
                          {/* 시간 라벨 셀 */}
                          <div 
                            className="border-b border-r border-gray-100 bg-gray-50/20 flex items-center justify-center text-[11px] font-extrabold text-indigo-600 select-none text-center"
                            style={{ gridRow: `${rowNum} / ${rowNum + 1}`, gridColumn: '1 / 2' }}
                          >
                            {slotTime}
                          </div>
                          {/* 각 Day별 배경 빈 격자 셀 */}
                          {uniqueDays.map((_, dayIdx) => (
                            <div 
                              key={dayIdx}
                              className="border-b border-r last:border-r-0 border-gray-100 flex items-center justify-center text-[10px] text-gray-200/30 select-none"
                              style={{ 
                                gridRow: `${rowNum} / ${rowNum + 1}`, 
                                gridColumn: `${dayIdx + 2} / ${dayIdx + 3}` 
                              }}
                            >
                              -
                            </div>
                          ))}
                        </React.Fragment>
                      );
                    })}

                    {/* 3. 절대/상대 포지션 기반 일정 카드 얹기 */}
                    {config.campSchedule.map((item, idx) => {
                      const dayIdx = uniqueDays.indexOf(item.day);
                      if (dayIdx === -1) return null;

                      const { startTime, endTime } = parseTimeRange(item.time);
                      const startRow = timeToRowIndex(startTime);
                      const endRow = timeToRowIndex(endTime);
                      const actualEndRow = endRow > startRow ? endRow : startRow + 1; // 최소 30분 높이 보장

                      return (
                        <div
                          key={item.id || idx}
                          className="m-1 p-2.5 rounded-xl border shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md text-left z-10 overflow-hidden flex flex-col justify-between"
                          style={{
                            gridRow: `${startRow} / ${actualEndRow}`,
                            gridColumn: `${dayIdx + 2} / ${dayIdx + 3}`,
                            backgroundColor: item.color || '#ffffff',
                            borderColor: item.color ? `${item.color}dd` : '#e2e8f0',
                          }}
                        >
                          <div>
                            <div className="text-[9px] font-extrabold text-indigo-600 mb-0.5 tracking-tight flex items-center gap-1">
                              🕒 {item.time}
                            </div>
                            <h4 className="font-extrabold text-xs text-slate-850 line-clamp-2 leading-tight">
                              {item.title}
                            </h4>
                          </div>
                          {item.description && (
                            <p className="text-[10px] text-slate-500 line-clamp-1 leading-normal font-semibold mt-0.5 shrink-0">
                              {item.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 메인 페이지 이동 안내 + 스텝 신청 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/"
              className="inline-block px-12 py-5 font-bold text-xl rounded-full shadow-lg transform hover:scale-105 transition-all duration-300 text-white"
              style={{ backgroundColor: primaryColor, boxShadow: `0 10px 20px -5px ${primaryColor}50` }}
            >
              ✏️ 메인 페이지에서 신청하기
            </Link>
            {config.isStepRecruitmentActive && (
              <Link
                href="/step-apply?dept=kids"
                className="inline-block px-12 py-5 font-bold text-xl rounded-full shadow-lg transform hover:scale-105 transition-all duration-300 border-2 bg-white"
                style={{ borderColor: primaryColor, color: primaryColor }}
              >
                🙌 성경학교 스텝 신청하기
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
