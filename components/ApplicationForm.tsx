'use client';

import { useState, useEffect } from 'react';

interface SubDepartment {
  id: string;
  label: string;
}

interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
  columnIndex: number;
}

interface Child {
  name: string;
  birthDate: string;
  department: string;
  subDepartment: string;
  tshirtSize: string;
  allergies: string;
  customAllergy: string;
  attendsWaterpark: boolean;
  customFields: { [key: string]: any };
}

const ALLERGY_OPTIONS = ['계란', '우유', '견과류', '밀', '복숭아', '대두', '갑각류'];

interface ApplicationFormProps {
  department: string;
  onClose?: () => void;
}

export default function ApplicationForm({ department, onClose }: ApplicationFormProps) {
  const [step, setStep] = useState(1); // 1: 부모, 2: 자녀, 3: 확인
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 설정
  const [config, setConfig] = useState<any>(null);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [tshirtSizes, setTshirtSizes] = useState<string[]>([]);

  // 폼 데이터
  const [parentInfo, setParentInfo] = useState({
    parentName: '',
    parentPhone: '',
    depositorName: ''
  });

  const [children, setChildren] = useState<Child[]>([
    {
      name: '',
      birthDate: '',
      department,
      subDepartment: '',
      tshirtSize: '',
      allergies: '',
      customAllergy: '',
      attendsWaterpark: false,
      customFields: {}
    }
  ]);

  const [fees, setFees] = useState<any>(null);
  const [grandTotal, setGrandTotal] = useState(0);

  // 부서 설정 로드
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/config/${department}`);
        const { data } = await res.json();

        setConfig(data);
        setSubDepartments(JSON.parse(data.subDepartments || '[]'));
        setCustomFields(JSON.parse(data.customFieldMappings || '[]'));
        setTshirtSizes(JSON.parse(data.tshirtSizes || '[]'));

        // 요금 로드
        const feesRes = await fetch('/api/fees');
        const { data: feesData } = await feesRes.json();
        setFees(feesData);
      } catch (err) {
        setError('설정 로드 실패');
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, [department]);

  // 자녀 정보 업데이트
  const updateChild = (index: number, field: string, value: any) => {
    const newChildren = [...children];
    if (field.startsWith('custom_')) {
      newChildren[index].customFields[field] = value;
    } else {
      (newChildren[index] as any)[field] = value;
    }
    setChildren(newChildren);
  };

  // 자녀 추가
  const addChild = () => {
    setChildren([
      ...children,
      {
        name: '',
        birthDate: '',
        department,
        subDepartment: '',
        tshirtSize: '',
        allergies: '',
        customAllergy: '',
        attendsWaterpark: false,
        customFields: {}
      }
    ]);
  };

  // 자녀 제거
  const removeChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index));
  };

  // 요금 계산
  useEffect(() => {
    if (!fees) return;
    let total = 0;
    children.forEach(child => {
      const deptFees: any = {
        kinder: fees.kinder,
        kids: fees.kids,
        teens: fees.teens
      };
      total += deptFees[child.department] || 0;
      if (child.attendsWaterpark) total += fees.parent_waterpark;
    });
    setGrandTotal(total);
  }, [children, fees]);

  // 신청서 제출
  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      // API에 맞춰 데이터 변환
      const formattedChildren = children.map(child => ({
        name: child.name,
        birthDate: child.birthDate,
        department: child.department,
        subDepartment: child.subDepartment,
        tshirtSize: child.tshirtSize,
        allergies: child.allergies,
        customAllergy: child.customAllergy,
        attendsWaterpark: child.attendsWaterpark,
        custom1: child.customFields.custom_1 || null,
        custom2: child.customFields.custom_2 || null,
        custom3: child.customFields.custom_3 || null,
        custom4: child.customFields.custom_4 || null,
        custom5: child.customFields.custom_5 || null,
        custom6: child.customFields.custom_6 || null,
        custom7: child.customFields.custom_7 || null,
        custom8: child.customFields.custom_8 || null,
        custom9: child.customFields.custom_9 || null,
        custom10: child.customFields.custom_10 || null,
        custom11: child.customFields.custom_11 || null,
        custom12: child.customFields.custom_12 || null,
        custom13: child.customFields.custom_13 || null,
        custom14: child.customFields.custom_14 || null,
        custom15: child.customFields.custom_15 || null,
        custom16: child.customFields.custom_16 || null,
        custom17: child.customFields.custom_17 || null,
        custom18: child.customFields.custom_18 || null,
        custom19: child.customFields.custom_19 || null,
        custom20: child.customFields.custom_20 || null
      }));

      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: parentInfo.parentName,
          parentPhone: parentInfo.parentPhone,
          depositorName: parentInfo.depositorName,
          children: formattedChildren,
          grandTotal
        })
      });

      if (response.ok) {
        alert('✅ 신청이 완료되었습니다!');
        onClose?.();
      } else {
        setError('신청 제출 실패');
      }
    } catch (err) {
      setError('오류 발생');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !config) {
    return <div className="text-center py-8">로드 중...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow">
      {/* Step 1: 부모 정보 */}
      {step === 1 && (
        <div>
          <h2 className="text-2xl font-bold mb-6">부모 정보</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="부모 이름"
              value={parentInfo.parentName}
              onChange={(e) => setParentInfo({ ...parentInfo, parentName: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
            />
            <input
              type="tel"
              placeholder="부모 연락처"
              value={parentInfo.parentPhone}
              onChange={(e) => setParentInfo({ ...parentInfo, parentPhone: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
            />
            <input
              type="text"
              placeholder="입금자 이름"
              value={parentInfo.depositorName}
              onChange={(e) => setParentInfo({ ...parentInfo, depositorName: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>
          <button
            onClick={() => setStep(2)}
            className="mt-6 w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
          >
            다음
          </button>
        </div>
      )}

      {/* Step 2: 자녀 정보 */}
      {step === 2 && (
        <div>
          <h2 className="text-2xl font-bold mb-6">자녀 정보</h2>
          {children.map((child, idx) => (
            <div key={idx} className="border-b pb-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">자녀 {idx + 1}</h3>

              <div className="grid grid-cols-2 gap-4">
                {/* 이름 */}
                <input
                  type="text"
                  placeholder="이름"
                  value={child.name}
                  onChange={(e) => updateChild(idx, 'name', e.target.value)}
                  className="px-4 py-2 border rounded-lg"
                />

                {/* 생년월일 */}
                <input
                  type="date"
                  value={child.birthDate}
                  onChange={(e) => updateChild(idx, 'birthDate', e.target.value)}
                  className="px-4 py-2 border rounded-lg"
                />

                {/* 하위 부서 */}
                <select
                  value={child.subDepartment}
                  onChange={(e) => updateChild(idx, 'subDepartment', e.target.value)}
                  className="px-4 py-2 border rounded-lg"
                >
                  <option value="">하위 부서 선택</option>
                  {subDepartments.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.label}
                    </option>
                  ))}
                </select>

                {/* 셔츠 사이즈 */}
                <select
                  value={child.tshirtSize}
                  onChange={(e) => updateChild(idx, 'tshirtSize', e.target.value)}
                  className="px-4 py-2 border rounded-lg"
                >
                  <option value="">셔츠 사이즈</option>
                  {tshirtSizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              {/* 알러지 */}
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">알러지</label>
                <div className="flex flex-wrap gap-2">
                  {ALLERGY_OPTIONS.map((allergy) => (
                    <label key={allergy} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={child.allergies.includes(allergy)}
                        onChange={(e) => {
                          const allergies = child.allergies.split(',').filter(Boolean);
                          if (e.target.checked) {
                            allergies.push(allergy);
                          } else {
                            allergies.splice(allergies.indexOf(allergy), 1);
                          }
                          updateChild(idx, 'allergies', allergies.join(','));
                        }}
                        className="mr-2"
                      />
                      {allergy}
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="기타 알러지"
                  value={child.customAllergy}
                  onChange={(e) => updateChild(idx, 'customAllergy', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg mt-2"
                />
              </div>

              {/* 물놀이 참석 */}
              <label className="mt-4 flex items-center">
                <input
                  type="checkbox"
                  checked={child.attendsWaterpark}
                  onChange={(e) => updateChild(idx, 'attendsWaterpark', e.target.checked)}
                  className="mr-2"
                />
                물놀이 참석 (추가 {fees?.parent_waterpark || 30000}원)
              </label>

              {/* 커스텀 필드 */}
              {customFields.map((field) => (
                <div key={field.id} className="mt-4">
                  <label className="block text-sm font-medium mb-2">
                    {field.label} {field.required && '*'}
                  </label>
                  {field.type === 'text' && (
                    <input
                      type="text"
                      value={child.customFields[`custom_${field.columnIndex}`] || ''}
                      onChange={(e) =>
                        updateChild(idx, `custom_${field.columnIndex}`, e.target.value)
                      }
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  )}
                  {field.type === 'textarea' && (
                    <textarea
                      value={child.customFields[`custom_${field.columnIndex}`] || ''}
                      onChange={(e) =>
                        updateChild(idx, `custom_${field.columnIndex}`, e.target.value)
                      }
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  )}
                  {field.type === 'select' && (
                    <select
                      value={child.customFields[`custom_${field.columnIndex}`] || ''}
                      onChange={(e) =>
                        updateChild(idx, `custom_${field.columnIndex}`, e.target.value)
                      }
                      className="w-full px-4 py-2 border rounded-lg"
                    >
                      <option value="">선택</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}

              {/* 자녀 제거 버튼 */}
              {children.length > 1 && (
                <button
                  onClick={() => removeChild(idx)}
                  className="mt-4 text-red-500 hover:text-red-700"
                >
                  이 자녀 제거
                </button>
              )}
            </div>
          ))}

          <button
            onClick={addChild}
            className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 mb-4"
          >
            자녀 추가
          </button>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="flex-1 bg-gray-400 text-white py-2 rounded-lg hover:bg-gray-500"
            >
              이전
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 확인 */}
      {step === 3 && (
        <div>
          <h2 className="text-2xl font-bold mb-6">신청 확인</h2>
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <p>
              <strong>부모:</strong> {parentInfo.parentName} ({parentInfo.parentPhone})
            </p>
            <p>
              <strong>입금자:</strong> {parentInfo.depositorName}
            </p>
            <p className="mt-2">
              <strong>자녀 {children.length}명</strong>
            </p>
            <p className="text-2xl font-bold text-red-600 mt-4">합계: {grandTotal.toLocaleString()}원</p>
          </div>

          {error && <div className="text-red-600 mb-4">{error}</div>}

          <div className="flex gap-4">
            <button
              onClick={() => setStep(2)}
              className="flex-1 bg-gray-400 text-white py-2 rounded-lg hover:bg-gray-500"
            >
              이전
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? '제출 중...' : '신청 완료'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
