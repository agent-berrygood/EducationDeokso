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
  customFields: Record<string, string>;
}

interface DraftState {
  step: 1 | 2 | 3;
  parentName: string;
  parentPhone: string;
  depositorName: string;
  waterfallParents: WaterfallParent[];
  children: ChildDraft[];
}

const initialDraft: DraftState = {
  step: 1,
  parentName: '',
  parentPhone: '',
  depositorName: '',
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
    customFields: {},
  };
}

export default function ApplyWizard() {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [configs, setConfigs] = useState<Record<DepartmentId, EventConfig | null>>({
    kinder: null, kids: null, teens: null,
  });
  const [posters, setPosters] = useState<Record<DepartmentId, string | null>>({
    kinder: null, kids: null, teens: null,
  });
  const [fees, setFees] = useState<FeesConfig | null>(null);

  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  // ─── 초기 hydration: localStorage 복원 ───
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setDraft({ ...initialDraft, ...parsed });
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

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

  // ─── 부서 설정 사전 로드 (3부서 모두) ───
  useEffect(() => {
    (async () => {
      try {
        const results = await Promise.all(
          DEPARTMENTS.map(async (d) => {
            const res = await fetch(`/api/config/${d.id}`);
            const json = await res.json();
            return [d.id, json.success ? json.data : null] as const;
          })
        );
        const map: any = {};
        results.forEach(([k, v]) => (map[k] = v));
        setConfigs(map);

        // 포스터 별도 캐시 가능 엔드포인트
        const posterResults = await Promise.all(
          DEPARTMENTS.map(async (d) => {
            try {
              const res = await fetch(`/api/poster/${d.id}`);
              const json = await res.json();
              return [d.id, json?.data?.posterUrl || null] as const;
            } catch {
              return [d.id, null] as const;
            }
          })
        );
        const posterMap: any = {};
        posterResults.forEach(([k, v]) => (posterMap[k] = v));
        setPosters(posterMap);

        const feesRes = await fetch('/api/fees');
        const feesJson = await feesRes.json();
        if (feesJson.success) setFees(feesJson.data);
      } catch (err) {
        console.error('설정 로드 실패', err);
      }
    })();
  }, []);

  // ─── 합계 계산 ───
  const grandTotal = useMemo(() => {
    if (!fees) return 0;
    let total = 0;
    draft.children.forEach((c) => {
      if (c.department === 'kinder') total += Number(fees.kinder);
      else if (c.department === 'kids') total += Number(fees.kids);
      else if (c.department === 'teens') total += Number(fees.teens);
      if (c.attendsWaterpark) total += Number(fees.parent_waterpark);
    });
    return total;
  }, [draft.children, fees]);

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
    if (draft.waterfallParents.length === 0) return setError('워터풀 보호자를 1명 이상 등록하세요');
    for (const p of draft.waterfallParents) {
      if (!p.name.trim()) return setError('워터풀 보호자 이름을 모두 입력하세요');
    }
    setStep(2);
  }

  // ─── Step 2 → Step 3 검증 ───
  function goToStep3() {
    setError('');
    if (draft.children.length === 0) return setError('자녀를 1명 이상 추가하세요');
    for (const c of draft.children) {
      if (!c.name.trim()) return setError('자녀 이름을 모두 입력하세요');
      if (!c.birthDate) return setError(`${c.name || '자녀'}의 생년월일을 입력하세요`);
      if (!c.department) return setError(`${c.name || '자녀'}의 부서를 선택하세요`);
      if (!c.subDepartment) return setError(`${c.name || '자녀'}의 세부 부서를 선택하세요`);
    }
    setStep(3);
  }

  // ─── 제출 ───
  async function handleSubmit() {
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        parentName: draft.parentName,
        parentPhone: draft.parentPhone,
        depositorName: draft.depositorName,
        waterfallParents: draft.waterfallParents,
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
      alert('신청이 완료되었습니다. 감사합니다!');
      router.push('/');
    } catch (err) {
      console.error(err);
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

  if (!hydrated) return <div className="text-center py-20 text-slate-500">불러오는 중...</div>;

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
          addParent={addWaterfallParent}
          removeParent={removeWaterfallParent}
          updateParent={updateWaterfallParent}
          onNext={goToStep2}
        />
      )}

      {draft.step === 2 && (
        <Step2
          draft={draft}
          configs={configs}
          posters={posters}
          patchChild={patchChild}
          addChild={addChild}
          removeChild={removeChild}
          onPrev={() => setStep(1)}
          onNext={goToStep3}
        />
      )}

      {draft.step === 3 && (
        <Step3
          draft={draft}
          grandTotal={grandTotal}
          onPrev={() => setStep(2)}
          onSubmit={handleSubmit}
          submitting={submitting}
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
              current >= s.n ? 'bg-cyan-500 text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {s.n}
            </div>
            <span className={`hidden md:inline font-semibold ${current >= s.n ? 'text-slate-900' : 'text-slate-400'}`}>
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

// ─── Step 1: 보호자 + 워터풀 보호자 ───
interface Step1Props {
  draft: DraftState;
  patch: (p: Partial<DraftState>) => void;
  addParent: () => void;
  removeParent: (idx: number) => void;
  updateParent: (idx: number, field: keyof WaterfallParent, value: string) => void;
  onNext: () => void;
}

function Step1({ draft, patch, addParent, removeParent, updateParent, onNext }: Step1Props) {
  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <h2 className="text-xl font-bold mb-1 text-slate-900">보호자 정보</h2>
        <p className="text-sm text-slate-500 mb-6">신청자(부모) 정보를 입력해 주세요.</p>
        <div className="space-y-4">
          <Field label="부모 이름">
            <input
              type="text"
              value={draft.parentName}
              onChange={(e) => patch({ parentName: e.target.value })}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
              placeholder="예) 홍길동"
            />
          </Field>
          <Field label="부모 연락처">
            <input
              type="tel"
              value={draft.parentPhone}
              onChange={(e) => patch({ parentPhone: e.target.value })}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
              placeholder="010-0000-0000"
            />
          </Field>
          <Field label="입금자 이름">
            <input
              type="text"
              value={draft.depositorName}
              onChange={(e) => patch({ depositorName: e.target.value })}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
              placeholder="입금하실 분 이름"
            />
          </Field>
        </div>
      </section>

      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-xl font-bold text-slate-900">워터풀 선데이 보호자</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          폭포수 주일에 자녀와 함께 참여하실 보호자(조부모, 부모 등)를 모두 등록해 주세요. 최소 1명 이상.
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
                onChange={(e) => updateParent(idx, 'phone', e.target.value)}
                placeholder="연락처 (선택)"
                className="col-span-3 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeParent(idx)}
                className="col-span-1 h-10 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 font-bold"
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
          className="mt-4 w-full py-3 border-2 border-dashed border-slate-300 text-slate-600 hover:border-cyan-400 hover:text-cyan-600 rounded-lg font-semibold transition-colors"
        >
          + 보호자 추가
        </button>
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

// ─── Step 2: 자녀 정보 + 실시간 부서 매핑 ───
interface Step2Props {
  draft: DraftState;
  configs: Record<DepartmentId, EventConfig | null>;
  posters: Record<DepartmentId, string | null>;
  patchChild: (uid: string, partial: Partial<ChildDraft>) => void;
  addChild: () => void;
  removeChild: (uid: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

function Step2({ draft, configs, posters, patchChild, addChild, removeChild, onPrev, onNext }: Step2Props) {
  return (
    <div className="space-y-6">
      {draft.children.map((child, idx) => (
        <ChildCard
          key={child.uid}
          index={idx}
          child={child}
          configs={configs}
          posters={posters}
          patchChild={patchChild}
          removable={draft.children.length > 1}
          onRemove={() => removeChild(child.uid)}
        />
      ))}

      <button
        type="button"
        onClick={addChild}
        className="w-full py-4 border-2 border-dashed border-slate-300 text-slate-600 hover:border-cyan-400 hover:text-cyan-600 rounded-2xl font-semibold transition-colors"
      >
        + 자녀 추가
      </button>

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          className="px-8 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors"
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
  configs: Record<DepartmentId, EventConfig | null>;
  posters: Record<DepartmentId, string | null>;
  patchChild: (uid: string, partial: Partial<ChildDraft>) => void;
  removable: boolean;
  onRemove: () => void;
}

function ChildCard({ index, child, configs, posters, patchChild, removable, onRemove }: ChildCardProps) {
  const suggestion = useMemo(() => suggestDepartment(child.birthDate), [child.birthDate]);
  const activeConfig = child.department ? configs[child.department] : null;
  const activePoster = child.department ? posters[child.department] : null;

  return (
    <section className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-slate-900">자녀 {index + 1}</h3>
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
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
          />
        </Field>

        <Field label="생년월일">
          <input
            type="date"
            value={child.birthDate}
            onChange={(e) => patchChild(child.uid, { birthDate: e.target.value })}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
          />
        </Field>

        <Field label="성별">
          <div className="flex gap-2">
            <label className={`flex-1 text-center py-3 rounded-lg border cursor-pointer transition-colors ${
              child.gender === 'male' ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-white text-slate-700 border-slate-300'
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
              child.gender === 'female' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-slate-700 border-slate-300'
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

        <Field label="부서">
          <select
            value={child.department}
            onChange={(e) => patchChild(child.uid, {
              department: e.target.value as DepartmentId,
              subDepartment: '',
            })}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
          >
            <option value="">선택</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
          {suggestion && !child.department && (
            <p className="mt-2 text-xs text-amber-600">
              💡 추천: <strong>{DEPARTMENTS.find(d => d.id === suggestion.recommended)?.label}</strong> ({suggestion.reason})
            </p>
          )}
          {suggestion && child.department && child.department !== suggestion.recommended && (
            <p className="mt-2 text-xs text-slate-500">
              ⓘ 만 {suggestion.age}세 자동 추천: {DEPARTMENTS.find(d => d.id === suggestion.recommended)?.label}
            </p>
          )}
        </Field>

        {activeConfig && (
          <Field label="세부 부서">
            {activeConfig.subDepartments && activeConfig.subDepartments.length > 0 ? (
              <select
                value={child.subDepartment}
                onChange={(e) => patchChild(child.uid, { subDepartment: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
              >
                <option value="">선택</option>
                {activeConfig.subDepartments.map((sd) => (
                  <option key={sd.id} value={sd.id}>{sd.label}</option>
                ))}
              </select>
            ) : (
              <div className="px-4 py-3 border border-amber-300 bg-amber-50 text-amber-800 text-sm rounded-lg">
                세부 부서 정보가 아직 설정되지 않았습니다. 관리자에게 문의해 주세요.
              </div>
            )}
          </Field>
        )}

        {activeConfig && activeConfig.tshirtSizes?.length > 0 && (
          <Field label="셔츠 사이즈">
            <select
              value={child.tshirtSize}
              onChange={(e) => patchChild(child.uid, { tshirtSize: e.target.value })}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
            >
              <option value="">선택</option>
              {activeConfig.tshirtSizes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
        )}
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
                  checked ? 'bg-cyan-100 border-cyan-400 text-cyan-700' : 'bg-white border-slate-300 text-slate-600'
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

        <label className="flex items-center mt-4 gap-2">
          <input
            type="checkbox"
            checked={child.attendsWaterpark}
            onChange={(e) => patchChild(child.uid, { attendsWaterpark: e.target.checked })}
            className="w-4 h-4 accent-cyan-500"
          />
          <span className="text-sm text-slate-700">물놀이 참석 (보호자 동반 시 추가 요금)</span>
        </label>
      </div>

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
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                />
              )}
              {f.type === 'textarea' && (
                <textarea
                  value={child.customFields[`custom_${f.columnIndex}`] || ''}
                  onChange={(e) => patchChild(child.uid, {
                    customFields: { ...child.customFields, [`custom_${f.columnIndex}`]: e.target.value },
                  })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                  rows={3}
                />
              )}
              {f.type === 'select' && (
                <select
                  value={child.customFields[`custom_${f.columnIndex}`] || ''}
                  onChange={(e) => patchChild(child.uid, {
                    customFields: { ...child.customFields, [`custom_${f.columnIndex}`]: e.target.value },
                  })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
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
              <h4 className="text-lg md:text-xl font-bold mt-1 text-slate-900 leading-tight">
                {activeConfig.title}
              </h4>
              {activeConfig.subtitle && (
                <p className="text-sm text-slate-700 mt-2">{activeConfig.subtitle}</p>
              )}
              {activeConfig.scripture && (
                <p className="text-xs italic text-slate-600 mt-2">"{activeConfig.scripture}"</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Step 3: 확인 ───
function Step3({
  draft, grandTotal, onPrev, onSubmit, submitting,
}: {
  draft: DraftState;
  grandTotal: number;
  onPrev: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <h2 className="text-xl font-bold mb-4 text-slate-900">신청 내용 확인</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between border-b pb-2">
            <dt className="text-slate-500">부모</dt>
            <dd className="font-semibold">{draft.parentName} ({draft.parentPhone})</dd>
          </div>
          <div className="flex justify-between border-b pb-2">
            <dt className="text-slate-500">입금자</dt>
            <dd className="font-semibold">{draft.depositorName}</dd>
          </div>
          <div className="flex justify-between border-b pb-2">
            <dt className="text-slate-500">워터풀 보호자</dt>
            <dd className="font-semibold text-right">
              {draft.waterfallParents.map((p) => `${p.name}(${p.relation})`).join(', ')}
            </dd>
          </div>
          <div className="flex justify-between border-b pb-2">
            <dt className="text-slate-500">자녀</dt>
            <dd className="font-semibold text-right">
              {draft.children.map((c) => `${c.name}(${c.department})`).join(', ')}
            </dd>
          </div>
        </dl>
        <div className="mt-6 pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-slate-700">합계</span>
            <span className="text-3xl font-extrabold text-cyan-600">
              {grandTotal.toLocaleString()}원
            </span>
          </div>
        </div>
      </section>

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          className="px-8 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors"
          disabled={submitting}
        >
          ← 이전
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg shadow-md transition-colors disabled:bg-slate-400"
        >
          {submitting ? '제출 중...' : '신청 완료'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
