'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { DepartmentId, WaterfallParent, WaterfallRelation, FeesConfig, Gender } from '@/lib/types';
import { waterparkApplicationSubmitSchema } from '@/lib/schemas';
import { getPresetSubDepartments } from '@/lib/subDepartments';

const RELATIONS: WaterfallRelation[] = ['부', '모', '조부', '조모', '기타'];
const DEPARTMENTS: { id: DepartmentId; label: string }[] = [
  { id: 'kinder', label: '나우킨더' },
  { id: 'kids', label: '나우키즈' },
  { id: 'teens', label: '나우틴즈' },
];

function formatPhoneNumber(val: string): string {
  const clean = val.replace(/\D/g, '');
  if (clean.length <= 3) return clean;
  if (clean.length <= 7) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7, 11)}`;
}

/** 세부부서 id → 소속 대부서 id (프리셋 기반 역매핑) */
function departmentForSubDepartment(subId: string): DepartmentId | '' {
  if (!subId) return '';
  for (const d of DEPARTMENTS) {
    if (getPresetSubDepartments(d.id).some((sd) => sd.id === subId)) return d.id;
  }
  return '';
}

interface ChildDraft {
  uid: string;
  name: string;
  gender: Gender | '';
  birthDate: string;
  subDepartment: string;
  department: DepartmentId | '';
}

const makeChild = (): ChildDraft => ({
  uid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '', gender: '', birthDate: '', subDepartment: '', department: '',
});

export default function WaterparkApplyPage() {
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [depositorName, setDepositorName] = useState('');
  const [children, setChildren] = useState<ChildDraft[]>([makeChild()]);
  const [parents, setParents] = useState<WaterfallParent[]>([{ name: '', relation: '모', phone: '' }]);
  const [fees, setFees] = useState<FeesConfig | null>(null);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/fees');
        const json = await res.json();
        if (json.success) setFees(json.data);
      } catch {}
    })();
  }, []);

  const childUnit = Number(fees?.child_waterpark || 0);
  const parentUnit = Number(fees?.parent_waterpark || 0);
  const grandTotal = useMemo(
    () => children.length * childUnit + parents.length * parentUnit,
    [children.length, parents.length, childUnit, parentUnit]
  );
  const waterparkAccount = fees?.waterpark_account?.trim() || null;

  function patchChild(uid: string, partial: Partial<ChildDraft>) {
    setChildren((cs) => cs.map((c) => (c.uid === uid ? { ...c, ...partial } : c)));
  }
  function updateParent(idx: number, field: keyof WaterfallParent, value: string) {
    setParents((ps) => ps.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  async function handleSubmit() {
    setError('');
    if (!parentName.trim()) return setError('보호자 이름을 입력하세요');
    if (!parentPhone.trim()) return setError('보호자 연락처를 입력하세요');
    if (!depositorName.trim()) return setError('입금자 이름을 입력하세요');
    for (const c of children) {
      if (!c.name.trim()) return setError('참가 자녀 이름을 모두 입력하세요');
    }
    const validParents = parents.filter((p) => p.name.trim() && p.phone?.trim());
    if (validParents.length === 0) return setError('동반 보호자를 1명 이상(이름·연락처) 입력하세요');
    if (!agreedPrivacy) return setError('개인정보 수집·이용에 동의해주세요.');

    const payload = {
      parentName: parentName.trim(),
      parentPhone: parentPhone.trim(),
      depositorName: depositorName.trim(),
      waterfallParents: validParents,
      grandTotal,
      children: children.map((c) => ({
        name: c.name.trim(),
        gender: (c.gender || undefined) as Gender | undefined,
        birthDate: c.birthDate || undefined,
        department: (c.department || undefined) as DepartmentId | undefined,
        subDepartment: c.subDepartment || undefined,
      })),
    };

    const check = waterparkApplicationSubmitSchema.safeParse(payload);
    if (!check.success) return setError('입력값 검증 실패: ' + check.error.issues[0]?.message);

    setSubmitting(true);
    try {
      const res = await fetch('/api/waterpark-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || '제출 실패');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('네트워크 오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = 'w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none text-black';

  if (submitted) {
    return (
      <div className="bg-slate-50 min-h-screen py-12 px-4">
        <div className="max-w-lg mx-auto bg-white p-8 rounded-2xl shadow-sm border text-center">
          <div className="text-6xl mb-4">💦</div>
          <h2 className="text-2xl font-bold text-black mb-2">워터풀선데이 신청이 완료되었습니다</h2>
          <p className="text-black mb-6">감사합니다. 신청 내용이 정상적으로 접수되었습니다.</p>
          <Link href="/" className="text-sm text-black hover:text-cyan-600 underline">메인 페이지로 돌아가기</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <header className="bg-slate-900 text-white py-5 sticky top-0 z-10 shadow-md">
        <div className="container mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <span className="text-2xl font-bold">←</span>
            <div>
              <h1 className="text-lg font-bold">💦 워터풀선데이 신청</h1>
              <p className="text-xs text-cyan-300">GODS WILL</p>
            </div>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <section className="bg-cyan-50 border border-cyan-200 rounded-2xl p-5 text-sm text-slate-700">
            성경학교와 별개로 <strong>워터풀선데이만</strong> 신청하는 양식입니다. 참가할 자녀와 함께 입장할
            동반 보호자를 등록해 주세요.
          </section>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
          )}

          {/* 보호자 정보 */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-xl font-bold mb-4 text-black">보호자 정보</h2>
            <div className="space-y-4">
              <Field label="보호자 이름">
                <input type="text" value={parentName} onChange={(e) => setParentName(e.target.value)} className={inputCls} placeholder="예) 홍길동" />
              </Field>
              <Field label="보호자 연락처">
                <input type="tel" value={parentPhone} onChange={(e) => setParentPhone(formatPhoneNumber(e.target.value))} className={inputCls} placeholder="010-0000-0000" />
              </Field>
              <Field label="입금자 이름">
                <input type="text" value={depositorName} onChange={(e) => setDepositorName(e.target.value)} className={inputCls} placeholder="입금하실 분 이름" />
              </Field>
            </div>
          </section>

          {/* 참가 자녀 */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-xl font-bold mb-1 text-black">참가 자녀</h2>
            <p className="text-sm text-black mb-4">워터풀선데이에 참가할 자녀 정보를 입력해 주세요.</p>
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-4 text-sm text-sky-900 leading-relaxed">
              💡 우리 교회 친구가 아닌 어린이도 함께 참여할 수 있어요! 다만 재정 지원은 <strong>우리 교회 소속 어린이</strong>에게 적용되는 점 양해 부탁드립니다.
              이 경우 아래 <strong>&lsquo;동반 보호자&rsquo;</strong>로 등록해 주시면 되며, 워터파크 요금은 <strong>부모님과 동일한 금액</strong>으로 안내드리고 있어요.
            </div>
            <div className="space-y-4">
              {children.map((c, idx) => (
                <div key={c.uid} className="border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-black">자녀 {idx + 1}</h3>
                    {children.length > 1 && (
                      <button type="button" onClick={() => setChildren((cs) => cs.filter((x) => x.uid !== c.uid))} className="text-sm text-red-600 hover:text-red-700 font-semibold">삭제</button>
                    )}
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="이름">
                      <input type="text" value={c.name} onChange={(e) => patchChild(c.uid, { name: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="성별">
                      <div className="flex gap-2">
                        <label className={`flex-1 text-center py-3 rounded-lg border cursor-pointer transition-colors ${c.gender === 'male' ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-white text-black border-slate-300'}`}>
                          <input type="radio" name={`g-${c.uid}`} checked={c.gender === 'male'} onChange={() => patchChild(c.uid, { gender: 'male' })} className="hidden" />남
                        </label>
                        <label className={`flex-1 text-center py-3 rounded-lg border cursor-pointer transition-colors ${c.gender === 'female' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-black border-slate-300'}`}>
                          <input type="radio" name={`g-${c.uid}`} checked={c.gender === 'female'} onChange={() => patchChild(c.uid, { gender: 'female' })} className="hidden" />여
                        </label>
                      </div>
                    </Field>
                    <Field label="생년월일 (선택)">
                      <input type="date" value={c.birthDate} onChange={(e) => patchChild(c.uid, { birthDate: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="부서 (선택)">
                      <select
                        value={c.subDepartment}
                        onChange={(e) => {
                          const newSub = e.target.value;
                          patchChild(c.uid, { subDepartment: newSub, department: departmentForSubDepartment(newSub) });
                        }}
                        className={`${inputCls} bg-white`}
                      >
                        <option value="">선택 안 함</option>
                        {DEPARTMENTS.map((d) => (
                          <optgroup key={d.id} label={d.label}>
                            {getPresetSubDepartments(d.id).map((sd) => (
                              <option key={sd.id} value={sd.id}>{sd.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setChildren((cs) => [...cs, makeChild()])} className="mt-4 w-full py-3 border-2 border-dashed border-slate-300 text-black hover:border-cyan-400 hover:text-cyan-600 rounded-xl font-semibold transition-colors">
              + 자녀 추가
            </button>
          </section>

          {/* 동반 보호자 */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-cyan-200">
            <h2 className="text-xl font-bold text-black">💦 워터풀선데이 동반 보호자</h2>
            <p className="text-sm text-black mt-1 mb-4">자녀와 함께 입장하실 보호자를 모두 등록해 주세요. 최소 1명 이상.</p>
            <div className="space-y-3">
              {parents.map((p, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                  <input type="text" value={p.name} onChange={(e) => updateParent(idx, 'name', e.target.value)} placeholder="이름" className="col-span-5 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none" />
                  <select value={p.relation} onChange={(e) => updateParent(idx, 'relation', e.target.value)} className="col-span-3 px-2 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none">
                    {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <input type="tel" value={p.phone || ''} onChange={(e) => updateParent(idx, 'phone', formatPhoneNumber(e.target.value))} placeholder="연락처 (필수)" className="col-span-3 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none" />
                  <button type="button" onClick={() => setParents((ps) => ps.length === 1 ? ps : ps.filter((_, i) => i !== idx))} className="col-span-1 h-10 rounded-lg bg-slate-100 hover:bg-red-100 text-black hover:text-red-600 font-bold" aria-label="보호자 삭제">✕</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setParents((ps) => [...ps, { name: '', relation: '부', phone: '' }])} className="mt-4 w-full py-3 border-2 border-dashed border-slate-300 text-black hover:border-cyan-400 hover:text-cyan-600 rounded-lg font-semibold transition-colors">
              + 보호자 추가
            </button>
          </section>

          {/* 금액 · 계좌 */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border">
            <h3 className="text-lg font-bold text-black mb-4">금액 내역</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-black">워터풀 자녀 <span className="text-slate-400 ml-1">({children.length}명 × {childUnit.toLocaleString()}원)</span></dt>
                <dd className="font-semibold">{(children.length * childUnit).toLocaleString()}원</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-black">워터풀 보호자 <span className="text-slate-400 ml-1">({parents.length}명 × {parentUnit.toLocaleString()}원)</span></dt>
                <dd className="font-semibold">{(parents.length * parentUnit).toLocaleString()}원</dd>
              </div>
            </dl>
            <div className="mt-4 pt-4 border-t flex justify-between items-center">
              <span className="text-lg font-semibold text-black">합계</span>
              <span className="text-3xl font-extrabold text-cyan-600">{grandTotal.toLocaleString()}원</span>
            </div>
            <div className="mt-4 rounded-lg p-4 border-2 border-cyan-200 bg-slate-50">
              <p className="text-xs text-black">워터풀선데이 입장료 입금 계좌</p>
              <p className="font-semibold text-black mt-1 break-all">
                {waterparkAccount || <span className="text-slate-400 italic">관리자에게 문의해 주세요.</span>}
              </p>
              <p className="text-xs font-bold text-amber-700 mt-1">✍️ 입금자명: &quot;{depositorName || '입금자 이름'}&quot;</p>
            </div>
          </section>

          {/* 개인정보 동의 */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border">
            <h3 className="text-base font-bold text-black mb-2">개인정보 수집·이용 동의</h3>
            <div className="text-xs text-black leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 space-y-1">
              <p>· 수집 항목: 보호자·자녀 성명, 연락처, 생년월일, 입금자명</p>
              <p>· 수집 목적: 워터풀선데이 신청 접수 및 운영, 안전 관리, 입장료 정산</p>
              <p>· 보유·이용 기간: <strong>행사 종료 후 즉시 파기</strong>합니다.</p>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={agreedPrivacy} onChange={(e) => setAgreedPrivacy(e.target.checked)} className="w-5 h-5 accent-emerald-500 mt-0.5" />
              <span className="text-sm font-semibold text-slate-800">위 개인정보 수집·이용에 동의합니다. <span className="text-red-500">(필수)</span></span>
            </label>
          </section>

          <button type="button" onClick={handleSubmit} disabled={submitting || !agreedPrivacy} className="w-full py-4 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl shadow-md transition-colors">
            {submitting ? '제출 중...' : '💦 워터풀선데이 신청 제출하기'}
          </button>
        </div>
      </main>
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
