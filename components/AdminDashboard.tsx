'use client';

import { useState, useEffect } from 'react';

interface Application {
  id: string;
  parent_name: string;
  parent_phone: string;
  depositor_name: string;
  grand_total: number;
  created_at: string;
  children: any[];
}

interface AdminDashboardProps {
  department: string;
}

export default function AdminDashboard({ department }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('applications');
  const [applications, setApplications] = useState<Application[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);

  const loadApplications = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/applications?department=${department}&limit=100&offset=${offset}`);
      const { data } = await res.json();
      setApplications(data);
    } catch (err) {
      setError('신청서 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/config/${department}`);
      const { data } = await res.json();
      setConfig(data);
    } catch (err) {
      setError('설정 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'applications') {
      loadApplications();
    } else if (activeTab === 'settings') {
      loadConfig();
    }
  }, [activeTab, offset]);

  const deleteApplication = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/applications?id=${id}`, { method: 'DELETE' });
      loadApplications();
      alert('삭제되었습니다');
    } catch (err) {
      alert('삭제 실패');
    }
  };

  const exportExcel = async () => {
    try {
      const res = await fetch(`/api/export?department=${department}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `신청현황_${department}.xlsx`;
      a.click();
    } catch (err) {
      alert('엑셀 추출 실패');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('applications')}
          className={`px-4 py-2 font-semibold ${
            activeTab === 'applications' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
          }`}
        >
          신청 현황
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 font-semibold ${
            activeTab === 'settings' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
          }`}
        >
          설정
        </button>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">{error}</div>}

      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <div>
          <div className="flex gap-4 mb-4">
            <button
              onClick={exportExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              📊 엑셀 다운로드
            </button>
          </div>

          {loading ? (
            <div>로드 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-4 py-2">부모</th>
                    <th className="border px-4 py-2">연락처</th>
                    <th className="border px-4 py-2">자녀</th>
                    <th className="border px-4 py-2">합계</th>
                    <th className="border px-4 py-2">신청일</th>
                    <th className="border px-4 py-2">삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50">
                      <td className="border px-4 py-2">{app.parent_name}</td>
                      <td className="border px-4 py-2">{app.parent_phone}</td>
                      <td className="border px-4 py-2">{app.children?.map((c) => c.name).join(', ')}</td>
                      <td className="border px-4 py-2 font-semibold">{app.grand_total.toLocaleString()}원</td>
                      <td className="border px-4 py-2">{new Date(app.created_at).toLocaleDateString('ko-KR')}</td>
                      <td className="border px-4 py-2 text-center">
                        <button
                          onClick={() => deleteApplication(app.id)}
                          className="text-red-600 hover:text-red-800 font-semibold"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-4 mt-6">
            <button
              onClick={() => setOffset(Math.max(0, offset - 100))}
              disabled={offset === 0}
              className="px-4 py-2 bg-gray-400 text-white rounded-lg disabled:opacity-50"
            >
              이전
            </button>
            <button
              onClick={() => setOffset(offset + 100)}
              disabled={applications.length < 100}
              className="px-4 py-2 bg-gray-400 text-white rounded-lg disabled:opacity-50"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && config && (
        <div>
          <h3 className="text-lg font-semibold mb-4">부서 설정</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p><strong>제목:</strong> {config.title}</p>
            <p><strong>주색상:</strong> {config.primaryColor}</p>
            <p><strong>배경색:</strong> {config.bgColor}</p>
            <p><strong>셔츠 사이즈:</strong> {config.tshirtSizes?.join(', ')}</p>
          </div>
          <p className="text-gray-500 mt-4 text-sm">✏️ 상세 설정 편집 기능은 별도 페이지에서 제공됩니다.</p>
        </div>
      )}
    </div>
  );
}
