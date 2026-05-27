# 높은뜻덕소교회 지금세대교육부 (미취학, 초등학생, 중고생) 통합 홈페이지

높은뜻덕소교회 지금세대교육부의 수련회 및 특별 행사 신청서 작성과 부서별 정보 제공을 위한 프로젝트 저장소입니다.

## 📄 핵심 문서 안내

프로젝트 분석, 인수인계용 상세 사양서 및 확정된 최종 구현 계획서는 아래의 문서에서 즉시 확인하실 수 있습니다.

👉 **[상세 개발 사양서 (project_specification.md)](file:///c:/Users/Administrator/Desktop/project%20temp/Education/project_specification.md)**

👉 **[최종 구현 계획서 (implementation_plan.md)](file:///c:/Users/Administrator/Desktop/project%20temp/Education/implementation_plan.md)**

👉 **[실시간 진행 현황판 (task.md)](file:///c:/Users/Administrator/Desktop/project%20temp/Education/task.md)**

## 🚀 프로젝트 주요 요구사항

1.  **메인 홈 주제**: `<2026 여름 바이블 캠프>`
2.  **부서별 페이지 구성 및 개별 디자인**:
    *   **나우킨더** (미취학 아동 및 학부모) -> 따뜻하고 아기자기한 디자인
    *   **나우키즈** (초등학생) -> 활기차고 역동적인 디자인
    *   **나우틴즈** (중고생) -> 트렌디한 다크모드/네온 스타일 디자인
3.  **부서별 하위 어드민 경로 구축**:
    *   `/kinder/admin`
    *   `/kids/admin`
    *   `/teens/admin`
4.  **우선 구현 사항 (핵심)**:
    *   구글 폼 수준의 다이나믹하고 검증 가능한 신청서 작성 기능
    *   **백엔드**: Firebase(Firestore, Auth, Hosting)를 RDBMS 구조형 모델로 구성
