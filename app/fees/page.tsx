import Link from 'next/link';
import { queryOne } from '@/lib/db';

// 관리자 계좌/회비 변경이 즉시 반영되도록 매 요청 렌더 (정적 캐시 방지)
export const dynamic = 'force-dynamic';

const DEPARTMENTS: { id: 'kinder' | 'kids' | 'teens'; label: string; emoji: string }[] = [
  { id: 'kinder', label: '나우킨더', emoji: '🧸' },
  { id: 'kids', label: '나우키즈', emoji: '👦' },
  { id: 'teens', label: '나우틴즈', emoji: '🔥' },
];

interface FeeRow {
  fee: number;
  account: string;
}

/** fees_config에서 계좌/회비 정보를 서버에서 직접 조회 (공개 정보). */
async function getFees() {
  try {
    const row: any = await queryOne(
      `SELECT kinder, kids, teens, child_waterpark, parent_waterpark,
              kinder_account, kids_account, teens_account, waterpark_account
         FROM fees_config LIMIT 1`
    );
    if (!row) return null;
    const num = (v: any) => Number(v || 0);
    const txt = (v: any) => (typeof v === 'string' ? v.trim() : '');
    const depts: { id: string; label: string; emoji: string; fee: number; account: string }[] = [];
    for (const d of DEPARTMENTS) {
      const fee = num(row[d.id]);
      const account = txt(row[`${d.id}_account`]);
      if (fee > 0 || account) depts.push({ ...d, fee, account });
    }
    const waterpark = {
      childFee: num(row.child_waterpark),
      parentFee: num(row.parent_waterpark),
      account: txt(row.waterpark_account),
    };
    const hasWaterpark = waterpark.childFee > 0 || waterpark.parentFee > 0 || !!waterpark.account;
    return { depts, waterpark, hasWaterpark };
  } catch {
    return null;
  }
}

function money(v: number) {
  return `${v.toLocaleString()}원`;
}

export default async function FeesPage() {
  const data = await getFees();

  return (
    <div className="bg-slate-900 text-white min-h-screen font-sans">
      {/* 헤더 */}
      <header className="border-b border-slate-800">
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 hover:text-cyan-300 transition-colors">
            ← 홈으로
          </Link>
          <span className="text-xs font-semibold tracking-widest text-cyan-400 uppercase">GODS WILL</span>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-3">💳 회비 · 입금 계좌 안내</h1>
          <p className="text-slate-300 leading-relaxed">
            2026 지금세대교육부 여름 캠프 부서별 인당 회비와 입금 계좌입니다.<br />
            입금 전 다시 한 번 확인해 주세요.
          </p>
        </div>

        {!data || (data.depts.length === 0 && !data.hasWaterpark) ? (
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-10 text-center text-slate-300">
            아직 등록된 회비·계좌 정보가 없습니다. 자세한 사항은 교회로 문의해 주세요.
          </div>
        ) : (
          <div className="space-y-4">
            {data.depts.map((d) => (
              <div key={d.id} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <span>{d.emoji}</span> {d.label}
                  </h2>
                  <span className="text-cyan-300 font-extrabold text-lg">
                    {d.fee > 0 ? money(d.fee) : '회비 미설정'}
                    {d.fee > 0 && <span className="text-xs text-slate-400 font-semibold ml-1">/ 1인</span>}
                  </span>
                </div>
                {d.account ? (
                  <div className="bg-slate-900/70 rounded-xl px-4 py-3">
                    <p className="text-xs text-slate-400 mb-0.5">입금 계좌</p>
                    <p className="font-bold text-white break-all select-all">{d.account}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">입금 계좌 미설정</p>
                )}
              </div>
            ))}

            {data.hasWaterpark && (
              <div className="bg-slate-800/60 border border-cyan-800/60 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <span>💦</span> 워터풀선데이
                  </h2>
                  <div className="text-right text-sm font-bold">
                    {data.waterpark.childFee > 0 && (
                      <div className="text-cyan-300">자녀 {money(data.waterpark.childFee)} <span className="text-xs text-slate-400 font-semibold">/ 1인</span></div>
                    )}
                    {data.waterpark.parentFee > 0 && (
                      <div className="text-cyan-300">보호자 {money(data.waterpark.parentFee)} <span className="text-xs text-slate-400 font-semibold">/ 1인</span></div>
                    )}
                  </div>
                </div>
                {data.waterpark.account ? (
                  <div className="bg-slate-900/70 rounded-xl px-4 py-3">
                    <p className="text-xs text-slate-400 mb-0.5">입금 계좌</p>
                    <p className="font-bold text-white break-all select-all">{data.waterpark.account}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">입금 계좌 미설정</p>
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-slate-500 mt-10">
          계좌 정보는 교회 관리자가 설정한 값이며 예고 없이 변경될 수 있습니다.
        </p>
      </main>
    </div>
  );
}
