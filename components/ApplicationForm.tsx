import { useState, useEffect, useMemo, FC } from 'react';
import { db } from '../lib/firebase'; // Assuming firebase is initialized in this file
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';

// --- TypeScript Interfaces ---
interface ParentInfo {
  parentName: string;
  parentPhone: string;
  depositorName: string;
}

interface Child {
  name: string;
  birthDate: string;
  department: 'kinder' | 'kids' | 'teens' | '';
  tshirtSize: 'S' | 'M' | 'L' | 'XL' | '2XL' | '3XL' | '';
  allergies: string[];
  customAllergy: string;
  attendsWaterpark: boolean;
}

interface Fees {
  kinder: number;
  kids: number;
  teens: number;
  parentWaterpark: number;
}

interface PaymentChecks {
  kinder: boolean;
  kids: boolean;
  teens: boolean;
  waterpark: boolean;
}

// --- Constants ---
const ALLERGY_OPTIONS = ['Eggs', 'Milk', 'Nuts', 'Wheat', 'Peach', 'Soy', 'Shellfish'];
const TSHIRT_SIZES: Child['tshirtSize'][] = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

const initialChildState: Child = {
  name: '',
  birthDate: '',
  department: '',
  tshirtSize: '',
  allergies: [],
  customAllergy: '',
  attendsWaterpark: false,
};

const FALLBACK_FEES: Fees = {
  kinder: 10000,
  kids: 15000,
  teens: 20000,
  parentWaterpark: 30000,
};

const BANK_ACCOUNTS = {
  kinder: { name: 'Now Kinder Camp', account: 'Shinhan 110-123-456789' },
  kids: { name: 'Now Kids Camp', account: 'Kookmin 220-123-456789' },
  teens: { name: 'Now Teens Camp', account: 'Hana 330-123-456789' },
  waterpark: { name: 'Now Generation Waterpark', account: 'Woori 1002-123-456789' },
};

// --- Helper Components ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}
const Input: React.FC<InputProps> = ({ label, ...props }) => (
  <div>
    {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <input
      className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out"
      {...props}
    />
  </div>
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}
const Select: React.FC<SelectProps> = ({ label, children, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select
      className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out"
      {...props}
    >
      {children}
    </select>
  </div>
);

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}
const Checkbox: React.FC<CheckboxProps> = ({ label, ...props }) => (
  <label className="flex items-center space-x-3">
    <input
      type="checkbox"
      className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
      {...props}
    />
    <span className="text-gray-700">{label}</span>
  </label>
);

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}
const Button: React.FC<ButtonProps> = ({ children, onClick, disabled = false, variant = 'primary' }) => {
  const baseClasses = "w-full px-6 py-3 text-base font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200";
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-400',
  };
  const disabledClasses = 'disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed';

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseClasses} ${variants[variant]} ${disabledClasses}`}>
      {children}
    </button>
  );
};

const StepIndicator: FC<{ currentStep: number }> = ({ currentStep }) => (
  <div className="flex justify-center items-center space-x-4 mb-12">
    {[1, 2, 3].map((step) => (
      <div key={step} className="flex items-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-300 ${currentStep >= step ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
          {step}
        </div>
        {step < 3 && <div className={`h-1 w-24 transition-all duration-300 ${currentStep > step ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>}
      </div>
    ))}
  </div>
);


