# 높은뜻덕소교회 지금세대교육부 홈페이지 구축 구현 계획서

본 계획서는 `/grill-me` 인터뷰를 통해 확정된 요구사항을 기반으로, 높은뜻덕소교회 지금세대교육부 홈페이지를 성공적으로 구축하기 위한 상세 실행 계획입니다.

---

## 1. 확정된 설계 사양 요약

*   **프레임워크**: Next.js (App Router, `app/` 디렉토리 기반)
*   **스타일링**: Tailwind CSS v4 (최신 기능 및 성능 최적화 적용)
*   **백엔드**: Firebase (Firestore, Hosting)
*   **초기 어드민 인증**: 개발 편의성을 고려한 간이 패스워드 방식 (환경 변수 검증)
*   **신청서 핵심 로직**:
    *   **단계별 입력형(Step-by-Step Wizard)**: 학부모님이 단계별로 집중할 수 있도록 화면 흐름을 3단계로 분할 제공.
        *   *1단계*: 학부모 정보 입력 (이름, 연락처, 비상 연락처 등)
        *   *2단계*: 자녀별 상세 정보 입력 (자녀 이름, 생년월일, 소속 부서 선택, **단체 티셔츠 사이즈 선택**, **알레르기 다중 선택 및 직접 입력**, **워터풀 선데이 참석 여부 체크**)
        *   *3단계*: **입금 안내 및 자가 매칭 섹션**. 부서별 캠프 참가비와 워터파크 참가비가 **부서별 전용 계좌 및 워터파크 전용 계좌로 각각 분리 표시**되며, 입금자명 입력란 및 **계좌별 [입금완료] 버튼 제공**하여 사용자가 체크 후 최종 신청서 접수.
    *   **자녀별 맞춤형 상세 정보 수집**:
        *   **티셔츠 사이즈**: 자녀별 드롭다운 제공 (예: 80, 90, 100, S, M, L, XL 등).
        *   **알레르기 정보**: 다중 체크박스(계란, 우유, 견과류, 밀가루, 복숭아, 대두, 조개류 등)와 직접 적을 수 있는 기타 텍스트 칸을 조합 제공.
    *   **워터풀 선데이 (아일랜드 캐슬) 로직**:
        *   자녀 중 최소 1명이라도 워터풀 선데이에 참석할 경우, **학부모 1인 필수 동반**이 트리거되어 3단계에서 학부모 1인 워터파크 비용이 자동으로 추가 계산됨.
        *   부모 워터파크 동반 비용 및 신청 비용은 **캠프 회비 계좌와 완전히 다른 '워터파크 전용 계좌'**로 별도 입금 안내.
    *   **부서별 분리된 입금 및 자가 확인**:
        *   캠프 회비는 전체 합산하지 않고, 자녀가 속한 부서(킨더/키즈/틴즈)별로 해당하는 개별 은행 계좌번호와 함께 각각의 총액을 화면에 분리 노출.
        *   3단계 화면에서 각 입금 안내 항목 옆에 **`[입금 완료]` 스위치/버튼**을 배치하여, 신청서 제출 시 해당 입금 여부 체크 데이터를 Firebase에 함께 전송 (`paidKinder: true`, `paidKids: true`, `paidWaterpark: true` 등).
*   **보안 및 트래픽 관리**:
    *   **쿠키 보안 및 암호화**: F12 개발자 도구 유출을 방지하기 위해 **HttpOnly 및 Secure** 쿠키 제어 적용. 세션 정보는 **서버사이드에서 암호화(JWE 또는 AES-GCM) 및 서명된 JWT**를 담고 있어 F12로 보아도 임의의 해석 불가능한 암호화 문자열로만 노출되며, 클라이언트 사이드 JS 스크립트 접근이 완전히 차단됩니다.
    *   **개인정보 수집 및 동의**: 필수 개인정보 제공 동의 체크 적용. 관리 편의성을 위해 어드민에서는 마스킹 처리 없이 전체 데이터의 직관적인 조회 지원.
    *   **중복 제출 방지**: 제출 버튼 Debounce 제어 및 제출 중 로딩 스피너 작동으로 중복 문서 생성 원천 방지.
    *   **Firebase 보안 규칙**: 쓰기 권한은 대중에게 오픈하고, 상세 데이터 형식 검증은 프론트엔드의 빈틈없는 유효성 검사(Validation)에 위임하여 속도와 유연성 확보.
*   **부서별 테마 디자인**:
    *   **나우킨더** (미취학): 따뜻하고 아기자기한 파스텔톤 컬러셋
    *   **나우키즈** (초등부): 활기차고 역동적인 비비드/원색 컬러셋
    *   **나우틴즈** (중고등부): 감각적이고 트렌디한 다크모드 & 네온 컬러셋

---

## 2. 사용자 피드백 및 검토 필요 사항

> [!NOTE]
> 개발 초기 단계이므로 어드민 로그인(`/kinder/admin` 등)은 `NEXT_PUBLIC_ADMIN_PASSWORD` 환경 변수와 대조하는 방식을 사용합니다. 이때 사용자가 로그인 성공 시 서버사이드에서 비밀 암호화 키를 이용하여 **HttpOnly JWT**를 발급하여 보안성을 최고 수준으로 격상시킵니다.
> 
> 트래픽 집중 시 중복 입력을 막기 위해 클라이언트 측에서 Debounce 처리를 빈틈없이 구현합니다.
> 
> 신청서는 **단계별 입력형(Step-by-Step Wizard)**으로 제작하며, **각 부서별 캠프 회비 계좌 및 워터파크 전용 계좌 정보를 분리 안내**하고, 사용자가 직접 입금 완료 상태를 자가 매킹할 수 있도록 버튼 인터랙션을 구현합니다.

