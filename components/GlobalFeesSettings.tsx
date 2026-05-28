'use client';

import React, { useEffect, useState } from 'react';
import type { FeesConfig } from '@/lib/types';

interface FormState {
  kinder: string;
  kids: string;
  teens: string;
  childWaterpark: string;
  parentWaterpark: string;
  kinderAccount: string;
  kidsAccount: string;
  teensAccount: string;
  waterparkAccount: string;
}

const empty: FormState = {
  kinder: '', kids: '', teens: '',
  childWaterpark: '', parentWaterpark: '',
  kinderAccount: '', kidsAccount: '', teensAccount: '', waterparkAccount: '',
};

function fromFees(f: FeesConfig | null): FormState {
  if (!f) return empty;
  return {
    kinder: String(f.kinder ?? ''),
    kids: String(f.kids ?? ''),
    teens: String(f.teens ?? ''),
    childWaterpark: String(f.child_waterpark ?? ''),
    parentWaterpark: String(f.parent_waterpark ?? ''),
    kinderAccount: f.kinder_account ?? '',
    kidsAccount: f.kids_account ?? '',
    teensAccount: f.teens_account ?? '',
    waterparkAccount: f.waterpark_account ?? '',
  };
}

export default function GlobalFeesSettings() {
  const [form, setForm] = useState<FormState>(empty);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    try {
      setLoading(true);
      const res = await fetch('/api/fees');
      const json = await res.json();
      if (json.success) setForm(fromFees(json.data));
    } catch {
      setError('요금 설정 로드 실패');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    setError('');
    setSuccess('');
    try {
      setSaving(true);
      const res = await fetch('/api/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kinder: form.kinder,
          kids: form.kids,
          teens: form.teens,
          childWaterpark: form.childWaterpark,
          parentWaterpark: form.parentWaterpark,
          kinderAccount: form.kinderAccount.trim(),
          kidsAccount: form.kidsAccount.trim(),
          teensAccount: form.teensAccount.trim(),
          waterparkAccount: form.waterparkAccount.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || '저장 실패');
        return;
      }
      setForm(fromFees(json.data));
      setSuccess('저장되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">불러오는 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">글로벌 요금 & 계좌 설정</h2>
        <p className="text-sm text-slate-500 mt-1">
          모든 부서에 공통 적용되는 회비/입장료/계좌를 설정합니다. 부서별 설정 페이지의 색상·세부부서와는 별개입니다.
        </p>
      </div>

      {error && <Banner kind="error">{error}</Banner>}
      {success && <Banner kind="success">{success}</Banner>}

      {/* 부서별 회비 */}
      <Card title="부서별 회비" description="성경학교 또는 수련회의 부서별 1인 참가비입니다.">
        <Grid>
          <MoneyField label="나우킨더 회비 (1인)" value={form.kinder} onChange={(v) => set('kinder', v)} />
          <MoneyField label="나우키즈 회비 (1인)" value={form.kids} onChange={(v) => set('kids', v)} />
          <MoneyField label="나우틴즈 회비 (1인)" value={form.teens} onChange={(v) => set('teens', v)} />
        </Grid>
      </Card>

      {/* 워터풀선데이 입장료 */}
      <Card title="워터풀선데이 입장료" description="자녀와 학부모를 분리하여 책정할 수 있습니다.">
        <Grid cols={2}>
          <MoneyField
            label="자녀 1인 입장료"
            value={form.childWaterpark}
            onChange={(v) => set('childWaterpark', v)}
            hint="자녀의 워터풀 참석 체크 시 합계에 1회 가산"
          />
          <MoneyField
            label="학부모 1인 입장료"
            value={form.parentWaterpark}
            onChange={(v) => set('parentWaterpark', v)}
            hint="등록된 워터풀 보호자 수 × 단가로 합계에 가산"
          />
        </Grid>
      </Card>

      {/* 입금 계좌 */}
      <Card title="입금 계좌" description="신청 확인 화면에 입금 안내로 노출됩니다.">
        <Grid>
          <AccountField
            label="나우킨더 회비 계좌"
            value={form.kinderAccount}
            onChange={(v) => set('kinderAccount', v)}
          />
          <AccountField
            label="나우키즈 회비 계좌"
            value={form.kidsAccount}
            onChange={(v) => set('kidsAccount', v)}
          />
          <AccountField
            label="나우틴즈 회비 계좌"
            value={form.teensAccount}
            onChange={(v) => set('teensAccount', v)}
          />
        </Grid>
        <div className="mt-4">
          <AccountField
            label="워터풀선데이 입장료 계좌"
            value={form.waterparkAccount}
            onChange={(v) => set('waterparkAccount', v)}
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-lg shadow-md transition-colors disabled:bg-slate-400"
        >
          {saving ? '저장 중...' : '글로벌 설정 저장'}
        </button>
      </div>
    </div>
  );
}

// ── 하위 UI 컴포넌트 ─────────────────────────────────────────
function Card({
  title, description, children,
}: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 mb-4">{description}</p>}
      {children}
    </section>
  );
}

function Grid({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 }) {
  const cls = cols === 2 ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'grid grid-cols-1 md:grid-cols-3 gap-4';
  return <div className={cls}>{children}</div>;
}

function MoneyField({
  label, value, onChange, hint,
}: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</span>
      <div className="relative">
        <input
          type="number"
          min="0"
          step="100"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none text-right"
          placeholder="0"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">원</span>
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </label>
  );
}

function AccountField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="예) 국민은행 123-45-6789 홍길동"
        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
      />
    </label>
  );
}

function Banner({ kind, children }: { kind: 'error' | 'success'; children: React.ReactNode }) {
  const cls = kind === 'error'
    ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return (
    <div className={`border ${cls} px-4 py-3 rounded-lg text-sm`}>
      {children}
    </div>
  );
}
