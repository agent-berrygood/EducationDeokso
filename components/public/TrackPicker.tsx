'use client';

import React from 'react';
import type { TrackOption } from '@/hooks/useDepartmentTrackConfig';

interface TrackPickerProps {
  tracks: TrackOption[];
  onSelect: (trackKey: string) => void;
  dark?: boolean;
  primaryColor: string;
  title: string;
}

/**
 * 분리(split) 운영 부서의 랜딩페이지 진입 시 방문자가 자신의 세부부서(트랙)를
 * 먼저 선택하도록 안내하는 화면. 선택 전에는 포스터/일정/테마가 표시되지 않는다.
 */
export default function TrackPicker({ tracks, onSelect, dark = false, primaryColor, title }: TrackPickerProps) {
  return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${dark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div
        className={`w-full max-w-lg rounded-3xl shadow-xl p-8 text-center space-y-6 border ${
          dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'
        }`}
      >
        <h2 className={`text-2xl font-extrabold ${dark ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
        <p className={`text-sm ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
          어느 세부부서이신가요? 선택하시면 해당 트랙의 안내를 보여드립니다.
        </p>
        <div className="space-y-3">
          {tracks.map((t) => (
            <button
              key={t.trackKey}
              type="button"
              onClick={() => onSelect(t.trackKey)}
              className={`w-full px-6 py-4 rounded-xl border-2 font-bold text-lg transition cursor-pointer ${
                dark
                  ? 'border-slate-700 hover:border-slate-500 bg-slate-800/50 text-white'
                  : 'border-gray-200 hover:border-gray-300 bg-gray-50 text-gray-900'
              }`}
              style={{ color: dark ? primaryColor : undefined }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