---

## 3. 상세 구현 계획 및 파일 구조

### 3.1. [NEW] 프로젝트 초기화 및 환경 설정
*   **작업 내용**:
    *   `npx --yes create-next-app@latest ./` 명령어를 활용하여 workspace에 Next.js 프로젝트 생성.
    *   옵션: TypeScript 사용, ESLint 사용, Tailwind CSS v4 사용, `src/` 디렉토리 사용 안 함, App Router 사용.
    *   Firebase SDK 설치 및 초기화 파일 (`lib/firebase.js`) 구성.
    *   환경 변수 설정 (`.env.local`).

### 3.2. [NEW] 데이터베이스 모델 및 API 연동
*   `lib/firebase.js`에서 Firestore DB 초기화.
*   `applications` 컬렉션 구조 설계:
    ```typescript
    interface Application {
      id: string; // 자동 생성 문서 ID
      parentName: string;
      parentPhone: string;
      depositorName: string; // 입금자명
      submittedAt: string; // ISO 타임스탬프
      selfPaymentStatus: {
        kinder?: boolean;    // 킨더 회비 입금 체크 여부
        kids?: boolean;      // 키즈 회비 입금 체크 여부
        teens?: boolean;     // 틴즈 회비 입금 체크 여부
        waterpark?: boolean; // 워터파크 회비 입금 체크 여부
      };
      children: Array<{
        name: string;
        birthDate: string;
        department: 'kinder' | 'kids' | 'teens';
        tshirtSize: string;
        allergies: string[];
        customAllergy?: string;
        attendsWaterpark: boolean; // 워터풀 선데이 참석 여부
      }>;
      status: 'pending' | 'confirmed' | 'cancelled';
    }
    ```

### 3.3. [NEW] 향후 부서별 설문조사(Survey) 운영을 위한 데이터 스키마 설계 (확장성 확보)
당장 전체 화면을 구현하지는 않으나, 어드민에서 언제든 설문조사를 개설하고 수집할 수 있도록 Firestore 구조 설계를 선제적으로 완료합니다.
*   **`surveys`** (부서별 설문조사 개설 데이터):
    ```typescript
    interface Survey {
      surveyId: string; // 문서 ID
      department: 'kinder' | 'kids' | 'teens';
      title: string;
      description?: string;
      questions: Array<{
        questionId: string;
        type: 'text' | 'single-choice' | 'multi-choice';
        title: string;
        options?: string[]; // 선택형 문항일 때의 보기 리스트
        required: boolean;
      }>;
      active: boolean; // 활성화 여부
      createdAt: string;
    }
    ```
*   **`survey_responses`** (설문조사 응답 수집 데이터):
    ```typescript
    interface SurveyResponse {
      responseId: string;
      surveyId: string;
      department: 'kinder' | 'kids' | 'teens';
      answers: Record<string, any>; // questionId -> 응답값 (String 또는 Array)
      submittedAt: string;
    }
    ```

### 3.4. [NEW] 페이지 및 라우팅 구조 (`app/` 디렉토리)
*   `app/page.js`: 메인 홈 (**2026 여름 바이블 캠프** 테마)
*   `app/kinder/page.js` & `app/kinder/admin/page.js` (나우킨더 홈 & 어드민 - *메뉴 내 설문조사 관리(/kinder/admin/surveys) 플레이스홀더 준비*)
*   `app/kids/page.js` & `app/kids/admin/page.js` (나우키즈 홈 & 어드민 - *메뉴 내 설문조사 관리(/kids/admin/surveys) 플레이스홀더 준비*)
*   `app/teens/page.js` & `app/teens/admin/page.js` (나우틴즈 홈 & 어드민 - *메뉴 내 설문조사 관리(/teens/admin/surveys) 플레이스홀더 준비*)
*   `components/ApplicationForm.js`: 다중 자녀 동시 등록이 가능한 공용 신청서 컴포넌트
*   `components/SurveyFormPlaceholder.js`: 향후 설문조사 확장을 위한 공용 설문조사 플레이스홀더 컴포넌트구축

### 3.5. [NEW] 부서별 비주얼 디자인 시스템 (Tailwind v4 테마)
*   `app/globals.css` 및 페이지별 전용 스타일 가이드를 통해 각기 다른 무드 구현:
    *   **나우킨더**: `bg-pink-50`, `text-pink-600`, 파스텔 라운드 카드
    *   **나우키즈**: `bg-yellow-50`, `text-blue-600`, 역동적인 비주얼 패턴
    *   **나우틴즈**: `bg-slate-900`, `text-emerald-400`, 다크 네온 카드 및 세련된 폰트

---

## 4. 검증 계획

### 4.1. 수동 검증
1.  **로컬 서버 작동**: `npm run dev` 실행 후 모든 부서 페이지 접근성 테스트.
2.  **다중 자녀 신청서 테스트**:
    *   자녀 추가 버튼 동작 검증.
    *   필수값 누락 시 유효성 검사 경고 작동 확인.
    *   신청 완료 시 Firestore에 정상 저장 및 성공 UI 확인.
3.  **관리자 화면 테스트**:
    *   패스워드 입력 후 대시보드 진입.
    *   저장된 신청서 목록(신청 부서 필터링 작동 여부) 확인.

### 4.2. 빌드 검증
*   `npm run build`를 실행하여 Next.js 빌드가 에러(`exited with 1`) 없이 통과하는지 확인.
