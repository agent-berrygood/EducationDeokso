import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, doc, getDoc, setDoc, getDocs, limit, startAfter, orderBy, deleteDoc } from 'firebase/firestore';
import RichTextEditor from '@/components/RichTextEditor';
import { SurveyFormPlaceholder } from '@/components/SurveyFormPlaceholder';

interface AdminDashboardProps {
  department: 'kinder' | 'kids' | 'teens';
}

interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
}

interface Application {
  id: string;
  parentInfo: {
    parentName: string;
    parentPhone: string;
    depositorName: string;
  };
  children: Array<{
    name: string;
    birthDate: string;
    department: string;
    tshirtSize: string;
    allergies: string[];
    customAllergy: string;
    attendsWaterpark: boolean;
    customValues?: { [key: string]: any };
  }>;
  fees: {
    kinderTotal: number;
    kidsTotal: number;
    teensTotal: number;
    waterparkTotal: number;
    grandTotal: number;
  };
  paymentStatus: {
    kinder?: boolean;
    kids?: boolean;
    teens?: boolean;
    waterpark?: boolean;
  };
  createdAt: string;
}

interface EventConfig {
  title: string;
  eventType: string;
  subtitle: string;
  scripture: string;
  primaryColor?: string;
  bgColor?: string;
  customFields?: CustomField[];
  tshirtSizes?: string[];
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ department }) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'applications' | 'settings' | 'surveys'>('applications');
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Event Settings State
  const [eventConfig, setEventConfig] = useState<EventConfig>({
    title: '',
    eventType: department === 'teens' ? '여름수련회' : '여름성경학교',
    subtitle: '',
    scripture: '',
    primaryColor: department === 'kinder' ? '#EAB308' : department === 'kids' ? '#3B82F6' : '#22C55E',
    bgColor: department === 'kinder' ? '#FEF08A' : department === 'kids' ? '#DBEAFE' : '#0F172A',
    customFields: [],
    tshirtSizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
  });

  const deptNames = {
    kinder: '나우킨더 (미취학)',
    kids: '나우키즈 (초등부)',
    teens: '나우틴즈 (중고등부)',
  };

  // 1. Fetch applications 100 at a time (Paging)
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'childName' | 'age' | 'createdAt'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const fetchApplications = async (isNext = false) => {
    if (!isNext) {
      setIsLoading(true);
    }
    try {
      let q = query(
        collection(db, 'applications'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );

      if (isNext && lastVisible) {
        q = query(
          collection(db, 'applications'),
          orderBy('createdAt', 'desc'),
          startAfter(lastVisible),
          limit(100)
        );
      }

      const snapshot = await getDocs(q);
      const fetchedApps = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Application[];

      if (snapshot.docs.length > 0) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      }
      setHasMore(snapshot.docs.length === 100);

      setApplications(prev => isNext ? [...prev, ...fetchedApps] : fetchedApps);
    } catch (err) {
      console.error("Error fetching applications:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setLastVisible(null);
    setHasMore(true);
    fetchApplications(false);
  }, [department]);

  const handleDelete = async (appId: string) => {
    if (!confirm("정말로 이 신청서를 영구 삭제하시겠습니까? 신청 부모와 동반 자녀 정보가 전부 삭제됩니다.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'applications', appId));
      alert("신청서가 데이터베이스에서 안전하게 삭제되었습니다.");
      setApplications(prev => prev.filter(app => app.id !== appId));
    } catch (err) {
      console.error("Error deleting application:", err);
      alert("삭제에 실패했습니다. 권한이 없거나 네트워크 문제가 발생했습니다.");
    }
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

  const processedChildren = useMemo(() => {
    const rows: Array<{
      appId: string;
      parentName: string;
      parentPhone: string;
      depositorName: string;
      childName: string;
      birthDate: string;
      age: number;
      tshirtSize: string;
      allergies: string[];
      customAllergy: string;
      attendsWaterpark: boolean;
      customValues?: { [key: string]: any };
      paymentStatus: boolean;
      createdAt: string;
      grandTotal: number;
    }> = [];

    applications.forEach(app => {
      if (app.children) {
        app.children.forEach(child => {
          if (child.department === department) {
            rows.push({
              appId: app.id,
              parentName: app.parentInfo.parentName,
              parentPhone: app.parentInfo.parentPhone,
              depositorName: app.parentInfo.depositorName || app.parentInfo.parentName,
              childName: child.name,
              birthDate: child.birthDate,
              age: calculateAge(child.birthDate),
              tshirtSize: child.tshirtSize,
              allergies: child.allergies || [],
              customAllergy: child.customAllergy || '',
              attendsWaterpark: child.attendsWaterpark || false,
              customValues: child.customValues,
              paymentStatus: !!app.paymentStatus[department as keyof typeof app.paymentStatus],
              createdAt: app.createdAt,
              grandTotal: app.fees.grandTotal,
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

    // 2. 정렬
    filtered.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

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
  }, [applications, department, searchQuery, sortField, sortDirection]);

  // 2. Fetch current event CMS configuration
  useEffect(() => {
    const fetchEventConfig = async () => {
      try {
        const docRef = doc(db, 'config', `events_${department}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setEventConfig((prev) => ({
            ...prev,
            ...data,
            customFields: data.customFields || [],
          }));
        }
      } catch (err) {
        console.error("Error fetching event CMS configuration:", err);
      }
    };
    fetchEventConfig();
  }, [department]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const docRef = doc(db, 'config', `events_${department}`);
      await setDoc(docRef, eventConfig, { merge: true });
      alert("행사 CMS 설정(맞춤 수집 항목 포함)이 데이터베이스에 실시간으로 안전하게 저장되었습니다!");
    } catch (err) {
      console.error(err);
      alert("설정 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.push(`/admin/login?dept=${department}`);
    }
  };

  const handleExportCSV = () => {
    if (!applications.length) {
      alert("내보낼 데이터가 없습니다.");
      return;
    }

    const fields = eventConfig.customFields || [];
    let csvContent = "\uFEFF"; // UTF-8 BOM
    
    // Header
    let headers = ["신청자ID", "보호자 성함", "보호자 연락처", "입금자명", "자녀이름", "생년월일", "사이즈", "알레르기", "워터파크동반"];
    fields.forEach(f => {
      headers.push(`[추가] ${f.label}`);
    });
    headers.push("입금상태", "총회비", "신청일시");
    csvContent += headers.map(h => `"${h}"`).join(',') + '\n';

    // Rows
    applications.forEach((app) => {
      app.children.forEach((child) => {
        if (child.department === department) {
          const attendsWaterpark = child.attendsWaterpark ? "신청(부모동반)" : "미신청";
          const paidStatus = app.paymentStatus[department as keyof typeof app.paymentStatus] ? "입금확인" : "대기";
          const allergies = child.allergies.join(' / ') + (child.customAllergy ? ` (${child.customAllergy})` : '');
          
          let rowData = [
            app.id,
            app.parentInfo.parentName,
            app.parentInfo.parentPhone,
            app.parentInfo.depositorName || app.parentInfo.parentName,
            child.name,
            child.birthDate,
            child.tshirtSize,
            allergies,
            attendsWaterpark
          ];

          // Map custom fields
          fields.forEach(f => {
            const val = child.customValues ? child.customValues[f.id] : '';
            rowData.push(val !== undefined && val !== null ? String(val) : '');
          });

          rowData.push(paidStatus, `${app.fees.grandTotal}원`, app.createdAt);
          csvContent += rowData.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
        }
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${department}_camp_applications_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`min-h-screen ${department === 'teens' ? 'bg-slate-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Top bar */}
      <header className={`border-b p-6 flex flex-col md:flex-row justify-between items-center gap-4 ${department === 'teens' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">🔑</span>
          <div>
            <h1 className="text-2xl font-bold">{deptNames[department]} 관리자 패널</h1>
            <p className="text-sm text-gray-400">교사 전용 수련회/성경학교 정보 및 데이터 실시간 관리 도구</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-md cursor-pointer transition"
          >
            📥 엑셀 내보내기 (CSV)
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white text-sm font-semibold rounded-lg cursor-pointer transition"
          >
            🔒 로그아웃
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="container mx-auto px-6 mt-8">
        <div className="flex border-b border-gray-300 gap-4">
          <button
            onClick={() => setActiveTab('applications')}
            className={`pb-4 px-4 font-bold border-b-2 text-lg transition cursor-pointer ${
              activeTab === 'applications'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            📝 신청 목록 ({applications.length}건)
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-4 px-4 font-bold border-b-2 text-lg transition cursor-pointer ${
              activeTab === 'settings'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            ⚙️ 성구 & 스킨 CMS 설정
          </button>
          <button
            onClick={() => setActiveTab('surveys')}
            className={`pb-4 px-4 font-bold border-b-2 text-lg transition cursor-pointer ${
              activeTab === 'surveys'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            📊 설문조사 관리 (Phase 2)
          </button>
        </div>

        {/* Tab Contents */}
        <div className="mt-8">
          {activeTab === 'applications' && (
            <div className="space-y-4">
              {/* 검색 및 정렬 컨트롤러 바 */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:max-w-md">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="아이 이름, 보호자명, 연락처 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white text-gray-900 shadow-sm"
                  />
                </div>
                <div className="text-sm text-gray-500">
                  검색 결과: <strong className="text-indigo-600 font-bold">{processedChildren.length}</strong>명
                </div>
              </div>

              <div className={`rounded-xl border overflow-hidden shadow-md ${department === 'teens' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
                {isLoading ? (
                  <div className="p-12 text-center text-gray-400">데이터를 불러오는 중입니다...</div>
                ) : !processedChildren.length ? (
                  <div className="p-12 text-center text-gray-400">조건에 부합하는 신청 자녀 정보가 없습니다.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className={`border-b text-xs font-semibold uppercase tracking-wider ${department === 'teens' ? 'bg-slate-950/50 border-slate-800 text-slate-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                          <th 
                            className="p-4 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-slate-850/50 select-none transition"
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
                            className="p-4 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-slate-850/50 select-none transition"
                            onClick={() => {
                              if (sortField === 'age') {
                                setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('age');
                                setSortDirection('desc'); // 나이는 역순(나이가 많은 순)이 기본값으로 유용
                              }
                            }}
                          >
                            연령 (나이) {sortField === 'age' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </th>
                          <th className="p-4">단체티 사이즈</th>
                          <th className="p-4">알레르기 & 특이사항</th>
                          <th className="p-4">보호자 정보</th>
                          <th className="p-4 text-center">수납 / 워터파크</th>
                          <th 
                            className="p-4 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-slate-850/50 select-none transition"
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
                          <tr key={`${row.appId}-${idx}`} className={`${department === 'teens' ? 'hover:bg-slate-800/40 divide-slate-800' : 'hover:bg-gray-50/50 divide-gray-100'}`}>
                            <td className="p-4 font-bold text-base text-indigo-700 dark:text-indigo-400">
                              {row.childName}
                            </td>
                            <td className="p-4">
                              <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-850 text-gray-800 dark:text-gray-200">
                                {row.age}세 ({row.birthDate})
                              </span>
                            </td>
                            <td className="p-4 font-medium text-gray-900 dark:text-white">
                              {row.tshirtSize || '미선택'}
                            </td>
                            <td className="p-4 space-y-1">
                              <div className="text-red-500 font-semibold text-xs">
                                ⚠️ 알러지: {row.allergies.join(', ') || '없음'}
                                {row.customAllergy && ` (${row.customAllergy})`}
                              </div>
                              {row.customValues && Object.keys(row.customValues).length > 0 && (
                                <div className="mt-1 pt-1.5 border-t border-dashed border-gray-200 dark:border-slate-800 text-xs text-gray-600 dark:text-slate-400 space-y-0.5">
                                  <div className="font-semibold text-indigo-600">📌 추가 맞춤 문항 답변:</div>
                                  {eventConfig.customFields?.map(field => {
                                    const val = row.customValues?.[field.id];
                                    if (val === undefined || val === null || val === '') return null;
                                    return (
                                      <div key={field.id} className="flex gap-1">
                                        <span className="font-medium text-gray-500">{field.label}:</span>
                                        <span>{String(val)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                            <td className="p-4 text-sm">
                              <div className="font-semibold">{row.parentName}</div>
                              <div className="text-xs text-gray-400 mt-0.5">{row.parentPhone}</div>
                              {row.depositorName !== row.parentName && (
                                <div className="text-xs text-gray-500">입금자: {row.depositorName}</div>
                              )}
                            </td>
                            <td className="p-4 text-center space-y-1.5">
                              <div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  row.paymentStatus
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                }`}>
                                  {row.paymentStatus ? '입금 확인' : '대기'}
                                </span>
                              </div>
                              <div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                  row.attendsWaterpark
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400'
                                }`}>
                                  워터파크: {row.attendsWaterpark ? '참가' : '미참가'}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 text-xs text-gray-400">
                              {new Date(row.createdAt).toLocaleString()}
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleDelete(row.appId)}
                                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded shadow transition cursor-pointer"
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

              {/* 100개 더 보기 버튼 */}
              {hasMore && !isLoading && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => fetchApplications(true)}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-md transition cursor-pointer"
                  >
                    🔄 신청 목록 100개 더 불러오기
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className={`p-8 rounded-xl border shadow-md space-y-6 ${department === 'teens' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
              <h3 className="text-2xl font-bold mb-4">🎨 {deptNames[department]} 절기 배너 & 스킨 제어</h3>
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-slate-300">공식 행사 명칭</label>
                    <input
                      type="text"
                      value={eventConfig.title}
                      onChange={(e) => setEventConfig({ ...eventConfig, title: e.target.value })}
                      placeholder="예: 2026 나우킨더 여름성경학교"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-slate-300">행사 타입</label>
                    <select
                      value={eventConfig.eventType}
                      onChange={(e) => setEventConfig({ ...eventConfig, eventType: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                    >
                      <option value="여름성경학교">여름성경학교</option>
                      <option value="여름수련회">여름수련회</option>
                      <option value="특별행사">특별행사</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-slate-300">테마 메인 컬러 (Hex)</label>
                    <input
                      type="color"
                      value={eventConfig.primaryColor}
                      onChange={(e) => setEventConfig({ ...eventConfig, primaryColor: e.target.value })}
                      className="w-full h-10 border rounded-lg bg-white p-1 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-slate-300">배경 톤 컬러 (Hex)</label>
                    <input
                      type="color"
                      value={eventConfig.bgColor}
                      onChange={(e) => setEventConfig({ ...eventConfig, bgColor: e.target.value })}
                      className="w-full h-10 border rounded-lg bg-white p-1 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">행사 주제 (Theme Slogan) - Tiptap 에디터</label>
                  <RichTextEditor
                    value={eventConfig.subtitle}
                    onChange={(html) => setEventConfig({ ...eventConfig, subtitle: html })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">올해의 주제 성구 (Scripture Verse) - Tiptap 에디터</label>
                  <RichTextEditor
                    value={eventConfig.scripture}
                    onChange={(html) => setEventConfig({ ...eventConfig, scripture: html })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">부서 단체티 사이즈 설정 (쉼표 ','로 구분하여 입력)</label>
                  <input
                    type="text"
                    value={eventConfig.tshirtSizes?.join(', ') || ''}
                    onChange={(e) => {
                      const sizes = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                      setEventConfig({ ...eventConfig, tshirtSizes: sizes });
                    }}
                    placeholder="예: S, M, L, XL, 2XL, 3XL"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                  />
                  <p className="text-xs text-gray-500 dark:text-slate-400">여기에 입력한 사이즈 목록이 신청서 단체티 선택 드롭다운에 실시간 반영됩니다.</p>
                </div>

                {/* --- Custom Fields Management Section --- */}
                <div className="border-t border-gray-200 dark:border-slate-800 pt-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-xl font-bold">📋 신청서 추가 수집 정보 항목 설정</h4>
                      <p className="text-sm text-gray-500 mt-1">부서 맞춤형 신청서 질문(차량탑승 여부, 특이사항, 기도제목 등)을 자유롭게 추가하고 수집할 수 있습니다.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newFields = [...(eventConfig.customFields || [])];
                        newFields.push({
                          id: 'f_' + Date.now(),
                          label: '새로운 질문 항목',
                          type: 'text',
                          required: false,
                          options: []
                        });
                        setEventConfig({ ...eventConfig, customFields: newFields });
                      }}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded-lg shadow transition cursor-pointer"
                    >
                      ➕ 질문 항목 추가
                    </button>
                  </div>

                  {(!eventConfig.customFields || eventConfig.customFields.length === 0) ? (
                    <div className="p-6 text-center border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl text-gray-400">
                      추가 수집 항목이 설정되지 않았습니다. 필요할 경우 질문 항목을 추가해 보세요.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {eventConfig.customFields.map((field, fIdx) => (
                        <div key={field.id} className="p-4 border rounded-xl bg-gray-50/50 dark:bg-slate-900/50 dark:border-slate-800 relative space-y-3">
                          <button
                            type="button"
                            onClick={() => {
                              const newFields = eventConfig.customFields?.filter((_, i) => i !== fIdx) || [];
                              setEventConfig({ ...eventConfig, customFields: newFields });
                            }}
                            className="absolute top-3 right-3 text-red-500 hover:text-red-700 font-bold"
                          >
                            삭제
                          </button>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">질문/문항 제목 (Label)</label>
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => {
                                  const newFields = [...(eventConfig.customFields || [])];
                                  newFields[fIdx].label = e.target.value;
                                  setEventConfig({ ...eventConfig, customFields: newFields });
                                }}
                                className="w-full px-3 py-1.5 border rounded-lg bg-white text-gray-900 text-sm"
                                placeholder="예: 차량 탑승 위치를 적어주세요"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">입력 타입 (Type)</label>
                              <select
                                value={field.type}
                                onChange={(e) => {
                                  const newFields = [...(eventConfig.customFields || [])];
                                  newFields[fIdx].type = e.target.value as any;
                                  setEventConfig({ ...eventConfig, customFields: newFields });
                                }}
                                className="w-full px-3 py-1.5 border rounded-lg bg-white text-gray-900 text-sm"
                              >
                                <option value="text">단답형 텍스트</option>
                                <option value="textarea">장문형 텍스트</option>
                                <option value="select">드롭다운 선택 (Select)</option>
                                <option value="checkbox">동의/체크박스 (Checkbox)</option>
                              </select>
                            </div>
                            <div className="flex items-center pt-5">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(e) => {
                                    const newFields = [...(eventConfig.customFields || [])];
                                    newFields[fIdx].required = e.target.checked;
                                    setEventConfig({ ...eventConfig, customFields: newFields });
                                  }}
                                  className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                />
                                <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">필수 응답 항목 지정</span>
                              </label>
                            </div>
                          </div>

                          {field.type === 'select' && (
                            <div className="pt-2 border-t border-dashed border-gray-200">
                              <label className="block text-xs font-semibold text-gray-500 mb-1">선택지 옵션 리스트 (콤마 , 로 구분해서 여러 개 입력)</label>
                              <input
                                type="text"
                                value={field.options?.join(', ') || ''}
                                onChange={(e) => {
                                  const newFields = [...(eventConfig.customFields || [])];
                                  newFields[fIdx].options = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                  setEventConfig({ ...eventConfig, customFields: newFields });
                                }}
                                className="w-full px-3 py-1.5 border rounded-lg bg-white text-gray-900 text-sm"
                                placeholder="예: 덕소역 탑승, 삼패동 탑승, 개별 이동"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full md:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition transform active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? '실시간 연동 저장 중...' : '💾 CMS 설정 적용'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'surveys' && (
            <SurveyFormPlaceholder department={department} />
          )}
        </div>
      </div>
    </div>
  );
};
