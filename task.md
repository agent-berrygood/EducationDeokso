# 높은뜻덕소교회 지금세대교육부 홈페이지 개발 진행 현황판 (task.md)

본 문서는 IDE 에이전트 및 팀원들과 실시간 개발 진척 상황을 완벽하게 동기화하기 위해 공유하는 현황판입니다. 작업 완료 시 상태를 `[x]`로 업데이트합니다.

---

## 📅 프로젝트 진행 현황 요약
* **현재 단계**: 1단계 - 프로젝트 설계 및 초기 환경 설정 준비 (`대기 중`)
* **최종 업데이트**: 2026-05-27 13:35 (KST)

---

## 📝 개발 세부 작업 체크리스트

### 1단계: 설계 및 의사결정 수립 (완료 5/27)
- [x] 요구사항 명세 작성 (`project_specification.md` 워크스페이스 저장)
- [x] 세부 아키텍처 및 의사결정 수립 (Next.js, Tailwind v4, Firestore, HttpOnly JWT, Step-by-Step Form)
- [x] 구현 계획 수립 및 문서 복제 (`implementation_plan.md` 워크스페이스 저장)
- [x] IDE 공유용 진행 현황판 초기설정 (`task.md` 생성)

### 2단계: 프로젝트 빌드 및 환경 설정 (진행 중)
- [x] [Task 1] Next.js (App Router, Tailwind v4, TS/JS) 스켈레톤 프로젝트 초기 생성 및 환경 변수 구성
- [x] Firebase CLI 로그인 연결 완료 (berryberry1120@gmail.com 계정 연동 성공)
- [x] Gemini CLI 연결 및 작동 테스트 완료 (로컬 쉘 작동 확인 완료)
- [x] [Task 2] Firebase SDK 설치 및 Firestore 커넥터 구현 (`lib/firebase.js`)
- [x] [Task 3] Tiptap 에디터 모듈 설치 및 공용 리치텍스트 컴포넌트 개발 (`components/RichTextEditor.js`)
- [x] [Task 4] 공용 3단계 위저드 신청서(Step-by-Step Wizard) 개발 (`components/ApplicationForm.js`)
- [x] [Task 5] 메인 홈 및 부서별 특화 페이지 & 동적 CSS 스킨 렌더러 구현
- [x] [Task 6] JWT 암호화 API 및 어드민 세션 보호 미들웨어 구축 (`app/api/admin/login/route.js`, `middleware.js`)
- [/] [Task 7] 부서별 관리자(Admin) 대시보드 및 설문조사 확장 기틀 빌드 (`app/kinder/admin/page.tsx` 등)

### 3단계: 신청서 폼 & 비즈니스 로직 개발 (대기)
- [ ] 자녀 정보(티셔츠, 알레르기 다중 선택, 워터파크 참석여부) 모델 구현
- [ ] 단계별 입력형(Step-by-Step Wizard) 신청서 컴포넌트 (`components/ApplicationForm.js`) 퍼포먼스 빌드
- [ ] Firestore에서 실시간 부서별 회비 로드 및 클라이언트단 합산 로직 연동
- [ ] 3단계 개별 입금 정보 표출 및 자가 `[입금 완료했어요]` 확인 인터랙션 스위치 구현
- [ ] 제출 더블클릭(Debounce) 제어 및 로딩 상태 UI 통합 적용

### 4단계: 부서별 특화 페이지 디자인 (대기)
- [ ] 메인 홈: `<2026 여름 바이블 캠프>` 프리미엄 메인 UI 퍼포먼스 빌드
- [ ] 나우킨더 (미취학): 따뜻한 파스텔 카드 테마 디자인
- [ ] 나우키즈 (초등부): 역동적인 스포츠/원색 테마 디자인
- [ ] 나우틴즈 (중고등부): 감각적인 네온 다크모드 테마 디자인

### 5단계: 관리자(Admin) 대시보드 및 JWT 보안 (대기)
- [ ] 어드민 전용 HttpOnly 암호화 JWT 발급 및 미들웨어 세션 보호 체계 구축
- [ ] 부서별 관리자 페이지 (`/kinder/admin` 등) 내 제출 신청서 실시간 스트리밍 대시보드 개발
- [ ] 어드민 내 부서별 설문조사(Surveys) 개설을 위한 확장용 플레이스홀더 경로 구축

### 6단계: 빌드 검증 및 프로덕션 푸시 (대기)
- [ ] Local Dev 서버 작동 여부 최종 수동 교차 테스트
- [ ] `npm run build` 프로덕션 빌드 무오류(Build 100% Pass) 검증
- [ ] 코드 형상 관리 형상 커밋 및 최종 리모트 푸시
