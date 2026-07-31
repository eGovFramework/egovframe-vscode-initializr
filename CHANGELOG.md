# Changelog

## v5.0.6 (2026-07-15)
- Code Generation
  - Monaco SQL Worker가 CSP(default-src 'none')에 막혀 동작하지 않던 문제 수정
  - MyBatis Mapper SQL이 Java 클래스명 대신 실제 DB 테이블명(DDL 원본 테이블명)을 사용하도록 수정 (Refs: PR #23)
  - UPDATE 구문 SET 절에서 PK 컬럼을 제외하도록 수정 (Refs: PR #6)
  - 컬럼명에서 언더스코어 뒤에 숫자가 오는 경우(addr_1 등) camelCase 변환이 누락되어 언더스코어가 남던 문제 수정 (Refs: PR #28)
  - 컬럼 COMMENT 본문에 "primary key" 문구가 있을 때 해당 컬럼이 PK로 오분류되어 생성 SQL의 WHERE 절이 잘못되던 문제 수정 (Refs: PR #27)
  - COMMENT·DEFAULT 문자열 안의 콤마·괄호 때문에 컬럼 분리가 깨져 DDL 파싱과 CRUD 코드 생성이 실패하던 문제 수정 (Refs: PR #34)
  - 생성된 MyBatis Mapper의 LIKE 검색이 문자열 결합에 `||`를 사용해 MySQL 기본 설정(PIPES_AS_CONCAT 미적용)에서 검색 조건이 무시되고 검색어와 무관하게 전체 행이 반환되던 문제 수정 — 방언 중립인 `<bind>`로 교체 (Refs: PR #35)
  - 코드 생성 실패 사유가 "알 수 없는 오류"로 대체되던 문제 수정 — 익스텐션 → 웹뷰 응답에 탭 스코프를 부여하고 실패 사유 페이로드를 text로 통일. 다른 탭의 실패가 Config 탭 오류 화면이나 Output Path 덮어쓰기로 번지지 않고, 프로젝트 템플릿 로드 실패는 Projects 탭에 표시된다 (Refs: PR #36)
  - Java 패키지명과 groupId 검증을 통일해 연속된 점과 숫자로 시작하는 세그먼트를 거부하도록 수정 (Refs: PR #37)
- Project Generation
  - POM 생성 시 입력값(프로젝트명·groupId 등)에 `$`가 포함되면 `String.replace`의 치환 특수 시퀀스로 해석되어 pom.xml이 손상되던 문제 수정 (Refs: PR #25)
  - Group ID 검증이 연속된 점(com..example)과 숫자로 시작하는 세그먼트(com.123)를 허용해 잘못된 Maven groupId가 생성되던 문제 수정 (Refs: PR #30)
  - Security: 프로젝트명·설정 파일명 입력에 경로 조작(CWE-22) 검증 추가 — 생성 결과가 지정한 출력 디렉터리를 벗어나지 못하도록 봉쇄 (Refs: PR #31)
  - VS Code 1.128(Node.js 24.17.0)에서 zip 파일 압축해제 시 hang 발생 오류 수정: extract-zip → adm-zip 으로 교체
  - 템플릿 보안 취약점 업데이트(NCSC, 국정원, KISA):
    - egovframe-ai-rag-langchain4j
    - egovframe-ai-rag-springai
    - egovframe-boot-simple-backend
    - egovframe-boot-simple-frontend
    - egovframe-boot-web
    - egovframe-mobile-deviceapi
    - egovframe-msa-common-components
    - egovframe-msa-portal-backend
    - egovframe-template-common-components
    - egovframe-template-enterprise
    - egovframe-template-portal
    - egovframe-web
- Security
  - 웹뷰 → 익스텐션 메시지를 판별 유니온 타입으로 확정하고 zod 기반 런타임 검증 추가 — 경로 구성에 쓰이는 필드는 안전한 문자 집합으로 제한
  - 웹뷰에 CSP 적용
  - handlebars 4.7.9 업데이트로 JS Injection·Prototype Pollution 등 취약점 8종 해소 (Refs: PR #20)
  - vite 6.4.3 업데이트로 dev server 취약점 7종 해소 (Refs: PR #21)
- Refactoring
  - Controller의 테마 변경 이벤트 리스너를 Disposable로 정리해 리소스 누수 방지 (Refs: PR #17)
  - 미사용 git 유틸리티(src/utils/git.ts) 제거

## v5.0.5 (2026-05-18)
- Project Generation
  - 템플릿 보안 취약점 업데이트(KISA): Common Components, Boot Simple Homepage (Backend/Frontend), MSA Portal (Backend)

## v5.0.4 (2026-04-10)
- Project Generation 
  - 템플릿 보안 취약점 업데이트(KISA): egovframe-boot-simple-backend 
  - 기타 템플릿 오류 수정

## v5.0.3 (2026-03-31)
- v5.0.x Initial official Release
- Project Generation
  - AI 카테고리에 **RAG Project (LangChain4j) 템플릿 추가**
  - 표준프레임워크 실행환경 5.0 정식버전이 적용된 템플릿으로 최신화
- Code Generation
  - 기본적인 SQL Validation만 수행하는 "generic" dialect 옵션 추가
  - Thymeleaf 핸들바 템플릿 2종 생성 경로 수정
  - PackageName 검증 기능 강화
  - 선택한 dialect에 따른 sample DDL 필터링 개선
- Config Generation
  - 입력 필드의 특수문자 및 숫자에 대한 검증 기능 추가
  - Handlebars 템플릿 비교 연산자 오류 수정
- Egov Settings
  - **언어 선택 옵션** 추가 (Refs: PR #1)
  - 입력값 검증 기능 추가
  - Save Settings 버튼 클릭 시 저장 성공 또는 실패 여부를 시각적으로 확인할 수 있도록 개선

## v5.0.2 Beta (2026-01-06)
- sample-thymeleaf-register.hbs 핸들바 파싱 오류 수정

## v5.0.1 Beta (2026-01-06)
- sample-controller-template.hbs 핸들바 파싱 오류 수정

## v5.0.0 Beta (2025-12-04)
- v5.0.x Initial Beta Release
