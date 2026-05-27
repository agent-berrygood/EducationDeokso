import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import RichTextEditor from '@/components/RichTextEditor';
import { SurveyFormPlaceholder } from '@/components/SurveyFormPlaceholder';

interface AdminDashboardProps {
  department: 'kinder' | 'kids' | 'teens';
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
  });

  const deptNames = {
    kinder: '나우킨더 (미취학)',
    kids: '나우키즈 (초등부)',
    teens: '나우틴즈 (중고등부)',
  };

  // 1. Fetch applications in real-time
  useEffect(() => {
    setIsLoading(true);
    const q = query(
      collection(db, 'applications')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allApps = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Application[];

      // Filter applications that have at least one child in the current department
      const filtered = allApps.filter((app) => 
        app.children && app.children.some((child) => child.department === department)
      );

      setApplications(filtered);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching applications:", err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [department]);

  // 2. Fetch current event CMS configuration
  useEffect(() => {
    const fetchEventConfig = async () => {
      try {
        const docRef = doc(db, 'config', `events_${department}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setEventConfig((prev) => ({ ...prev, ...docSnap.data() }));
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
      alert("행사 CMS 설정이 데이터베이스에 실시간으로 안전하게 저장되었습니다!");
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

    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "신청자ID,보호자 성함,보호자 연락처,입금자명,자녀이름,생년월일,사이즈,알레르기,워터파크동반,입금상태,총회비,신청일시\n";

    applications.forEach((app) => {
      app.children.forEach((child) => {
        if (child.department === department) {
          const attendsWaterpark = child.attendsWaterpark ? "신청(부모동반)" : "미신청";
          const paidStatus = app.paymentStatus[department as keyof typeof app.paymentStatus] ? "입금확인" : "대기";
          const allergies = child.allergies.join(' / ') + (child.customAllergy ? ` (${child.customAllergy})` : '');
          
          csvContent += `"${app.id}","${app.parentInfo.parentName}","${app.parentInfo.parentPhone}","${app.parentInfo.depositorName || app.parentInfo.parentName}","${child.name}","${child.birthDate}","${child.tshirtSize}","${allergies}","${attendsWaterpark}","${paidStatus}","${app.fees.grandTotal}","${app.createdAt}"\n`;
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
            <div className={`rounded-xl border overflow-hidden shadow-md ${department === 'teens' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
              {isLoading ? (
                <div className="p-12 text-center text-gray-400">데이터를 스트리밍하는 중입니다...</div>
              ) : !applications.length ? (
                <div className="p-12 text-center text-gray-400">접수된 신청서가 아직 없습니다.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`border-b text-xs font-semibold uppercase tracking-wider ${department === 'teens' ? 'bg-slate-950/50 border-slate-800 text-slate-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                        <th className="p-4">보호자 / 연락처</th>
                        <th className="p-4">입금자명</th>
                        <th className="p-4">신청 자녀 정보 (부서/사이즈/알레르기/워터파크)</th>
                        <th className="p-4 text-center">총 회비</th>
                        <th className="p-4 text-center">수납 확인</th>
                        <th className="p-4">신청일시</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {applications.map((app) => (
                        <tr key={app.id} className={`${department === 'teens' ? 'hover:bg-slate-800/40 divide-slate-800' : 'hover:bg-gray-50/50 divide-gray-100'}`}>
                          <td className="p-4 font-medium">
                            <div>{app.parentInfo.parentName}</div>
                            <div className="text-xs text-gray-400 mt-1">{app.parentInfo.parentPhone}</div>
                          </td>
                          <td className="p-4">{app.parentInfo.depositorName || app.parentInfo.parentName}</td>
                          <td className="p-4 space-y-2">
                            {app.children.map((child, idx) => (
                              <div key={idx} className="p-2 border rounded-lg text-sm bg-gray-50/50">
                                <strong>{child.name}</strong> ({child.birthDate}) | 티셔츠: {child.tshirtSize || '미선택'} |
                                <span className="text-red-500 ml-1">
                                  알러지: {child.allergies.join(',') || '없음'}{child.customAllergy && ` (${child.customAllergy})`}
                                </span> |
                                <span className="text-blue-500 ml-1">
                                  워터풀: {child.attendsWaterpark ? '참가' : '불참'}
                                </span>
                              </div>
                            ))}
                          </td>
                          <td className="p-4 text-center font-bold text-indigo-600">{app.fees.grandTotal.toLocaleString()}원</td>
                          <td className="p-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              app.paymentStatus[department as keyof typeof app.paymentStatus]
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {app.paymentStatus[department as keyof typeof app.paymentStatus] ? '자가확인 완료' : '대기'}
                            </span>
                          </td>
                          <td className="p-4 text-xs text-gray-400">{new Date(app.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
