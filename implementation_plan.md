# 대규모 개편 구현 계획서 (Major Overhaul Implementation Plan)

본 계획서는 학부모 신청 절차 간소화, 부모 중심 데이터 구조, 통합 관리자 운영 체계를 위한 대규모 개편안과 함께 사전 리스크 진단 결과를 통합한 구현 명세서입니다.

---

## 0. 즉시 조치 사항 (선결 과제)

본 개편을 시작하기 **전에 반드시 선결**되어야 하는 항목입니다.

1. **`lib/db.ts` 한글 인코딩 손상 복구**
   - 현재 `INSERT INTO event_configs ... VALUES ('kinder', '2026 ?????? ?????????', ...)` 형태로 부서 라벨이 깨져 있어, 새 환경에서 `/api/init` 호출 시 부서명이 `?????`로 저장됩니다.
   - 모든 한글 문자열을 UTF-8 정상 텍스트로 복원합니다.

2. **운영 데이터 백업 (Neon Branch 생성)**
   ```bash
   neonctl branches create --name pre-overhaul-2026-05-28
   ```
   - 마이그레이션 실패 시 즉시 롤백 가능한 안전망을 확보합니다.

3. **관리자 비밀번호 클라이언트 노출 제거**
   - `NEXT_PUBLIC_ADMIN_PASSWORD`는 빌드 산출물에 그대로 노출됩니다.
   - 서버사이드 환경 변수(`ADMIN_PASSWORD_KINDER`, `ADMIN_PASSWORD_KIDS`, `ADMIN_PASSWORD_TEENS`)로 분리하고, JWT 발급 라우트(`/api/admin/login`)에서만 검증하도록 변경합니다.

4. **스키마 마이그레이션 버전 관리 테이블 도입**
   ```sql
   CREATE TABLE IF NOT EXISTS schema_migrations (
     version INT PRIMARY KEY,
     description TEXT,
     applied_at TIMESTAMP DEFAULT NOW()
   );
   ```
   - 각 마이그레이션은 `migrations/001_*.sql` 파일로 분리 보관하고 다운 마이그레이션 스크립트를 동봉합니다.

5. **공용 타입 정의 통합 (`lib/types.ts`)**
   - `Application`, `Child`, `EventConfig`, `PaymentStatus`, `WaterfallParent` 등 공용 인터페이스를 한 곳에서 export 하여 `any` 사용을 제거합니다.

---

## 1. 주요 요구사항 및 아키텍처 설계

### 1.1. 메인 랜딩 페이지 간소화 (`app/page.tsx`)
- 기존의 부서 카드와 설명 링크를 모두 숨기고, 화면 중앙에 세련된 그라데이션 타이틀과 함께 **`2026 지금세대교육부 여름 캠프 신청하기`** 단 하나의 메인 버튼만 남깁니다.
- 해당 버튼 클릭 시 모달이 아닌 풀페이지 라우트인 `/apply`로 직접 이동합니다.
- **보완**: 기존 부서별 페이지(`/kinder`, `/kids`, `/teens`)와 어드민 링크는 footer 또는 hidden link로 유지하여 SEO 및 직접 진입 트래픽이 단절되지 않도록 합니다.

### 1.2. 풀페이지 신청 라우트 구현 (`app/apply/page.tsx`)
- 기존 모달 기반 `ApplicationForm`을 걷어내고, 독립된 풀페이지 라우터 `/apply`를 신설합니다.
- 모바일 입력 피로도를 낮추기 위해 가독성 높은 반응형 폼 인터페이스를 제공합니다.
- **보완**:
  - **`localStorage` 자동 저장**: 입력값을 500ms debounce로 `apply_draft` 키에 저장하고, 새로고침/백그라운드 복귀 시 자동 복원합니다.
  - 제출 성공 후 `localStorage.removeItem('apply_draft')`로 초기화.
  - Next.js 16 호환을 위해 모든 페이지 파일에 `'use client'` 명시 + 동적 파라미터는 `params: Promise<{...}>` 패턴 강제.

