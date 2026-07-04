'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { departmentLabel } from '@/lib/labels';
import { useToast, useConfirm } from '@/components/ui/Feedback';

interface WaterparkRosterProps {
  /** 지정 시 해당 부서 자녀가 워터풀 참석하는 가족만 표시. 미지정 시 전체 명단. */
  department?: string;
  /** 다크 테마 (틴즈 어드민) */
  dark?: boolean;
}

/**
 * 워터풀선데이 신청 명단 (가족 단위) — 부서별 어드민 탭과 통합 어드민의
 * 전체 명단 탭에서 공용으로 사용.
 */
export default function WaterparkRoster({ department, dark = false }: WaterparkRosterProps) {
  const showToast = useToast();
  const confirmDialog = useConfirm();
  const [families, setFamilies] = useState<any[]>([]);
  const [summary, setSummary] = useState({ familyCount: 0, parentCount: 0, childCount: 0 });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadRoster = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const qs = department ? `?department=${department}` : '';
      const res = await fetch(`/api/waterpark/applicants${qs}`);
      if (!res.ok) throw new Error('Fetch failed');
      const json = await res.json();
      setFamilies(json.data || []);
      setSummary(json.summary || { familyCount: 0, parentCount: 0, childCount: 0 });
    } catch {
      setError('워터풀 신청 명단을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [department]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // 워터풀에서만 제외 (성경학교 신청은 유지)
  const patchWaterpark = async (payload: Record<string, any>) => {
    setBusy(true);
    try {
      const res = await fetch('/api/waterpark/applicants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, department }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Patch failed');
      showToast(`워터풀 명단에서 제외했습니다. (자녀 ${json.data.childrenRemoved}명)`, 'success');
      await loadRoster();
    } catch {
      showToast('워터풀 명단 제외 도중 오류가 발생했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeFamily = async (family: any) => {
    if (!(await confirmDialog(`${family.parentName} 가족을 워터풀 명단에서 제외하시겠습니까?\n성경학교/수련회 신청은 그대로 유지됩니다.`))) return;
    // 병합된 가족은 신청서가 여러 건일 수 있어 전체를 제외
    await patchWaterpark({ applicationIds: family.applicationIds || [family.id] });
  };

  const clearAll = async () => {
    if (families.length === 0) return;
    const scopeLabel = department ? `${departmentLabel(department)} 부서` : '전체';
    if (!(await confirmDialog(`현재 명단(${scopeLabel})의 모든 가족을 워터풀에서 제외하시겠습니까?\n성경학교/수련회 신청은 유지되며, 워터풀 참석만 취소됩니다.`))) return;
    await patchWaterpark({ all: true });
  };

  const cardCls = dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100';
  const tableCls = dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">
            💦 워터풀선데이 신청 명단{department ? '' : ' (전체 부서)'}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            성경학교 가족 단위 신청 데이터 기준 — 워터풀 참석 자녀가 1명 이상인 가족만 표시됩니다.
            {department ? ' 가족 내 다른 부서 자녀도 함께 표시됩니다.' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => window.open(`/api/export/waterpark${department ? `?department=${department}` : ''}`, '_blank')}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-lg shadow transition duration-200 cursor-pointer"
          >
            📥 가족단위 명단 엑셀 추출
          </button>
          <button
            onClick={clearAll}
            disabled={busy || families.length === 0}
            className="px-4 py-2 border border-red-500 text-red-600 hover:bg-red-500 hover:text-white text-sm font-semibold rounded-lg transition duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🗑️ 전체 워터풀 명단 비우기
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-xl">{error}</div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '신청 가족', value: summary.familyCount, unit: '가정' },
          { label: '동반 보호자', value: summary.parentCount, unit: '명' },
          { label: '참석 자녀', value: summary.childCount, unit: '명' },
        ].map((s) => (
          <div key={s.label} className={`p-5 rounded-2xl border shadow-sm text-center ${cardCls}`}>
            <p className="text-xs font-semibold text-gray-400">{s.label}</p>
            <p className="text-3xl font-extrabold text-cyan-600 mt-1">
              {s.value}<span className="text-sm font-bold text-gray-400 ml-1">{s.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* 가족 단위 명단 — 모바일 카드 뷰 */}
      <div className={`md:hidden rounded-xl border overflow-hidden shadow-md ${tableCls}`}>
        {loading ? (
          <div className="p-12 text-center text-gray-400">명단을 불러오는 중입니다...</div>
        ) : families.length === 0 ? (
          <div className="p-12 text-center text-gray-400">워터풀선데이 신청 가족이 아직 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {families.map((f) => (
              <div key={f.id} className="p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{f.parentName}</span>
                  <span className="font-bold text-cyan-600">{f.totalCount}명</span>
                </div>
                <div className="text-gray-500">{f.parentPhone}</div>
                <div className="flex flex-wrap gap-1.5">
                  {f.parents.map((p: any, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                      {p.name} ({p.relation})
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {f.children.map((c: any) => (
                    <span
                      key={c.id}
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        !department || c.department === department
                          ? 'bg-cyan-50 text-cyan-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c.name} ({departmentLabel(c.department) || c.department})
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => removeFamily(f)}
                  disabled={busy}
                  className="mt-1 w-full px-3 py-1.5 border border-red-400 text-red-600 hover:bg-red-500 hover:text-white text-xs font-bold rounded-lg transition disabled:opacity-40"
                >
                  워터풀 명단에서 제외
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 가족 단위 명단 — 데스크톱 테이블 뷰 */}
      <div className={`hidden md:block rounded-xl border overflow-hidden shadow-md ${tableCls}`}>
        {loading ? (
          <div className="p-12 text-center text-gray-400">명단을 불러오는 중입니다...</div>
        ) : families.length === 0 ? (
          <div className="p-12 text-center text-gray-400">워터풀선데이 신청 가족이 아직 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-left text-xs uppercase tracking-wider ${dark ? 'bg-slate-800 text-slate-400' : 'bg-gray-50 text-gray-500'}`}>
                  <th className="px-4 py-3">대표 보호자</th>
                  <th className="px-4 py-3">연락처</th>
                  <th className="px-4 py-3">동반 보호자</th>
                  <th className="px-4 py-3">참석 자녀</th>
                  <th className="px-4 py-3 text-center">인원</th>
                  <th className="px-4 py-3 text-center">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {families.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-bold">{f.parentName}</td>
                    <td className="px-4 py-3 text-gray-500">{f.parentPhone}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {f.parents.map((p: any, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                            {p.name} ({p.relation})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {f.children.map((c: any) => (
                          <span
                            key={c.id}
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              !department || c.department === department
                                ? 'bg-cyan-50 text-cyan-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                            title={department && c.department !== department ? '다른 부서 소속 자녀' : undefined}
                          >
                            {c.name} ({departmentLabel(c.department) || c.department})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-cyan-600">{f.totalCount}명</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => removeFamily(f)}
                        disabled={busy}
                        className="px-3 py-1 border border-red-400 text-red-600 hover:bg-red-500 hover:text-white text-xs font-bold rounded transition disabled:opacity-40 whitespace-nowrap"
                      >
                        제외
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
