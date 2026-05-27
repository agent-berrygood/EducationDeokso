'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import ApplicationForm from '@/components/ApplicationForm';

interface EventConfig {
  title: string;
  eventType: string;
  subtitle: string;
  scripture: string;
  primaryColor?: string;
  bgColor?: string;
}

const DEFAULT_CONFIG: EventConfig = {
  title: "2026 나우틴즈 여름수련회",
  eventType: "여름수련회",
  subtitle: "<p>어두운 세상에서 그리스도의 빛을 발하는 <strong>나우틴즈 네온 캠프</strong>!</p>",
  scripture: "<p><em>\"너희는 세상의 빛이라 산 위에 있는 동네가 숨겨지지 못할 것이요\"</em> (마태복음 5:14)</p>",
  primaryColor: "#22C55E", // Green 500 (Neon-like)
  bgColor: "#0F172A", // Dark Slate 900 base
};

export default function TeensPage() {
  const [config, setConfig] = useState<EventConfig>(DEFAULT_CONFIG);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, 'config', 'events_teens');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig(prev => ({ ...prev, ...docSnap.data() }));
        }
      } catch (err) {
        console.error("Error fetching teens event configuration:", err);
      }
    };
    fetchConfig();
  }, []);

  return (
    <>
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative border border-slate-700 text-white">
            <div className="p-8">
              <ApplicationForm department="teens" onClose={() => setShowForm(false)} />
            </div>
          </div>
        </div>
      )}

      <div
        className="min-h-screen font-sans transition-all duration-500 pb-20 text-white bg-slate-950"
        style={{
          '--primary-color': config.primaryColor,
        } as React.CSSProperties}
      >
        {/* Header Navigation */}
        <nav className="container mx-auto px-6 py-6 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span style={{ color: config.primaryColor }}>🏠</span> 지금세대 홈으로
          </Link>
          <span
            className="text-sm font-semibold px-4 py-1.5 rounded-full uppercase tracking-wider bg-slate-800 border border-slate-700"
            style={{ color: config.primaryColor }}
          >
            🧑 {config.eventType}
          </span>
        </nav>

        {/* Hero Banner Section */}
        <main className="container mx-auto px-6 mt-10 max-w-5xl">
          <div
            className="rounded-3xl shadow-2xl overflow-hidden p-8 md:p-16 text-center space-y-8 bg-slate-900 border"
            style={{ borderColor: `${config.primaryColor}30` }}
          >
            <div
              className="inline-block px-6 py-2 rounded-full text-sm font-bold tracking-widest uppercase mb-4 border"
              style={{
                borderColor: `${config.primaryColor}50`,
                backgroundColor: `${config.primaryColor}10`,
                color: config.primaryColor
              }}
            >
              NOW TEENS (중고등부 부서)
            </div>

            <h1
              className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(to right, #ffffff, ${config.primaryColor})`
              }}
            >
              {config.title}
            </h1>

            {/* Subtitle rendered as Tiptap HTML */}
            <div
              className="text-lg md:text-2xl text-slate-350 prose dark:prose-invert max-w-none mx-auto"
              dangerouslySetInnerHTML={{ __html: config.subtitle }}
            />

            {/* Scripture Highlight banner */}
            <div
              className="p-8 md:p-12 rounded-2xl bg-slate-950 border-l-4 text-left my-8"
              style={{
                borderLeftColor: config.primaryColor,
                backgroundColor: '#05070c',
                boxShadow: `inset 0 0 20px ${config.primaryColor}08`
              }}
            >
              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">올해의 주제 성구</h4>
              <div
                className="text-lg md:text-xl font-medium text-slate-300 italic leading-relaxed prose dark:prose-invert max-w-none"
                style={{ '--tw-prose-body': '#cbd5e1' } as React.CSSProperties}
                dangerouslySetInnerHTML={{ __html: config.scripture }}
              />
            </div>

            <button
              onClick={() => setShowForm(true)}
              className="px-12 py-5 font-bold text-xl rounded-full shadow-lg transform hover:scale-105 transition-all duration-300 cursor-pointer text-slate-950"
              style={{
                backgroundColor: config.primaryColor,
                boxShadow: `0 10px 30px -5px ${config.primaryColor}60`
              }}
            >
              신청서 작성하기
            </button>
          </div>
        </main>
      </div>
    </>
  );
}
