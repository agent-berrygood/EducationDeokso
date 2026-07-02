'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface ScheduleItem {
  id: string;
  day: number;
  time: string;
  title: string;
  description: string;
  color?: string; // 카드 개별 악센트 컬러
}

const PRESETS: Record<string, ScheduleItem[]> = {
  continuous_3: [
    // Day 1
    { id: 'c1', day: 1, time: '09:00 - 10:30', title: '교회 집결 및 등록', description: '체육관 앞 로비에서 등록 및 웰컴 키트 수령', color: '#eff6ff' },
    { id: 'c2', day: 1, time: '10:30 - 12:00', title: '오리엔테이션 & 여는 예배', description: '일정 소개 및 조 편성, 여는 예배 진행', color: '#eff6ff' },
    { id: 'c3', day: 1, time: '12:00 - 13:30', title: '환영 점심 식사', description: '식당에서 맛있는 점심 교제', color: '#fef3c7' },
    { id: 'c4', day: 1, time: '14:00 - 17:00', title: '아이스브레이킹 & 공동체 게임', description: '조별 친밀감 형성을 위한 실내 레크리에이션', color: '#eff6ff' },
    { id: 'c5', day: 1, time: '18:00 - 19:30', title: '저녁 식사', description: '조별 맛집 탐방 또는 단체 급식', color: '#fef3c7' },
    { id: 'c6', day: 1, time: '19:30 - 21:30', title: '저녁 은혜 집회 (Day 1)', description: '뜨거운 찬양과 기도, 말씀 선포의 시간', color: '#ecfdf5' },
    // Day 2
    { id: 'c7', day: 2, time: '07:30 - 08:30', title: '기상 및 아침 묵상 QT', description: '하루를 여는 아침 기도 및 말씀 묵상', color: '#f5f5f5' },
    { id: 'c8', day: 2, time: '08:30 - 09:30', title: '아침 식사', description: '가벼운 식사와 아침 체조', color: '#fef3c7' },
    { id: 'c9', day: 2, time: '10:00 - 12:00', title: '조별 바이블 스터디', description: '올해의 주제 공과 공부 및 나눔', color: '#eff6ff' },
    { id: 'c10', day: 2, time: '12:00 - 13:30', title: '점심 식사', description: '영양 가득한 점심 교제', color: '#fef3c7' },
    { id: 'c11', day: 2, time: '13:30 - 17:30', title: '야외 액티비티 & 워터파크', description: '다 함께 즐거운 물놀이 및 야외 체육 활동', color: '#eff6ff' },
    { id: 'c12', day: 2, time: '19:30 - 22:00', title: '저녁 심령 집회 (Day 2)', description: '수련회의 하이라이트! 뜨거운 기도회와 결단', color: '#ecfdf5' },
    // Day 3
    { id: 'c13', day: 3, time: '08:00 - 09:00', title: '아침 식사', description: '든든하게 챙겨 먹는 마지막 아침', color: '#fef3c7' },
    { id: 'c14', day: 3, time: '09:30 - 11:30', title: '소감문 작성 및 파송 예배', description: '받은 은혜를 나누고 세상으로 파송하는 예배', color: '#ecfdf5' },
    { id: 'c15', day: 3, time: '11:30 - 13:00', title: '점심 식사 & 귀가', description: '단체 기념 사진 촬영 후 안전한 귀가', color: '#fef3c7' },
  ],
  weekly_2: [
    // Week 1
    { id: 'w1', day: 1, time: '09:30 - 11:00', title: '주일 예배 & 수련회 개회', description: '1주차 개회 및 찬양 축제', color: '#eff6ff' },
    { id: 'w2', day: 1, time: '11:00 - 12:30', title: '스페셜 바이블 콘서트', description: '외부 강사 초청 말씀 및 음악 콘서트', color: '#eff6ff' },
    { id: 'w3', day: 1, time: '12:30 - 14:00', title: '점심 및 조별 친교 교제', description: '조별 다과회 및 스페셜 뷔페 점심', color: '#fef3c7' },
    { id: 'w4', day: 1, time: '14:00 - 16:00', title: '비전 페스티벌 레크리에이션', description: '반별 대항 공동체 레크리에이션 게임', color: '#eff6ff' },
    // Week 2
    { id: 'w5', day: 2, time: '09:30 - 11:00', title: '결단 예배 & 말씀 선포', description: '2주차 주제 예배 및 결단', color: '#ecfdf5' },
    { id: 'w6', day: 2, time: '11:00 - 12:30', title: '공과 공작 & 크래프트 타임', description: '성경학교 주제 만들기 및 체험 학습', color: '#eff6ff' },
    { id: 'w7', day: 2, time: '12:30 - 14:00', title: '은혜 나눔 오찬 식사', description: '조별 소감문 작성 및 점심 교제', color: '#fef3c7' },
    { id: 'w8', day: 2, time: '14:00 - 15:30', title: '클로징 어워드 & 축복 파송', description: '출석상 수여, 단체 사진 촬영 및 해산', color: '#ecfdf5' },
  ]
};