### 1.3. 신청 프로세스 다단계 고도화 (Step-by-Step Wizard)

#### Step 1: 보호자 정보 & 워터풀 선데이 참석자 등록
- 부모 이름, 연락처, 캠프비 입금자명을 입력받습니다.
- **워터풀 선데이 보호자 참석 정보 수집**: 폭포수 주일에 함께 참여하는 보호자(조부모, 부모 등) 정보를 여러 명 동적으로 행 추가(`+ 보호자 추가`)할 수 있는 Dynamic Array Input UI를 탑재합니다.
- **데이터 검증 강화**:
  - 1명 이상 필수 + 각 행마다 `name`, `relation`(드롭다운: 부/모/조부/조모/기타), `phone(선택)` 모두 검증.
  - 클라이언트는 zod 스키마로 검증, 서버는 INSERT 전 동일 스키마 재검증.
  ```typescript
  const waterfallParentSchema = z.object({
    name: z.string().min(1),
    relation: z.enum(['부','모','조부','조모','기타']),
    phone: z.string().optional(),
  });
  ```

#### Step 2: 자녀 정보 입력 & 실시간 부서 홍보 콘텐츠 매핑
- 자녀의 이름, 생년월일, 성별 기입 시 한국 나이 기반으로 대부서를 자동 **추천**(강제 아님)하거나, 학부모가 직접 대부서(나우킨더/나우키즈/나우틴즈)를 선택할 수 있습니다.
- **자동 부서 추천 모호성 해소**:
  - 만 나이 통일법(2024 시행) 기준으로 계산하되 결과는 "추천" 라벨로 표기 후 수동 확정 버튼을 둠.
  - 학년 입력란을 함께 제공해 1월생/12월생 경계 케이스를 사용자가 직접 정정할 수 있게 함.
  - 매핑 테이블 단일 출처화: `lib/age-to-department.ts`에 매핑 로직 분리.
- **실시간 부서 매핑 비주얼 보드**: 자녀 등록 카드 내에서 부서가 매핑·선택되는 즉시, 해당 부서의 **홍보 포스터 이미지, 올해의 주제 성구, 행사 타이틀, 테마 슬로건**을 카드 내부에 렌더링합니다.
- **Base64 이미지 성능 보완**:
  - 포스터는 별도 엔드포인트 `/api/poster/[dept]`로 분리하고 `Cache-Control: public, max-age=3600` 헤더 부여.
  - 클라이언트 `sessionStorage`에 한 세션 단위 캐싱.
  - 서버에서 `sharp`로 업로드 시점에 WebP 압축 + 1MB 상한 강제.
  - 로딩 동안 스켈레톤 홀더 노출 (`<Skeleton aspectRatio="3/4" />`).
- 자녀가 2명 이상일 경우 `자녀 추가` 시 카드별로 독립 매핑됩니다.
- 세부부서 선택란(통합미취학부, 영유아부, 유치부, 통합아동부, 유년부, 소년부, 중등부, 고등부)과 참석일정 옵션을 자녀별로 입력받습니다.

### 1.4. 부모 중심 DB 스키마 마이그레이션 (`lib/db.ts` / Postgres)
- 부모를 중심(Parent-Centric)으로 데이터가 유기적으로 엮이도록 관계를 명확히 합니다.
- **마이그레이션 정책**:
  - 모든 변경은 `schema_migrations` 버전 테이블에 기록.
  - 운영 데이터를 건드리지 않도록 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + `DEFAULT '[]'::jsonb` 가드를 적용.
  - 마이그레이션 직후 NULL 백필 쿼리 실행으로 누락 방지.
