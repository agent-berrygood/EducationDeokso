'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * ApplyWizard 전용 — "department::subDepartment" 키 목록을 받아 각 키에 해당하는
 * (트랙 해석이 끝난) CMS 설정을 온디맨드로 조회/캐싱한다. subDepartment가 빈 문자열이면
 * `sub` 파라미터를 생략하고, 서버의 resolveTrackKey가 연합 모드/미선택 모두 안전하게
 * 'main'으로 폴백하므로 별도 분기가 필요 없다.
 *
 * 반환값: { cache, loading }
 * - cache: 키별 설정 데이터
 * - loading: 요청된 키 중 아직 응답을 받지 못한 것이 있으면 true
 */
export function useApplyConfigCache(keys: string[]) {
  const [cache, setCache] = useState<Record<string, any>>({});
  const resolvedOrPending = useRef<Set<string>>(new Set());
  const [resolvedKeys, setResolvedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const toFetch = keys.filter((k) => !resolvedOrPending.current.has(k));
    if (toFetch.length === 0) return;
    toFetch.forEach((k) => resolvedOrPending.current.add(k));

    (async () => {
      const results = await Promise.all(
        toFetch.map(async (key) => {
          const [dept, sub] = key.split('::');
          const qs = sub ? `?sub=${encodeURIComponent(sub)}` : '';
          try {
            const res = await fetch(`/api/config/${dept}${qs}`);
            const json = await res.json();
            return [key, json.success ? json.data : null] as const;
          } catch (err) {
            if (process.env.NODE_ENV === 'development') console.error(`설정 로드 실패 (${key})`, err);
            return [key, null] as const;
          }
        })
      );
      setCache((prev) => {
        const next = { ...prev };
        results.forEach(([k, v]) => {
          next[k] = v;
        });
        return next;
      });
      setResolvedKeys((prev) => {
        const next = new Set(prev);
        results.forEach(([k]) => next.add(k));
        return next;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join(',')]);

  // 요청된 키 중 아직 resolve되지 않은 것이 있으면 loading
  const loading = keys.some((k) => !resolvedKeys.has(k));

  return { cache, loading };
}
