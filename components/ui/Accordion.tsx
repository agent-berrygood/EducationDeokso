'use client';

import React, { useState } from 'react';

interface AccordionProps {
  title: string;
  icon?: string;
  defaultOpen?: boolean;
  dark?: boolean;
  children: React.ReactNode;
}

/**
 * 설정 페이지처럼 섹션이 많은 화면에서 한 화면에 모든 카드가 펼쳐져
 * 스크롤이 길어지는 문제를 완화하기 위한 접이식 섹션 래퍼.
 */
export default function Accordion({ title, icon, defaultOpen = false, dark = false, children }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-3 p-6 text-left cursor-pointer ${open ? 'border-b' : ''} ${dark ? 'border-slate-800' : ''}`}
        aria-expanded={open}
      >
        <h3 className="text-xl font-bold">{icon ? `${icon} ` : ''}{title}</h3>
        <span className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && <div className="p-6 pt-4">{children}</div>}
    </div>
  );
}
