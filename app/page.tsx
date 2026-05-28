'use client';

import React from 'react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="bg-slate-900 text-white min-h-screen font-sans flex flex-col justify-between">
      <main className="container mx-auto px-6 py-12 flex-1 flex flex-col justify-center items-center">
        <header className="text-center max-w-3xl">
          <p className="text-cyan-400 text-lg md:text-xl font-semibold mb-4 tracking-widest uppercase">
            High Will Deokso Church
          </p>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-cyan-400 leading-tight">
            2026 지금세대교육부<br />여름 캠프
          </h1>
          <p className="text-slate-300 text-lg md:text-xl mb-12 leading-relaxed">
            나우킨더 · 나우키즈 · 나우틴즈가 함께하는<br />
            여름성경학교와 여름수련회를 시작합니다.
          </p>

          <Link
            href="/apply"
            className="inline-block px-12 py-5 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-xl md:text-2xl rounded-full shadow-2xl shadow-cyan-500/40 transform hover:scale-105 transition-all duration-300 ease-in-out cursor-pointer"
          >
            2026 지금세대교육부 여름 캠프 신청하기 →
          </Link>
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
          &copy; {new Date().getFullYear()} High Will Deokso Church. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
