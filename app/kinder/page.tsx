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
  title: "2026 나우킨더 여름성경학교",
  eventType: "여름성경학교",
  subtitle: "<p>예수님 안에서 자라나는 <strong>나우킨더 바이블 캠프</strong>!</p>",
  scripture: "<p><em>\"오직 우리 주 곧 구주 예수 그리스도의 은혜와 그를 아는 지식에서 자라 가라\"</em> (베드로후서 3:18)</p>",
  primaryColor: "#EAB308", // Yellow 500
  bgColor: "#FEF08A", // Yellow 200
};

export default function KinderPage() {
  const [config, setConfig] = useState<EventConfig>(DEFAULT_CONFIG);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, 'config', 'events_kinder');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig(prev => ({ ...prev, ...docSnap.data() }));
        }
      } catch (err) {
        console.error("Error fetching kinder event configuration:", err);
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
              <ApplicationForm department="kinder" onClose={() => setShowForm(false)} />
            </div>
          </div>
        </div>
      )}

      <div
        className="min-h-screen font-sans transition-all duration-500 pb-20"
        style={{
          backgroundColor: `${config.bgColor}15`, // extremely soft background tint
          borderColor: config.primaryColor,
          '--primary-color': config.primaryColor,
        } as React.CSSProperties}
      >
        {/* Header Navigation */}
        <nav className="container mx-auto px-6 py-6 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span style={{ color: config.primaryColor }}>🏠</span> 지금세대 홈으로
          </Link>
          <span className="text-sm font-semibold px-4 py-1.5 rounded-full bg-yellow-100 text-yellow-800 uppercase tracking-wider">
            👶 {config.eventType}
          </span>
        </nav>

        {/* Hero Banner Section */}
        <main className="container mx-auto px-6 mt-10 max-w-5xl">
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 p-8 md:p-16 text-center space-y-8">
            <div
              className="inline-block px-6 py-2 rounded-full text-sm font-bold tracking-widest uppercase mb-4"
              style={{ backgroundColor: `${config.primaryColor}20`, color: config.primaryColor }}
            >
              NOW KINDER (미취학 부서)
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight">
              {config.title}
            </h1>

            {/* Subtitle rendered as Tiptap HTML */}
            <div
              className="text-lg md:text-2xl text-gray-600 prose max-w-none mx-auto"
              dangerouslySetInnerHTML={{ __html: config.subtitle }}
            />

            {/* Scripture Highlight banner */}
            <div
              className="p-8 md:p-12 rounded-2xl bg-yellow-50/50 border-l-4 border-yellow-400 text-left my-8"
              style={{ borderLeftColor: config.primaryColor, backgroundColor: `${config.primaryColor}08` }}
            >
              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">올해의 주제 성구</h4>
              <div
                className="text-lg md:text-xl font-medium text-gray-700 italic leading-relaxed prose max-w-none"
                dangerouslySetInnerHTML={{ __html: config.scripture }}
              />
            </div>

            <button
              onClick={() => setShowForm(true)}
              className="px-12 py-5 text-white font-bold text-xl rounded-full shadow-lg transform hover:scale-105 transition-all duration-300 cursor-pointer"
              style={{
                backgroundColor: config.primaryColor,
                boxShadow: `0 10px 20px -5px ${config.primaryColor}50`
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
