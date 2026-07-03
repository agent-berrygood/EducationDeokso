'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

const DEPARTMENTS: { id: string; label: string }[] = [
  { id: 'kinder', label: '나우킨더' },
  { id: 'kids', label: '나우키즈' },
  { id: 'teens', label: '나우틴즈' },
];

interface ExternalLink {
  id: string;
  label: string;
  url: string;
}

export default function HomePage() {
  const [externalLinks, setExternalLinks] = useState<ExternalLink[]>([]);
  // 내부 신청 가능한 부서가 하나라도 있는지 (전부 외부 신청/미운영이면 내부 신청 버튼 숨김)
  const [hasInternalApply, setHasInternalApply] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const results = await Promise.all(
          DEPARTMENTS.map(async (d) => {
            try {
              const res = await fetch(`/api/config/${d.id}`);
              const json = await res.json();
              return { dept: d, data: json.success ? json.data : null };
            } catch {
              return { dept: d, data: null };
            }
          })
        );
        const links: ExternalLink[] = [];
        let anyInternal = false;
        for (const { dept, data } of results) {
          const campActive = data?.isCampActive ?? true;
          const external = data?.isExternalApply ?? false;
          const url = data?.externalApplyUrl || '';
          if (!campActive) continue; // 미운영 부서는 어느 쪽에도 노출하지 않음
          if (external) {
            links.push({ id: dept.id, label: dept.label, url: url || '#' });
          } else {
            anyInternal = true; // 내부 신청 가능한 부서 존재
          }
        }
        setExternalLinks(links);
        setHasInternalApply(anyInternal);
      } catch {
        // 실패 시 기본 동작 유지 (내부 신청 버튼 노출)
        setHasInternalApply(true);
      }
    })();
  }, []);

  return (
    <div className="bg-slate-900 text-white min-h-screen font-sans flex flex-col justify-between">
      <main className="container mx-auto px-6 py-12 flex-1 flex flex-col justify-center items-center">
        <header className="text-center max-w-3xl">
          <p className="text-cyan-400 text-lg md:text-xl font-semibold mb-4 tracking-widest uppercase">
            GODS WILL
          </p>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-cyan-400 leading-tight">
            2026 지금세대교육부<br />여름 캠프
          </h1>
          <p className="text-slate-300 text-lg md:text-xl mb-12 leading-relaxed">
            나우킨더 · 나우키즈 · 나우틴즈가 함께하는<br />
            여름성경학교와 여름수련회를 시작합니다.
          </p>

          <div className="flex flex-col items-center gap-4">
            {hasInternalApply && (
              <>
                <Link
                  href="/apply"
                  className="inline-block px-12 py-5 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-xl md:text-2xl rounded-full shadow-2xl shadow-cyan-500/40 transform hover:scale-105 transition-all duration-300 ease-in-out cursor-pointer"
                >
                  2026 지금세대교육부 여름 캠프 신청하기 →
                </Link>
                <Link
                  href="/step-apply"
                  className="inline-block px-8 py-3 bg-slate-800/50 hover:bg-slate-700/80 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 font-bold text-base md:text-lg rounded-full transition-all duration-300 cursor-pointer"
                >
                  🙋‍♂️ 스텝(봉사자) 신청하기 →
                </Link>
              </>
            )}

            {/* 외부(구글폼 등) 신청 부서 전용 링크 */}
            {externalLinks.map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-10 py-4 border-2 border-cyan-400 text-cyan-300 hover:bg-cyan-400 hover:text-slate-900 font-bold text-lg md:text-xl rounded-full transition-all duration-300 cursor-pointer"
              >
                {l.label} 신청하기 (외부 링크) →
              </a>
            ))}
          </div>
        </header>
      </main>

      <footer className="text-center py-8 border-t border-slate-800">
        <nav className="flex flex-col md:flex-row justify-center items-center gap-3 md:gap-6 text-sm">
          <Link href="/kinder" className="text-slate-500 hover:text-cyan-300 transition-colors">
            나우킨더
          </Link>
          <span className="hidden md:inline text-slate-700">·</span>
          <Link href="/kids" className="text-slate-500 hover:text-cyan-300 transition-colors">
            나우키즈
          </Link>
          <span className="hidden md:inline text-slate-700">·</span>
          <Link href="/teens" className="text-slate-500 hover:text-cyan-300 transition-colors">
            나우틴즈
          </Link>
          <span className="hidden md:inline text-slate-700">|</span>
          <Link href="/admin" className="text-slate-500 hover:text-cyan-300 transition-colors">
            관리자
          </Link>
        </nav>
        <p className="text-slate-600 mt-4 text-xs">
          &copy; {new Date().getFullYear()} GODS WILL. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
