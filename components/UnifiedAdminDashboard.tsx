'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminDashboard from '@/components/AdminDashboard';
import GlobalFeesSettings from '@/components/GlobalFeesSettings';
import type { DepartmentId, EventConfig, SubDepartment } from '@/lib/types';

const DEPT_LABELS: Record<DepartmentId, string> = {
  kinder: '나우킨더',
  kids: '나우키즈',
  teens: '나우틴즈',
};

interface Props {
  allowedDepartments: DepartmentId[];
}

type TopTab = DepartmentId | 'global';

export default function UnifiedAdminDashboard({ allowedDepartments }: Props) {
  // 글로벌 설정은 전체 부서 권한이 있는 사용자만 접근 가능
  const canSeeGlobal = allowedDepartments.length >= 2;

  const [activeTab, setActiveTab] = useState<TopTab>(allowedDepartments[0]);
  const [activeSubDept, setActiveSubDept] = useState<string>('all');
  const [config, setConfig] = useState<EventConfig | null>(null);

  // 부서 변경 시 세부부서 reset + config 로드
  useEffect(() => {
    setActiveSubDept('all');
    if (activeTab === 'global') {
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
      }
    })();
  }, [activeTab]);

  const subDepartments: SubDepartment[] = useMemo(
    () => config?.subDepartments || [],
    [config]
  );

  const isDeptTab = activeTab !== 'global';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">통합 관리자</h1>
            <p className="text-xs text-cyan-300">High Will Deokso Church · 지금세대교육부</p>
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
              {DEPT_LABELS[dept]}
            </button>
          ))}
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
