'use client';

import React, { useEffect, useState } from 'react';

interface TypedConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** 확인 버튼을 활성화하려면 사용자가 정확히 입력해야 하는 문자열 */
  requiredText: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

/**
 * 되돌릴 수 없는 파괴적 작업 전용 확인 다이얼로그.
 * 지정된 문구(requiredText)를 정확히 입력해야만 확인 버튼이 활성화된다.
 * (Feedback.tsx의 단순 OK/취소 confirm으로는 부족한 케이스용)
 */
export default function TypedConfirmDialog({
  open,
  title,
  description,
  requiredText,
  confirmLabel = '삭제',
  onCancel,
  onConfirm,
  loading = false,
}: TypedConfirmDialogProps) {
  const [typed, setTyped] = useState('');

  // 열릴 때마다 입력값 초기화
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  if (!open) return null;

  const matches = typed === requiredText;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 whitespace-pre-line">{description}</p>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            계속하려면 <span className="font-mono font-bold text-red-600">{requiredText}</span> 를 정확히 입력하세요
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-400 focus:outline-none"
            placeholder={requiredText}
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold text-sm cursor-pointer disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || loading}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