// --- Main ApplicationForm Component ---
const ApplicationForm: FC = () => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parentInfo, setParentInfo] = useState<ParentInfo>({
    parentName: '',
    parentPhone: '',
    depositorName: '',
  });

  const [children, setChildren] = useState<Child[]>([initialChildState]);
  const [fees, setFees] = useState<Fees>(FALLBACK_FEES);

  const [paymentChecks, setPaymentChecks] = useState<PaymentChecks>({
    kinder: false,
    kids: false,
    teens: false,
    waterpark: false,
  });

  useEffect(() => {
    const fetchFees = async () => {
      try {
        const feeDocRef = doc(db, 'config', 'fees');
        const feeDocSnap = await getDoc(feeDocRef);
        if (feeDocSnap.exists()) {
          setFees(feeDocSnap.data() as Fees);
        } else {
          console.warn("Fee document not found, using fallback values.");
        }
      } catch (err) {
        console.error("Error fetching fees:", err);
        setError("회비 정보를 불러오는 데 실패했습니다. 기본값으로 진행합니다.");
      }
    };
    fetchFees();
  }, []);

  const handleParentInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setParentInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleChildChange = (index: number, field: keyof Child, value: any) => {
    const newChildren = [...children];
    if (field === 'allergies') {
      const currentAllergies = newChildren[index].allergies;
      if (currentAllergies.includes(value)) {
        newChildren[index].allergies = currentAllergies.filter((a) => a !== value);
      } else {
        newChildren[index].allergies.push(value);
      }
    } else {
      newChildren[index] = { ...newChildren[index], [field]: value };
    }
    setChildren(newChildren);
  };

  const addChild = () => {
    setChildren([...children, { ...initialChildState }]);
  };

  const removeChild = (index: number) => {
    if (children.length > 1) {
      setChildren(children.filter((_, i) => i !== index));
    }
  };

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  const calculatedFees = useMemo(() => {
    let kinderTotal = 0;
    let kidsTotal = 0;
    let teensTotal = 0;
    let waterparkTotal = 0;

    children.forEach(child => {
      if (child.department === 'kinder') kinderTotal += fees.kinder;
      if (child.department === 'kids') kidsTotal += fees.kids;
      if (child.department === 'teens') teensTotal += fees.teens;
    });

    const isWaterparkAttended = children.some(c => c.attendsWaterpark);
    if (isWaterparkAttended) {
      waterparkTotal = fees.parentWaterpark;
    }

    const grandTotal = kinderTotal + kidsTotal + teensTotal + waterparkTotal;

    return { kinderTotal, kidsTotal, teensTotal, waterparkTotal, grandTotal, isWaterparkAttended };
  }, [children, fees]);

  const handlePaymentCheck = (account: keyof PaymentChecks) => {
    setPaymentChecks(prev => ({ ...prev, [account]: !prev[account] }));
  };

  const isSubmitDisabled = useMemo(() => {
    if (isLoading) return true;
    const { kinderTotal, kidsTotal, teensTotal, waterparkTotal } = calculatedFees;
    if (kinderTotal > 0 && !paymentChecks.kinder) return true;
    if (kidsTotal > 0 && !paymentChecks.kids) return true;
    if (teensTotal > 0 && !paymentChecks.teens) return true;
    if (waterparkTotal > 0 && !paymentChecks.waterpark) return true;
    return false;
  }, [paymentChecks, calculatedFees, isLoading]);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const applicationData = {
        parentInfo,
        children,
        fees: {
          ...calculatedFees,
          breakdown: {
            kinder: calculatedFees.kinderTotal,
            kids: calculatedFees.kidsTotal,
            teens: calculatedFees.teensTotal,
            waterpark: calculatedFees.waterparkTotal,
          }
        },
        totalFee: calculatedFees.grandTotal,
        paymentStatus: paymentChecks,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'applications'), applicationData);
      setStep(4); // Success step
    } catch (err) {
      console.error("Error submitting application:", err);
      setError("신청서 제출에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1: // Parent Info
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-center text-gray-800">1. 보호자 정보</h2>
            <div className="space-y-4">
              <Input label="보호자 성함" name="parentName" value={parentInfo.parentName} onChange={handleParentInfoChange} placeholder="홍길동" />
              <Input label="연락처" name="parentPhone" value={parentInfo.parentPhone} onChange={handleParentInfoChange} placeholder="010-1234-5678" type="tel" />
              <Input label="입금자명" name="depositorName" value={parentInfo.depositorName} onChange={handleParentInfoChange} placeholder="보호자 성함과 동일시 비워두셔도 됩니다" />
            </div>
            <Button onClick={nextStep} disabled={!parentInfo.parentName || !parentInfo.parentPhone}>다음</Button>
          </div>
        );

      case 2: // Children Info
        return (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-center text-gray-800">2. 자녀 정보</h2>
            {children.map((child, index) => (
              <div key={index} className="p-6 border border-gray-200 rounded-xl shadow-sm bg-white relative">
                {children.length > 1 && (
                  <button onClick={() => removeChild(index)} className="absolute top-4 right-4 text-red-500 hover:text-red-700 font-bold text-2xl">&times;</button>
                )}
                <h3 className="text-xl font-semibold mb-4 text-indigo-700">자녀 {index + 1}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label="이름" value={child.name} onChange={(e) => handleChildChange(index, 'name', e.target.value)} placeholder="김열정" />
                  <Input label="생년월일" value={child.birthDate} onChange={(e) => handleChildChange(index, 'birthDate', e.target.value)} type="date" />
                  <Select label="소속 부서" value={child.department} onChange={(e) => handleChildChange(index, 'department', e.target.value)}>
                    <option value="">부서를 선택하세요</option>
                    <option value="kinder">유치부</option>
                    <option value="kids">아동부</option>
                    <option value="teens">청소년부</option>
                  </Select>
                  <Select label="단체티 사이즈" value={child.tshirtSize} onChange={(e) => handleChildChange(index, 'tshirtSize', e.target.value)}>
                    <option value="">사이즈를 선택하세요</option>
                    {TSHIRT_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
                  </Select>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">알러지 정보 (해당하는 것 모두 선택)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {ALLERGY_OPTIONS.map(allergy => (
                        <Checkbox key={allergy} label={allergy} checked={child.allergies.includes(allergy)} onChange={() => handleChildChange(index, 'allergies', allergy)} />
                      ))}
                    </div>
                    <Input type="text" placeholder="기타 알러지 정보를 입력하세요" value={child.customAllergy} onChange={(e) => handleChildChange(index, 'customAllergy', e.target.value)} className="mt-3" />
                  </div>
                  <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg">
                    <Checkbox label="워터파크에 참여합니다." checked={child.attendsWaterpark} onChange={(e) => handleChildChange(index, 'attendsWaterpark', e.target.checked)} />
                    <p className="text-sm text-blue-700 mt-2 ml-8">워터파크 참여 시 보호자 1인 동반이 필수입니다. (보호자 비용 별도)</p>
                  </div>
                </div>
              </div>
            ))}
            <Button onClick={addChild} variant="secondary">+ 자녀 추가</Button>
            <div className="flex justify-between space-x-4">
              <Button onClick={prevStep} variant="secondary">이전</Button>
              <Button onClick={nextStep}>다음</Button>
            </div>
          </div>
        );

      case 3: // Payment
        const { kinderTotal, kidsTotal, teensTotal, waterparkTotal, grandTotal } = calculatedFees;
        return (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-center text-gray-800">3. 최종 확인 및 결제</h2>
            <div className="p-6 bg-white rounded-xl shadow-md space-y-4">
              <h3 className="text-xl font-semibold border-b pb-3 mb-4 text-gray-800">회비 내역</h3>
              {kinderTotal > 0 && <p className="flex justify-between"><span>유치부 회비:</span> <span>{kinderTotal.toLocaleString()}원</span></p>}
              {kidsTotal > 0 && <p className="flex justify-between"><span>아동부 회비:</span> <span>{kidsTotal.toLocaleString()}원</span></p>}
              {teensTotal > 0 && <p className="flex justify-between"><span>청소년부 회비:</span> <span>{teensTotal.toLocaleString()}원</span></p>}
              {waterparkTotal > 0 && <p className="flex justify-between"><span>워터파크 (보호자):</span> <span>{waterparkTotal.toLocaleString()}원</span></p>}
              <hr />
              <p className="flex justify-between text-2xl font-bold text-indigo-600"><span>총 합계:</span> <span>{grandTotal.toLocaleString()}원</span></p>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-center text-gray-800">입금 계좌 안내</h3>
              <p className="text-center text-gray-600">해당하는 항목의 금액을 아래 계좌로 입금하신 후, 각 항목의 [입금 확인] 버튼을 눌러주세요.</p>
              
              {kinderTotal > 0 && (
                <div className="p-4 border rounded-lg flex justify-between items-center bg-gray-50">
                  <div>
                    <p className="font-bold">{BANK_ACCOUNTS.kinder.name} ({kinderTotal.toLocaleString()}원)</p>
                    <p className="text-sm text-gray-600">{BANK_ACCOUNTS.kinder.account}</p>
                  </div>
                  <Checkbox label="입금 확인" checked={paymentChecks.kinder} onChange={() => handlePaymentCheck('kinder')} />
                </div>
              )}
              {kidsTotal > 0 && (
                <div className="p-4 border rounded-lg flex justify-between items-center bg-gray-50">
                  <div>
                    <p className="font-bold">{BANK_ACCOUNTS.kids.name} ({kidsTotal.toLocaleString()}원)</p>
                    <p className="text-sm text-gray-600">{BANK_ACCOUNTS.kids.account}</p>
                  </div>
                  <Checkbox label="입금 확인" checked={paymentChecks.kids} onChange={() => handlePaymentCheck('kids')} />
                </div>
              )}
              {teensTotal > 0 && (
                <div className="p-4 border rounded-lg flex justify-between items-center bg-gray-50">
                  <div>
                    <p className="font-bold">{BANK_ACCOUNTS.teens.name} ({teensTotal.toLocaleString()}원)</p>
                    <p className="text-sm text-gray-600">{BANK_ACCOUNTS.teens.account}</p>
                  </div>
                  <Checkbox label="입금 확인" checked={paymentChecks.teens} onChange={() => handlePaymentCheck('teens')} />
                </div>
              )}
              {waterparkTotal > 0 && (
                <div className="p-4 border rounded-lg flex justify-between items-center bg-gray-50">
                  <div>
                    <p className="font-bold">{BANK_ACCOUNTS.waterpark.name} ({waterparkTotal.toLocaleString()}원)</p>
                    <p className="text-sm text-gray-600">{BANK_ACCOUNTS.waterpark.account}</p>
                  </div>
                  <Checkbox label="입금 확인" checked={paymentChecks.waterpark} onChange={() => handlePaymentCheck('waterpark')} />
                </div>
              )}
            </div>

            {error && <p className="text-red-500 text-center">{error}</p>}

            <div className="flex justify-between space-x-4 pt-4">
              <Button onClick={prevStep} variant="secondary" disabled={isLoading}>이전</Button>
              <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
                {isLoading ? '제출 중...' : '최종 제출'}
              </Button>
            </div>
            {isSubmitDisabled && !isLoading && <p className="text-center text-sm text-red-600 mt-2">모든 해당 항목에 대해 입금 확인을 체크해야 제출이 가능합니다.</p>}
          </div>
        );

      case 4: // Success
        return (
          <div className="text-center py-20">
            <svg className="mx-auto h-24 w-24 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="mt-6 text-4xl font-extrabold text-gray-900">신청이 완료되었습니다!</h2>
            <p className="mt-4 text-lg text-gray-600">참여해주셔서 감사합니다. 곧 확인 후 연락드리겠습니다.</p>
            <div className="mt-10">
              <Button onClick={() => window.location.reload()}>새로운 신청서 작성</Button>
            </div>
          </div>
        );

      default:
        return <div>잘못된 단계입니다.</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl w-full mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12">
          {step < 4 && <StepIndicator currentStep={step} />}
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default ApplicationForm;
