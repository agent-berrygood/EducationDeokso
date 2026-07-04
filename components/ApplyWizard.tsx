'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  DepartmentId,
  WaterfallParent,
  WaterfallRelation,
  EventConfig,
  FeesConfig,
  Gender,
} from '@/lib/types';
import { suggestDepartment } from '@/lib/age-to-department';
import { applicationSubmitSchema } from '@/lib/schemas';
import { subDepartmentShortLabel } from '@/lib/labels';
import { getPresetSubDepartments } from '@/lib/subDepartments';
import { useApplyConfigCache } from '@/hooks/useApplyConfigCache';

function formatPhoneNumber(val: string): string {
  const clean = val.replace(/\D/g, '');
  if (clean.length <= 3) return clean;
  if (clean.length <= 7) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7, 11)}`;
}

const DRAFT_KEY = 'apply_draft_v1';
const RELATIONS: WaterfallRelation[] = ['부', '모', '조부', '조모', '기타'];
const ALLERGY_OPTIONS = ['계란', '우유', '견과류', '밀', '복숭아', '대두', '갑각류'];
const DEPARTMENTS: { id: DepartmentId; label: string }[] = [
  { id: 'kinder', label: '나우킨더' },
  { id: 'kids', label: '나우키즈' },
  { id: 'teens', label: '나우틴즈' },
];

interface ChildDraft {
  uid: string;
  name: string;
  birthDate: string;
  gender: Gender | '';
  department: DepartmentId | '';
  subDepartment: string;
  tshirtSize: string;
  allergies: string;
  customAllergy: string;
  attendsWaterpark: boolean;
  attendedSessions: string[];
  customFields: Record<string, string>;
  partialAttendanceReason: string;
}

interface DraftState {
  step: 1 | 2 | 3;
  parentName: string;
  parentPhone: string;
  depositorName: string;
  vehicleInfo: string;
  carpoolAvailable: boolean;
  carpoolCapacity: string;
  waterfallParents: WaterfallParent[];
  children: ChildDraft[];
}

const initialDraft: DraftState = {
  step: 1,
  parentName: '',
  parentPhone: '',
  depositorName: '',
  vehicleInfo: '',
  carpoolAvailable: false,
  carpoolCapacity: '',
  waterfallParents: [{ name: '', relation: '모', phone: '' }],
  children: [makeEmptyChild()],
};

function makeEmptyChild(): ChildDraft {
  return {
    uid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    birthDate: '',
    gender: '',
    department: '',
    subDepartment: '',
    tshirtSize: '',
    allergies: '',
    customAllergy: '',
    attendsWaterpark: false,
    attendedSessions: [],
    customFields: {},
    partialAttendanceReason: '',
  };
}

/** 저장된 초안이 "이어쓰기"를 물어볼 만큼 실제 내용을 담고 있는지 판별 */
function draftHasContent(d: any): boolean {
  if (!d || typeof d !== 'object') return false;
  if (d.parentName?.trim() || d.parentPhone?.trim() || d.depositorName?.trim()) return true;
  if (Array.isArray(d.children) && d.children.some((c: any) => c?.name?.trim() || c?.birthDate || c?.department)) return true;
  if (Array.isArray(d.waterfallParents) && d.waterfallParents.some((p: any) => p?.name?.trim() || p?.phone?.trim())) return true;
  return false;
}

/** 세부부서 id → 소속 대부서 id (프리셋 기반 역매핑) */
function departmentForSubDepartment(subId: string): DepartmentId | '' {
  if (!subId) return '';
  for (const d of DEPARTMENTS) {
    if (getPresetSubDepartments(d.id).some((sd) => sd.id === subId)) return d.id;
  }
  return '';
}

/** 생년월일 연/월/일 드롭다운 — 부분 선택은 내부 상태로 유지하고, 3개 모두 선택 시에만 YYYY-MM-DD emit */
function BirthDateSelect({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  // ChildCard가 child.uid로 key되어 자녀마다 새로 마운트되므로 초기값을 value에서 한 번 읽으면 충분
  const [ymd, setYmd] = useState(() => {
    const [vy, vm, vd] = (value || '').split('-');
    return { y: vy || '', m: vm ? String(Number(vm)) : '', d: vd ? String(Number(vd)) : '' };
  });

  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let yr = currentYear; yr >= currentYear - 25; yr--) years.push(yr);

  const daysInMonth = (ymd.y && ymd.m) ? new Date(Number(ymd.y), Number(ymd.m), 0).getDate() : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const update = (next: { y: string; m: string; d: string }) => {
    // 월/연 변경으로 일수가 줄면 일 보정
    let nd = next.d;
    if (next.y && next.m && nd) {
      const maxD = new Date(Number(next.y), Number(next.m), 0).getDate();
      if (Number(nd) > maxD) nd = String(maxD);
    }
    const fixed = { ...next, d: nd };
    setYmd(fixed);
    if (fixed.y && fixed.m && fixed.d) {
      onChange(`${fixed.y}-${String(Number(fixed.m)).padStart(2, '0')}-${String(Number(fixed.d)).padStart(2, '0')}`);
    } else {
      onChange('');
    }
  };

  const selCls = 'flex-1 px-3 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none bg-white';

  return (
    <div className="flex gap-2">
      <select className={selCls} value={ymd.y} onChange={(e) => update({ ...ymd, y: e.target.value })}>
        <option value="">연도</option>
        {years.map((yr) => <option key={yr} value={yr}>{yr}년</option>)}
      </select>
      <select className={selCls} value={ymd.m} onChange={(e) => update({ ...ymd, m: e.target.value })}>
        <option value="">월</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => <option key={mo} value={mo}>{mo}월</option>)}
      </select>
      <select className={selCls} value={ymd.d} onChange={(e) => update({ ...ymd, d: e.target.value })}>
        <option value="">일</option>
        {days.map((dd) => <option key={dd} value={dd}>{dd}일</option>)}
      </select>
    </div>
  );
}

export default function ApplyWizard() {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const [hydrated, setHydrated] = useState(false);
  // 저장된 초안이 감지되면 자동 복원하지 않고 사용자에게 이어쓰기/새로작성을 먼저 묻는다
  const [pendingDraft, setPendingDraft] = useState<DraftState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedDepts, setSubmittedDepts] = useState<DepartmentId[]>([]);
  const [error, setError] = useState('');
  const [fees, setFees] = useState<FeesConfig | null>(null);
  const [feesLoading, setFeesLoading] = useState(true);
  // 개인정보 수집·이용 동의 (제출 시마다 새로 확인 — localStorage에 저장하지 않음)
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);

  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  // ─── 초기 hydration: 저장된 초안이 있으면 자동 복원 대신 이어쓰기/새로작성 확인 ───
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (draftHasContent(parsed)) {
          // 사용자가 선택할 때까지 hydrated=false 유지 → 자동저장이 빈 초안으로 덮어쓰지 않음
          setPendingDraft({ ...initialDraft, ...parsed });
          return;
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  const resumeDraft = () => {
    if (pendingDraft) setDraft(pendingDraft);
    setPendingDraft(null);
    setHydrated(true);
  };

  const startFreshDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setDraft(initialDraft);
    setPendingDraft(null);
    setHydrated(true);
  };

  // ─── 자동 저장 (debounce 500ms) ───
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {}
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft, hydrated]);

  // ─── 부서/트랙별 CMS 설정 온디맨드 캐시 ───
  // 부서 단위(sub 없음) 3개는 항상 미리 채워 anyWaterparkActive 등 부서 레벨 판단에 사용하고,
  // 자녀별로 선택된 department::subDepartment 조합은 추가로 필요할 때마다 채워진다.
  const configCacheKeys = useMemo(() => {
    const base = DEPARTMENTS.map((d) => `${d.id}::`);
    const childKeys = draft.children
      .filter((c) => c.department)
      .map((c) => `${c.department}::${c.subDepartment || ''}`);
    return Array.from(new Set([...base, ...childKeys]));
  }, [draft.children]);
  const { cache: configCache, loading: configCacheLoading } = useApplyConfigCache(configCacheKeys);

  useEffect(() => {
    (async () => {
      try {
        const feesRes = await fetch('/api/fees');
        const feesJson = await feesRes.json();
        if (feesJson.success) setFees(feesJson.data);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') console.error('요금 정보 로드 실패', err);
      } finally {
        setFeesLoading(false);
      }
    })();
  }, []);

  // ─── 전체 초기 데이터 로딩 완료 여부 (부서 설정 3개 + 요금 정보) ───
  const initialDataReady = !configCacheLoading && !feesLoading;

  // ─── 합계 계산 (부서별 분리 + 워터풀 자녀/학부모 분리) ───
  const breakdown = useMemo(() => {
    const empty = {
      kinderCount: 0, kinderTotal: 0,
      kidsCount: 0, kidsTotal: 0,
      teensCount: 0, teensTotal: 0,
      childWaterparkTotal: 0,
      parentWaterparkTotal: 0,
      attendingChildren: 0,
      total: 0,
    };
    if (!fees) return empty;

    let kinderCount = 0, kidsCount = 0, teensCount = 0;
    let attendingChildren = 0;

    draft.children.forEach((c) => {
      if (c.department === 'kinder') kinderCount += 1;
      else if (c.department === 'kids') kidsCount += 1;
      else if (c.department === 'teens') teensCount += 1;
      if (c.attendsWaterpark) attendingChildren += 1;
    });

    const kinderTotal = kinderCount * Number(fees.kinder || 0);
    const kidsTotal = kidsCount * Number(fees.kids || 0);
    const teensTotal = teensCount * Number(fees.teens || 0);

    const childUnit = Number(fees.child_waterpark || 0);
    const parentUnit = Number(fees.parent_waterpark || 0);
    const childWaterparkTotal = attendingChildren * childUnit;
    // 자녀 1명이라도 워터풀 참석할 때만 보호자 단가 적용
    const parentWaterparkTotal = attendingChildren > 0 ? draft.waterfallParents.length * parentUnit : 0;

    return {
      kinderCount, kinderTotal,
      kidsCount, kidsTotal,
      teensCount, teensTotal,
      childWaterparkTotal,
      parentWaterparkTotal,
      attendingChildren,
      total: kinderTotal + kidsTotal + teensTotal + childWaterparkTotal + parentWaterparkTotal,
    };
  }, [draft.children, draft.waterfallParents, fees]);

  const grandTotal = breakdown.total;

  // ─── 헬퍼: draft 업데이트 ───
  function patch(partial: Partial<DraftState>) {
    setDraft((d) => ({ ...d, ...partial }));
  }

  function patchChild(uid: string, partial: Partial<ChildDraft>) {
    setDraft((d) => ({
      ...d,
      children: d.children.map((c) => (c.uid === uid ? { ...c, ...partial } : c)),
    }));
  }

  function setStep(step: 1 | 2 | 3) {
    patch({ step });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ─── Step 1 → Step 2 검증 ───
  function goToStep2() {
    setError('');
    if (!draft.parentName.trim()) return setError('부모 이름을 입력하세요');
    if (!draft.parentPhone.trim()) return setError('부모 연락처를 입력하세요');
    if (!draft.depositorName.trim()) return setError('입금자 이름을 입력하세요');
    setStep(2);
  }

  // ─── Step 2 → Step 3 검증 ───
  function goToStep3() {
    setError('');
    if (draft.children.length === 0) return setError('자녀를 1명 이상 추가하세요');
    for (const c of draft.children) {
      if (!c.name.trim()) return setError('자녀 이름을 모두 입력하세요');
      if (!c.birthDate) return setError(`${c.name || '자녀'}의 생년월일을 입력하세요`);
      if (!c.subDepartment) return setError(`${c.name || '자녀'}의 부서를 선택하세요`);
    }
    // 워터풀선데이 참석 자녀가 있으면 보호자 1명 이상 입력 필수
    const attending = draft.children.some((c) => c.attendsWaterpark);
    if (attending) {
      const valid = draft.waterfallParents.filter((p) => p.name.trim() && p.phone?.trim());
      if (valid.length === 0) return setError('워터풀선데이 참석 시 동반 보호자를 1명 이상 입력하세요');
    }
    setStep(3);
  }

  // ─── 제출 ───
  async function handleSubmit() {
    setError('');
    if (!agreedPrivacy) return setError('개인정보 수집·이용에 동의해주세요.');
    setSubmitting(true);
    try {
      const payload = {
        parentName: draft.parentName,
        parentPhone: draft.parentPhone,
        depositorName: draft.depositorName,
        vehicleInfo: draft.vehicleInfo.trim() || undefined,
        carpoolAvailable: draft.carpoolAvailable,
        carpoolCapacity: draft.carpoolAvailable && draft.carpoolCapacity ? Number(draft.carpoolCapacity) : undefined,
        // 워터풀 참석 자녀가 없거나 미입력 기본 행이 남아있을 수 있으므로 빈 항목은 항상 제외
        waterfallParents: draft.waterfallParents.filter((p) => p.name.trim()),
        grandTotal,
        children: draft.children.map((c) => {
          const customs: Record<string, string | null> = {};
          for (let i = 1; i <= 20; i++) customs[`custom${i}`] = c.customFields[`custom_${i}`] || null;
          return {
            name: c.name,
            birthDate: c.birthDate,
            gender: (c.gender || undefined) as Gender | undefined,
            department: c.department as DepartmentId,
            subDepartment: c.subDepartment,
            tshirtSize: c.tshirtSize || undefined,
            allergies: c.allergies || undefined,
            customAllergy: c.customAllergy || undefined,
            attendsWaterpark: c.attendsWaterpark,
            attendedSessions: c.attendedSessions,
            partialAttendanceReason: c.partialAttendanceReason || undefined,
            ...customs,
          };
        }),
      };

      // 클라이언트 zod 검증 (서버도 동일 검증 수행)
      const check = applicationSubmitSchema.safeParse(payload);
      if (!check.success) {
        setError('입력값 검증 실패: ' + check.error.issues[0]?.message);
        return;
      }

      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error || '제출 실패');
        return;
      }

      // 성공 → draft 정리
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      setSubmitted(true);
      setSubmittedDepts(draft.children.map(c => c.department).filter(Boolean) as DepartmentId[]);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error(err);
      setError('네트워크 오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── 워터풀 보호자 동적 입력 ───
  function addWaterfallParent() {
    patch({ waterfallParents: [...draft.waterfallParents, { name: '', relation: '부', phone: '' }] });
  }
  function removeWaterfallParent(idx: number) {
    if (draft.waterfallParents.length === 1) {
      setError('워터풀 보호자는 1명 이상 필요합니다');
      return;
    }
    patch({ waterfallParents: draft.waterfallParents.filter((_, i) => i !== idx) });
  }
  function updateWaterfallParent(idx: number, field: keyof WaterfallParent, value: string) {
    const next = [...draft.waterfallParents];
    next[idx] = { ...next[idx], [field]: value } as WaterfallParent;
    patch({ waterfallParents: next });
  }

  // ─── 자녀 추가/제거 ───
  function addChild() {
    patch({ children: [...draft.children, makeEmptyChild()] });
  }
  function removeChild(uid: string) {
    if (draft.children.length === 1) {
      setError('자녀는 최소 1명 등록해야 합니다');
      return;
    }
    patch({ children: draft.children.filter((c) => c.uid !== uid) });
  }

  // 저장된 초안 감지 → 이어쓰기/새로작성 확인 화면
  if (pendingDraft) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <section className="bg-white p-8 rounded-2xl shadow-sm border text-center space-y-5">
          <div className="text-5xl">📝</div>
          <h2 className="text-xl font-bold text-black">이전에 작성하던 신청서가 있습니다</h2>
          <p className="text-black text-sm">
            이어서 작성하시겠어요? 새로 작성하시면 이전에 입력하던 내용은 삭제됩니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={startFreshDraft}
              className="flex-1 px-6 py-3 border border-slate-300 text-black font-bold rounded-lg hover:bg-slate-50 transition-colors"
            >
              새로 작성하기
            </button>
            <button
              type="button"
              onClick={resumeDraft}
              className="flex-1 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-lg shadow-md transition-colors"
            >
              이어서 작성하기
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!hydrated || !initialDataReady) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <section className="bg-white p-8 rounded-2xl shadow-sm border text-center space-y-5">
          <div className="flex justify-center">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-black">신청서를 준비하고 있습니다.</h2>
          <p className="text-sm text-black mt-2">
            잠시만 기다려주세요.
          </p>
        </section>
      </div>
    );
  }

  // 완료 화면
  if (submitted) {
    const stepDepts = submittedDepts.filter(d => {
      const cfg = configCache[`${d}::`];
      return cfg && (cfg as any).is_step_recruitment_active;
    });
    return (
      <div className="max-w-3xl mx-auto">
        <section className="bg-white p-8 rounded-2xl shadow-sm border text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-black mb-2">신청이 완료되었습니다</h2>
          <p className="text-black mb-6">감사합니다. 신청 내용이 정상적으로 접수되었습니다.</p>
          {stepDepts.length > 0 && (
            <div className="mb-6">
              <a
                href="/step-apply"
                className="inline-block px-8 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-lg shadow-md transition-colors"
              >
                성경학교 스텝 신청하기
              </a>
            </div>
          )}
          <a
            href="/"
            className="text-sm text-black hover:text-cyan-600 underline transition-colors"
          >
            메인 페이지로 돌아가기
          </a>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <StepIndicator current={draft.step} />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {draft.step === 1 && (
        <Step1
          draft={draft}
          patch={patch}
          onNext={goToStep2}
        />
      )}

      {draft.step === 2 && (
        <Step2
          draft={draft}
          configCache={configCache}
          patchChild={patchChild}
          addChild={addChild}
          removeChild={removeChild}
          addParent={addWaterfallParent}
          removeParent={removeWaterfallParent}
          updateParent={updateWaterfallParent}
          onPrev={() => setStep(1)}
          onNext={goToStep3}
        />
      )}

      {draft.step === 3 && (
        <Step3
          draft={draft}
          breakdown={breakdown}
          fees={fees}
          onPrev={() => setStep(2)}
          onSubmit={handleSubmit}
          submitting={submitting}
          agreedPrivacy={agreedPrivacy}
          setAgreedPrivacy={setAgreedPrivacy}
        />
      )}
    </div>
  );
}

// ─── 진행 상태 표시 ───
function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: '보호자 정보' },
    { n: 2, label: '자녀 정보' },
    { n: 3, label: '확인 및 제출' },
  ];
  return (
    <div className="flex items-center justify-between mb-8 bg-white rounded-2xl shadow-sm p-4 border">
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              current >= s.n ? 'bg-cyan-500 text-white' : 'bg-slate-200 text-black'
            }`}>
              {s.n}
            </div>
            <span className={`hidden md:inline font-semibold ${current >= s.n ? 'text-black' : 'text-slate-400'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 mx-2 md:mx-4 h-1 rounded ${current > s.n ? 'bg-cyan-500' : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Step 1: 보호자 정보 ───
interface Step1Props {
  draft: DraftState;
  patch: (p: Partial<DraftState>) => void;
  onNext: () => void;
}

function Step1({ draft, patch, onNext }: Step1Props) {
  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <h2 className="text-xl font-bold mb-1 text-black">보호자 정보</h2>
        <p className="text-sm text-black mb-6">신청자(부모) 정보를 입력해 주세요.</p>
        <div className="space-y-4">
          <Field label="부모 이름">
            <input
              type="text"
              value={draft.parentName}
              onChange={(e) => patch({ parentName: e.target.value })}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none text-black"
              placeholder="예) 홍길동"
            />
          </Field>
          <Field label="부모 연락처">
            <input
              type="tel"
              value={draft.parentPhone}
              onChange={(e) => patch({ parentPhone: formatPhoneNumber(e.target.value) })}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none text-black"
              placeholder="010-0000-0000"
            />
          </Field>
          <Field label="입금자 이름">
            <input
              type="text"
              value={draft.depositorName}
              onChange={(e) => patch({ depositorName: e.target.value })}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none text-black"
              placeholder="입금하실 분 이름"
            />
          </Field>
          <Field label="차량 정보 (선택)">
            <input
              type="text"
              value={draft.vehicleInfo}
              onChange={(e) => patch({ vehicleInfo: e.target.value })}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none text-black"
              placeholder="예) 12가 3456 (흰색 카니발)"
            />
            <p className="mt-1 text-xs text-slate-400">주차 안내 및 카풀 편성을 위해 차량 번호·차종을 적어주세요.</p>
          </Field>
        </div>
      </section>

      {/* 덕소지역 카풀 차량 지원 */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-200">
        <h2 className="text-xl font-bold mb-1 text-emerald-700">🚗 덕소지역 카풀 차량 지원</h2>
        <p className="text-sm text-slate-500 mb-4 leading-relaxed">
          덕소지역에서 함께 이동할 카풀 차량 자원봉사가 필요합니다.
          차량을 지원해주실 수 있는 학부모님께서는 아래에 체크하고 <strong className="text-emerald-700">태워주실 수 있는 인원</strong>을 적어주세요.
          (카풀이 필요한 신청이 아니라, 차량을 지원해주시는 경우에만 체크해주세요.)
        </p>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.carpoolAvailable}
            onChange={(e) => patch({ carpoolAvailable: e.target.checked, carpoolCapacity: e.target.checked ? draft.carpoolCapacity : '' })}
            className="w-5 h-5 accent-emerald-500 mt-0.5"
          />
          <span className="text-sm font-semibold text-slate-800">카풀 차량을 지원할 수 있습니다.</span>
        </label>
        {draft.carpoolAvailable && (
          <div className="mt-3">
            <label className="block text-sm font-semibold text-slate-700 mb-1">지원 차량이 태울 수 있는 인원</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={20}
                value={draft.carpoolCapacity}
                onChange={(e) => patch({ carpoolCapacity: e.target.value })}
                className="w-28 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:outline-none text-black"
                placeholder="예) 4"
              />
              <span className="text-sm text-slate-500">명</span>
            </div>
          </div>
        )}
      </section>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onNext}
          className="px-8 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-lg shadow-md transition-colors"
        >
          다음 단계 →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: 자녀 정보 + (참석 시) 워터풀 보호자 ───
interface Step2Props {
  draft: DraftState;
  configCache: Record<string, EventConfig | null>;
  patchChild: (uid: string, partial: Partial<ChildDraft>) => void;
  addChild: () => void;
  removeChild: (uid: string) => void;
  addParent: () => void;
  removeParent: (idx: number) => void;
  updateParent: (idx: number, field: keyof WaterfallParent, value: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

function Step2({ draft, configCache, patchChild, addChild, removeChild, addParent, removeParent, updateParent, onPrev, onNext }: Step2Props) {
  const hasWaterparkAttendee = draft.children.some((c) => c.attendsWaterpark);
  return (
    <div className="space-y-6">
      {draft.children.map((child, idx) => (
        <ChildCard
          key={child.uid}
          index={idx}
          child={child}
          configCache={configCache}
          patchChild={patchChild}
          removable={draft.children.length > 1}
          onRemove={() => removeChild(child.uid)}
        />
      ))}

      <button
        type="button"
        onClick={addChild}
        className="w-full py-4 border-2 border-dashed border-slate-300 text-black hover:border-cyan-400 hover:text-cyan-600 rounded-2xl font-semibold transition-colors"
      >
        + 자녀 추가
      </button>

      {/* 워터풀선데이 참석 자녀가 있을 때만 동반 보호자 입력 */}
      {hasWaterparkAttendee && (
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-cyan-200">
          <h2 className="text-xl font-bold text-black">💦 워터풀선데이 동반 보호자</h2>
          <p className="text-sm text-black mt-1 mb-6">
            워터풀선데이에 자녀와 함께 참여하실 보호자(조부모, 부모 등)를 모두 등록해 주세요. 최소 1명 이상.
          </p>

          <div className="space-y-3">
            {draft.waterfallParents.map((p, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updateParent(idx, 'name', e.target.value)}
                  placeholder="이름"
                  className="col-span-5 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                />
                <select
                  value={p.relation}
                  onChange={(e) => updateParent(idx, 'relation', e.target.value)}
                  className="col-span-3 px-2 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                >
                  {RELATIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={p.phone || ''}
                  onChange={(e) => updateParent(idx, 'phone', formatPhoneNumber(e.target.value))}
                  placeholder="연락처 (필수)"
                  className="col-span-3 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeParent(idx)}
                  className="col-span-1 h-10 rounded-lg bg-slate-100 hover:bg-red-100 text-black hover:text-red-600 font-bold"
                  aria-label="보호자 삭제"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addParent}
            className="mt-4 w-full py-3 border-2 border-dashed border-slate-300 text-black hover:border-cyan-400 hover:text-cyan-600 rounded-lg font-semibold transition-colors"
          >
            + 보호자 추가
          </button>
        </section>
      )}

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          className="px-8 py-3 bg-slate-200 hover:bg-slate-300 text-black font-bold rounded-lg transition-colors"
        >
          ← 이전
        </button>
        <button
          type="button"
          onClick={onNext}
          className="px-8 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-lg shadow-md transition-colors"
        >
          다음 단계 →
        </button>
      </div>
    </div>
  );
}

interface ChildCardProps {
  index: number;
  child: ChildDraft;
  configCache: Record<string, EventConfig | null>;
  patchChild: (uid: string, partial: Partial<ChildDraft>) => void;
  removable: boolean;
  onRemove: () => void;
}

function ChildCard({ index, child, configCache, patchChild, removable, onRemove }: ChildCardProps) {
  const suggestion = useMemo(() => suggestDepartment(child.birthDate), [child.birthDate]);
  // 올해 미운영(수련회 없음)이거나 외부 링크로 신청받는 부서는 내부 신청 목록에서 제외
  // (config 로드 전엔 기본 노출 — 데이터 도착 전 깜빡임 방지)
  const activeDepartments = DEPARTMENTS.filter((d) => {
    const cfg = configCache[`${d.id}::`] as any;
    if (cfg?.isCampActive === false) return false;
    if (cfg?.isExternalApply === true) return false;
    return true;
  });
  const activeConfig = child.department ? configCache[`${child.department}::${child.subDepartment || ''}`] : null;
  const activePoster = (activeConfig as any)?.posterUrl || (activeConfig as any)?.poster_url || null;
  const showUnassignedWarning =
    !!child.subDepartment &&
    (activeConfig as any)?.trackKey === 'main' &&
    (activeConfig as any)?.operatingMode === 'split';

  return (
    <section className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-black">자녀 {index + 1}</h3>
          {removable && (
            <button
              type="button"
              onClick={onRemove}
              className="text-sm text-red-600 hover:text-red-700 font-semibold"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      <div className="p-6 grid md:grid-cols-2 gap-4">
        <Field label="이름">
          <input
            type="text"
            value={child.name}
            onChange={(e) => patchChild(child.uid, { name: e.target.value })}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none text-black"
          />
        </Field>

        <Field label="생년월일">
          <BirthDateSelect
            value={child.birthDate}
            onChange={(iso) => patchChild(child.uid, { birthDate: iso })}
          />
        </Field>

        <Field label="성별">
          <div className="flex gap-2">
            <label className={`flex-1 text-center py-3 rounded-lg border cursor-pointer transition-colors ${
              child.gender === 'male' ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-white text-black border-slate-300'
            }`}>
              <input
                type="radio"
                name={`gender-${child.uid}`}
                value="male"
                checked={child.gender === 'male'}
                onChange={() => patchChild(child.uid, { gender: 'male' })}
                className="hidden"
              />
              남
            </label>
            <label className={`flex-1 text-center py-3 rounded-lg border cursor-pointer transition-colors ${
              child.gender === 'female' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-black border-slate-300'
            }`}>
              <input
                type="radio"
                name={`gender-${child.uid}`}
                value="female"
                checked={child.gender === 'female'}
                onChange={() => patchChild(child.uid, { gender: 'female' })}
                className="hidden"
              />
              여
            </label>
          </div>
        </Field>

        <Field label="부서 선택">
          <select
            value={child.subDepartment}
            onChange={(e) => {
              const newSub = e.target.value;
              const newDept = departmentForSubDepartment(newSub);
              const deptChanged = newDept !== child.department;
              patchChild(child.uid, {
                subDepartment: newSub,
                department: newDept,
                // 부서(대분류)가 바뀌면 시간표/워터풀 설정이 달라지므로 리셋
                ...(deptChanged ? { attendedSessions: [], attendsWaterpark: false } : {}),
              });
            }}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none bg-white"
          >
            <option value="">선택</option>
            {activeDepartments.map((d) => (
              <optgroup key={d.id} label={d.label}>
                {getPresetSubDepartments(d.id).map((sd) => (
                  <option key={sd.id} value={sd.id}>{sd.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {suggestion && !child.department && (
            <p className="mt-2 text-xs text-amber-600">
              💡 추천: <strong>{DEPARTMENTS.find(d => d.id === suggestion.recommended)?.label}</strong> ({suggestion.reason})
            </p>
          )}
          {suggestion && child.department && child.department !== suggestion.recommended && (
            <p className="mt-2 text-xs text-black">
              ⓘ 만 {suggestion.age}세 자동 추천: {DEPARTMENTS.find(d => d.id === suggestion.recommended)?.label}
            </p>
          )}
          {showUnassignedWarning && (
            <p className="mt-2 text-xs text-amber-600">
              ⚠️ 선택하신 세부부서는 현재 어떤 트랙에도 배정되어 있지 않아 기본(연합) 설정으로 안내됩니다.
              정확한 캠프 정보 확인을 위해 담당 교역자에게 문의해주세요.
            </p>
          )}
        </Field>

        {activePoster && (
          <div className="md:col-span-2 mt-2">
            <img src={activePoster} alt="수련회 포스터" className="w-full h-auto max-h-[600px] object-contain rounded-xl shadow-sm border border-slate-200" />
          </div>
        )}

        {activeConfig && activeConfig.tshirtSizes?.length > 0 && (() => {
          // 티셔츠 마감일 체크
          const deadline = (activeConfig as any).tshirtDeadline || (activeConfig as any).tshirt_deadline;
          if (deadline && new Date(deadline) < new Date()) return null;
          return (
            <Field label="셔츠 사이즈">
              <select
                value={child.tshirtSize}
                onChange={(e) => patchChild(child.uid, { tshirtSize: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none text-black"
              >
                <option value="">선택</option>
                {activeConfig.tshirtSizes.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          );
        })()}
      </div>

      {/* 알러지 */}
      <div className="px-6 pb-6">
        <Field label="알러지">
          <div className="flex flex-wrap gap-2 mb-2">
            {ALLERGY_OPTIONS.map((allergy) => {
              const arr = child.allergies.split(',').filter(Boolean);
              const checked = arr.includes(allergy);
              return (
                <label key={allergy} className={`px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                  checked ? 'bg-cyan-100 border-cyan-400 text-cyan-700' : 'bg-white border-slate-300 text-black'
                }`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = arr.filter((a) => a !== allergy);
                      if (e.target.checked) next.push(allergy);
                      patchChild(child.uid, { allergies: next.join(',') });
                    }}
                    className="hidden"
                  />
                  {allergy}
                </label>
              );
            })}
          </div>
          <input
            type="text"
            value={child.customAllergy}
            onChange={(e) => patchChild(child.uid, { customAllergy: e.target.value })}
            placeholder="기타 알러지 (직접 입력)"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none text-sm"
          />
        </Field>

        {(() => {
          // 부서별 워터풀선데이 활성화 여부 — 부서 미선택 시에는 노출하지 않음
          if (!activeConfig) return null;
          const wpActive = (activeConfig as any).isWaterparkActive ?? (activeConfig as any).is_waterpark_active ?? true;
          if (!wpActive) return null;
          // 부서별 커스텀 일정 안내 (예: 나우틴즈는 별도 일정)
          const info = (activeConfig as any).waterparkInfo || (activeConfig as any).waterpark_info || {};
          const infoLine = [info.date, info.time, info.location].filter(Boolean).join(' · ');
          return (
            <label className="flex items-start mt-4 gap-2">
              <input
                type="checkbox"
                checked={child.attendsWaterpark}
                onChange={(e) => patchChild(child.uid, { attendsWaterpark: e.target.checked })}
                className="w-4 h-4 accent-cyan-500 mt-0.5"
              />
              <span className="text-sm text-black">
                {info.title?.trim() || '워터풀선데이'} 참석
                {infoLine && (
                  <span className="block text-xs font-semibold text-cyan-700 mt-0.5">📅 {infoLine}</span>
                )}
                {info.note?.trim() && (
                  <span className="block text-xs text-black mt-0.5">{info.note}</span>
                )}
                <span className="block text-xs text-black mt-0.5">
                  자녀 입장료 + 등록된 워터풀 보호자 인원 × 학부모 입장료가 합계에 추가됩니다.
                </span>
              </span>
            </label>
          );
        })()}
      </div>

      {/* 참석 일정 선택 */}
      {activeConfig && activeConfig.camp_start_date && (() => {
        const startDate = new Date(activeConfig.camp_start_date);
        const duration = activeConfig.camp_duration || 3;
        const campType = activeConfig.camp_type || 'continuous';
        const dayStep = campType === 'weekly' ? 7 : 1;
        const days: { date: string; label: string }[] = [];
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        for (let i = 0; i < duration; i++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i * dayStep);
          const iso = d.toISOString().slice(0, 10);
          days.push({ date: iso, label: `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})` });
        }
        const selected = child.attendedSessions || [];
        const allSelected = days.length > 0 && days.every(d => selected.includes(d.date));
        return (
          <div className="px-6 py-4 border-t">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-bold text-slate-800">📅 성경학교 참석 일정 선택</h5>
              <button
                type="button"
                onClick={() => patchChild(child.uid, { attendedSessions: allSelected ? [] : days.map(d => d.date) })}
                className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${
                  allSelected ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-black hover:bg-cyan-50'
                }`}
              >
                {allSelected ? '✓ 전체 선택됨' : '전체 선택'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {days.map(d => {
                const checked = selected.includes(d.date);
                return (
                  <label key={d.date} className={`px-4 py-2.5 rounded-lg border cursor-pointer text-sm font-semibold transition-all ${
                    checked ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm' : 'bg-white text-black border-slate-300 hover:border-cyan-300'
                  }`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selected, d.date]
                          : selected.filter(s => s !== d.date);
                        patchChild(child.uid, { attendedSessions: next });
                      }}
                      className="hidden"
                    />
                    {d.label}
                  </label>
                );
              })}
            </div>
            <div className="mt-3">
              <input
                type="text"
                value={child.partialAttendanceReason}
                onChange={(e) => patchChild(child.uid, { partialAttendanceReason: e.target.value })}
                placeholder="부분 참석 사유 및 시간 (선택)"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none text-sm"
              />
            </div>
            {((activeConfig as any).campSchedule || (activeConfig as any).camp_schedule) && (((activeConfig as any).campSchedule || (activeConfig as any).camp_schedule).length > 0) && (
              <div className="mt-6 pt-4 border-t">
                <h5 className="text-sm font-bold text-slate-800 mb-3">🕒 수련회 시간표 안내</h5>
                <div className="space-y-2">
                  {((activeConfig as any).campSchedule || (activeConfig as any).camp_schedule).map((item: any, i: number) => (
                    <div key={i} className="flex gap-3 text-sm p-3 bg-slate-50 border border-slate-100 rounded-lg">
                      <div className="font-bold text-cyan-600 min-w-[50px]">{item.day}일차</div>
                      <div className="font-semibold text-black w-16">{item.time}</div>
                      <div className="flex-1">
                        <div className="font-bold text-slate-800">{item.title}</div>
                        {item.description && <div className="text-xs text-black mt-0.5">{item.description}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* 커스텀 필드 */}
      {activeConfig && activeConfig.customFieldMappings?.length > 0 && (
        <div className="px-6 pb-6 space-y-4 border-t pt-6">
          {activeConfig.customFieldMappings.map((f) => (
            <Field key={f.id} label={`${f.label}${f.required ? ' *' : ''}`}>
              {f.type === 'text' && (
                <input
                  type="text"
                  value={child.customFields[`custom_${f.columnIndex}`] || ''}
                  onChange={(e) => patchChild(child.uid, {
                    customFields: { ...child.customFields, [`custom_${f.columnIndex}`]: e.target.value },
                  })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none text-black"
                />
              )}
              {f.type === 'textarea' && (
                <textarea
                  value={child.customFields[`custom_${f.columnIndex}`] || ''}
                  onChange={(e) => patchChild(child.uid, {
                    customFields: { ...child.customFields, [`custom_${f.columnIndex}`]: e.target.value },
                  })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none text-black"
                  rows={3}
                />
              )}
              {f.type === 'select' && (
                <select
                  value={child.customFields[`custom_${f.columnIndex}`] || ''}
                  onChange={(e) => patchChild(child.uid, {
                    customFields: { ...child.customFields, [`custom_${f.columnIndex}`]: e.target.value },
                  })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none text-black"
                >
                  <option value="">선택</option>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              )}
            </Field>
          ))}
        </div>
      )}

      {/* 부서 콘텐츠 미리보기 (실시간 매핑) */}
      {activeConfig && (
        <div
          className="px-6 py-6 border-t"
          style={{ backgroundColor: activeConfig.bg_color || '#f8fafc' }}
        >
          <div className="flex gap-4 items-start">
            <div className="w-24 md:w-32 aspect-[3/4] bg-white/60 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
              {activePoster ? (
                <img src={activePoster} alt={`${activeConfig.title} 포스터`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full animate-pulse bg-slate-200" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold opacity-70" style={{ color: activeConfig.primary_color }}>
                {activeConfig.event_type}
              </p>
              <h4 className="text-lg md:text-xl font-bold mt-1 text-black leading-tight">
                {activeConfig.title}
              </h4>
              {activeConfig.subtitle && (
                <div className="text-sm text-black mt-2 prose max-w-none" dangerouslySetInnerHTML={{ __html: activeConfig.subtitle }} />
              )}
              {activeConfig.scripture && (
                <div className="text-xs italic text-black mt-2 border-l-2 pl-2 border-slate-350 prose max-w-none" dangerouslySetInnerHTML={{ __html: activeConfig.scripture }} />
              )}
            </div>
          </div>

          {/* 수련회 세부 일정표 및 시간표 실시간 노출 추가 */}
          {activeConfig.camp_schedule && activeConfig.camp_schedule.length > 0 && (() => {
            const uniqueDays = Array.from(new Set(activeConfig.camp_schedule.map((s: any) => s.day))).sort((a: any, b: any) => a - b);
            
            // 30분 단위 슬롯 매핑용
            const START_HOUR = 8;
            const END_HOUR = 22;
            const totalSlots = (END_HOUR - START_HOUR) * 2;
            const slots = Array.from({ length: totalSlots }, (_, i) => {
              const h = START_HOUR + Math.floor(i / 2);
              const m = i % 2 === 0 ? '00' : '30';
              return `${String(h).padStart(2, '0')}:${m}`;
            });

            const parseTimeRange = (timeStr: string) => {
              const parts = (timeStr || '').split('-').map(s => s.trim());
              const startTime = parts[0] || '09:00';
              const endTime = parts[1] || '10:30';
              return { startTime, endTime };
            };

            const timeToRowIndex = (timeStr: string): number => {
              const [h, m] = (timeStr || '09:00').split(':').map(Number);
              const hourDiff = h - START_HOUR;
              const slotIndex = hourDiff * 2 + (m >= 30 ? 1 : 0);
              return Math.max(0, Math.min(totalSlots - 1, slotIndex)) + 2;
            };

            return (
              <div className="mt-6 pt-6 border-t border-slate-200/60">
                <h5 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-1.5">
                  📅 {activeConfig.event_type} 시간표 안내
                </h5>
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white/80 p-3 min-w-[400px]">
                  <div 
                    className="grid relative"
                    style={{
                      gridTemplateColumns: `80px repeat(${uniqueDays.length}, 1fr)`,
                      gridTemplateRows: `32px repeat(${totalSlots}, 24px)`,
                    }}
                  >
                    {/* 시간표 헤더 */}
                    <div 
                      className="border-b border-gray-200 bg-gray-50 flex items-center justify-center font-bold text-black text-[10px] select-none"
                      style={{ gridRow: '1 / 2', gridColumn: '1 / 2' }}
                    >
                      시간대
                    </div>
                    {uniqueDays.map((dayNum: any, dayIdx: number) => (
                      <div 
                        key={dayNum}
                        className="border-b border-r last:border-r-0 border-gray-200 bg-gray-50 flex items-center justify-center font-bold text-black text-xs select-none"
                        style={{ 
                          gridRow: '1 / 2', 
                          gridColumn: `${dayIdx + 2} / ${dayIdx + 3}`,
                          color: activeConfig.primary_color
                        }}
                      >
                        {dayNum}{activeConfig.camp_type === 'continuous' ? '일차' : '주차'}
                      </div>
                    ))}

                    {/* 배경 30분 격자 슬롯 */}
                    {slots.map((slotTime, slotIdx) => {
                      const rowNum = slotIdx + 2;
                      return (
                        <React.Fragment key={slotTime}>
                          <div 
                            className="border-b border-r border-gray-100 bg-gray-50/10 flex items-center justify-center text-[8px] font-semibold text-slate-400 select-none text-center"
                            style={{ gridRow: `${rowNum} / ${rowNum + 1}`, gridColumn: '1 / 2' }}
                          >
                            {slotTime}
                          </div>
                          {uniqueDays.map((_, dayIdx: number) => (
                            <div 
                              key={dayIdx}
                              className="border-b border-r last:border-r-0 border-gray-100 flex items-center justify-center text-[9px] text-gray-200 select-none"
                              style={{ 
                                gridRow: `${rowNum} / ${rowNum + 1}`, 
                                gridColumn: `${dayIdx + 2} / ${dayIdx + 3}` 
                              }}
                            >
                              -
                            </div>
                          ))}
                        </React.Fragment>
                      );
                    })}

                    {/* 카드 배치 */}
                    {activeConfig.camp_schedule?.map((item: any, idx: number) => {
                      const dayIdx = uniqueDays.indexOf(item.day);
                      if (dayIdx === -1) return null;

                      const { startTime, endTime } = parseTimeRange(item.time);
                      const startRow = timeToRowIndex(startTime);
                      const endRow = timeToRowIndex(endTime);
                      const actualEndRow = endRow > startRow ? endRow : startRow + 1;

                      return (
                        <div
                          key={item.id || idx}
                          className="m-px p-0.5 rounded-lg border shadow-sm text-left z-10 overflow-hidden flex flex-col justify-between"
                          style={{
                            gridRow: `${startRow} / ${actualEndRow}`,
                            gridColumn: `${dayIdx + 2} / ${dayIdx + 3}`,
                            backgroundColor: item.color || '#ffffff',
                            borderColor: item.color ? `${item.color}dd` : '#e2e8f0',
                          }}
                        >
                          <div>
                            <div className="text-[7px] font-bold text-slate-400 mb-0.5 leading-none">
                              🕒 {item.time}
                            </div>
                            <h6 className="font-extrabold text-[9px] text-slate-800 line-clamp-1 leading-tight">
                              {item.title}
                            </h6>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </section>
  );
}

// ─── Step 3: 확인 ───
interface Breakdown {
  kinderCount: number; kinderTotal: number;
  kidsCount: number;   kidsTotal: number;
  teensCount: number;  teensTotal: number;
  childWaterparkTotal: number;
  parentWaterparkTotal: number;
  attendingChildren: number;
  total: number;
}

const DEPT_META: Record<DepartmentId, { label: string }> = {
  kinder: { label: '나우킨더' },
  kids:   { label: '나우키즈' },
  teens:  { label: '나우틴즈' },
};

function deptCount(b: Breakdown, d: DepartmentId): number {
  return d === 'kinder' ? b.kinderCount : d === 'kids' ? b.kidsCount : b.teensCount;
}
function deptTotal(b: Breakdown, d: DepartmentId): number {
  return d === 'kinder' ? b.kinderTotal : d === 'kids' ? b.kidsTotal : b.teensTotal;
}
function deptUnit(fees: FeesConfig | null, d: DepartmentId): number {
  if (!fees) return 0;
  return Number(d === 'kinder' ? fees.kinder : d === 'kids' ? fees.kids : fees.teens || 0);
}
function deptAccount(fees: FeesConfig | null, d: DepartmentId): string | null {
  if (!fees) return null;
  const v = d === 'kinder' ? fees.kinder_account
          : d === 'kids'   ? fees.kids_account
          :                   fees.teens_account;
  return v && v.trim() ? v : null;
}

function Step3({
  draft, breakdown, fees, onPrev, onSubmit, submitting, agreedPrivacy, setAgreedPrivacy,
}: {
  draft: DraftState;
  breakdown: Breakdown;
  fees: FeesConfig | null;
  onPrev: () => void;
  onSubmit: () => void;
  submitting: boolean;
  agreedPrivacy: boolean;
  setAgreedPrivacy: (v: boolean) => void;
}) {
  const usedDepartments = useMemo<DepartmentId[]>(() => {
    const order: DepartmentId[] = ['kinder', 'kids', 'teens'];
    return order.filter((d) => deptCount(breakdown, d) > 0);
  }, [breakdown]);

  const waterparkAccount = fees?.waterpark_account && fees.waterpark_account.trim()
    ? fees.waterpark_account
    : null;
  const showWaterparkAccount = breakdown.attendingChildren > 0;
  const waterparkSubtotal = breakdown.childWaterparkTotal + breakdown.parentWaterparkTotal;

  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <h2 className="text-xl font-bold mb-4 text-black">신청 내용 확인</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between border-b pb-2">
            <dt className="text-black">부모</dt>
            <dd className="font-semibold">{draft.parentName} ({draft.parentPhone})</dd>
          </div>
          <div className="flex justify-between border-b pb-2">
            <dt className="text-black">입금자</dt>
            <dd className="font-semibold">{draft.depositorName}</dd>
          </div>
          {draft.waterfallParents.some((p) => p.name.trim()) && (
            <div className="flex justify-between border-b pb-2">
              <dt className="text-black">워터풀 보호자</dt>
              <dd className="font-semibold text-right">
                {draft.waterfallParents.filter((p) => p.name.trim()).map((p) => `${p.name}(${p.relation})`).join(', ')}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-b pb-2">
            <dt className="text-black">자녀</dt>
            <dd className="font-semibold text-right">
              {draft.children.map((c) => `${c.name}(${c.department})`).join(', ')}
            </dd>
          </div>
          {draft.vehicleInfo.trim() && (
            <div className="flex justify-between border-b pb-2">
              <dt className="text-black">차량 정보</dt>
              <dd className="font-semibold text-right">{draft.vehicleInfo}</dd>
            </div>
          )}
          {draft.carpoolAvailable && (
            <div className="flex justify-between border-b pb-2">
              <dt className="text-black">카풀 차량 지원</dt>
              <dd className="font-semibold text-right text-emerald-700">
                지원 가능{draft.carpoolCapacity ? ` (${draft.carpoolCapacity}명)` : ''}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* 금액 내역 */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <h3 className="text-lg font-bold text-black mb-4">금액 내역</h3>
        <dl className="space-y-2 text-sm">
          {usedDepartments.map((d) => (
            <div key={d} className="flex justify-between">
              <dt className="text-black">
                {DEPT_META[d].label} 회비
                <span className="text-slate-400 ml-1">
                  ({deptCount(breakdown, d)}명 × {deptUnit(fees, d).toLocaleString()}원)
                </span>
              </dt>
              <dd className="font-semibold">{deptTotal(breakdown, d).toLocaleString()}원</dd>
            </div>
          ))}

          {breakdown.attendingChildren > 0 && (
            <>
              <div className="flex justify-between">
                <dt className="text-black">
                  워터풀 자녀
                  <span className="text-slate-400 ml-1">
                    ({breakdown.attendingChildren}명 × {Number(fees?.child_waterpark || 0).toLocaleString()}원)
                  </span>
                </dt>
                <dd className="font-semibold">{breakdown.childWaterparkTotal.toLocaleString()}원</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-black">
                  워터풀 학부모
                  <span className="text-slate-400 ml-1">
                    ({draft.waterfallParents.length}명 × {Number(fees?.parent_waterpark || 0).toLocaleString()}원)
                  </span>
                </dt>
                <dd className="font-semibold">{breakdown.parentWaterparkTotal.toLocaleString()}원</dd>
              </div>
            </>
          )}
        </dl>
        <div className="mt-4 pt-4 border-t flex justify-between items-center">
          <span className="text-lg font-semibold text-black">합계</span>
          <span className="text-3xl font-extrabold text-cyan-600">
            {breakdown.total.toLocaleString()}원
          </span>
        </div>
      </section>

      {/* 입금 계좌 안내 (읽기 전용) */}
      <section className="bg-slate-50 p-6 rounded-2xl border-2 border-cyan-200">
        <h3 className="text-lg font-bold text-black mb-1">💰 입금 계좌 안내</h3>
        <p className="text-xs text-black mb-2">
          항목별로 계좌가 다르니 <strong className="text-black">각각의 금액을 정확히 분리하여 입금</strong>해 주세요.
        </p>
        <div className="text-xs text-black bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-4 space-y-1">
          <p className="font-bold text-amber-800">📌 입금자명 입력 안내</p>
          <p>
            · 수련회(성경학교) 회비: <strong className="text-slate-800">&quot;세부부서 약칭 + 자녀 이름&quot;</strong>으로 입금해 주세요.
            <span className="block text-xs text-black mt-0.5 ml-2">
              약칭: 통미(통합미취학부) / 영유(영유아부) / 유치(유치부) / 통아(통합아동부) / 유년(유년부) / 소년(소년부) / 중등(중등부) / 고등(고등부)
            </span>
          </p>
          <p>· 워터풀선데이 회비: 처음 입력하신 입금자명 <strong className="text-slate-800">&quot;{draft.depositorName}&quot;</strong>으로 입금해 주세요.</p>
        </div>
        <div className="space-y-3">
          {usedDepartments.map((d) => {
            const acc = deptAccount(fees, d);
            const subtotal = deptTotal(breakdown, d);
            // 해당 부서 자녀별로 "세부부서 약칭 + 이름" 입금자명 생성 (예: 유년 홍길동)
            const depositorNames = draft.children
              .filter((c) => c.department === d)
              .map((c) => `"${[subDepartmentShortLabel(c.subDepartment), c.name].filter(Boolean).join(' ')}"`)
              .join(', ');
            return (
              <AccountInfoCard
                key={d}
                title={`${DEPT_META[d].label} 회비 입금 계좌`}
                account={acc}
                amount={subtotal}
                meta={`${deptCount(breakdown, d)}명`}
                depositorNote={`입금자명: ${depositorNames} (세부부서 약칭 + 자녀 이름)`}
              />
            );
          })}

          {showWaterparkAccount && (
            <AccountInfoCard
              title="워터풀선데이 입장료 입금 계좌"
              account={waterparkAccount}
              amount={waterparkSubtotal}
              meta={`자녀 ${breakdown.attendingChildren}명 + 보호자 ${draft.waterfallParents.length}명`}
              depositorNote={`입금자명: "${draft.depositorName}" (처음 입력하신 입금자명)`}
            />
          )}
        </div>
      </section>

      {/* 개인정보 수집·이용 동의 */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <h3 className="text-base font-bold text-black mb-2">개인정보 수집·이용 동의</h3>
        <div className="text-xs text-black leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 space-y-1">
          <p>· 수집 항목: 보호자·자녀 성명, 연락처, 생년월일, 알러지 등 건강 특이사항, 입금자명</p>
          <p>· 수집 목적: 여름성경학교/수련회 신청 접수 및 운영, 안전 관리, 회비 정산</p>
          <p>· 보유·이용 기간: <strong className="text-black">여름성경학교 종료 후 즉시 파기</strong>합니다.</p>
        </div>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={agreedPrivacy}
            onChange={(e) => setAgreedPrivacy(e.target.checked)}
            className="w-5 h-5 accent-emerald-500 mt-0.5"
          />
          <span className="text-sm font-semibold text-slate-800">
            위 개인정보 수집·이용에 동의합니다. <span className="text-red-500">(필수)</span>
          </span>
        </label>
      </section>

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          className="px-8 py-3 bg-slate-200 hover:bg-slate-300 text-black font-bold rounded-lg transition-colors"
          disabled={submitting}
        >
          ← 이전
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !agreedPrivacy}
          className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg shadow-md transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {submitting ? '제출 중...' : '✅ 회비 및 계좌 확인 완료'}
        </button>
      </div>
    </div>
  );
}

// ─── 입금 계좌 안내 카드 (읽기 전용) ───
function AccountInfoCard({
  title, account, amount, meta, depositorNote,
}: {
  title: string;
  account: string | null;
  amount: number;
  meta?: string;
  /** 입금자명 입력 규칙 안내 (예: 부서+자녀이름 / 처음 입력한 입금자명) */
  depositorNote?: string;
}) {
  return (
    <div className="rounded-lg p-4 border-2 border-slate-200 bg-white">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs text-black">{title}</p>
          <p className="font-semibold text-black mt-1">
            {account || <span className="text-slate-400 italic">관리자에게 문의해 주세요.</span>}
          </p>
          {depositorNote && (
            <p className="text-xs font-bold text-amber-700 mt-1">✍️ {depositorNote}</p>
          )}
          {meta && <p className="text-xs text-slate-400 mt-1">{meta}</p>}
        </div>
        <div className="text-right md:min-w-[140px]">
          <p className="text-xs text-slate-400">입금 금액</p>
          <p className="text-xl font-extrabold text-cyan-600">
            {amount.toLocaleString()}원
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-black mb-1.5">{label}</span>
      {children}
    </label>
  );
}
