'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ConfirmState {
  message: string;
  resolve: (value: boolean) => void;
}

interface FeedbackContextValue {
  showToast: (message: string, type?: ToastType) => void;
  confirm: (message: string) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

/**
 * 브라우저 alert()/confirm()을 대체하는 전역 토스트 + 확인 다이얼로그 프로바이더.
 * app/layout.tsx 최상단에 마운트되어 있어 앱 어디서나 useToast()/useConfirm()으로 사용 가능.
 */
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ message, resolve });
    });
  }, []);

  const resolveConfirm = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  return (
    <FeedbackContext.Provider value={{ showToast, confirm }}>
      {children}

      {/* 토스트 스택 */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto max-w-sm px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white animate-[fadeIn_0.15s_ease-out] ${
              t.type === 'success' ? 'bg-emerald-600' : t.type === 'error' ? 'bg-red-600' : 'bg-slate-800'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* 확인 다이얼로그 */}
      {confirmState && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <p className="text-gray-800 dark:text-gray-100 font-semibold whitespace-pre-line">{confirmState.message}</p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => resolveConfirm(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold text-sm cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => resolveConfirm(true)}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm cursor-pointer"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useToast/useConfirm은 FeedbackProvider 내부에서만 사용할 수 있습니다.');
  return ctx;
}

export function useToast() {
  const { showToast } = useFeedback();
  return showToast;
}

export function useConfirm() {
  const { confirm } = useFeedback();
  return confirm;
}
