'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import SessionGridPicker from '@/components/SessionGridPicker';
import { staffApplicationSubmitSchema } from '@/lib/schemas';
import type { DepartmentId } from '@/lib/types';

const DEPARTMENTS: { id: DepartmentId; label: string; emoji: string }[] = [
  { id: 'kinder', label: '나우킨더 (미취학)', emoji: '🧸' },
  { id: 'kids', label: '나우키즈 (초등부)', emoji: '👦' },
  { id: 'teens', label: '나우틴즈 (중고등부)', emoji: '🔥' },
];

interface DeptConfig {
  department: DepartmentId;
  title: string;
  event_type: string;
  primary_color?: string;
  campSchedule?: any[];
  campDuration?: number;
  isStepRecruitmentActive?: boolean;
  stepTshirtSizes?: string[];
}

/** 스텝 모집 대상 캠프 — 연합 부서는 부서 자체가, 분리 부서는 트랙별로 하나씩 */
interface Camp {
  key: string;            // `${department}::${trackKey}`
  department: DepartmentId;
  deptLabel: string;
  emoji: string;
  trackKey: string;
  campLabel: string;      // 연합=부서명, 분리=트랙명(성경학교명)
  cfg: DeptConfig;
}

interface EntryDraft {
  checked: boolean;
  attendanceType: 'full' | 'partial';
  attendedSessions: string[];
  tshirtSize: string;
}

const emptyEntry = (): EntryDraft => ({ checked: false, attendanceType: 'full', attendedSessions: [], tshirtSize: '' });

