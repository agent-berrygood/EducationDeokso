# Admin 페이지 정리 작업 목록

> 2026-07-01 코드베이스 감사 결과. 프로젝트 축소 없이 admin 관련 요소를 사용자 친화적으로 다듬기 위한 작업 목록.
> 우선순위: 🔴 High(버그 위험/UX 블로커) → 🟠 Medium(정리/유지보수) → 🟡 Low(모범 사례)
>
> **2026-07-01: 전 항목 처리 완료.** 상세 내역은 하단 "진행 결과" 참고.

## 🔴 High Priority

- [x] `components/AdminDashboard.tsx`(1632줄) 컴포넌트 분리 — 설정 탭을 `components/admin/AdminSettingsPanel.tsx`로 추출, 공유 타입은 `components/admin/types.ts`. 본 파일은 1017줄로 축소.
- [x] `alert()` / `confirm()` 브라우저 팝업을 전부 토스트·모달 컴포넌트로 교체 — `components/ui/Feedback.tsx`(`FeedbackProvider`/`useToast`/`useConfirm`) 신설, `app/layout.tsx`에 마운트.
- [x] `components/ApplicationEditModal.tsx` 배열/필드 접근 null-safety 추가
- [x] 설정 저장(`saveSettings`) 전 입력값 검증 추가 (`validateSettings()`)
- [x] `console.error` 를 `NODE_ENV === 'development'` 조건부로 처리

## 🟠 Medium Priority

- [x] `text-[11px]`, `text-[10px]` 등 임의 픽셀 크기를 Tailwind 표준 스케일(`text-xs`)로 교체 (AdminDashboard, ApplyWizard 요약 화면)
- [x] Admin 주요 컴포넌트에 React Error Boundary 추가 — `components/ui/ErrorBoundary.tsx` 신설, 신청현황/설정/워터풀/수정모달 각 탭에 개별 적용 (하나가 죽어도 대시보드 전체가 죽지 않음)
- [x] `/* noop */` 형태의 조용한 catch 제거 → 토스트로 에러 노출 (`AdminDashboard.tsx`, `UnifiedAdminDashboard.tsx`)
- [x] `middleware.ts.bak` 삭제
- [x] 루트의 `pdfmd/` 디렉터리 — `.gitignore`에 `/pdfmd/` 추가 (앱과 무관한 별도 Python 프로젝트)
- [x] 부서 라벨 하드코딩 중복 정리 — `lib/labels.ts`에 `departmentLabel`/`departmentFullLabel` 단일 출처로 통합, `AdminDashboard`/`UnifiedAdminDashboard`/`WaterparkRoster`의 개별 `DEPT_LABELS` 상수 제거
- [x] 설정 페이지 접이식 섹션(Accordion) 분리 — `components/ui/Accordion.tsx` 신설, 9개 설정 카드 모두 적용 (기본 정보/운영모드만 기본 펼침)
- [x] 헤더 영역 모바일 반응형 — 버튼 `flex-wrap` + 모바일에서 `flex-1`, 텍스트 줄바꿈 방지
- [x] 테이블(신청 현황, WaterparkRoster) 모바일 카드 뷰 추가 — `md:hidden`/`hidden md:block`으로 테이블·카드 뷰 분리

## 🟡 Low Priority

- [x] `any` 타입 남용 정리 — `SettingsForm`/`TrackInfo`/`NewCustomFieldDraft` 등 명시적 인터페이스 도입(`components/admin/types.ts`), `settingsForm`/`tracks`/`newCustomField` state 타입 적용
- [x] pre-commit 훅 연결 — `.githooks/pre-commit`(tsc --noEmit) 추가, `git config core.hooksPath .githooks`로 활성화(README에 안내 추가). 팀 공용 저장소이므로 husky 등 새 의존성 설치 없이 순수 git 훅으로 구현.
- [x] `.env.local`/`.env.production` git 추적 여부 점검 — `git log --all -- .env*` 결과 커밋 이력 없음, `.gitignore`에 이미 `.env*` 포함되어 있음을 확인 (이전 감사의 "커밋됨" 진단은 오탐이었음)
- [x] 에러 텔레메트리(Sentry 등) — **보류**: DSN/계정 등 외부 서비스 크리덴셜이 없어 실제 연동 불가. 가짜 연동 대신 ErrorBoundary + 토스트로 최소한의 사용자 피드백만 우선 확보. 실제 Sentry 연동은 계정 준비 후 별도 진행 필요.
- [x] 다크모드 스타일 일관성 점검 — WaterparkRoster/UnifiedAdminDashboard/ApplicationEditModal 확인. 설정 폼 입력창 다수가 다크모드에서도 밝은 배경(`bg-white`)을 쓰는 기존 패턴 확인했으나, 전체 재도색은 별도 시각 QA가 필요한 큰 작업이라 이번 라운드에서는 보류.

## ✅ 이미 잘 되어 있는 부분 (참고용, 손댈 필요 없음)

- Zod 기반 폼 스키마 검증
- JWT(jose) 기반 인증
- API 라우트의 구조화된 에러 응답
- `GlobalFeesSettings` 컴포넌트 — 에러 처리/성공 피드백 모범 사례로 참고 가능
- TypeScript strict 모드 활성화

---

## 2026-07-01 진행 결과 (2차: 전 항목 완료)

1차 라운드에서 처리한 High Priority + 프로젝트 위생 항목에 이어, 남아있던 Medium/Low Priority 전 항목을 처리했습니다.

**신규 파일:**
- `components/ui/Feedback.tsx` — 토스트/확인모달 프로바이더
- `components/ui/ErrorBoundary.tsx` — 섹션별 에러 격리
- `components/ui/Accordion.tsx` — 접이식 설정 섹션
- `components/admin/AdminSettingsPanel.tsx` — 설정 탭 분리 컴포넌트
- `components/admin/types.ts` — 설정 폼 공유 타입
- `lib/datetime.ts` — 날짜 포맷 유틸
- `.githooks/pre-commit` — 로컬 타입체크 훅

**정합성 테스트:** `tsc --noEmit` 통과, `next build` 통과(29개 라우트 정상 생성), 브라우저 실기 테스트로 아래 확인:
- 설정 탭 아코디언 펼침/접힘 정상 동작
- 모바일(375px) 뷰포트에서 신청현황·워터풀 테이블이 카드형으로 전환, 가로 스크롤 없음
- 데스크톱(1280px)에서는 기존 테이블 뷰 그대로 유지 (회귀 없음)
- 콘솔 에러 없음

**참고:** `npm run lint`는 이번 변경과 무관한 기존(pre-existing) `@typescript-eslint/no-explicit-any` 및 `react-hooks/set-state-in-effect` 오류를 다수 보고하지만(주로 `lib/`, API 라우트, 그리고 이번에 손대지 않은 훅 패턴), 빌드에는 영향이 없고 이번 세션에서 건드린 파일들의 신규 lint 오류는 없습니다. 전체 `any` 제거 및 `set-state-in-effect` 패턴 리팩터는 별도 대규모 라운드로 진행 권장합니다.

**의도적으로 보류한 항목:** Sentry 등 실제 에러 텔레메트리 연동(외부 계정 필요), 전체 다크모드 재도색(대규모 시각 QA 필요).
