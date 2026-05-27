import React from 'react';

interface SurveyFormPlaceholderProps {
  department: 'kinder' | 'kids' | 'teens';
}

export const SurveyFormPlaceholder: React.FC<SurveyFormPlaceholderProps> = ({ department }) => {
  const deptNames = {
    kinder: '나우킨더 (미취학)',
    kids: '나우키즈 (초등부)',
    teens: '나우틴즈 (중고등부)',
  };

  return (
    <div className="p-8 border border-dashed border-gray-300 rounded-2xl bg-gray-50/50 text-center space-y-6">
      <div className="text-5xl">📊</div>
      <div className="space-y-2">
        <h3 className="text-2xl font-bold text-gray-800">{deptNames[department]} 설문조사 모듈</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          본 영역은 수련회 및 캠프 사후 피드백, 교사 평가 등을 위해 실시간 설문을 개설하고 관리할 수 있도록 설계된 확장 인프라 공간입니다.
        </p>
      </div>
      
      {/* Visual Roadmap Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-lg mx-auto text-left space-y-3">
        <h4 className="font-bold text-indigo-600">🛠️ 2단계 추가 구축 예정 로드맵</h4>
        <ul className="text-sm text-gray-600 space-y-1.5 list-disc list-inside">
          <li><strong>동적 설문 개설기</strong>: 객관식/주관식/다중선택 문항 빌더</li>
          <li><strong>실시간 수집 통계</strong>: 구글폼 스타일 차트 대시보드 시각화</li>
          <li><strong>대량 이메일/SMS 전송</strong>: 설문 미참여자 대상 리마인드 기능</li>
        </ul>
      </div>

      <div className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold uppercase tracking-wider">
        Firestore surveys/survey_responses Schema Connected
      </div>
    </div>
  );
};