const COLOR_OPTIONS = [
  { value: '#ffffff', name: '기본 화이트' },
  { value: '#eff6ff', name: '시원한 블루 (오전)' },
  { value: '#fef3c7', name: '따뜻한 옐로우 (식사)' },
  { value: '#ecfdf5', name: '신선한 그린 (예배)' },
  { value: '#fdf2f8', name: '은은한 핑크 (레크)' },
  { value: '#f5f5f5', name: '차분한 그레이 (묵상)' },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const min = i % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${min}`;
});

const parseTimeRange = (timeStr: string) => {
  const parts = (timeStr || '').split('-').map(s => s.trim());
  const startTime = parts[0] || '09:00';
  const endTime = parts[1] || '10:30';
  return { startTime, endTime };
};

export default function ScheduleEditorPage() {
  const params = useParams();
  const router = useRouter();
  const department = (params?.dept as string) || 'kinder';

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);

  // 트랙(연합/분리 운영) 상태 — 설정 패널과 동일한 규칙: 분리 모드에서는 'main' 편집 불가
  const [operatingMode, setOperatingMode] = useState<'union' | 'split'>('union');
  const [tracks, setTracks] = useState<{ trackKey: string; label: string; subDepartmentIds: string[] }[]>([]);
  const [activeTrackKey, setActiveTrackKey] = useState<string>('main');

  // 에디터 핵심 상태
  const [campType, setCampType] = useState<'continuous' | 'weekly'>('continuous');
  const [campDuration, setCampDuration] = useState<number>(3);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);

  // 모달 상세 카드 편집 상태
  const [editingCard, setEditingCard] = useState<ScheduleItem | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

  const deptNames: Record<string, string> = {
    kinder: '나우킨더',
    kids: '나우키즈',
    teens: '나우틴즈',
  };

  // 트랙 목록 + 운영모드 로드. 분리 모드면 'main'을 편집 대상에서 제외하고 첫 non-main 트랙 자동 선택.
  const loadTracks = async (): Promise<string> => {
    const listRes = await fetch(`/api/config/${department}?list=1`);
    const listJson = await listRes.json();
    const mode: 'union' | 'split' = listJson?.data?.operatingMode === 'split' ? 'split' : 'union';
    const trackList = listJson?.data?.tracks || [];
    setOperatingMode(mode);
    setTracks(trackList);
    let tk = 'main';
    if (mode === 'split') {
      const firstNonMain = trackList.find((t: any) => t.trackKey !== 'main');
      if (firstNonMain) tk = firstNonMain.trackKey;
    }
    setActiveTrackKey(tk);
    return tk;
  };

  const loadData = async (trackKey: string) => {
    if (!params?.dept) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/config/${department}?track=${encodeURIComponent(trackKey)}`);
      if (!res.ok) throw new Error('Failed to fetch config');
      const { data } = await res.json();
      if (data) {
        setConfig(data);
        setCampType(data.campType || 'continuous');
        setCampDuration(Number(data.campDuration || 3));
        setSchedule(data.campSchedule || []);
      }
    } catch (err) {
      alert('설정 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const switchTrack = async (trackKey: string) => {
    setActiveTrackKey(trackKey);
    await loadData(trackKey);
  };

  useEffect(() => {
    if (!params?.dept) return;
    (async () => {
      const tk = await loadTracks();
      await loadData(tk);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.dept, department]);

  // 프리셋 채우기 함수
  const applyPreset = () => {
    const key = `${campType}_${campDuration}`;
    const presetData = PRESETS[key] || PRESETS['continuous_3'];
    
    if (confirm(`현재 작성 중인 일정이 모두 초기화되고, [${campType === 'continuous' ? '연속형' : '분산형'} ${campDuration}일/주] 템플릿 프리셋으로 변경됩니다. 진행하시겠습니까?`)) {
      const generated = presetData.map((item, idx) => ({
        ...item,
        id: `sched_${Date.now()}_${idx}`,
        day: Math.min(item.day, campDuration) // 기간 초과 방지
      }));
      setSchedule(generated);
    }
  };

  // 일정 임시 추가
  const addNewCard = (dayNum: number) => {
    const newCard: ScheduleItem = {
      id: `sched_${Date.now()}`,
      day: dayNum,
      time: '14:00 - 15:00',
      title: '새로운 활동',
      description: '상세 일정 내용을 여기에 입력하세요.',
      color: '#ffffff'
    };
    setSchedule((prev) => [...prev, newCard]);
    setEditingCard(newCard); // 추가하자마자 편집창 오픈
  };

  // 카드 삭제
  const deleteCard = (id: string) => {
    if (confirm('이 일정 카드를 삭제하시겠습니까?')) {
      setSchedule((prev) => prev.filter((item) => item.id !== id));
      if (editingCard?.id === id) setEditingCard(null);
    }
  };

  // 카드 수정 반영
  const handleUpdateCard = (updated: ScheduleItem) => {
    setSchedule((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setEditingCard(null);
  };

  // 드래그 앤 드롭 핸들러
  const handleDragStart = (id: string) => {
    setDraggedCardId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // 필수
  };

  const handleDrop = (targetDay: number) => {
    if (!draggedCardId) return;
    setSchedule((prev) =>
      prev.map((item) => (item.id === draggedCardId ? { ...item, day: targetDay } : item))
    );
    setDraggedCardId(null);
  };

  // 최종 DB 저장
  const handleSave = async () => {
    try {
      setIsSaving(true);
      // 시간순 정렬 후 저장
      const sortedSchedule = [...schedule].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
      
      const payload = {
        ...config,
        campType,
        campDuration,
        campSchedule: sortedSchedule,
        // 기존 테마 필드 누락 방지
        title: config?.title,
        subtitle: config?.subtitle,
        scripture: config?.scripture,
        primaryColor: config?.primary_color,
        bgColor: config?.bg_color,
        tshirtSizes: config?.tshirtSizes,
        customFieldMappings: config?.customFieldMappings,
        subDepartments: config?.subDepartments,
        campStartDate: config?.camp_start_date,
        // 현재 편집 중인 트랙에 명시적으로 저장 (로드된 config에 암묵적으로 의존하지 않음)
        trackKey: activeTrackKey,
        trackLabel: tracks.find((t) => t.trackKey === activeTrackKey)?.label ?? null,
        subDepartmentIds: tracks.find((t) => t.trackKey === activeTrackKey)?.subDepartmentIds ?? [],
      };

      const res = await fetch(`/api/config/${department}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Save failed');
      alert('🎉 수련회 그래픽 세부 일정이 성공적으로 동기화 및 저장되었습니다.');
      
      // 관리자 대시보드로 돌아가거나 창 닫기
      if (window.opener) {
        window.opener.location.reload();
        window.close();
      } else {
        router.back();
      }
    } catch (err) {
      alert('일정 저장 도중 에러가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center">
        <p className="text-xl font-bold animate-pulse">📅 그래픽 일정 에디터 캔버스를 불러오고 있습니다...</p>
      </div>
    );
  }

  const primaryColor = config?.primary_color || (department === 'kinder' ? '#EAB308' : department === 'kids' ? '#3B82F6' : '#22C55E');

  // 일차/주차별 렌더링 범위 생성
  const daysArray = Array.from({ length: campDuration }, (_, i) => i + 1);

  const editableTracks = tracks.filter((t) => t.trackKey !== 'main');
  const showTrackSwitcher = operatingMode === 'split' && editableTracks.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-20">
      {/* 상단 컨트롤 바 */}
      <header className="sticky top-0 bg-slate-900 border-b border-slate-800 z-40 shadow-xl">
        {showTrackSwitcher && (
          <div className="px-6 pt-4 flex flex-wrap items-center gap-2 border-b border-slate-800 pb-4">
            <span className="text-xs font-bold text-slate-400 mr-1">편집할 트랙:</span>
            {editableTracks.map((t) => (
              <button
                key={t.trackKey}
                type="button"
                onClick={() => switchTrack(t.trackKey)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition cursor-pointer ${
                  activeTrackKey === t.trackKey
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div className="p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-4">
          <Link href={`/admin/login?dept=${department}`} className="text-2xl hover:scale-105 transition">🏠</Link>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              🎨 <span style={{ color: primaryColor }}>{deptNames[department] || department}</span> 수련회 세부 일정 그래픽 캔버스
            </h1>
            <p className="text-xs text-slate-400 mt-1">드래그로 일정을 이동하고 클릭하여 손쉽게 디자인을 커스텀하세요.</p>
          </div>
        </div>

        {/* 설정 조절 필드 */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">일정 형태:</span>
            <select
              value={campType}
              onChange={(e) => setCampType(e.target.value as any)}
              className="bg-slate-900 text-white text-xs px-3 py-1.5 rounded border border-slate-700 focus:outline-none"
            >
              <option value="continuous">연속 수련회 (2박 3일 등)</option>
              <option value="weekly">주일 분산 수련회 (매주일)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">총 기간:</span>
            <input
              type="number"
              min={1}
              max={30}
              value={campDuration}
              onChange={(e) => setCampDuration(Math.max(1, Number(e.target.value)))}
              className="w-16 bg-slate-900 text-white text-xs px-3 py-1 rounded border border-slate-700 focus:outline-none"
            />
            <span className="text-xs text-slate-400">{campType === 'continuous' ? '일간' : '주간'}</span>
          </div>

          <button
            onClick={applyPreset}
            className="px-3.5 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-bold rounded shadow transition cursor-pointer"
          >
            🪄 프리셋 템플릿 채우기
          </button>
        </div>

        {/* 저장 및 닫기 */}
        <div className="flex gap-3 shrink-0">
          <button
            onClick={() => { if(confirm('저장하지 않은 변경 사항이 유실됩니다. 창을 닫으시겠습니까?')) window.close(); }}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-white text-sm font-semibold rounded-lg transition"
          >
            취소 및 닫기
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{ backgroundColor: primaryColor }}
            className="px-6 py-2.5 text-slate-950 text-sm font-black rounded-lg shadow-lg hover:brightness-110 active:scale-95 transition disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? '서버 동기화 중...' : '💾 일정 최종 저장'}
          </button>
        </div>
        </div>
      </header>

      {/* 캔버스 본문 (가로 칸반 보드 레이아웃) */}
      <main className="px-6 mt-8 overflow-x-auto select-none">
        <div className="flex gap-6 min-h-[70vh] pb-8 items-start" style={{ width: 'max-content', minWidth: '100%' }}>
          {daysArray.map((dayNum) => {
            const dayCards = schedule.filter((item) => item.day === dayNum)
              .sort((a, b) => a.time.localeCompare(b.time));

            return (
              <div
                key={dayNum}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(dayNum)}
                className="w-80 bg-slate-900/60 rounded-2xl border border-slate-800 flex flex-col p-4 shrink-0 transition hover:border-slate-700/60"
              >
                {/* 열 머리글 */}
                <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-black text-lg text-white">
                      {dayNum}{campType === 'continuous' ? '일차' : '주차'}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">총 {dayCards.length}개의 활동 일정</p>
                  </div>
                  <button
                    onClick={() => addNewCard(dayNum)}
                    className="w-7 h-7 bg-slate-800 hover:bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow transition cursor-pointer"
                  >
                    ＋
                  </button>
                </div>

                {/* 카드 리스트 목록 */}
                <div className="space-y-3 min-h-[450px] overflow-y-auto pr-1">
                  {dayCards.length === 0 ? (
                    <div className="h-40 border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-center p-6 text-xs text-slate-500">
                      여기에 일정을 추가하거나 다른 날짜에서 카드를 드래그해 놓으세요.
                    </div>
                  ) : (
                    dayCards.map((card) => (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={() => handleDragStart(card.id)}
                        onClick={() => setEditingCard(card)}
                        style={{ backgroundColor: card.color || '#ffffff' }}
                        className="p-4 rounded-xl border border-slate-200 shadow-sm cursor-grab active:cursor-grabbing hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-md transition duration-200 text-slate-900 group relative"
                      >
                        {/* 삭제 버튼 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCard(card.id);
                          }}
                          className="absolute top-2 right-2 w-5 h-5 bg-black/5 rounded-full flex items-center justify-center text-slate-500 hover:bg-red-500 hover:text-white transition duration-150 text-[10px] font-bold"
                        >
                          ✕
                        </button>
                        
                        <div className="text-[11px] font-extrabold text-indigo-600 mb-1 tracking-tight flex items-center gap-1">
                          🕒 {card.time}
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 line-clamp-2">
                          {card.title}
                        </h4>
                        {card.description && (
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-3 leading-relaxed">
                            {card.description}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* 하단 카드 빠른 추가 버튼 */}
                <button
                  onClick={() => addNewCard(dayNum)}
                  className="mt-4 w-full py-2 bg-slate-800/40 hover:bg-slate-800 border border-dashed border-slate-700/60 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
                >
                  ＋ 새로운 일정 카드 추가
                </button>
              </div>
            );
          })}
        </div>
      </main>

      {/* 카드 편집 디테일 사이드바/모달 팝업 */}
      {editingCard && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <h3 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-3 flex items-center gap-2">
              ✏️ 일정 카드 편집
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">진행 일차</label>
                <select
                  value={editingCard.day}
                  onChange={(e) => setEditingCard({ ...editingCard, day: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {daysArray.map((dayNum) => (
                    <option key={dayNum} value={dayNum}>{dayNum}{campType === 'continuous' ? '일차' : '주차'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">시간대 선택</label>
                <div className="flex items-center gap-2">
                  <select
                    value={parseTimeRange(editingCard.time).startTime}
                    onChange={(e) => {
                      const { endTime } = parseTimeRange(editingCard.time);
                      setEditingCard({ ...editingCard, time: `${e.target.value} - ${endTime}` });
                    }}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <span className="text-slate-400 font-bold">~</span>
                  <select
                    value={parseTimeRange(editingCard.time).endTime}
                    onChange={(e) => {
                      const { startTime } = parseTimeRange(editingCard.time);
                      setEditingCard({ ...editingCard, time: `${startTime} - ${e.target.value}` });
                    }}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">일정 활동명 (Title)</label>
                <input
                  type="text"
                  value={editingCard.title}
                  onChange={(e) => setEditingCard({ ...editingCard, title: e.target.value })}
                  placeholder="예: 레크리에이션 게임"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">상세 내용 및 비고 (Description)</label>
                <textarea
                  rows={3}
                  value={editingCard.description}
                  onChange={(e) => setEditingCard({ ...editingCard, description: e.target.value })}
                  placeholder="장소, 준비물 등 메모 기재"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 카드 테마 색상 선택 */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">🎨 카드 악센트 컬러</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setEditingCard({ ...editingCard, color: opt.value })}
                      style={{ backgroundColor: opt.value }}
                      className={`w-7 h-7 rounded-full border-2 transition shadow ${
                        editingCard.color === opt.value ? 'border-indigo-500 scale-110' : 'border-slate-800'
                      }`}
                      title={opt.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* 하단 제어 */}
            <div className="flex justify-between items-center mt-8 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => deleteCard(editingCard.id)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition"
              >
                🗑️ 이 일정 삭제
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCard(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold rounded-lg transition"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateCard(editingCard)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold rounded-lg transition"
                >
                  반영하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
