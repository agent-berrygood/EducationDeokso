'use client';

import { useCallback, useEffect, useState } from 'react';

export interface TrackOption {
  trackKey: string;
  label: string;
  subDepartmentIds: string[];
}

interface State {
  /** loading: 트랙 목록 조회 중 / picker: 분리 모드라 트랙 선택 필요 / ready: 표시할 config 확정 */
  phase: 'loading' | 'picker' | 'ready';
  tracks: TrackOption[];
  config: any | null;
}

/**
 * 부서 랜딩페이지 전용 훅 — 분리(split) 운영이면 'main'을 건너뛰고
 * 방문자가 트랙(세부부서)을 먼저 선택하게 한 뒤 해당 트랙의 config를 반환한다.
 * 연합(union) 모드거나 트랙이 없으면 기존과 동일하게 즉시 main config를 반환한다.
 */
export function useDepartmentTrackConfig(department: string) {
  const [state, setState] = useState<State>({ phase: 'loading', tracks: [], config: null });

  useEffect(() => {
    let cancelled = false;
    setState({ phase: 'loading', tracks: [], config: null });
    (async () => {
      try {
        const listRes = await fetch(`/api/config/${department}?list=1`);
        const listJson = await listRes.json();
        const mode: 'union' | 'split' = listJson?.data?.operatingMode === 'split' ? 'split' : 'union';
        const allTracks: TrackOption[] = listJson?.data?.tracks || [];
        const nonMain = allTracks.filter((t) => t.trackKey !== 'main');

        if (mode === 'split' && nonMain.length > 0) {
          if (!cancelled) setState({ phase: 'picker', tracks: nonMain, config: null });
          return;
        }

        const res = await fetch(`/api/config/${department}`);
        const json = await res.json();
        if (!cancelled) setState({ phase: 'ready', tracks: [], config: json.success ? json.data : null });
      } catch (err) {
        if (process.env.NODE_ENV === 'development') console.error(`${department} 설정 로드 실패`, err);
        if (!cancelled) setState({ phase: 'ready', tracks: [], config: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [department]);

  const selectTrack = useCallback(
    async (trackKey: string) => {
      setState((prev) => ({ ...prev, phase: 'loading' }));
      try {
        const res = await fetch(`/api/config/${department}?track=${encodeURIComponent(trackKey)}`);
        const json = await res.json();
        setState({ phase: 'ready', tracks: [], config: json.success ? json.data : null });
      } catch (err) {
        if (process.env.NODE_ENV === 'development') console.error(`${department} 트랙 설정 로드 실패`, err);
        setState({ phase: 'ready', tracks: [], config: null });
      }
    },
    [department]
  );

  return { ...state, selectTrack };
}
