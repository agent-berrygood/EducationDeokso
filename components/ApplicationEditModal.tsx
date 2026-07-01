import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/Feedback';

export default function ApplicationEditModal({
  application,
  config,
  onClose,
  onSaved,
}: {
  application: any;
  config: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const showToast = useToast();
  const [formData, setFormData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (application) {
      setFormData({ ...application, children: application.children || [] });
    }
  }, [application]);

  if (!formData) return null;

  const handleParentChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleChildChange = (index: number, field: string, value: any) => {
    const children: any[] = formData.children || [];
    if (index < 0 || index >= children.length) return;
    const newChildren = [...children];
    newChildren[index] = { ...newChildren[index], [field]: value };
    setFormData((prev: any) => ({ ...prev, children: newChildren }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);

      // JSON 필드 변환 보정 (waterfallParents는 배열 그대로 전송)
      const payload = {
        parentName: formData.parent_name,
        parentPhone: formData.parent_phone,
        depositorName: formData.depositor_name,
        waterfallParents: typeof formData.waterfall_parents === 'string' ? JSON.parse(formData.waterfall_parents || '[]') : formData.waterfall_parents || [],
        grandTotal: formData.grand_total,
        children: (formData.children || []).map((c: any) => ({
          name: c.name,
          birthDate: c.birth_date,
          gender: c.gender,
          department: c.department,
          subDepartment: c.sub_department,
          tshirtSize: c.tshirt_size,
          allergies: typeof c.allergies === 'string' ? c.allergies : (c.allergies?.join(',') || ''),
          customAllergy: c.custom_allergy,
          attendsWaterpark: c.attends_waterpark,
          attendedSessions: typeof c.attended_sessions === 'string' ? JSON.parse(c.attended_sessions || '[]') : c.attended_sessions || [],
          partialAttendanceReason: c.partial_attendance_reason,
          // 커스텀 필드
          custom1: c.custom_1, custom2: c.custom_2, custom3: c.custom_3, custom4: c.custom_4, custom5: c.custom_5,
          custom6: c.custom_6, custom7: c.custom_7, custom8: c.custom_8, custom9: c.custom_9, custom10: c.custom_10,
          custom11: c.custom_11, custom12: c.custom_12, custom13: c.custom_13, custom14: c.custom_14, custom15: c.custom_15,
          custom16: c.custom_16, custom17: c.custom_17, custom18: c.custom_18, custom19: c.custom_19, custom20: c.custom_20,
        }))
      };

      const res = await fetch(`/api/applications/${application.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || '저장 실패');
      }

      showToast('수정되었습니다.', 'success');
      onSaved();
    } catch (err: any) {
      showToast('오류 발생: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-800 dark:hover:text-white"
        >
          ✕
        </button>
        <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">📝 신청서 상세 수정</h2>

        <form onSubmit={handleSave} className="space-y-8">
          {/* 부모 정보 섹션 */}
          <div className="p-4 border border-gray-200 dark:border-slate-800 rounded-xl bg-gray-50 dark:bg-slate-800/50">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">보호자 정보</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">보호자명</label>
                <input
                  type="text"
                  value={formData.parent_name}
                  onChange={(e) => handleParentChange('parent_name', e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:ring-indigo-500 bg-white dark:bg-slate-900 dark:border-slate-700"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">연락처</label>
                <input
                  type="text"
                  value={formData.parent_phone}
                  onChange={(e) => handleParentChange('parent_phone', e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:ring-indigo-500 bg-white dark:bg-slate-900 dark:border-slate-700"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">입금자명</label>
                <input
                  type="text"
                  value={formData.depositor_name}
                  onChange={(e) => handleParentChange('depositor_name', e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:ring-indigo-500 bg-white dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
            </div>
          </div>

          {/* 자녀 정보 섹션 */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">자녀 정보</h3>
            {(formData.children || []).map((child: any, idx: number) => (
              <div key={idx} className="p-4 border border-gray-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm relative">
                <div className="absolute top-2 right-4 text-xs font-bold text-gray-400">자녀 {idx + 1}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">자녀 이름</label>
                    <input
                      type="text"
                      value={child.name}
                      onChange={(e) => handleChildChange(idx, 'name', e.target.value)}
                      className="w-full px-3 py-2 border rounded focus:ring-indigo-500 bg-gray-50 dark:bg-slate-800 dark:border-slate-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">생년월일</label>
                    <input
                      type="date"
                      value={child.birth_date}
                      onChange={(e) => handleChildChange(idx, 'birth_date', e.target.value)}
                      className="w-full px-3 py-2 border rounded focus:ring-indigo-500 bg-gray-50 dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">성별</label>
                    <select
                      value={child.gender || ''}
                      onChange={(e) => handleChildChange(idx, 'gender', e.target.value)}
                      className="w-full px-3 py-2 border rounded focus:ring-indigo-500 bg-gray-50 dark:bg-slate-800 dark:border-slate-700"
                    >
                      <option value="">미선택</option>
                      <option value="male">남자</option>
                      <option value="female">여자</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">단체티 사이즈</label>
                    <select
                      value={child.tshirt_size || ''}
                      onChange={(e) => handleChildChange(idx, 'tshirt_size', e.target.value)}
                      className="w-full px-3 py-2 border rounded focus:ring-indigo-500 bg-gray-50 dark:bg-slate-800 dark:border-slate-700"
                    >
                      <option value="">미선택</option>
                      {(config?.tshirtSizes || []).map((sz: string) => (
                        <option key={sz} value={sz}>{sz}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium mb-1">부서 / 세부 부서</label>
                    <div className="flex gap-2">
                      <select
                        value={child.department}
                        onChange={(e) => handleChildChange(idx, 'department', e.target.value)}
                        className="w-1/2 px-3 py-2 border rounded bg-gray-50 dark:bg-slate-800 dark:border-slate-700"
                      >
                        <option value="kinder">나우킨더</option>
                        <option value="kids">나우키즈</option>
                        <option value="teens">나우틴즈</option>
                      </select>
                      <input
                        type="text"
                        placeholder="세부 부서 아이디"
                        value={child.sub_department || ''}
                        onChange={(e) => handleChildChange(idx, 'sub_department', e.target.value)}
                        className="w-1/2 px-3 py-2 border rounded bg-gray-50 dark:bg-slate-800 dark:border-slate-700"
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium mb-1">알러지 / 특이사항</label>
                    <input
                      type="text"
                      placeholder="알러지 (쉼표 구분)"
                      value={typeof child.allergies === 'string' ? child.allergies : (child.allergies || []).join(', ')}
                      onChange={(e) => handleChildChange(idx, 'allergies', e.target.value)}
                      className="w-full px-3 py-2 border rounded bg-gray-50 dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>
                  <div className="lg:col-span-4">
                    <label className="block text-sm font-medium mb-1">기타 알러지</label>
                    <input
                      type="text"
                      value={child.custom_allergy || ''}
                      onChange={(e) => handleChildChange(idx, 'custom_allergy', e.target.value)}
                      className="w-full px-3 py-2 border rounded bg-gray-50 dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>
                  
                  <div className="lg:col-span-4">
                    <label className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={child.attends_waterpark || false}
                        onChange={(e) => handleChildChange(idx, 'attends_waterpark', e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm font-medium">워터파크 참가</span>
                    </label>
                  </div>
                  <div className="lg:col-span-4">
                    <label className="block text-sm font-medium mb-1">부분참석 사유</label>
                    <input
                      type="text"
                      value={child.partial_attendance_reason || ''}
                      onChange={(e) => handleChildChange(idx, 'partial_attendance_reason', e.target.value)}
                      className="w-full px-3 py-2 border rounded bg-gray-50 dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>

                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border rounded text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-slate-800"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-indigo-600 text-white font-bold rounded shadow hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? '저장 중...' : '저장 완료'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
