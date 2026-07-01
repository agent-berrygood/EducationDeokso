# Admin 페이지 정리 작업 목록

> 2026-07-01 코드베이스 감사 결과. 프로젝트 축소 없이 admin 관련 요소를 사용자 친화적으로 다듬기 위한 작업 목록.
> 우선순위: 🔴 High(버그 위험/UX 블로커) → 🟠 Medium(정리/유지보수) → 🟡 Low(모범 사례)

## 🔴 High Priority

- [ ] `components/AdminDashboard.tsx`(1632줄) 컴포넌트 분리
  - `AdminApplicationsTab.tsx`, `AdminSettingsPanel.tsx`, `AdminWaterparkTab.tsx` 등으로 쪼개기
  - (2026-07-01 기준 보류: 리스크 대비 실익이 낮아 이번 라운드에서는 제외. 다음 라운드에서 진행 권장)
- [x] `alert()` / `confirm()` 브라우저 팝업을 전부 토스트·모달 컴포넌트로 교체 — `components/ui/Feedback.tsx`(`FeedbackProvider`/`useToast`/`useConfirm`) 신설, `app/layout.tsx`에 마운트. `AdminDashboard.tsx`, `ApplicationEditModal.tsx`의 모든 alert/confirm 교체 완료
- [x] `components/ApplicationEditModal.tsx` 배열/필드 접근 null-safety 추가 (`formData.children` fallback, 인덱스 범위 체크)
- [x] 설정 저장(`saveSettings`) 전 입력값 검증 추가 (`validateSettings()`: 제목 빈 값, 컬러 hex 형식, `campDuration` 범위)
- [x] `console.error` 를 `NODE_ENV === 'development'` 조건부로 처리 — `AdminDashboard.tsx`, `ApplyWizard.tsx`, `ApplicationForm.tsx`

## 🟠 Medium Priority

- [ ] `text-[11px]`, `text-[10px]` 등 임의 픽셀 크기를 일관된 spacing/typography 스케일로 교체 (ApplyWizard, AdminDashboard 전반)
- [ ] Admin 주요 컴포넌트에 React Error Boundary 추가 (하나가 죽어도 대시보드 전체가 죽지 않도록)
- [ ] `/* noop */` 형태의 조용한 catch 제거 → 에러 UI/토스트로 대체 (`AdminDashboard.tsx` L230, 243 / `UnifiedAdminDashboard.tsx` L39-44)
- [x] `middleware.ts.bak` 삭제 (백업 파일 방치)
- [x] 루트의 `pdfmd/` 디렉터리 처리 — 앱 코드에서 미사용 확인, `.gitignore`에 `/pdfmd/` 추가 (별도 Python 프로젝트라 삭제하지 않고 무시 처리)
- [ ] 부서 라벨(`DEPT_LABELS` 등) 하드코딩 중복 정리 — `UnifiedAdminDashboard.tsx` L9-13, `AdminDashboard.tsx` L118-122 등 여러 곳에 중복
- [ ] 설정 페이지가 한 화면에 다 몰려있음(운영모드/행사정보/테마색상/티셔츠/소속부서/일정/커스텀필드) → 접이식 섹션(Accordion)으로 분리
- [ ] 헤더 영역(로그아웃/엑셀 내보내기 버튼) 모바일에서 겹침 → 햄버거 메뉴 또는 반응형 레이아웃 적용
- [ ] 테이블(WaterparkRoster 등) 모바일에서 `overflow-x-auto`만 있고 카드형 대체 뷰 없음 → 모바일 카드 뷰 추가

## 🟡 Low Priority

- [ ] `any` 타입 남용 정리 — `AdminDashboard.tsx`의 `config`, `settingsForm` 등에 명시적 인터페이스 부여
- [ ] lint/typecheck를 pre-commit 훅으로 연결 (`tsc --noEmit` 포함)
- [ ] `.env.local`, `.env.production` 등 git에 커밋된 환경변수 파일 점검 — 민감정보 여부 확인 후 정리
- [ ] 에러 텔레메트리(Sentry 등) 도입 검토 — 현재 프로덕션 에러가 전부 콘솔에만 남고 추적 불가
- [ ] 다크모드 스타일 일관성 점검 — 일부 컴포넌트만 `dark:` 클래스 적용됨

## ✅ 이미 잘 되어 있는 부분 (참고용, 손댈 필요 없음)

- Zod 기반 폼 스키마 검증
- JWT(jose) 기반 인증
- API 라우트의 구조화된 에러 응답
- `GlobalFeesSettings` 컴포넌트 — 에러 처리/성공 피드백 모범 사례로 참고 가능
- TypeScript strict 모드 활성화

---

## 2026-07-01 진행 결과

High Priority 대부분과 Medium Priority 중 프로젝트 위생 항목을 처리했습니다. 정합성 테스트(`tsc --noEmit`, `next build`) 통과, 관리자 로그인/삭제 확인/설정 저장 검증을 브라우저에서 직접 확인했습니다.

- 남은 항목: `AdminDashboard.tsx` 컴포넌트 분리, 접이식 설정 섹션, 모바일 카드 뷰, `any` 타입 정리 등 — 다음 라운드에서 진행
- 참고: `npm run lint` 실행 시 152개의 사전 존재(pre-existing) `@typescript-eslint/no-explicit-any` 오류가 나오지만, 이번 변경 파일에는 해당 오류가 없고 `next build`는 정상 통과합니다. `any` 타입 정리는 Low Priority 항목으로 별도 라운드 권장.

다음 작업 시 이 목록에서 항목을 골라 하나씩 진행하면 됩니다. High Priority부터 순서대로 처리하는 것을 추천.
