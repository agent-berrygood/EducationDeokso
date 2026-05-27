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
  title: "2026 나우키즈 여름성경학교",
  eventType: "여름성경학교",
  subtitle: "<p>기쁨으로 충만한 <strong>나우키즈 바이블 스토리</strong> 캠프!</p>",
  scripture: "<p><em>\"주께서 생명의 길을 내게 보이시리니 주의 앞에는 충만한 기쁨이 있고\"</em> (시편 16:11)</p>",
  primaryColor: "#3B82F6", // Blue 500
  bgColor: "#DBEAFE", // Blue 100
};

export default function KidsPage() {
  const [config, setConfig] = useState<EventConfig>(DEFAULT_CONFIG);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, 'config', 'events_kids');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig(prev => ({ ...prev, ...docSnap.data() }));
        }
      } catch (err) {
        console.error("Error fetching kids event configuration:", err);
      }
    };
    fetchConfig();
  }, []);

  return (
    <>
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative border border-slate-700 text-white">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-3xl transition-colors z-10"
            >
              &times;
            </button>
            <div className="p-8">
              <ApplicationForm />
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
          <span className="text-sm font-semibold px-4 py-1.5 rounded-full bg-blue-100 text-blue-850 uppercase tracking-wider">
            👦 {config.eventType}
          </span>
        </nav>

        {/* Hero Banner Section */}
        <main className="container mx-auto px-6 mt-10 max-w-5xl">
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 p-8 md:p-16 text-center space-y-8">
            <div
              className="inline-block px-6 py-2 rounded-full text-sm font-bold tracking-widest uppercase mb-4"
              style={{ backgroundColor: `${config.primaryColor}20`, color: config.primaryColor }}
            >
              NOW KIDS (아동부 부서)
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
              className="p-8 md:p-12 rounded-2xl bg-blue-50/50 border-l-4 border-blue-400 text-left my-8"
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
