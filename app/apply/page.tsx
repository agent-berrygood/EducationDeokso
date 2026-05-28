'use client';

import React from 'react';
import Link from 'next/link';
import ApplyWizard from '@/components/ApplyWizard';

export default function ApplyPage() {
  return (
    <div className="bg-slate-50 min-h-screen">
      <header className="bg-slate-900 text-white py-5 sticky top-0 z-10 shadow-md">
        <div className="container mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <span className="text-2xl font-bold">←</span>
            <div>
              <h1 className="text-lg font-bold">2026 지금세대교육부 여름 캠프</h1>
              <p className="text-xs text-cyan-300">High Will Deokso Church</p>
            </div>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8">
        <ApplyWizard />
      </main>
    </div>
  );
}
