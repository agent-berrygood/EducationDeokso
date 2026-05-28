'use client';

import React, { useMemo } from 'react';
import {
  SLOTS,
  SLOT_LABELS,
  allSessionKeys,
  buildSessionKey,
  deriveDayCount,
  scheduleItemToKey,
  type SessionKey,
  type SessionSlot,
} from '@/lib/session-grid';

interface ScheduleItem {
  id?: string;
  day?: number | string;
  time?: string;
  title?: string;
  description?: string;
  slot?: SessionSlot;
}

interface Props {
  /** 현재 자녀가 체크한 세션 키 배열 */
  value: string[];
  onChange: (next: string[]) => void;
  /** 시간표 카드 데이터 (camp_schedule) */
  schedule?: ScheduleItem[];
  /** camp_duration fallback */
  campDuration?: number;
  className?: string;
}

export default function SessionGridPicker({
  value, onChange, schedule, campDuration, className,
}: Props) {
  const dayCount = deriveDayCount(schedule, campDuration);
  const all = useMemo(() => allSessionKeys(dayCount), [dayCount]);
  const selected = useMemo(() => new Set(value.filter(Boolean)), [value]);

  // 시간표 카드를 세션 슬롯별로 그룹핑 (UI 하이라이트용)
  const scheduleBySession = useMemo(() => {
    const map = new Map<SessionKey, ScheduleItem[]>();
    (schedule || []).forEach((item) => {
      const key = scheduleItemToKey(item);
      if (!key) return;
      const arr = map.get(key) || [];
      arr.push(item);
      map.set(key, arr);
    });
    return map;
  }, [schedule]);

  const allSelected = all.length > 0 && all.every((k) => selected.has(k));

  function toggle(key: SessionKey, on?: boolean) {
    const next = new Set(selected);
    const should = on === undefined ? !next.has(key) : on;
    if (should) next.add(key);
    else next.delete(key);
    onChange(Array.from(next).sort());
  }

  function toggleDay(day: number, on?: boolean) {
    const next = new Set(selected);
    const dayKeys = SLOTS.map((s) => buildSessionKey(day, s));
    const allOn = dayKeys.every((k) => next.has(k));
    const should = on === undefined ? !allOn : on;
    dayKeys.forEach((k) => {
      if (should) next.add(k);
      else next.delete(k);
    });
    onChange(Array.from(next).sort());
  }

  function toggleAll(on: boolean) {
    onChange(on ? [...all].sort() : []);
  }

  return (
    <div className={`bg-slate-50 border rounded-xl p-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">부분 참석 세션 선택</p>
          <p className="text-[11px] text-slate-500 mt-0.5">참석하실 시간대를 체크하세요. 식수 인원 산출에 활용됩니다.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => toggleAll(e.target.checked)}
            className="accent-cyan-500 h-4 w-4"
          />
          전체 참석
        </label>
      </div>

      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-xs border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="text-left text-[10px] uppercase tracking-wider text-slate-500 font-semibold pl-1">일차</th>
              {SLOTS.map((s) => (
                <th key={s} className="text-center text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  {SLOT_LABELS[s]}
                </th>
              ))}
              <th className="text-center text-[10px] uppercase tracking-wider text-slate-400 font-semibold w-12">일괄</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
              <tr key={day}>
                <td className="font-bold text-slate-700 pl-1">{day}일차</td>
                {SLOTS.map((slot) => {
                  const key = buildSessionKey(day, slot);
                  const checked = selected.has(key);
                  const items = scheduleBySession.get(key) || [];
                  return (
                    <td key={slot} className="align-top">
                      <label
                        className={`block rounded-lg border-2 px-2 py-2 cursor-pointer transition-colors ${
                          checked
                            ? 'border-cyan-500 bg-cyan-50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(key)}
                            className="accent-cyan-500 h-3.5 w-3.5"
                          />
                          <span className="text-[11px] font-semibold text-slate-700">
                            {SLOT_LABELS[slot]}
                          </span>
                        </div>
                        {items.length > 0 && (
                          <div className={`mt-1 space-y-0.5 ${checked ? 'opacity-100' : 'opacity-40'}`}>
                            {items.slice(0, 2).map((item, idx) => (
                              <div key={idx} className="text-[10px] leading-tight text-slate-600 truncate">
                                {item.time ? `${item.time} ` : ''}{item.title}
                              </div>
                            ))}
                            {items.length > 2 && (
                              <div className="text-[10px] text-slate-400">+ {items.length - 2}건</div>
                            )}
                          </div>
                        )}
                      </label>
                    </td>
                  );
                })}
                <td className="text-center">
                  <button
                    type="button"
                    onClick={() => toggleDay(day)}
                    className="text-[10px] font-semibold text-cyan-600 hover:underline"
                  >
                    하루
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected.size === 0 && (
        <p className="mt-3 text-[11px] text-amber-600">
          ⚠ 선택된 세션이 없습니다. 참석하지 않을 경우 빈 상태로 두어도 무방하지만, 식수 집계에서 제외됩니다.
        </p>
      )}
    </div>
  );
}
