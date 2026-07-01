'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  /** 에러 발생 시 보여줄 안내 문구 (섹션 이름 등) */
  label?: string;
}

interface State {
  hasError: boolean;
}

/**
 * 관리자 대시보드의 한 섹션(탭/테이블/모달)이 죽어도 전체 대시보드가
 * 함께 죽지 않도록 격리하는 경계 컴포넌트.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught:', error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center rounded-xl border border-dashed border-red-300 bg-red-50 text-red-700">
          <p className="font-bold">
            {this.props.label ? `${this.props.label} 로딩 중 오류가 발생했습니다.` : '이 화면을 표시하는 중 오류가 발생했습니다.'}
          </p>
          <p className="text-sm mt-1">새로고침 후 다시 시도해주세요. 문제가 반복되면 관리자에게 문의해주세요.</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg cursor-pointer"
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
