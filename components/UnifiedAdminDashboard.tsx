'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminDashboard from '@/components/AdminDashboard';
import GlobalFeesSettings from '@/components/GlobalFeesSettings';
import WaterparkRoster from '@/components/WaterparkRoster';
import type { DepartmentId, EventConfig, SubDepartment } from '@/lib/types';
import { departmentLabel } from '@/lib/labels';
import { useToast } from '@/components/ui/Feedback';

interface Props {
  allowedDepartments: DepartmentId[];
}

type TopTab = DepartmentId | 'global' | 'waterpark';

export default function UnifiedAdminDashboard({ allowedDepartments }: Props) {
  // 교역자 단일 운영 - 어드민은 항상 글로벌 설정 노출
  const canSeeGlobal = true;
  const showToast = useToast();

  const [activeTab, setActiveTab] = useState<TopTab>(allowedDepartments[0]);
  const [activeSubDept, setActiveSubDept] = useState<string>('all');
  const [config, setConfig] = useState<EventConfig | null>(null);

  // 부서 변경 시 세부부서 reset + config 로드
  useEffect(() => {
    setActiveSubDept('all');
    if (activeTab === 'global' || activeTab === 'waterpark') {
      setConfig(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/config/${activeTab}`);
        const json = await res.json();
        if (json.success) setConfig(json.data);
      } catch {
        setConfig(null);
        showToast('부서 설정을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.', 'error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const subDepartments: SubDepartment[] = useMemo(
    () => config?.subDepartments || [],
    [config]
  );

  const isDeptTab = activeTab !== 'global' && activeTab !== 'waterpark';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">통합 관리자</h1>
            <p className="text-xs text-cyan-300">GODS WILL · 지금세대교육부</p>
          </div>
          <form action="/api/admin/logout" method="POST">
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-sm font-semibold rounded-lg">
              로그아웃
            </button>
          </form>
        </div>

        {/* 1차 탭: 부서 선택 + 글로벌 설정 */}
        <nav className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {allowedDepartments.map((dept) => (
            <button
              key={dept}
              onClick={() => setActiveTab(dept)}
              className={`px-6 py-3 font-bold text-sm whitespace-nowrap transition-colors ${
                activeTab === dept
                  ? 'bg-slate-50 text-slate-900 rounded-t-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {departmentLabel(dept)}
            </button>
          ))}
          <button
            onClick={() => setActiveTab('waterpark')}
            className={`px-6 py-3 font-bold text-sm whitespace-nowrap transition-colors ${
              activeTab === 'waterpark'
                ? 'bg-slate-50 text-slate-900 rounded-t-lg'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            💦 워터풀 명단
          </button>
          {canSeeGlobal && (
            <button
              onClick={() => setActiveTab('global')}
              className={`px-6 py-3 font-bold text-sm whitespace-nowrap transition-colors ${
                activeTab === 'global'
                  ? 'bg-slate-50 text-slate-900 rounded-t-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              ⚙️ 글로벌 설정
            </button>
          )}
        </nav>
      </header>

      {/* 2차 탭: 세부부서 필터 (부서 탭일 때만) */}
      {isDeptTab && subDepartments.length > 0 && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto py-2">
            <SubTab
              label="전체"
              active={activeSubDept === 'all'}
              onClick={() => setActiveSubDept('all')}
            />
            {subDepartments.map((sd) => (
              <SubTab
                key={sd.id}
                label={sd.label}
                active={activeSubDept === sd.id}
                onClick={() => setActiveSubDept(sd.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 본문 */}
      <div className="max-w-7xl mx-auto">
        {isDeptTab ? (
          <AdminDashboard
            key={`${activeTab}-${activeSubDept}`}
            department={activeTab as DepartmentId}
            subDepartment={activeSubDept === 'all' ? undefined : activeSubDept}
          />
        ) : activeTab === 'waterpark' ? (
          <div className="p-6">
            {/* 부서 미지정 → 전체 부서 통합 명단 */}
            <WaterparkRoster />
          </div>
        ) : (
          <div className="p-6">
            <GlobalFeesSettings />
          </div>
        )}
      </div>
    </div>
  );
}

function SubTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
        active ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