- **마이그레이션 쿼리 (v2)**:
  ```sql
  -- 001_waterfall_parents.sql (UP)
  ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS waterfall_parents JSONB DEFAULT '[]'::jsonb;
  UPDATE applications
    SET waterfall_parents = '[]'::jsonb
    WHERE waterfall_parents IS NULL;
  INSERT INTO schema_migrations(version, description)
    VALUES (1, 'Add waterfall_parents to applications') ON CONFLICT DO NOTHING;

  -- 001_waterfall_parents.down.sql
  ALTER TABLE applications DROP COLUMN IF EXISTS waterfall_parents;
  DELETE FROM schema_migrations WHERE version = 1;
  ```
- **인덱스 보강 (v3)**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_children_dept_sub
    ON application_children(department, sub_department);
  CREATE INDEX IF NOT EXISTS idx_apps_created
    ON applications(created_at DESC);
  ```
- **데이터 흐름**: 학부모 1회 접수 시 `applications` 레코드 하나 + `waterfall_parents` JSONB 배열에 여러 보호자, 그리고 `application_id` FK로 묶인 `application_children` 다중 레코드가 단단히 결합됩니다.

### 1.5. 통합 관리자 페이지 개발 (`app/admin/page.tsx` & `components/AdminDashboard.tsx`)
- 부서별로 쪼개진 관리자 화면(`/kinder/admin`, `/kids/admin`, `/teens/admin`)을 단일 대시보드 `/admin`으로 통합합니다.
- **부서 전환 탭**: 상단에 나우킨더/나우키즈/나우틴즈 탭. 클릭 시 해당 부서 자녀 데이터만 동적 로드.
- **세부부서 2차 탭**: 대부서 내부에서 전체/통합부/유년부/소년부 등 2차 탭으로 필터링.
- **권한 격리 강화 (보안 보완)**:
  - 부서별 비밀번호 환경 변수(`ADMIN_PASSWORD_KINDER` 등)로 분리.
  - 로그인 라우트에서 JWT 발급 시 `allowed_departments: ['kids']` 같은 claim 포함.
  - 모든 어드민 API 라우트는 미들웨어에서 토큰 검증 + 부서 화이트리스트 필터링.
  - **통합 권한 계정**(전체 부서 접근)은 별도 키로 격리하고 운영자에게만 부여.
- **부서별 데이터 격리 검증**: API 단에서 `WHERE department = ANY($1::text[])`를 항상 token claim 기반으로 강제, 클라이언트가 임의로 다른 부서 조회 시 403 반환.

---

## 2. 발생 가능 오류 사전 진단 및 예외 조치 (리스크 매트릭스)

| ID | 리스크 | 심각도 | 보완 조치 |
|----|--------|--------|-----------|
| R1 | DB 마이그레이션 실패·롤백 불가 | ★★★★★ | `schema_migrations` 버전 테이블 + UP/DOWN 스크립트 분리 + Neon Branch 백업 |
| R2 | Base64 포스터로 인한 응답 폭증 | ★★★★ | `/api/poster/[dept]` 분리, sharp WebP 압축, sessionStorage 캐싱, 1MB 상한 |
| R3 | `/apply` 풀페이지 진입 후 새로고침 시 입력 손실 | ★★★ | `localStorage` debounce 자동 저장 + 제출 성공 시 정리 |
| R4 | 통합 어드민의 다른 부서 개인정보 노출 | ★★★★ | 부서별 환경변수 + JWT claim + API 미들웨어 화이트리스트 |
| R5 | 세부부서 필터 성능 저하 | ★★ | `idx_children_dept_sub` 복합 인덱스, `idx_apps_created` 정렬 인덱스 |
| R6 | 한국 나이 자동 판정 모호성 | ★★★ | "추천" 표기로 강제 회피, 학년 입력 병행, 매핑 로직 단일 모듈화 |
| R7 | `any` 사용으로 인한 런타임 타입 오류 | ★★ | `lib/types.ts` 통합 + zod로 API 응답 검증 |
| R8 | Next.js 16 빌드 호환 (params Promise, Turbopack) | ★★ | 신규 dynamic route는 `params: Promise<...>` 강제, pre-deploy `tsc --noEmit && next build` |
| R9 | 워터풀 보호자 JSONB 내부 스키마 미강제 | ★★ | 클라이언트·서버 양측 zod 검증, relation 드롭다운 강제 |
| R10 | 운영 중 장애 시 롤백 전략 부재 | ★★★ | Neon Branch 스냅샷, DOWN 스크립트 동봉, Vercel rollback 절차 문서화 |
| R11 | `NEXT_PUBLIC_ADMIN_PASSWORD` 클라이언트 노출 | ★★★★ | 즉시 제거, 서버사이드 환경변수 + JWT 발급 라우트로 이전 |
| R12 | `lib/db.ts` 한글 인코딩 깨짐 | ★★★ | UTF-8 정상 텍스트로 즉시 복구 (선결 과제 0.1) |

> [!IMPORTANT]
> - **데이터 마이그레이션**: 기존 데이터 유실을 완벽 차단하기 위해 `ALTER TABLE`은 항상 `IF NOT EXISTS` + `DEFAULT` 가드와 함께 사용하고, NULL 백필 쿼리를 후속 실행합니다.
> - **Base64 이미지 처리**: 부서 변경 시 발생하는 수 MB 응답을 회피하기 위해 포스터 전용 엔드포인트를 캐시하고 sharp WebP 압축을 강제합니다.
> - **필터 성능 인덱싱**: `/admin`에서 발생하는 JOIN + 필터 쿼리에 대비해 `(department, sub_department)` 복합 인덱스를 사전 생성합니다.
> - **권한 분리**: 통합 어드민 시 부서 교사가 타 부서 개인정보에 접근하지 못하도록 JWT claim 기반 화이트리스트를 적용합니다.

---

## 3. 구현 순서 (단계별 로드맵)

각 단계는 이전 단계 완료를 전제로 합니다. 단계마다 `npx tsc --noEmit && npm run build` 통과를 게이트로 둡니다.

### Phase 1 — 인프라 정비 (Foundation)
- [ ] `lib/db.ts` 한글 인코딩 복구
- [ ] Neon Branch 백업 생성 (`pre-overhaul-2026-05-28`)
- [ ] `schema_migrations` 테이블 도입 및 마이그레이션 러너 작성
- [ ] `lib/types.ts` 공용 타입 통합
- [ ] zod 의존성 추가 및 공용 스키마 작성 (`lib/schemas.ts`)

### Phase 2 — 백엔드 변경 (Backend)
- [ ] `applications.waterfall_parents JSONB` 컬럼 추가 (마이그레이션 v1)
- [ ] 복합 인덱스 추가 (마이그레이션 v2)
- [ ] `POST /api/applications` 핸들러가 `waterfall_parents` 저장하도록 확장
- [ ] `/api/poster/[dept]` 신규 엔드포인트 + 캐시 헤더
- [ ] `/api/admin/login` JWT 발급 + 부서 claim
- [ ] 어드민 미들웨어에서 토큰·부서 검증

### Phase 3 — 신청 폼 (Frontend - Apply)
- [ ] `/apply` 풀페이지 라우트 생성
- [ ] `localStorage` 자동 저장 훅
- [ ] Step 1 워터풀 보호자 Dynamic Array Input + zod 검증
- [ ] Step 2 자녀 카드 + 실시간 부서 콘텐츠 매핑 + 포스터 스켈레톤
- [ ] 자동 부서 추천 모듈 (`lib/age-to-department.ts`)

### Phase 4 — 통합 어드민 (Frontend - Admin)
- [ ] `/admin` 페이지 신설 + 부서 탭 + 세부부서 2차 탭
- [ ] JWT 발급 폼 (부서 비밀번호 입력)
- [ ] 부서별 데이터 격리 검증 (E2E)
- [ ] 결제·설정·커스텀 필드 UI는 기존 컴포넌트 재사용

### Phase 5 — 랜딩 페이지 (Frontend - Home)
- [ ] `app/page.tsx`를 단일 버튼 + `/apply` 이동으로 단순화
- [ ] 기존 부서 페이지 링크는 footer에 hidden 유지

### Phase 6 — 검증 및 배포 (QA & Release)
- [ ] `npx tsc --noEmit` + `npm run build` 통과
- [ ] 수동 테스트 시나리오 실행 (아래 4. 검증 계획 참조)
- [ ] Neon 콘솔에서 데이터 무결성 확인
- [ ] Vercel 배포 + 즉시 모니터링 (1시간)
- [ ] 문제 시 Neon Branch 롤백 + Vercel rollback 절차 실행

---

## 4. 검증 계획

### 4.1. 자동화 검증
- `npx tsc --noEmit`로 TypeScript 전체 타입 통과 확인.
- `npm run build`로 Next.js 16 Turbopack 빌드 통과 확인.
- (선택) zod 스키마 단위 테스트 추가 (`tests/schemas.test.ts`).

### 4.2. 수동 검증 시나리오
1. **/apply 풀페이지**
   - 자녀 2명 등록 + 워터풀 보호자 3명 등록 → 정상 제출.
   - Step 2 진행 중 새로고침 → 입력값 복원 확인.
   - 부서 변경 시 포스터/성구/슬로건 실시간 매핑 확인.
2. **/admin 통합 패널**
   - 부서 탭 전환 시 데이터 동적 로드 확인.
   - 세부부서 2차 탭 필터링 정확성 확인.
   - 잘못된 부서 비밀번호로 로그인 시 차단 확인.
   - 한 부서 토큰으로 다른 부서 API 직접 호출 시 403 확인.
3. **데이터 무결성**
   - Neon SQL 에디터에서 `SELECT waterfall_parents FROM applications LIMIT 5` → JSONB 형식 확인.
   - 마이그레이션 후 `SELECT version FROM schema_migrations` → 적용 버전 확인.
4. **성능**
   - 부서 페이지 첫 로딩에서 포스터 응답 1MB 이하 확인 (DevTools Network).
   - 어드민 신청 100건 이상에서 필터링 응답 500ms 이하 확인.

### 4.3. 롤백 절차
1. Vercel: 이전 정상 배포로 즉시 rollback.
2. DB: 해당 마이그레이션의 DOWN 스크립트 실행 또는 Neon Branch 복원.
3. 환경변수: 변경된 키만 이전 값으로 되돌림.

---

## 5. 부록: 디렉토리·파일 변경 요약

```
새로 생성:
  app/apply/page.tsx                     # 풀페이지 신청 라우트
  app/admin/page.tsx                     # 통합 어드민
  app/api/admin/login/route.ts           # JWT 발급
  app/api/poster/[dept]/route.ts         # 포스터 전용 캐시 엔드포인트
  lib/types.ts                           # 공용 타입
  lib/schemas.ts                         # zod 스키마
  lib/age-to-department.ts               # 부서 추천 로직
  migrations/001_waterfall_parents.sql
  migrations/001_waterfall_parents.down.sql
  migrations/002_indexes.sql
  migrations/002_indexes.down.sql

수정:
  app/page.tsx                           # 단일 버튼화
  lib/db.ts                              # 한글 인코딩 복구 + 마이그레이션 러너
  components/ApplicationForm.tsx         # /apply로 분리 후 props 정리
  components/AdminDashboard.tsx          # 부서 탭 + 세부부서 필터
  app/api/applications/route.ts          # waterfall_parents 처리

제거(또는 hidden):
  app/{kinder,kids,teens}/admin/page.tsx # /admin으로 통합 (footer 링크만 유지)
```
