'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useToast, useConfirm } from '@/components/ui/Feedback';

interface StaffEntry {
  department: string;
  trackKey: string;
  trackLabel: string | null;
  attendanceType: 'full' | 'partial';
  attendedSessions: string[];
  tshirtSize: string | null;
}
interface StaffApplication {
  id: string;
  name: string;
  phone: string;
  note: string | null;
  created_at: string;
  entries: StaffEntry[];
}

interface Props {
  /** 지정 시 해당 부서 스텝 신청만. 미지정 시 전체. */
  department?: string;
  dark?: boolean;
}

/**
 * 스텝(성경학교 봉사자) 신청 관리 — 부서별 어드민 탭과 통합 어드민에서 공용.
 * 스텝 참석은 캠프(부서·트랙)별 entry로 저장되므로 신청자 단위로 묶어 표시한다.
 */
export default function StaffApplicationsRoster({ department, dark = false }: Props) {
  const showToast = useToast();
  const confirmDialog = useConfirm();
  const [apps, setApps] = useState<StaffApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const qs = department ? `?department=${department}` : '';
      const res = await fetch(`/api/step-apply${qs}`);
      if (!res.ok) throw new Error('Fetch failed');
      const json = await res.json();
      setApps(json.data || []);
    } catch {
      setError('스텝 신청 명단을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [department]);

  useEffect(() => {
    load();
  }, [load]);

  const removeApp = async (app: StaffApplication) => {
    if (!(await confirmDialog(`${app.name} 님의 스텝 신청을 삭제하시겠습니까?`))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/step-apply?id=${app.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Delete failed');
      showToast('스텝 신청을 삭제했습니다.', 'success');
      await load();
    } catch {
      showToast('삭제 도중 오류가 발생했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const cardCls = dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100';

  const totalEntries = apps.reduce((s, a) => s + a.entries.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">🙌 스텝(봉사자) 신청 명단{department ? '' : ' (전체 부서)'}</h2>
          <p className="text-sm text-gray-400 mt-1">
            성경학교/수련회를 함께 섬길 스텝 신청 목록입니다. 한 명이 여러 캠프에 신청할 수 있습니다.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-xl">{error}</div>
      )}

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: '신청 인원', value: apps.length, unit: '명' },
          { label: '캠프 신청 건', value: totalEntries, unit: '건' },
        ].map((s) => (
          <div key={s.label} className={`p-5 rounded-2xl border shadow-sm text-center ${cardCls}`}>
            <p className="text-xs font-semibold text-gray-400">{s.label}</p>
            <p className="text-3xl font-extrabold text-indigo-600 mt-1">
              {s.value}<span className="text-sm font-bold text-gray-400 ml-1">{s.unit}</span>
            </p>
          </div>
        ))}
      </div>

      <div className={`rounded-xl border shadow-md ${cardCls}`}>
        {loading ? (
          <div className="p-12 text-center text-gray-400">명단을 불러오는 중입니다...</div>
        ) : apps.length === 0 ? (
          <div className="p-12 text-center text-gray-400">스텝 신청자가 아직 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {apps.map((app) => (
              <div key={app.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-bold text-base">{app.name}</span>
                    <span className="text-sm text-gray-400 ml-2">{app.phone}</span>
                    <span className="block text-xs text-gray-400 mt-0.5">
                      {new Date(app.created_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <button
                    onClick={() => removeApp(app)}
                    disabled={busy}
                    className="px-3 py-1 border border-red-400 text-red-600 hover:bg-red-500 hover:text-white text-xs font-bold rounded transition disabled:opacity-40 shrink-0"
                  >
                    삭제
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {app.entries.map((e, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold"
                    >
                      {e.trackLabel || e.department}
                      <span className="text-indigo-400">
                        · {e.attendanceType === 'full' ? '전체참석' : `부분참석(${e.attendedSessions.length})`}
                      </span>
                      {e.tshirtSize && <span className="text-indigo-400">· 👕 {e.tshirtSize}</span>}
                    </span>
                  ))}
                </div>

                {app.note && (
                  <p className="text-xs text-gray-500 bg-gray-50 dark:bg-slate-800/40 rounded-lg px-3 py-2">
                    📝 {app.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
