'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminDashboard from '@/components/AdminDashboard';
import type { DepartmentId, EventConfig, SubDepartment } from '@/lib/types';

const DEPT_LABELS: Record<DepartmentId, string> = {
  kinder: '나우킨더',
  kids: '나우키즈',
  teens: '나우틴즈',
};

interface Props {
  allowedDepartments: DepartmentId[];
}

export default function UnifiedAdminDashboard({ allowedDepartments }: Props) {
  const [activeDept, setActiveDept] = useState<DepartmentId>(allowedDepartments[0]);
  const [activeSubDept, setActiveSubDept] = useState<string>('all');
  const [config, setConfig] = useState<EventConfig | null>(null);

  // 부서 변경 시 세부부서 reset + config 로드
  useEffect(() => {
    setActiveSubDept('all');
    (async () => {
      try {
        const res = await fetch(`/api/config/${activeDept}`);
        const json = await res.json();
        if (json.success) setConfig(json.data);
      } catch {
        setConfig(null);
      }
    })();
  }, [activeDept]);

  const subDepartments: SubDepartment[] = useMemo(
    () => config?.subDepartments || [],
    [config]
  );

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

        {/* 1차 탭: 부서 선택 */}
        <nav className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {allowedDepartments.map((dept) => (
            <button
              key={dept}
              onClick={() => setActiveDept(dept)}
              className={`px-6 py-3 font-bold text-sm whitespace-nowrap transition-colors ${
                activeDept === dept
                  ? 'bg-slate-50 text-slate-900 rounded-t-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {DEPT_LABELS[dept]}
            </button>
          ))}
        </nav>
      </header>

      {/* 2차 탭: 세부부서 필터 */}
      {subDepartments.length > 0 && (
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

      {/* 본문: 기존 AdminDashboard 재사용 */}
      <div className="max-w-7xl mx-auto">
        <AdminDashboard
          key={`${activeDept}-${activeSubDept}`}
          department={activeDept}
          subDepartment={activeSubDept === 'all' ? undefined : activeSubDept}
        />
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
