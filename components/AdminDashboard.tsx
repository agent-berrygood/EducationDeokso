'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import RichTextEditor from '@/components/RichTextEditor';
import { SurveyFormPlaceholder } from '@/components/SurveyFormPlaceholder';

interface Application {
  id: string;
  parent_name: string;
  parent_phone: string;
  depositor_name: string;
  grand_total: number;
  created_at: string;
  children: any[];
}

interface PaymentStatus {
  application_id: string;
  kinder_paid: boolean;
  kids_paid: boolean;
  teens_paid: boolean;
  waterpark_paid: boolean;
}

interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
  columnIndex: number;
}

interface AdminDashboardProps {
  department: 'kinder' | 'kids' | 'teens' | string;
}

export default function AdminDashboard({ department }: AdminDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'applications' | 'settings' | 'payment' | 'surveys' | string>('applications');
  const [applications, setApplications] = useState<Application[]>([]);
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, PaymentStatus>>({});
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  
  // 페이징, 검색 및 정렬 상태 추가
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'childName' | 'age' | 'createdAt'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // 하위 부서 탭 필터 state
  const [selectedSubDept, setSelectedSubDept] = useState<string>('all');

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<any>({
    title: '',
    eventType: '',
    subtitle: '',
    scripture: '',
    primaryColor: department === 'kinder' ? '#EAB308' : department === 'kids' ? '#3B82F6' : '#22C55E',
    bgColor: department === 'kinder' ? '#FEF08A' : department === 'kids' ? '#DBEAFE' : '#0F172A',
    tshirtSizes: [],
    customFields: [],
    subDepartments: [],
    campStartDate: '',
    campSchedule: [],
    campType: 'continuous',
    campDuration: 3,
    posterUrl: '',
  });
  
  const [newTshirtSize, setNewTshirtSize] = useState('');
  const [newSchedule, setNewSchedule] = useState({
    day: 1,
    time: '',
    title: '',
    description: '',
  });
  const [newCustomField, setNewCustomField] = useState<any>({
    label: '',
    type: 'text',
    required: false,
    options: '',
    columnIndex: 1,
  });

  const deptNames: Record<string, string> = {
    kinder: '나우킨더 (미취학)',
    kids: '나우키즈 (초등부)',
    teens: '나우틴즈 (중고등부)',
  };

  const loadApplications = async () => {
    try {
      setLoading(true);
      setError('');
      // 어드민 SQL 페이징 및 정렬 연동 호출
      const sqlSortField = sortField === 'childName' ? 'parentName' : 'createdAt'; // API가 'createdAt' 외의 값은 parent_name 정렬로 처리
      const res = await fetch(`/api/applications?department=${department}&limit=100&offset=${offset}&sortBy=${sqlSortField}&sortOrder=${sortDirection.toUpperCase()}`);
      if (!res.ok) throw new Error('Fetch failed');
      const { data } = await res.json();
      setApplications(data || []);
    } catch (err) {
      setError('신청서 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/config/${department}`);
      if (!res.ok) throw new Error('Fetch failed');
      const { data } = await res.json();
      setConfig(data);
      setSettingsForm({
        title: data.title || '',
        eventType: data.event_type || '',
        subtitle: data.subtitle || '',
        scripture: data.scripture || '',
        primaryColor: data.primary_color || (department === 'kinder' ? '#EAB308' : department === 'kids' ? '#3B82F6' : '#22C55E'),
        bgColor: data.bg_color || (department === 'kinder' ? '#FEF08A' : department === 'kids' ? '#DBEAFE' : '#0F172A'),
        tshirtSizes: data.tshirtSizes || [],
        customFields: data.customFieldMappings || [],
        subDepartments: data.subDepartments || [],
        campStartDate: data.camp_start_date || '',
        campSchedule: data.campSchedule || [],
        campType: data.campType || 'continuous',
        campDuration: Number(data.campDuration || 3),
        posterUrl: data.posterUrl || '',
      });
    } catch (err) {
      setError('CMS 설정을 로드하는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentStatuses = async () => {
    try {
      for (const app of applications) {
        const res = await fetch(`/api/payment?applicationId=${app.id}`);
        if (res.ok) {
          const { data } = await res.json();
          if (data) {
            setPaymentStatuses((prev) => ({ ...prev, [app.id]: data }));
          }
        }
      }
    } catch (err) {
      console.error('결제 상태 로드 실패:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'applications') {
      loadApplications();
    } else if (activeTab === 'settings') {
      loadConfig();
    }
  }, [activeTab, offset, department, sortField, sortDirection]);

  useEffect(() => {
    if (activeTab === 'applications' && applications.length > 0) {
      loadPaymentStatuses();
    }
  }, [applications, activeTab]);

  const deleteApplication = async (id: string) => {
    if (!confirm('정말 이 신청 정보 및 동반 자녀 데이터를 삭제하시겠습니까? 관련 데이터가 영구히 제거됩니다.')) return;
    try {
      const res = await fetch(`/api/applications?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      alert('데이터가 성공적으로 제거되었습니다.');
      loadApplications();
    } catch (err) {
      alert('삭제 도중 에러가 발생했습니다.');
    }
  };

  const updatePaymentStatus = async (applicationId: string, field: string, value: boolean) => {
    try {
      await fetch('/api/payment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, [field]: value }),
      });
      setPaymentStatuses((prev) => ({
        ...prev,
        [applicationId]: { ...prev[applicationId], [field]: value },
      }));
    } catch (err) {
      alert('수납 상태 업데이트에 실패했습니다.');
    }
  };

  const exportExcel = async () => {
    try {
      const res = await fetch(`/api/export?department=${department}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `신청현황_${department}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
    } catch (err) {
      alert('엑셀 파일 생성에 실패했습니다.');
    }
  };

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 제한 (2MB) - Neon DB 용량 최적화용
    if (file.size > 2 * 1024 * 1024) {
      alert('파일 크기가 너무 큽니다. 데이터베이스 최적화를 위해 2MB 이하의 이미지만 업로드해주세요.');
      return;
    }

    try {
      setIsSaving(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setSettingsForm((prev: any) => ({
          ...prev,
          posterUrl: base64String
        }));
        setIsSaving(false);
        alert('포스터 이미지가 정상적으로 변환되었습니다! 하단 저장 버튼을 눌러 확정해주세요.');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      alert('이미지 파일 변환 중 에러가 발생했습니다.');
      setIsSaving(false);
    }
  };

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      const res = await fetch(`/api/config/${department}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: settingsForm.title,
          eventType: settingsForm.eventType,
          subtitle: settingsForm.subtitle,
          scripture: settingsForm.scripture,
          primaryColor: settingsForm.primaryColor,
          bgColor: settingsForm.bgColor,
          tshirtSizes: settingsForm.tshirtSizes,
          customFieldMappings: settingsForm.customFields,
          subDepartments: settingsForm.subDepartments,
          campStartDate: settingsForm.campStartDate,
          campSchedule: settingsForm.campSchedule,
          campType: settingsForm.campType,
          campDuration: settingsForm.campDuration,
          posterUrl: settingsForm.posterUrl,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      alert('CMS 테마 및 행사 설정이 반영되었습니다.');
      loadConfig();
    } catch (err) {
      alert('설정 저장 도중 문제가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const addTshirtSize = () => {
    if (!newTshirtSize.trim()) return;
    setSettingsForm((prev: any) => ({
      ...prev,
      tshirtSizes: [...prev.tshirtSizes, newTshirtSize.trim().toUpperCase()],
    }));
    setNewTshirtSize('');
  };

  const removeTshirtSize = (size: string) => {
    setSettingsForm((prev: any) => ({
      ...prev,
      tshirtSizes: prev.tshirtSizes.filter((s: string) => s !== size),
    }));
  };

  const addCustomField = () => {
    if (!newCustomField.label.trim()) return;
    const field = {
      ...newCustomField,
      id: `field_${Date.now()}`,
      options: newCustomField.options ? newCustomField.options.split(',').map((o: string) => o.trim()).filter(Boolean) : [],
    };
    setSettingsForm((prev: any) => ({
      ...prev,
      customFields: [...prev.customFields, field],
    }));
    setNewCustomField({ label: '', type: 'text', required: false, options: '', columnIndex: 1 });
  };

  const removeCustomField = (id: string) => {
    setSettingsForm((prev: any) => ({
      ...prev,
      customFields: prev.customFields.filter((f: any) => f.id !== id),
    }));
  };

  const addScheduleItem = () => {
    if (!newSchedule.time.trim() || !newSchedule.title.trim()) {
      alert('시간과 일정명은 필수 입력 항목입니다.');
      return;
    }
    setSettingsForm((prev: any) => ({
      ...prev,
      campSchedule: [
        ...(prev.campSchedule || []),
        {
          id: `sched_${Date.now()}`,
          day: Number(newSchedule.day),
          time: newSchedule.time.trim(),
          title: newSchedule.title.trim(),
          description: newSchedule.description.trim(),
        }
      ].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)),
    }));
    setNewSchedule({ day: newSchedule.day, time: '', title: '', description: '' });
  };

  const removeScheduleItem = (id: string) => {
    setSettingsForm((prev: any) => ({
      ...prev,
      campSchedule: (prev.campSchedule || []).filter((s: any) => s.id !== id),
    }));
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return 0;
    try {
      const birthYear = new Date(birthDate).getFullYear();
      const currentYear = new Date().getFullYear();
      return currentYear - birthYear + 1;
    } catch (e) {
      return 0;
    }
  };

  // 아이 단위(자녀 중심)의 리스토어 평탄화 연산
  const processedChildren = useMemo(() => {
    const rows: any[] = [];
    applications.forEach(app => {
      if (app.children) {
        app.children.forEach(child => {
          if (child.department === department || !child.department) {
            rows.push({
              appId: app.id,
              parentName: app.parent_name,
              parentPhone: app.parent_phone,
              depositorName: app.depositor_name || app.parent_name,
              childName: child.name,
              birthDate: child.birthDate,
              age: calculateAge(child.birthDate),
              tshirtSize: child.tshirtSize,
              allergies: Array.isArray(child.allergies) ? child.allergies : JSON.parse(child.allergies || '[]'),
              customAllergy: child.customAllergy || '',
              attendsWaterpark: !!child.attendsWaterpark,
              grandTotal: app.grand_total,
              createdAt: app.created_at,
              originalChild: child
            });
          }
        });
      }
    });

    // 1. 검색어 필터링
    let filtered = rows;
    if (searchQuery.trim()) {
      const queryStr = searchQuery.toLowerCase().trim();
      filtered = rows.filter(row => 
        row.childName.toLowerCase().includes(queryStr) ||
        row.parentName.toLowerCase().includes(queryStr) ||
        row.parentPhone.includes(queryStr) ||
        row.depositorName.toLowerCase().includes(queryStr)
      );
    }

    // 3. 연령 범위 필터 (부서별 기준: kinder ≤7, kids 8~13, teens 14~19)
    const AGE_RANGES: Record<string, [number, number]> = {
      kinder: [0, 7],
      kids: [8, 13],
      teens: [14, 19],
    };
    const range = AGE_RANGES[department];
    if (range) {
      filtered = filtered.filter(row => row.age >= range[0] && row.age <= range[1]);
    }

    // 4. 하위 부서 탭 필터
    if (selectedSubDept !== 'all') {
      filtered = filtered.filter(row => 
        (row.originalChild?.subDepartment === selectedSubDept) ||
        (row.originalChild?.sub_department === selectedSubDept)
      );
    }

    // 2. 클라이언트 정렬
    filtered.sort((a, b) => {
      let valA: any = a.createdAt;
      let valB: any = b.createdAt;

      if (sortField === 'childName') {
        valA = a.childName;
        valB = b.childName;
      } else if (sortField === 'age') {
        valA = a.age;
        valB = b.age;
      }

      if (typeof valA === 'string') {
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB, 'ko') 
          : valB.localeCompare(valA, 'ko');
      } else {
        return sortDirection === 'asc' 
          ? (valA > valB ? 1 : -1) 
          : (valB > valA ? 1 : -1);
      }
    });

    return filtered;
  }, [applications, department, searchQuery, sortField, sortDirection, selectedSubDept]);

  const handleLogout = async () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.push(`/admin/login?dept=${department}`);
    }
  };

  return (
    <div 
      className={`min-h-screen pb-20 ${department === 'teens' ? 'bg-slate-950 text-white' : 'bg-gray-50 text-gray-900'}`}
      style={{
        '--primary-color': settingsForm.primaryColor,
        '--bg-color': settingsForm.bgColor,
      } as React.CSSProperties}
    >
      {/* Header Bar */}
      <header className={`border-b p-6 flex flex-col md:flex-row justify-between items-center gap-4 ${department === 'teens' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">🔑</span>
          <div>
            <h1 className="text-2xl font-bold">{deptNames[department] || department} 관리자 패널</h1>
            <p className="text-sm text-gray-400">교사 전용 성경학교 및 여름 수련회 실시간 CMS 통합 대시보드</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportExcel}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow transition duration-200 cursor-pointer"
          >
            📥 엑셀 내보내기 (xlsx)
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white text-sm font-semibold rounded-lg transition duration-200 cursor-pointer"
          >
            🔒 로그아웃
          </button>
        </div>
      </header>

      <div className="container mx-auto px-6 mt-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-300 dark:border-slate-800 gap-4 overflow-x-auto whitespace-nowrap">
          {[
            { id: 'applications', label: `📝 신청 현황 (${processedChildren.length}명)` },
            { id: 'settings', label: '🎨 CMS & 스킨 설정' },
            { id: 'payment', label: '💳 수납 확인 모니터' },
            { id: 'surveys', label: '📊 설문조사 관리 (Phase 2)' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-4 px-4 font-bold border-b-2 text-lg transition duration-200 cursor-pointer ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-xl">
            {error}
          </div>
        )}

        {/* Tab Contents */}
        <div className="mt-8">
          
          {/* 1. Applications Tab */}
          {activeTab === 'applications' && (
            <div className="space-y-4">
              {/* 하위 부서 탭 필터 */}
              {config?.subDepartments && config.subDepartments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setSelectedSubDept('all')}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition cursor-pointer ${
                      selectedSubDept === 'all'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200'
                    }`}
                  >
                    전체
                  </button>
                  {config.subDepartments.map((sub: any) => (
                    <button
                      key={sub.id}
                      onClick={() => setSelectedSubDept(sub.id)}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition cursor-pointer ${
                        selectedSubDept === sub.id
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:max-w-md">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="자녀 이름, 부모 성함, 연락처 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white text-gray-900 shadow-sm transition"
                  />
                </div>
                <div className="text-sm text-gray-400">
                  검색 결과: <strong className="text-indigo-600 font-bold">{processedChildren.length}</strong>명
                </div>
              </div>

              <div className={`rounded-xl border overflow-hidden shadow-md ${department === 'teens' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
                {loading ? (
                  <div className="p-12 text-center text-gray-400">데이터를 스트리밍 중입니다...</div>
                ) : !processedChildren.length ? (
                  <div className="p-12 text-center text-gray-400">조건에 일치하는 자녀 정보가 존재하지 않습니다.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className={`border-b text-xs font-semibold uppercase tracking-wider ${department === 'teens' ? 'bg-slate-950/50 border-slate-800 text-slate-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                          <th 
                            className="p-4 cursor-pointer hover:bg-gray-100/50 select-none transition"
                            onClick={() => {
                              if (sortField === 'childName') {
                                setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('childName');
                                setSortDirection('asc');
                              }
                            }}
                          >
                            자녀 이름 {sortField === 'childName' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </th>
                          <th 
                            className="p-4 cursor-pointer hover:bg-gray-100/50 select-none transition"
                            onClick={() => {
                              if (sortField === 'age') {
                                setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('age');
                                setSortDirection('desc');
                              }
                            }}
                          >
                            연령 (나이) {sortField === 'age' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </th>
                          <th className="p-4">성별</th>
                          <th className="p-4">단체티 사이즈</th>
                          <th className="p-4">알레르기 및 기타 특이사항</th>
                          <th className="p-4">보호자 / 연락처</th>
                          <th className="p-4 text-center">워터파크 참가</th>
                          <th 
                            className="p-4 cursor-pointer hover:bg-gray-100/50 select-none transition"
                            onClick={() => {
                              if (sortField === 'createdAt') {
                                setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('createdAt');
                                setSortDirection('desc');
                              }
                            }}
                          >
                            신청일시 {sortField === 'createdAt' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </th>
                          <th className="p-4 text-center">작업</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                        {processedChildren.map((row, idx) => (
                          <tr key={`${row.appId}-${idx}`} className={`${department === 'teens' ? 'hover:bg-slate-800/40' : 'hover:bg-gray-50/50'}`}>
                            <td className="p-4 font-bold text-base text-indigo-600 dark:text-indigo-400">
                              {row.childName}
                            </td>
                            <td className="p-4 text-sm">
                              <span className="px-2.5 py-1 font-semibold rounded bg-slate-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200">
                                {row.age}세 ({row.birthDate})
                              </span>
                            </td>
                            <td className="p-4 text-sm font-semibold">
                              {row.originalChild?.custom20 || row.originalChild?.custom_20 || '-'}
                            </td>
                            <td className="p-4 font-semibold text-gray-900 dark:text-white">
                              {row.tshirtSize || '미선택'}
                            </td>
                            <td className="p-4 text-xs text-red-500 font-medium">
                              <div>⚠️ 알러지: {row.allergies.join(', ') || '없음'}</div>
                              {row.customAllergy && <div className="mt-1 text-gray-400">기타: {row.customAllergy}</div>}
                            </td>
                            <td className="p-4 text-sm">
                              <div className="font-semibold">{row.parentName}</div>
                              <div className="text-xs text-gray-400 mt-0.5">{row.parentPhone}</div>
                              {row.depositorName !== row.parentName && (
                                <div className="text-[11px] text-gray-500">입금자: {row.depositorName}</div>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                row.attendsWaterpark
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30'
                                  : 'bg-gray-100 text-gray-400 dark:bg-slate-800'
                              }`}>
                                {row.attendsWaterpark ? '참가' : '미참가'}
                              </span>
                            </td>
                            <td className="p-4 text-xs text-gray-400">
                              {new Date(row.createdAt).toLocaleString('ko-KR')}
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => deleteApplication(row.appId)}
                                className="px-3 py-1 bg-red-500 hover:bg-red-650 text-white font-bold text-xs rounded transition duration-150 shadow cursor-pointer"
                              >
                                🗑️ 삭제
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Paging Buttons */}
              <div className="flex justify-center gap-4 mt-6">
                <button
                  onClick={() => setOffset(Math.max(0, offset - 100))}
                  disabled={offset === 0}
                  className="px-4 py-2 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 disabled:opacity-50 text-sm font-semibold rounded-lg transition"
                >
                  이전 페이지
                </button>
                <button
                  onClick={() => setOffset(offset + 100)}
                  disabled={applications.length < 100}
                  className="px-4 py-2 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 disabled:opacity-50 text-sm font-semibold rounded-lg transition"
                >
                  다음 페이지
                </button>
              </div>
            </div>
          )}

          {/* 2. Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-8">
              <form onSubmit={(e) => { e.preventDefault(); saveSettings(); }} className="space-y-8">
                
                {/* 기본 정보 */}
                <div className={`p-6 rounded-2xl border shadow-sm ${department === 'teens' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                  <h3 className="text-xl font-bold mb-4 border-b pb-2">🎨 기본 행사 정보 설정</h3>
                  <div className="grid grid-cols-1 gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">공식 행사 명칭</label>
                        <input
                          type="text"
                          value={settingsForm.title}
                          onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                          placeholder="예: 2026 나우킨더 여름성경학교"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">행사 종류 (Top-Right 배지 텍스트)</label>
                        <input
                          type="text"
                          value={settingsForm.eventType}
                          onChange={(e) => setSettingsForm({ ...settingsForm, eventType: e.target.value })}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                          placeholder="예: 여름성경학교, 여름수련회"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2">📢 공식 홍보 포스터 등록 (다이렉트 파일 업로드 지원)</label>
                      <div className="flex flex-col md:flex-row gap-4 items-center">
                        <label className="w-full md:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-center cursor-pointer shadow transition duration-200">
                          📁 내 컴퓨터에서 이미지 선택...
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePosterUpload}
                            className="hidden"
                          />
                        </label>
                        <div className="flex-1 w-full">
                          <input
                            type="text"
                            value={settingsForm.posterUrl}
                            onChange={(e) => setSettingsForm({ ...settingsForm, posterUrl: e.target.value })}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900"
                            placeholder="파일을 선택하면 주소가 자동 주입되며 직접 입력도 가능합니다."
                          />
                        </div>
                      </div>
                      {settingsForm.posterUrl && (
                        <div className="mt-3 p-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-between">
                          <div className="text-xs text-gray-500 truncate mr-4">등록된 포스터: <span className="font-semibold text-indigo-650">{settingsForm.posterUrl}</span></div>
                          <button
                            type="button"
                            onClick={() => setSettingsForm({ ...settingsForm, posterUrl: '' })}
                            className="px-2 py-1 text-xs font-bold text-red-500 hover:text-red-700 transition"
                          >
                            ✕ 삭제
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">📅 캠프 시작일 (카운트다운 기준)</label>
                        <input
                          type="date"
                          value={settingsForm.campStartDate}
                          onChange={(e) => setSettingsForm({ ...settingsForm, campStartDate: e.target.value })}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">🗓️ 수련회 진행 방식</label>
                        <select
                          value={settingsForm.campType}
                          onChange={(e) => setSettingsForm({ ...settingsForm, campType: e.target.value })}
                          className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900 text-sm"
                        >
                          <option value="continuous">연속 수련회 (예: 2박 3일 연속)</option>
                          <option value="weekly">주일 분산 수련회 (예: 수주에 걸쳐 매주일)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">⏳ 수련회 기간 (총 일차 / 주차)</label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={settingsForm.campDuration}
                          onChange={(e) => setSettingsForm({ ...settingsForm, campDuration: Number(e.target.value) })}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">행사 주제 (Theme Slogan) - 리치 텍스트</label>
                      <RichTextEditor
                        value={settingsForm.subtitle}
                        onChange={(html) => setSettingsForm({ ...settingsForm, subtitle: html })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">성경 구절 (Scripture Verse) - 리치 텍스트</label>
                      <RichTextEditor
                        value={settingsForm.scripture}
                        onChange={(html) => setSettingsForm({ ...settingsForm, scripture: html })}
                      />
                    </div>
                  </div>
                </div>

                {/* 테마 컬러 제어 */}
                <div className={`p-6 rounded-2xl border shadow-sm ${department === 'teens' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                  <h3 className="text-xl font-bold mb-4 border-b pb-2">🎨 배너 & 테마 스킨 제어</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-1">메인 테마 컬러 (Hex)</label>
                      <input
                        type="color"
                        value={settingsForm.primaryColor}
                        onChange={(e) => setSettingsForm({ ...settingsForm, primaryColor: e.target.value })}
                        className="w-full h-12 border rounded-lg p-1 bg-white cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">배경 톤 컬러 (Hex)</label>
                      <input
                        type="color"
                        value={settingsForm.bgColor}
                        onChange={(e) => setSettingsForm({ ...settingsForm, bgColor: e.target.value })}
                        className="w-full h-12 border rounded-lg p-1 bg-white cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* 단체티 사이즈 관리 */}
                <div className={`p-6 rounded-2xl border shadow-sm ${department === 'teens' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                  <h3 className="text-xl font-bold mb-4 border-b pb-2">👕 부서별 티셔츠 사이즈 옵션 관리</h3>
                  <div className="flex gap-3 mb-4">
                    <input
                      type="text"
                      placeholder="추가할 사이즈 입력 (예: L, 100, 2XL)"
                      value={newTshirtSize}
                      onChange={(e) => setNewTshirtSize(e.target.value)}
                      className="flex-1 px-4 py-2 border rounded-lg bg-white text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={addTshirtSize}
                      className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow cursor-pointer"
                    >
                      옵션 추가
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {settingsForm.tshirtSizes.length === 0 ? (
                      <p className="text-sm text-gray-400">등록된 커스텀 사이즈가 없습니다. (기본 사이즈가 드롭다운에 노출됩니다)</p>
                    ) : (
                      settingsForm.tshirtSizes.map((size: string) => (
                        <div
                          key={size}
                          className="flex items-center gap-2 bg-indigo-50 border border-indigo-150 px-3.5 py-1.5 rounded-full text-indigo-700 font-semibold text-sm"
                        >
                          <span>{size}</span>
                          <button
                            type="button"
                            onClick={() => removeTshirtSize(size)}
                            className="text-red-500 hover:text-red-700 font-bold cursor-pointer text-base"
                          >
                            &times;
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 수련회 세부 일정(타임라인) 설정 */}
                <div className={`p-6 rounded-2xl border shadow-sm ${department === 'teens' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b pb-4">
                    <div>
                      <h3 className="text-xl font-bold">📅 수련회 세부 일정(타임라인) 그래픽 설정</h3>
                      <p className="text-xs text-gray-400 mt-1">드래그 앤 드롭과 프리셋이 지원되는 단독 전체화면 디자인 에디터에서 일정을 한눈에 편집하세요.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.open(`/${department}/admin/schedule`, '_blank')}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg shadow-lg cursor-pointer flex items-center gap-2 transform active:scale-95 transition"
                    >
                      🎨 일정 그래픽 캔버스 에디터 열기
                    </button>
                  </div>
                  
                  {/* 대시보드 내에서는 약식 등록 및 현황 조회만 제공 */}
                  <div className="text-sm p-4 rounded-xl bg-indigo-50/50 dark:bg-slate-800/20 text-indigo-700 dark:text-indigo-300 font-semibold mb-6">
                    💡 현재 설정된 방식: <strong className="underline">{settingsForm.campType === 'continuous' ? '연속 수련회' : '주일 분산 수련회'}</strong> ({settingsForm.campDuration}일간 / {settingsForm.campDuration}주간)
                  </div>
                  
                  {/* 등록된 일정 목록 (간략히 10개만 리스트업) */}
                  <div className="space-y-2">
                    {!settingsForm.campSchedule || settingsForm.campSchedule.length === 0 ? (
                      <p className="text-center p-6 border border-dashed border-gray-200 dark:border-slate-800 rounded-xl text-gray-400">등록된 세부 일정이 없습니다. 그래픽 에디터를 열고 프리셋 템플릿을 생성해보세요.</p>
                    ) : (
                      settingsForm.campSchedule.slice(0, 10).map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-3 border rounded-xl bg-gray-50/50 dark:bg-slate-900/50 dark:border-slate-800 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">
                              {item.day}{settingsForm.campType === 'continuous' ? '일차' : '주차'}
                            </span>
                            <span className="font-bold text-gray-500">
                              🕒 {item.time}
                            </span>
                            <span className="font-bold text-gray-800 dark:text-white">
                              {item.title}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                    {settingsForm.campSchedule && settingsForm.campSchedule.length > 10 && (
                      <p className="text-center text-xs text-gray-400 mt-2">외에 {settingsForm.campSchedule.length - 10}개의 일정이 더 있습니다. 에디터에서 전체 상세 보기가 가능합니다.</p>
                    )}
                  </div>
                </div>

                {/* 추가 맞춤 문항 질문 설정 */}
                <div className={`p-6 rounded-2xl border shadow-sm ${department === 'teens' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                  <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="text-xl font-bold">📋 신청서 추가 수집 질문 문항 설정</h3>
                    <button
                      type="button"
                      onClick={addCustomField}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow cursor-pointer"
                    >
                      ➕ 새 문항 임시 추가
                    </button>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-xl bg-gray-50/50 dark:bg-slate-800/40">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">문항 질문 제목 (Label)</label>
                        <input
                          type="text"
                          placeholder="예: 셔틀버스를 어디서 타시나요?"
                          value={newCustomField.label}
                          onChange={(e) => setNewCustomField({ ...newCustomField, label: e.target.value })}
                          className="w-full px-3 py-1.5 border rounded-lg bg-white text-gray-900 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">입력 컨트롤 타입 (Type)</label>
                        <select
                          value={newCustomField.type}
                          onChange={(e) => setNewCustomField({ ...newCustomField, type: e.target.value as any })}
                          className="w-full px-3 py-1.5 border rounded-lg bg-white text-gray-900 text-sm"
                        >
                          <option value="text">단답형 텍스트</option>
                          <option value="textarea">장문형 텍스트</option>
                          <option value="select">드롭다운 선택 (Select)</option>
                          <option value="checkbox">동의/체크박스 (Checkbox)</option>
                        </select>
                      </div>
                      <div className="flex items-center pt-5">
                        <label className="flex items-center space-x-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={newCustomField.required}
                            onChange={(e) => setNewCustomField({ ...newCustomField, required: e.target.checked })}
                            className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-semibold">필수 응답 항목 지정</span>
                        </label>
                      </div>
                      {(newCustomField.type === 'select' || newCustomField.type === 'checkbox') && (
                        <div className="md:col-span-3 pt-2 border-t border-dashed border-gray-200">
                          <label className="block text-xs font-semibold text-gray-500 mb-1">선택지 옵션 리스트 (콤마 , 로 구분)</label>
                          <input
                            type="text"
                            placeholder="예: 덕소역 탑승, 삼패동 탑승, 개별 이동"
                            value={newCustomField.options}
                            onChange={(e) => setNewCustomField({ ...newCustomField, options: e.target.value })}
                            className="w-full px-3 py-1.5 border rounded-lg bg-white text-gray-900 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 등록된 추가 질문 리스트 */}
                  <div className="space-y-3">
                    {settingsForm.customFields.length === 0 ? (
                      <p className="text-center p-6 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl text-gray-400">추가적으로 수집할 맞춤 질문이 없습니다.</p>
                    ) : (
                      settingsForm.customFields.map((field: any, idx: number) => (
                        <div key={field.id} className="flex items-center justify-between p-4 border rounded-xl bg-gray-50/50 dark:bg-slate-900/50 dark:border-slate-800">
                          <div>
                            <p className="font-bold text-base flex items-center gap-1.5">
                              <span>❓</span> {field.label} {field.required && <span className="text-red-500 font-bold text-xs">*필수</span>}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              타입: {field.type === 'text' ? '단답형' : field.type === 'textarea' ? '장문형' : field.type === 'select' ? '드롭다운' : '체크박스'}
                              {field.options && field.options.length > 0 && ` | 선택지: [${field.options.join(', ')}]`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCustomField(field.id)}
                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded shadow transition cursor-pointer"
                          >
                            삭제
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg rounded-xl shadow-lg transition duration-200 disabled:opacity-50 cursor-pointer transform active:scale-95"
                  >
                    {isSaving ? '설정 데이터 동기화 중...' : '💾 CMS 설정 최종 적용'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 3. Payment Status Tab */}
          {activeTab === 'payment' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold">💳 실시간 수납 및 입금자 확인 모니터</h3>
              <p className="text-sm text-gray-500">신청서에서 부모님이 자가 체크한 입금 상태를 대조하고 교사 확인 상태로 직접 토글합니다.</p>
              
              <div className={`rounded-xl border overflow-hidden shadow-md ${department === 'teens' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className={`border-b text-xs font-semibold uppercase tracking-wider ${department === 'teens' ? 'bg-slate-950/50 border-slate-800 text-slate-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                        <th className="p-4">보호자명</th>
                        <th className="p-4">연락처</th>
                        <th className="p-4">입금자명</th>
                        <th className="p-4 text-center">나우킨더 회비</th>
                        <th className="p-4 text-center">나우키즈 회비</th>
                        <th className="p-4 text-center">나우틴즈 회비</th>
                        <th className="p-4 text-center">워터파크 비용</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                      {applications.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-gray-400">수납 확인 대상 신청 정보가 존재하지 않습니다.</td>
                        </tr>
                      ) : (
                        applications.map((app) => {
                          const payment = paymentStatuses[app.id] || {
                            kinder_paid: false,
                            kids_paid: false,
                            teens_paid: false,
                            waterpark_paid: false
                          };
                          return (
                            <tr key={app.id} className={`${department === 'teens' ? 'hover:bg-slate-800/40' : 'hover:bg-gray-50/50'}`}>
                              <td className="p-4 font-bold">{app.parent_name}</td>
                              <td className="p-4 text-gray-400 text-xs">{app.parent_phone}</td>
                              <td className="p-4 text-indigo-700 font-semibold dark:text-indigo-400">{app.depositor_name || app.parent_name}</td>
                              <td className="p-4 text-center">
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={payment.kinder_paid || false}
                                    onChange={(e) => updatePaymentStatus(app.id, 'kinder_paid', e.target.checked)}
                                    className="h-4.5 w-4.5 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                  />
                                  <span className="text-xs">수납</span>
                                </label>
                              </td>
                              <td className="p-4 text-center">
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={payment.kids_paid || false}
                                    onChange={(e) => updatePaymentStatus(app.id, 'kids_paid', e.target.checked)}
                                    className="h-4.5 w-4.5 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                  />
                                  <span className="text-xs">수납</span>
                                </label>
                              </td>
                              <td className="p-4 text-center">
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={payment.teens_paid || false}
                                    onChange={(e) => updatePaymentStatus(app.id, 'teens_paid', e.target.checked)}
                                    className="h-4.5 w-4.5 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                  />
                                  <span className="text-xs">수납</span>
                                </label>
                              </td>
                              <td className="p-4 text-center">
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={payment.waterpark_paid || false}
                                    onChange={(e) => updatePaymentStatus(app.id, 'waterpark_paid', e.target.checked)}
                                    className="h-4.5 w-4.5 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                  />
                                  <span className="text-xs">수납</span>
                                </label>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4. Surveys Tab */}
          {activeTab === 'surveys' && (
            <SurveyFormPlaceholder department={department as 'kinder' | 'kids' | 'teens'} />
          )}

        </div>
      </div>
    </div>
  );
}