function formatPhoneNumber(val: string): string {
  const clean = val.replace(/\D/g, '');
  if (clean.length <= 3) return clean;
  if (clean.length <= 7) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7, 11)}`;
}

function StepApplyForm() {
  const searchParams = useSearchParams();
  const preselect = searchParams.get('dept');

  const [camps, setCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [entries, setEntries] = useState<Record<string, EntryDraft>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const collected: Camp[] = [];
        for (const d of DEPARTMENTS) {
          // 트랙 목록 + 운영모드 확인
          const list = (await (await fetch(`/api/config/${d.id}?list=1`)).json())?.data;
          const mode = list?.operatingMode === 'split' ? 'split' : 'union';
          const nonMain = (list?.tracks || []).filter((t: any) => t.trackKey !== 'main');

          if (mode === 'split' && nonMain.length > 0) {
            // 분리 운영: 트랙(성경학교)마다 개별 스텝 모집
            for (const t of nonMain) {
              const cfg = (await (await fetch(`/api/config/${d.id}?track=${encodeURIComponent(t.trackKey)}`)).json())?.data;
              if (cfg?.isStepRecruitmentActive) {
                collected.push({
                  key: `${d.id}::${t.trackKey}`,
                  department: d.id, deptLabel: d.label, emoji: d.emoji,
                  trackKey: t.trackKey, campLabel: t.label || cfg.title || d.label, cfg,
                });
              }
            }
          } else {
            // 연합 운영: 부서 자체가 하나의 캠프 (main)
            const cfg = (await (await fetch(`/api/config/${d.id}`)).json())?.data;
            if (cfg?.isStepRecruitmentActive) {
              collected.push({
                key: `${d.id}::main`,
                department: d.id, deptLabel: d.label, emoji: d.emoji,
                trackKey: 'main', campLabel: d.label, cfg,
              });
            }
          }
        }
        setCamps(collected);
        // URL ?dept= 프리셀렉트 (해당 부서의 모집 활성 캠프 전체 선택)
        if (preselect) {
          setEntries((prev) => {
            const next = { ...prev };
            collected.filter((c) => c.department === preselect).forEach((c) => {
              next[c.key] = { ...emptyEntry(), ...next[c.key], checked: true };
            });
            return next;
          });
        }
      } catch (err) {
        console.error('설정 로드 실패', err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeDepts = camps; // 모집 활성 캠프 목록

  function getEntry(key: string): EntryDraft {
    return entries[key] || emptyEntry();
  }
  function patchEntry(key: string, partial: Partial<EntryDraft>) {
    setEntries((prev) => ({ ...prev, [key]: { ...getEntry(key), ...partial } }));
  }

  async function handleSubmit() {
    setError('');
    const selected = camps.filter((c) => getEntry(c.key).checked);
    if (!name.trim()) return setError('이름을 입력하세요');
    if (!phone.trim()) return setError('연락처를 입력하세요');
    if (selected.length === 0) return setError('스텝으로 참여할 캠프를 1개 이상 선택하세요');
    for (const c of selected) {
      const e = getEntry(c.key);
      if (e.attendanceType === 'partial' && e.attendedSessions.length === 0) {
        return setError(`${c.campLabel}의 부분 참석 세션을 1개 이상 선택하세요`);
      }
    }

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      note: note.trim() || undefined,
      entries: selected.map((c) => {
        const e = getEntry(c.key);
        return {
          department: c.department,
          trackKey: c.trackKey,
          trackLabel: c.campLabel,
          attendanceType: e.attendanceType,
          attendedSessions: e.attendanceType === 'partial' ? e.attendedSessions : [],
          tshirtSize: e.tshirtSize || undefined,
        };
      }),
    };

    const check = staffApplicationSubmitSchema.safeParse(payload);
    if (!check.success) {
      return setError('입력값 검증 실패: ' + check.error.issues[0]?.message);
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/step-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || '제출 실패');
        return;
      }
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError('네트워크 오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-center py-20 text-slate-500">불러오는 중...</div>;
  }

  if (submitted) {
    return (
      <section className="bg-white p-8 rounded-2xl shadow-sm border text-center">
        <div className="text-6xl mb-4">🙌</div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">스텝 신청이 완료되었습니다</h2>
        <p className="text-slate-600 mb-6">함께 섬겨주셔서 감사합니다. 담당 교역자가 확인 후 연락드립니다.</p>
        <Link href="/" className="text-sm text-slate-500 hover:text-cyan-600 underline transition-colors">
          메인 페이지로 돌아가기
        </Link>
      </section>
    );
  }

  if (activeDepts.length === 0) {
    return (
      <section className="bg-white p-8 rounded-2xl shadow-sm border text-center">
        <div className="text-5xl mb-4">😴</div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">현재 스텝 모집 중인 캠프가 없습니다</h2>
        <p className="text-slate-600 mb-6">모집이 시작되면 다시 안내드리겠습니다.</p>
        <Link href="/" className="text-sm text-slate-500 hover:text-cyan-600 underline transition-colors">
          메인 페이지로 돌아가기
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* 신청자 정보 */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <h3 className="text-lg font-bold text-slate-900 mb-4">신청자 정보</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">이름 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">연락처 *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
              placeholder="010-0000-0000"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1">남기실 말씀 (선택)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="섬기고 싶은 역할, 참고사항 등을 자유롭게 적어주세요"
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
        </div>
      </section>

      {/* 캠프별 신청 — 다른 일정의 캠프도 스텝으로 복수 참여 가능 */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <h3 className="text-lg font-bold text-slate-900 mb-1">참여할 캠프 선택</h3>
        <p className="text-sm text-slate-500 mb-4">
          일정이 다른 캠프는 중복으로 신청할 수 있습니다. 캠프마다 전체 참석 또는 부분 참석을 지정해주세요.
        </p>
        <div className="space-y-4">
          {activeDepts.map((c) => {
            const cfg = c.cfg;
            const entry = getEntry(c.key);
            const color = cfg.primary_color || '#06B6D4';
            return (
              <div
                key={c.key}
                className={`rounded-xl border-2 transition-colors ${
                  entry.checked ? 'bg-white' : 'border-slate-200 bg-slate-50'
                }`}
                style={entry.checked ? { borderColor: color } : undefined}
              >
                <label className="flex items-center gap-3 p-4 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={entry.checked}
                    onChange={(e) => patchEntry(c.key, { checked: e.target.checked })}
                    className="h-5 w-5 accent-cyan-500"
                  />
                  <span className="text-2xl">{c.emoji}</span>
                  <span className="flex-1">
                    <span className="block font-bold text-slate-900">{cfg.title || c.campLabel}</span>
                    <span className="block text-xs text-slate-500">
                      {c.deptLabel}{c.trackKey !== 'main' ? ` · ${c.campLabel}` : ''} · {cfg.event_type}
                    </span>
                  </span>
                  <span
                    className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ backgroundColor: `${color}20`, color }}
                  >
                    스텝 모집중
                  </span>
                </label>

                {entry.checked && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* 전체/부분 참석 선택 */}
                    <div className="flex gap-2">
                      {([
                        { v: 'full', label: '전체 참석' },
                        { v: 'partial', label: '부분 참석' },
                      ] as const).map((opt) => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => patchEntry(c.key, { attendanceType: opt.v })}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                            entry.attendanceType === opt.v
                              ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {entry.attendanceType === 'partial' && (
                      <SessionGridPicker
                        value={entry.attendedSessions}
                        onChange={(next) => patchEntry(c.key, { attendedSessions: next })}
                        schedule={cfg.campSchedule}
                        campDuration={cfg.campDuration}
                      />
                    )}

                    {/* 스텝 티셔츠 사이즈 (캠프에 설정된 경우만) */}
                    {cfg.stepTshirtSizes && cfg.stepTshirtSizes.length > 0 && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                          👕 스텝 티셔츠 사이즈
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {cfg.stepTshirtSizes.map((size) => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => patchEntry(c.key, { tshirtSize: entry.tshirtSize === size ? '' : size })}
                              className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-colors ${
                                entry.tshirtSize === size
                                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-4 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white font-bold text-lg rounded-xl shadow-md transition-colors"
      >
        {submitting ? '제출 중...' : '스텝 신청 제출하기'}
      </button>
    </div>
  );
}

export default function StepApplyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900">🙌 성경학교 스텝 신청</h1>
          <p className="text-slate-500 mt-2">여름성경학교 · 여름수련회를 함께 섬길 스텝을 모집합니다</p>
        </div>
        <Suspense fallback={<div className="text-center py-20 text-slate-500">불러오는 중...</div>}>
          <StepApplyForm />
        </Suspense>
      </div>
    </div>
  );
}
