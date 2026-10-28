# Changelog

## Unreleased
- Architecture Check
  - 번들 빌드에서 `@vscode/ripgrep`의 `rgPath`가 존재하지 않는 경로를 가리켜 ripgrep이 한 번도 동작하지 않고 항상 fs 재귀 탐색으로 떨어지던 문제 수정. 확장이 rg를 배포하는 대신 VS Code가 설치한 rg를 쓴다. 탐색 순서는 Cline 확장과 같은 고정 후보 6개(`vscode.env.appRoot` 아래 `@vscode/ripgrep-universal/bin/<platform>-<arch>/rg`, `@vscode/ripgrep/bin/rg`, `vscode-ripgrep/bin/rg`의 `node_modules`·`node_modules.asar.unpacked` 배치) → `@vscode/ripgrep*` 패키지 디렉터리 나열 → 시스템 rg(`/usr/bin`, `/opt/homebrew/bin`, `/usr/local/bin`, PATH) → 개발 환경의 저장소 node_modules `@vscode/ripgrep` 1.18.0 플랫폼 패키지 → fs 탐색. 엔진은 `vscode` 의존 없이 rg 경로를 주입받고, 이 프로젝트는 esbuild CJS 번들 방식이라서 esm 전용인 `@vscode/ripgrep`은 런타임 import 없이 devDependency 1.18.0으로 올림.
  - fs 대체 경로가 글롭을 잘못 변환해 경로에 `Controller.java`가 포함되기만 하면(e.g., `*Controller.java.bak` 등) 매칭되고, 숨김 디렉터리·`target/`·`build/`·`node_modules/`·`out/`·`dist/`까지 모두 훑던 문제 수정. ripgrep 경로에도 같은 제외 글롭을 적용해 git 저장소 여부와 무관하게 두 경로의 결과가 같도록 함. `archChecker`·`ripgrepPath` 단위 테스트 추가
  - Controller 매핑 판정 결과에 매핑된 public 메서드 수와 점검 대상 메서드 수, 클래스 레벨 `@RequestMapping` 여부를 실어, 상세 결과의 Mapping 칸과 CSV의 Mapping Annotation 열에 FAIL / Class level / a/b / PASS로 표시. 판정 규칙은 그대로이며 일부 메서드만 매핑된 경우를 알아볼 수 있게 함
  - Controller의 비어 있던 check3를 DAO 주입 금지 조건("DAO X")으로 사용. 주석이 아닌 줄에서 `*DAO`·`*Dao`·DAO 레이어 판정 대상에 같은 이름이 있는 `*Mapper` 타입의 필드·매개변수·지역 변수 선언을 찾으면 실패로 표시하고 판정식을 c1 ∧ c2 ∧ c3로 변경. 라이브러리 타입(`ObjectMapper` 등)은 오탐하지 않음
  - Service 점검의 상속(check1)이 중간 클래스 이름을 `EgovCommonServiceImpl`로 고정 가정해, 프로젝트가 다른 이름의 공통 ServiceImpl을 거쳐 `EgovAbstractServiceImpl`을 상속하면 NotFound로 판정하던 문제 수정. 주석이 아닌 줄의 `extends` 뒤 부모 클래스 이름을 그대로 읽어 소스 루트에서 상속 체인(최대 5단계)을 추적한다. 체인을 따라가며 조부모 이름을 읽을 때도 주석에 적힌 `extends`는 무시한다(Service·DAO 공통)
  - Service 점검의 인터페이스 구현(check3)이 `implements` 뒤 파일 어디에든 `Service`라는 문자열(메서드 본문의 문자열 리터럴, 주입 필드의 타입 이름 등)만 있으면 통과시키던 문제 수정. 파일 이름과 같은 클래스의 선언부(`class` ~ 첫 `{`)에서 `implements` 목록을 파싱해, 제네릭 인자와 패키지 경로를 뗀 단순 이름이 `Service`로 끝나는 인터페이스가 하나 이상 있을 때만 통과한다. 여러 줄에 걸친 선언도 같은 경로로 처리하므로 종전의 2차 검사는 제거
  - CheckArch 탭이 탭 스코프 체계(PR #36)에서 빠져 다른 탭의 실패가 CheckArch 탭 오류로 표시되고, 아키텍처 점검 오류가 스코프 없이 발신되어 모든 탭의 오류 표시·오류 화면으로 번지던 문제 수정 (Refs: PR #36)
  - DAO와 Mapper 레이어를 "DAO / Mapper" 한 레이어로 통합. 공식 적용점검 가이드가 DAO 항목에 iBatis DAO·MyBatis DAO·Mapper 인터페이스 세 방식을 택1로 두므로 `*DAO.java`·`*Dao.java`·`*Mapper.java`를 함께 모아 파일 내용으로 방식을 분류하고, 기반(Base: `EgovAbstractDAO`/`EgovAbstractMapper` 상속 또는 `@Mapper`/`@EgovMapper`) ∧ 빈 등록(Bean: `@Repository` 또는 어노테이션의 import 출처가 표준프레임워크 패키지) ∧ 버전 정합(Version: 세대를 모르면 n/a)으로 판정. 중간 클래스 경유 상속은 패키지 선언 기준 FQCN 색인으로 추적하고(동명 클래스·주석 안 `extends` 오독 해소), MyBatis `org.apache.ibatis.annotations.Mapper`를 쓴 인터페이스는 실패로 표시. abstract 클래스·`@Configuration` 클래스·RowMapper 같은 비(非) 데이터 접근 `*Mapper`·Spring Data 저장소·MapStruct·`@Repository` 없는 기반 클래스는 판정에서 빼고 Skipped 목록으로 표시. 모든 레이어에서 `src/test`·`src/it` 아래를 제외하고 ripgrep이 `.gitignore`를 따르지 않도록 `--no-ignore`를 적용해 fs 대체 경로와 같은 집합을 모음. Controller "DAO X"의 입력을 `*Mapper.java` 파일 이름 집합에서 DAO 레이어 판정 대상 집합으로 바꿔 공통컴포넌트의 `ObjectMapper.java` 때문에 Jackson `ObjectMapper` 주입이 실패로 표시되던 오탐 해소. CSV는 `Result_DAO_*.csv`의 열을 Style/Base/Bean/Version으로 바꾸고 `Result_Mapper_*.csv`는 더 이상 만들지 않음
  - 프로젝트 수준 점검 항목(Project) 추가. `pom.xml`·`build.gradle`·`build.gradle.kts`를 빌드 도구 실행 없이 읽어 실행환경 세대·버전(버전 속성 → BOM parent/import → 의존성 버전 → 좌표 패턴 순, 증거 표시)과 필수 라이브러리 4종(`ptl-mvc`·`fdl-cmmn`·`fdl-logging`·`psl-dataaccess`)의 적용 여부를 판정. 직접 선언뿐 아니라 실행환경 저장소의 모듈 의존 그래프(3.9.x~5.0.x)를 내장해 전이 의존(예: `ptl-mvc` → `fdl-cmmn` → `fdl-logging`)을 인정하고 exclusion은 Maven 의미론대로 하위 트리를 끊으며, 그래프 밖 표준프레임워크 아티팩트(cloud·boot-starter 등)를 선언한 모듈은 누락을 unknown으로 표시. 멀티 모듈(parent 체인·내부 모듈 의존·`settings.gradle` include)과 모듈 간 버전 일관성도 점검하며, 가이드의 4종 규칙을 모든 모듈에 엄격 적용하므로 배치·MSA 템플릿은 누락 라이브러리가 증거와 함께 NotFound로 표시됨. DAO / Mapper의 Version 칸이 이 세대와 비교되고(불일치는 실패), Runtime 드롭다운(Auto / 3.x / 4.x / 5.x)으로 세대를 수동 지정할 수 있음. 결과는 Project 카드와 상세 결과의 Project 항목(`Module / Item / Status / Evidence`), `Result_Project_*.csv`로 내보냄. `buildSrc` 빌드 파일과 `packaging pom` 모듈은 판정에서 건너뜀
  - Project 항목에 스프링 데이터 접근 설정 정보 추가(판정에는 영향 없음). `src/main/resources`·`src/main/java`·`src/main/webapp/WEB-INF`에서 `SqlMapClientFactoryBean`(패키지 접두어 표시)·`SqlSessionFactoryBean`·`MapperConfigurer`·`@MapperScan`(속성 유무)·`mybatis-spring-boot-starter`·`mybatis.mapper-locations`의 존재를 모아 보이고, Mapper 인터페이스가 있는데 스캔 설정이 없거나 iBatis DAO가 있는데 `SqlMapClientFactoryBean`이 없는 경우 등 다섯 가지 교차 경고를 정보로 표시. 수집 글롭 밖에서 `JdbcTemplate`·`EntityManager`·`SqlSessionTemplate` 등을 직접 쓰는 파일을 "미분류 데이터 접근 파일"로 함께 표시
- Code Generation
  - DDL 입력 내용을 기반으로 테이블, 컬럼, PK/FK, 1:N 관계를 표시하는 ERD Preview 추가 (Refs: PR #10)
  - DDL COMMENT를 파싱해 VO 필드 주석에 반영 (Refs: PR #18)
  - NUMBER 타입을 정밀도/스케일 기반으로 매핑하고 누락된 SQL 타입 보강 (Refs: PR #19)
  - TEXT/BLOB/BYTE 타입을 각각 String/byte[]/byte[]로 변환하도록 매핑 추가 (Refs: PR #16)
  - ERD Preview에서 컬럼 COMMENT 본문의 "primary key"·"references" 문구를 제약조건으로 오인해 PK/FK가 잘못 표시되던 문제 수정 (Refs: PR #33)
- Config Generation
  - AOP 트랜잭션 설정 템플릿에서 txAdvisor의 잘못된 직접 메서드 호출 수정 (Refs: PR #12)
  - TransactionForm의 READ_UNCOMMITTED 오타 수정 (Refs: PR #9)
- Internationalization
  - 웹뷰 UI(*.tsx) 다국어(i18n) 처리 (Refs: PR #29)
- Project Generation
  - modulith 카테고리 신설
  - 구버전(4.3.x) 템플릿 다운로드 캐시를 확장 설치 디렉터리 밖인 VS Code globalStorage(`<globalStorageUri>/template-cache/{examples,pom}/<version>/`)로 이동 — 확장 업데이트 후에도 캐시가 유지되고 VSIX 패키징에 섞여 들어가지 않으며, manifest가 버전마다 같은 파일명을 써도 서로 덮어쓰지 않음. 임시 파일 이름에 프로세스 ID를 넣어 여러 창의 동시 다운로드가 겹치지 않게 하고, 하루 넘게 남은 임시 파일은 다음 다운로드 때 정리
  - 템플릿 무결성 검증에 실패하면 Projects 탭에 확장 업데이트·캐시 삭제 안내를 표시
- Security
  - GitHub Releases에서 내려받는 구버전 템플릿 ZIP·POM의 sha256을 manifest(`templates-projects.json`의 `sha256`/`pomSha256`)에 기록하고, 다운로드 직후와 캐시 사용 시마다 대조해 일치할 때만 압축 해제 — 해시가 기록되지 않은 항목은 다운로드를 거부하고, 불일치한 캐시는 삭제 후 한 번 다시 받음
  - 템플릿 다운로드가 웹뷰가 보낸 downloadUrl·파일명을 그대로 신뢰하던 문제 수정 — 웹뷰는 templateId·version만 보내고 호스트가 번들 manifest에서 다운로드 경로·파일명을 확정
  - 템플릿 다운로드에 https 강제, 리다이렉트 횟수 상한(5회)·https 유지, 응답 크기 상한(200MB), 소켓 타임아웃을 적용하고 임시 파일에 받아 검증 후 캐시로 이동
- Refactoring
  - 컬럼 유효성 검사 로직 분리 (Refs: PR #13)
  - 불필요한 try/catch(no-useless-catch) 제거 (codeGenerator.ts) (Refs: PR #24)

## v5.0.7 (2026-10-16)
- Project Generation
  - egovframe-msa-common-components 템플릿 프로젝트에서 모바일 신분증 소스코드 제거
- Code Generation
  - CRUD 안내 문구의 뷰 파일명 표기를 실제 생성 파일명과 일치시킴
  - 컬럼 COMMENT 본문에 "primary key" 문구가 있을 때 해당 컬럼이 PK로 오분류되어 생성 SQL의 WHERE 절이 잘못되던 문제 수정 (Refs: PR #27)
  - COMMENT·DEFAULT 문자열 안의 콤마·괄호 때문에 컬럼 분리가 깨져 DDL 파싱과 CRUD 코드 생성이 실패하던 문제 수정 (Refs: PR #34)
  - 생성된 MyBatis Mapper의 LIKE 검색이 문자열 결합에 `||`를 사용해 MySQL 기본 설정(PIPES_AS_CONCAT 미적용)에서 검색 조건이 무시되고 검색어와 무관하게 전체 행이 반환되던 문제 수정 — 방언 중립인 `<bind>`로 교체 (Refs: PR #35)
  - 코드 생성 실패 사유가 "알 수 없는 오류"로 대체되던 문제 수정 — 익스텐션 → 웹뷰 응답에 탭 스코프를 부여하고 실패 사유 페이로드를 text로 통일. 다른 탭의 실패가 Config 탭 오류 화면이나 Output Path 덮어쓰기로 번지지 않고, 프로젝트 템플릿 로드 실패는 Projects 탭에 표시된다 (Refs: PR #36)
  - Java 패키지명과 groupId 검증을 통일해 연속된 점과 숫자로 시작하는 세그먼트를 거부하도록 수정 (Refs: PR #37)
  - 생성된 JSP 화면이 요청 파라미터를 이스케이프 없이 출력해 반사형 XSS가 가능하던 문제 수정 — 등록/수정 화면의 검색 조건 hidden 필드와 목록 화면의 검색어 입력 필드를 `c:out`으로 감쌈 (Refs: PR #39)
  - 생성된 Thymeleaf 등록/수정 화면이 PK 컬럼마다 `<div>`를 하나 더 열고 닫지 않아 버튼 영역이 입력 필드 영역(fieldset) 안으로 들어가던 문제 수정 — PK 분기에 중복으로 열려 있던 `form-group` 여는 태그 제거 (Refs: PR #40)
  - 생성된 Thymeleaf 등록/수정 화면에 `<title>`이 하나도 출력되지 않던 문제 수정 — 두 `<title>`의 `th:if` 조건만 `${}` 없이 쓰여 registerFlag가 변수가 아닌 리터럴 토큰으로 평가되던 것을 같은 파일의 나머지 조건 표기에 맞춤 (Refs: PR #41)
  - Code 탭이 설정 화면을 다녀오는 등 기본 설정(egovSettings)을 다시 받을 때 사용자가 입력한 Package Name을 기본값으로 덮어쓰던 문제 수정 — 값이 직전 기본값 그대로일 때만 설정값으로 채우고, 기본값 복원은 입력란 옆 버튼에 맡김 (Refs: PR #42)
- Security
  - adm-zip 0.6.0으로 업데이트하여 CVE-2026-39244 취약점 해소
- Refactoring
  - 발신처 없는 switchEgovTab 메시지 리스너 제거
  - TS 7.0 대비 웹뷰 tsconfig(tsconfig.app.json)의 deprecated baseUrl 제거 및 paths 상대화
  - 발신자 없는 transferDDLToCodeView 메시지 경로 제거
  - TS 7.0 대비 루트 tsconfig의 deprecated baseUrl 제거 및 paths 상대화
  - 미사용 경로 별칭 @api·@integrations·@services·@packages 제거

## v5.0.6 (2026-07-15)
- Code Generation
  - Monaco SQL Worker가 CSP(default-src 'none')에 막혀 동작하지 않던 문제 수정
  - MyBatis Mapper SQL이 Java 클래스명 대신 실제 DB 테이블명(DDL 원본 테이블명)을 사용하도록 수정 (Refs: PR #23)
  - UPDATE 구문 SET 절에서 PK 컬럼을 제외하도록 수정 (Refs: PR #6)
  - 컬럼명에서 언더스코어 뒤에 숫자가 오는 경우(addr_1 등) camelCase 변환이 누락되어 언더스코어가 남던 문제 수정 (Refs: PR #28)
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
