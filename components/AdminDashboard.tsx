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
  department: string;
}

export default function AdminDashboard({ department }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('applications');
  const [applications, setApplications] = useState<Application[]>([]);
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, PaymentStatus>>({});
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<any>({
    title: '',
    subtitle: '',
    scripture: '',
    primaryColor: '#3B82F6',
    bgColor: '#DBEAFE',
    tshirtSizes: [],
    customFields: [],
    subDepartments: [],
  });
  const [newTshirtSize, setNewTshirtSize] = useState('');
  const [newCustomField, setNewCustomField] = useState<any>({
    label: '',
    type: 'text',
    required: false,
    options: '',
    columnIndex: 1,
  });

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
      setSettingsForm({
        title: data.title || '',
        subtitle: data.subtitle || '',
        scripture: data.scripture || '',
        primaryColor: data.primary_color || '#3B82F6',
        bgColor: data.bg_color || '#DBEAFE',
        tshirtSizes: data.tshirtSizes || [],
        customFields: data.customFieldMappings || [],
        subDepartments: data.subDepartments || [],
      });
    } catch (err) {
      setError('설정 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentStatuses = async () => {
    try {
      for (const app of applications) {
        const res = await fetch(`/api/payment?applicationId=${app.id}`);
        const { data } = await res.json();
        setPaymentStatuses((prev) => ({ ...prev, [app.id]: data }));
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
  }, [activeTab, offset]);

  useEffect(() => {
    if (activeTab === 'applications' && applications.length > 0) {
      loadPaymentStatuses();
    }
  }, [applications]);

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
      alert('결제 상태 업데이트 실패');
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

  const saveSettings = async () => {
    try {
      setLoading(true);
      await fetch(`/api/config/${department}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: settingsForm.title,
          subtitle: settingsForm.subtitle,
          scripture: settingsForm.scripture,
          primaryColor: settingsForm.primaryColor,
          bgColor: settingsForm.bgColor,
          tshirtSizes: settingsForm.tshirtSizes,
          customFieldMappings: settingsForm.customFields,
          subDepartments: settingsForm.subDepartments,
        }),
      });
      alert('설정이 저장되었습니다');
      loadConfig();
    } catch (err) {
      alert('설정 저장 실패');
    } finally {
      setLoading(false);
    }
  };

  const addTshirtSize = () => {
    if (!newTshirtSize.trim()) return;
    setSettingsForm((prev: any) => ({
      ...prev,
      tshirtSizes: [...prev.tshirtSizes, newTshirtSize],
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
      options: newCustomField.options ? newCustomField.options.split(',').map((o: string) => o.trim()) : [],
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

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b overflow-x-auto">
        {['applications', 'settings', 'payment', 'surveys'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-semibold whitespace-nowrap ${
              activeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab === 'applications' && '신청 현황'}
            {tab === 'settings' && '설정'}
            {tab === 'payment' && '결제 관리'}
            {tab === 'surveys' && '설문'}
          </button>
        ))}
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
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">기본 정보</h3>
            <div className="space-y-4">
              <div>
                <label className="block font-medium mb-2">행사 제목</label>
                <input
                  type="text"
                  value={settingsForm.title}
                  onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium mb-2">부제목</label>
                <input
                  type="text"
                  value={settingsForm.subtitle}
                  onChange={(e) => setSettingsForm({ ...settingsForm, subtitle: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium mb-2">성경 구절</label>
                <input
                  type="text"
                  value={settingsForm.scripture}
                  onChange={(e) => setSettingsForm({ ...settingsForm, scripture: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">색상 설정</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium mb-2">주 색상</label>
                <input
                  type="color"
                  value={settingsForm.primaryColor}
                  onChange={(e) => setSettingsForm({ ...settingsForm, primaryColor: e.target.value })}
                  className="w-full h-12 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium mb-2">배경 색상</label>
                <input
                  type="color"
                  value={settingsForm.bgColor}
                  onChange={(e) => setSettingsForm({ ...settingsForm, bgColor: e.target.value })}
                  className="w-full h-12 border rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">셔츠 사이즈</h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="사이즈 입력 (예: XL, 2XL)"
                value={newTshirtSize}
                onChange={(e) => setNewTshirtSize(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg"
              />
              <button
                onClick={addTshirtSize}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                추가
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settingsForm.tshirtSizes.map((size: string) => (
                <div
                  key={size}
                  className="flex items-center gap-2 bg-blue-100 px-3 py-1 rounded-full"
                >
                  <span>{size}</span>
                  <button
                    onClick={() => removeTshirtSize(size)}
                    className="text-red-600 hover:text-red-800 font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">커스텀 필드</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block font-medium mb-2">필드명</label>
                <input
                  type="text"
                  placeholder="필드명 입력"
                  value={newCustomField.label}
                  onChange={(e) => setNewCustomField({ ...newCustomField, label: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium mb-2">필드 타입</label>
                  <select
                    value={newCustomField.type}
                    onChange={(e) => setNewCustomField({ ...newCustomField, type: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="text">텍스트</option>
                    <option value="textarea">긴 텍스트</option>
                    <option value="select">선택</option>
                    <option value="checkbox">체크박스</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-2">필수 여부</label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newCustomField.required}
                      onChange={(e) => setNewCustomField({ ...newCustomField, required: e.target.checked })}
                      className="w-4 h-4"
                    />
                    필수
                  </label>
                </div>
              </div>
              {(newCustomField.type === 'select' || newCustomField.type === 'checkbox') && (
                <div>
                  <label className="block font-medium mb-2">옵션 (쉼표로 구분)</label>
                  <input
                    type="text"
                    placeholder="옵션1, 옵션2, 옵션3"
                    value={newCustomField.options}
                    onChange={(e) => setNewCustomField({ ...newCustomField, options: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
              )}
              <button
                onClick={addCustomField}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                필드 추가
              </button>
            </div>

            <div className="space-y-2">
              {settingsForm.customFields.map((field: any, idx: number) => (
                <div key={field.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                  <div>
                    <p className="font-medium">{field.label}</p>
                    <p className="text-sm text-gray-600">
                      {field.type} {field.required && '(필수)'}
                    </p>
                  </div>
                  <button
                    onClick={() => removeCustomField(field.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={saveSettings}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? '저장 중...' : '설정 저장'}
            </button>
          </div>
        </div>
      )}

      {/* Payment Tab */}
      {activeTab === 'payment' && (
        <div>
          <h3 className="text-lg font-semibold mb-4">결제 현황 관리</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-4 py-2">부모</th>
                  <th className="border px-4 py-2">킨더</th>
                  <th className="border px-4 py-2">키즈</th>
                  <th className="border px-4 py-2">틴즈</th>
                  <th className="border px-4 py-2">물놀이</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => {
                  const payment = paymentStatuses[app.id];
                  if (!payment) return null;
                  return (
                    <tr key={app.id} className="hover:bg-gray-50">
                      <td className="border px-4 py-2">{app.parent_name}</td>
                      <td className="border px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={payment.kinder_paid || false}
                          onChange={(e) => updatePaymentStatus(app.id, 'kinder_paid', e.target.checked)}
                        />
                      </td>
                      <td className="border px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={payment.kids_paid || false}
                          onChange={(e) => updatePaymentStatus(app.id, 'kids_paid', e.target.checked)}
                        />
                      </td>
                      <td className="border px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={payment.teens_paid || false}
                          onChange={(e) => updatePaymentStatus(app.id, 'teens_paid', e.target.checked)}
                        />
                      </td>
                      <td className="border px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={payment.waterpark_paid || false}
                          onChange={(e) => updatePaymentStatus(app.id, 'waterpark_paid', e.target.checked)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Surveys Tab */}
      {activeTab === 'surveys' && (
        <div className="bg-white p-6 rounded-lg border text-center">
          <p className="text-gray-600">설문 기능은 추후 업데이트될 예정입니다.</p>
        </div>
      )}
    </div>
  );
}
