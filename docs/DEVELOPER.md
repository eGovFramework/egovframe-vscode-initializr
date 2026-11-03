# Developer Guide

## 개요

eGovFrame VSCode Initializr를 기반으로 개발하려는 개발자를 위한 기능 및 시스템 소개 문서입니다.

- 아키텍쳐 및 폴더 구조는 [ARCHITECTURE 가이드 문서](./ARCHITECTURE.md)에서 확인 가능합니다.

## 기술 스택

### Backend (Extension Host)
- **런타임**: Node.js
- **언어**: TypeScript 5.4+
- **빌드**: ESBuild 0.25+
- **템플릿 엔진**: Handlebars 4.7+
- **파일 처리**:
  - fs-extra 11.2+ (파일 시스템 유틸리티)
  - extract-zip 2.0+ (ZIP 압축 해제)

### Frontend (Webview UI)
- **프레임워크**: React 18.3+
- **언어**: TypeScript 5.7+
- **빌드**: Vite 6.3+ + SWC
- **스타일링**:
  - TailwindCSS 4.1+ (유틸리티 우선 CSS)
  - VSCode CSS 변수 통합 (테마 시스템)
- **코드 에디터**:
  - Monaco Editor 0.31+ (코어)
  - @monaco-editor/react 4.7+ (React 래퍼)
  - monaco-sql-languages 0.15+ (MySQL/PostgreSQL 언어 지원)
- **UI 컴포넌트**:
  - 커스텀 React 컴포넌트 (VSCode 네이티브 스타일)
  - lucide-react 0.511+ (아이콘)
  - clsx 2.1+ (조건부 클래스명 유틸리티)
- **상태 관리**: React Context API + 커스텀 훅
- **폼 처리**: 네이티브 HTML 폼 + React 상태 관리
- **테스트**: Vitest 3.0+ + Testing Library + JSdom

### 개발 도구
- **린터**: ESLint 8.57+ + TypeScript ESLint 8.18+
- **포매터**: Prettier 3.3+
- **타입 체킹**: TypeScript (strict mode)
- **Git Hooks**: Husky 9.1+ + lint-staged 16.1+
- **패키징**: @vscode/vsce 3.6+

## UI 컴포넌트 시스템

### VSCode 테마 통합 아키텍처

프로젝트는 VSCode의 네이티브 디자인 시스템과 완전히 통합된 커스텀 React 컴포넌트 라이브러리를 구축했습니다.

#### 핵심 설계 원칙
- **네이티브 VSCode 스타일**: 모든 UI 컴포넌트가 VSCode 기본 테마와 일관성 유지
- **다크/라이트 테마 지원**: VSCode CSS 변수를 활용한 자동 테마 전환
- **타입 안전성**: 완전한 TypeScript 지원

#### 커스텀 UI 컴포넌트 라이브러리

| 컴포넌트 | 설명 | VSCode 테마 변수 |
|----------|------|------------------|
| **Button** | Primary, Secondary, Ghost 버튼 | `--vscode-button-*` |
| **TextField** | 텍스트 입력 필드 | `--vscode-input-*` |
| **TextArea** | 멀티라인 텍스트 입력 | `--vscode-input-*` |
| **Select** | 드롭다운 선택 박스 | `--vscode-input-*` |
| **RadioGroup** | 라디오 버튼 그룹 | `--vscode-checkbox-*` |
| **Checkbox** | 체크박스 입력 | `--vscode-checkbox-*` |
| **ProgressRing** | 로딩 인디케이터 | `--vscode-progressBar-*` |
| **Link** | 링크 컴포넌트 | `--vscode-textLink-*` |
| **Divider** | 구분선 | `--vscode-panel-border` |

#### VSCode 테마 변수 활용
```typescript
// 예시: Button 컴포넌트의 테마 스타일
const getButtonStyles = (variant: 'primary' | 'secondary') => ({
  backgroundColor: variant === 'primary'
    ? 'var(--vscode-button-background)'
    : 'var(--vscode-button-secondaryBackground)',
  color: variant === 'primary'
    ? 'var(--vscode-button-foreground)'
    : 'var(--vscode-button-secondaryForeground)',
  border: '1px solid var(--vscode-button-border)',
  // 호버 효과
  '&:hover': {
    backgroundColor: variant === 'primary'
      ? 'var(--vscode-button-hoverBackground)'
      : 'var(--vscode-button-secondaryHoverBackground)'
  }
})
```

#### 테마 시스템 구조
```typescript
// VSCode 테마 컨텍스트
interface VSCodeTheme {
  colors: {
    // 배경색
    background: string
    inputBackground: string
    buttonBackground: string

    // 전경색
    foreground: string
    inputForeground: string
    buttonForeground: string

    // 테두리
    inputBorder: string
    focusBorder: string
  }
  spacing: { xs: string, sm: string, md: string, lg: string }
  borderRadius: { sm: string, md: string, lg: string }
  fontSize: { xs: string, sm: string, md: string, lg: string }
}
```

#### 네이티브 HTML 엘리먼트 활용
성능 최적화와 브라우저 호환성을 위해 핵심 입력 컴포넌트들은 네이티브 HTML 엘리먼트를 직접 사용:

- **CodeView DDL TextArea**: `<textarea>` + VSCode 테마 인라인 스타일
- **Select 박스들**: `<select>` + `appearance: none` + VSCode 테마 스타일
- **모든 버튼들**: `<button>` + 동적 이벤트 핸들러

#### Monaco Editor 활용

**DDL 입력 및 코드 미리보기**에서 Monaco Editor를 사용하여 고급 편집 기능을 제공합니다.

##### 주요 기능
- **SQL 문법 강조 (Syntax Highlighting)**:
  - `monaco-sql-languages` 라이브러리를 통한 MySQL/PostgreSQL DDL 문법 강조
  - `monaco-sql-languages` 라이브러리를 통한 실시간 SQL 문법 검증 및 오류 표시
  - `monaco-sql-languages` 라이브러리를 통한 자동 완성 및 인텔리센스 지원

- **멀티 SQL 방언 지원**:
  - MySQL과 PostgreSQL DDL 문법 전환 지원
  - 각 방언별 전용 Language Worker 사용
  - 동적 언어 모드 전환

- **실시간 DDL 검증**:
  - Monaco Editor의 마커(Marker) API를 통한 실시간 오류 감지
  - 500ms 디바운스로 최적화된 검증 성능
  - Worker 기반 백그라운드 검증으로 UI 블로킹 방지

- **코드 미리보기**:
  - 생성될 코드를 Monaco Editor로 표시
  - Java, XML, JSP, HTML 등 언어별 문법 강조
  - 읽기 전용 모드로 안전한 미리보기 제공

##### 기술 구현
```typescript
// Monaco Editor 설정
import Editor, { loader } from "@monaco-editor/react"
import * as monaco from "monaco-editor"
import "monaco-sql-languages/esm/languages/mysql/mysql.contribution"
import "monaco-sql-languages/esm/languages/pgsql/pgsql.contribution"

// Worker를 Vite를 이용해 inline으로 Import
import MySQLWorker from "monaco-sql-languages/esm/languages/mysql/mysql.worker?worker&inline"
import PgSQLWorker from "monaco-sql-languages/esm/languages/pgsql/pgsql.worker?worker&inline"
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker&inline"

// 커스텀한 Monaco 설정을 등록 (@monaco-editor/react가 monaco 설정을 CDN으로 로드하여 커스텀한 Monaco 설정이 등록되지 않는 문제 방지)
loader.config({ monaco })

// Worker 설정 (Vite inline 번들링으로 CORS 문제 해결)
window.MonacoEnvironment = {
  getWorker(_: any, label: string) {
    if (label === "mysql") return new MySQLWorker()
    if (label === "pgsql") return new PgSQLWorker()
    return new EditorWorker()
  }
}

// 실시간 검증: 모델 내용이 변경될 때마다 디바운스 후 검증 (테이블 이름 변경 등 모든 변경사항 감지)
editor.onDidChangeModelContent()
// 실시간 검증: 언어 변경 시 즉시 재검증 (SQL 방언 변경: MySQL ↔ PostgreSQL)
editor.onDidChangeModelLanguage()
// 실시간 검증: Monaco Worker가 마커(에러 내용)를 업데이트할 때마다 즉시 검증
monacoInstance.editor.onDidChangeMarkers()
```

##### 성능 최적화
- **Worker 번들링**: Vite의 `?worker&inline` 플래그로 Worker를 base64 인라인 번들링
- **CORS 문제 해결**: VSCode Webview 환경에서 외부 Worker 로딩 문제 해결
- **지연 검증**: 입력 후 500ms 디바운스로 불필요한 검증 방지
- **백그라운드 처리**: Web Worker를 통한 비동기 문법 분석

##### 보안: CSP와 Web Worker

웹뷰는 `enableScripts: true`로 스크립트 실행이 켜져 있고, `postMessage`를 통해 파일 생성·명령 실행 등 권한 있는 Extension Host에 닿습니다. 따라서 웹뷰 HTML(`src/core/webview/index.ts`의 `getHtmlForWebview()`)에 **Content-Security-Policy(CSP)** 를 설정해 방어 계층을 둡니다.

```typescript
// inline script 허용을 위한 보안용 랜덤 nonce 생성
const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("")

const csp = [
  `default-src 'none'`,                              // 기본 전면 차단(deny-by-default)
  `script-src 'nonce-${nonce}' ${webview.cspSource}`, // nonce 부여 inline script + 로컬 번들만
  `style-src ${webview.cspSource} 'unsafe-inline'`,   // 다수 inline style + Monaco 동적 주입 <style>
  `worker-src ${webview.cspSource} blob:`,            // ★ 인라인 Worker(blob:) 동적 생성 허용
  `font-src ${webview.cspSource} data:`,              // codicon 폰트·data: 인라인
  `img-src ${webview.cspSource} data:`,               // 아이콘·data: 인라인
].join("; ")
// <meta http-equiv="Content-Security-Policy" content="${csp};"> 로 삽입
// 두 <script> 에는 nonce 부여
```

- **`worker-src ... blob:` 가 핵심**: `monaco-sql-languages`의 방언별 Worker는 `?worker&inline` 번들링으로 **base64 → `blob:` URL**에서 동적 생성됩니다. CSP에 `worker-src`가 없으면 `default-src 'none'`으로 폴백되어 **Worker 생성이 차단**되고, 그 결과 SQL 문법 강조·실시간 검증이 동작하지 않습니다. 반드시 `worker-src`에 `blob:`을 허용해야 합니다.
- **nonce**: `default-src 'none'` 하에서 `window.__EGOV_INIT_LANGUAGE__` 부트스트랩 inline script가 실행되려면 매 렌더마다 생성한 nonce를 `<script nonce="...">`로 부여해야 합니다.
- **이력 참고**: 과거 워커가 뜨지 않아 CSP를 통째로 제거한 적이 있으나(보안 봉쇄 전부 상실), 실제 원인은 `worker-src` 누락이었습니다. CSP를 유지한 채 `worker-src blob:`만 허용하면 워커도 동작하고 보안도 지킬 수 있습니다.

> ⚠️ 브라우저/Electron 버전에 따라 Worker 스크립트를 `script-src`로도 검사하는 경우, 워커가 여전히 차단되면 `worker-src`에 `data:`를 추가하거나 `script-src`에 `blob:`을 추가합니다. 사양상 정석은 `worker-src blob:`입니다.

## 아키텍처 점검 엔진

CheckArch 탭의 점검은 확장 호스트의 순수 모듈들이 수행합니다. 모든 모듈은 `vscode`를 import하지 않습니다. 판정 모듈(`javaIndex`·`daoCheck`·`buildFileCheck`·`dataAccessConfigScan`)은 파일 읽기(`readFile`)를 주입받고 파서(`javaSource`·`mavenPom`·`gradleBuild`)는 텍스트를 받으며, 진입점 `archChecker.ts`가 ripgrep/fs로 파일을 직접 수집하고 읽기 캐시(`createCachedReader`)를 만들어 넘깁니다. 그래서 root Vitest(`npm run test`)로 직접 검증합니다.

### 모듈 구성

| 모듈 | 책임 |
|------|------|
| `src/utils/archChecker.ts` | 진입점 `checkEgovArchitecture`와 `exportArchResults`. 파일 수집(ripgrep/fs), 실행 순서(Project → DAO / Mapper → 데이터 접근 설정 → Controller → Service), 레이어별 집계, CSV 작성 |
| `src/utils/javaSource.ts` | 주석 제거(`stripJavaComments`), `package`·`import` 수집, 타입 선언부 추출(`findTypeDeclaration`), 읽기 캐시(`createCachedReader`) |
| `src/utils/javaIndex.ts` | 프로젝트 `.java`의 FQCN 색인(`buildJavaIndex`)과 단순 이름 참조 해석(`resolveTypeReference`: 단일 import → 같은 패키지 → 와일드카드 → 유일한 단순 이름) |
| `src/utils/daoCheck.ts` | DAO / Mapper 통합 레이어. 제외 규칙 S1~S7, 상속 체인 추적(`traceInheritance`), 어노테이션·기반 클래스 출처 해석(`resolveOrigin`), Base/Bean/Version 3체크(`checkDaoLayer`) |
| `src/utils/runtimeModuleGraph.ts` | 실행환경 브랜치별 모듈 의존 그래프 상수(`RUNTIME_MODULE_GRAPH`), 필수 라이브러리 4종(`REQUIRED_LIBRARIES`), 전이 도달 판정(`reachRequiredLibrary`) |
| `src/utils/mavenPom.ts` | `pom.xml` 파서(`parseMavenPom`): parent·properties·dependencies·dependencyManagement·modules, 주석 제거, `${...}` 치환 |
| `src/utils/gradleBuild.ts` | `build.gradle(.kts)`·`settings.gradle`·`gradle.properties`·`libs.versions.toml` 파서 |
| `src/utils/buildFileCheck.ts` | 위 세 모듈을 묶어 Project 항목을 만든다(`checkProjectBuild`): 모듈별 세대·버전, 필수 4종 엄격 적용, 버전 일관성, 파일→모듈 세대 매핑(`generationForFile`) |
| `src/utils/dataAccessConfigScan.ts` | Project의 데이터 접근 설정 정보(`scanDataAccessConfig`)와 미분류 데이터 접근 파일(`findUnclassifiedDataAccessFiles`). 정보 항목이라 판정에 영향을 주지 않는다 |
| `src/shared/archCheck.ts` | 결과 타입(호스트·웹뷰 공유, 타입만) |
| `src/shared/archCheckReport.ts` | Project 결과를 보고 행으로 펼치는 `projectReportRows`. 웹뷰 상세 테이블과 `Result_Project` CSV가 같은 행 규칙을 쓴다 |

의존 방향은 `javaSource` → `javaIndex` → `daoCheck`, `mavenPom`·`gradleBuild`·`runtimeModuleGraph` → `buildFileCheck`입니다. `archChecker.ts`가 이들을 순서대로 호출하고, Project 결과의 세대를 DAO 레이어(check3)에 넘기며 DAO 판정 대상 타입 이름을 Controller의 "DAO X" 입력으로 씁니다.

### 파일 수집 규칙

모든 레이어가 같은 규칙을 씁니다(`collectProjectFiles`).

- 숨김 디렉터리(`.`으로 시작)와 빌드 산출물 디렉터리(`EXCLUDED_DIRECTORY_NAMES`: `node_modules`, `target`, `build`, `out`, `dist`)는 건너뜁니다
- `src/test`와 `src/it` 아래는 수집하지 않습니다(테스트 픽스처가 판정과 Controller "DAO X" 이름 집합에 섞이지 않도록)
- ripgrep 호출에는 `--no-ignore`를 붙여 `.gitignore`·`.ignore`와 무관하게 fs 대체 경로와 같은 파일 집합을 얻습니다
- rg는 프로젝트의 부모 디렉터리를 cwd로 두고 프로젝트 디렉터리 이름을 상대 경로로 넘겨 실행합니다. 절대 경로를 넘기면 심볼릭 링크(macOS `/var` → `/private/var`)를 거칠 때 제외 글롭이 경로 접두어를 떼지 못하고, cwd를 프로젝트로 두면 루트 이름이 `src`일 때 `src/test`가 제외되지 않습니다. 검색 경로 앞에는 옵션 끝 구분자 `--`를 두어, 디렉터리 이름이 `-x`·`-L`처럼 `-`로 시작해도 rg 옵션으로 읽히지 않게 합니다
- Service 상속 체인(check1)의 부모 클래스 파일은 디렉터리를 다시 훑지 않고 `checkEgovArchitecture`가 만든 `.java` 색인(`buildJavaIndex`)에서 찾습니다. 자식의 package·import로 해석하고(`resolveTypeReference`), 해석되지 않으면 이름이 같은 첫 후보를 씁니다. 그래서 부모 탐색 범위도 수집 규칙과 같이 `projectPath` 아래·심볼릭 링크 제외·`src/test` 제외입니다
- CSV의 모든 셀은 `csvCell`을 거칩니다: 쉼표·큰따옴표·줄바꿈은 인용하고, `=`·`+`·`@`·탭·CR로 시작하거나 `-` 뒤에 숫자가 아닌 글자가 오는 값에는 `'`를 붙여 스프레드시트 수식 주입을 막습니다
- 엔진의 오류 로그는 `describeError`(시스템 오류는 code, 그 밖은 message)와 `path.basename`만 쓰고 Error 객체·절대 경로·스택을 남기지 않습니다

### 결과 계약 동기화 체크리스트

결과 필드를 추가하거나 바꿀 때는 아래를 항상 함께 고칩니다. 하나라도 빠지면 웹뷰나 CSV에서 값이 사라집니다.

1. `src/shared/archCheck.ts`: 타입 추가·변경
2. `src/shared/webviewMessageSchema.ts`: 같은 모양의 zod 스키마(`archCheckResultSchema` 등). 스키마에 없는 필드는 호스트가 메시지를 검증할 때 **strip되므로**, 결과가 웹뷰에서 호스트로 되돌아오는 CSV 내보내기에서 조용히 사라집니다
3. `src/utils/archChecker.ts`와 해당 모듈: 값을 채우는 코드, CSV 열(`exportArchResults`, `projectReportRows`)
4. `webview-ui/src/components/egov/tabs/CheckArchView.tsx`: 표시. 공통 표시 로직은 `checkArch/checkDisplay.ts`, Project 카드·상세는 `ProjectSummaryCard.tsx`·`ProjectReportTable.tsx`. 이 spec(`__tests__/CheckArchView.spec.tsx`, `checkArch/checkDisplay.spec.ts`)도 함께 고칩니다
5. 테스트: `src/utils/__tests__/*.spec.ts`, `src/shared/webviewMessageSchema.test.ts`, `src/shared/archCheckReport.spec.ts`
6. `CHANGELOG.md`의 Unreleased 항목

### 실행환경 모듈 그래프 상수

`RUNTIME_MODULE_GRAPH`는 GitHub `eGovFramework/egovframe-runtime`의 브랜치(3.9.x, 3.10.x, 4.0.x, 4.1.x, 4.2.x, 4.3.x, 5.0.x)별 모듈 `pom.xml`에서 2026-10-28에 추출한 모듈 간 compile 의존입니다. 5.1.x는 실행환경 v5.1.0 **베타** sources jar의 `META-INF/maven` pom에서 2026-11-03에 추출한 것으로(AI 모듈 `ai-core`·`ai-langchain4j`·`ai-springai` 추가, 필수 라이브러리 4종 도달 경로는 5.0.x와 동일), 정식 5.1.0 릴리스 뒤 다시 추출해 확인해야 합니다. `selectGraphBranch`는 버전이 `5.1.`로 시작할 때만 5.1.x를 쓰고 버전을 모르면 정식 5.0.x를 씁니다. 추출 원본은 `src/utils/__tests__/fixtures/runtime-graph/graph-<branch>.txt`에 있고, 변환 규칙은 `runtimeModuleGraph.ts` 머리 주석과 `runtimeModuleGraph.spec.ts`의 `parseFixture`에 적혀 있습니다.

새 실행환경 버전이 나와 그래프가 바뀌면 다음 순서로 갱신합니다.

1. 해당 브랜치의 모듈 pom에서 의존을 다시 추출해 `graph-<branch>.txt` 픽스처를 교체합니다(새 브랜치면 파일을 추가하고 `RuntimeGraphBranch`·`selectGraphBranch`도 확장)
2. `npm run test`를 돌립니다. `runtimeModuleGraph.spec.ts`가 상수와 픽스처의 불일치를 잡아냅니다
3. 실패한 모듈 항목을 `RUNTIME_MODULE_GRAPH`에 반영하고 테스트가 통과하는지 확인합니다

## 빌드 시스템

### Extension 빌드 (ESBuild)

**설정 파일**: `esbuild.js`

#### 주요 특징
- **번들링**: 모든 소스를 단일 `dist/extension.js` 파일로 번들
- **타입스크립트 컴파일**: 네이티브 TS 지원
- **경로 별칭**: `@core`, `@utils`, `@shared` 등 단축 경로
- **감시 모드**: 개발 중 자동 리빌드
- **ripgrep**: 아키텍처 점검은 rg를 배포하지 않고 `src/utils/ripgrepPath.ts`가 네 단계로 찾는다. (1) Cline 확장과 같은 고정 후보 6개(`vscode.env.appRoot` 아래 `@vscode/ripgrep-universal/bin/<platform>-<arch>/rg`, `@vscode/ripgrep/bin/rg`, `vscode-ripgrep/bin/rg`), (2) `@vscode/ripgrep*` 패키지 디렉터리 나열, (3) 시스템 rg(`/usr/bin`, `/opt/homebrew/bin`, `/usr/local/bin`, PATH), (4) 저장소 `node_modules/@vscode/ripgrep-<platform>-<arch>/bin/rg`(devDependency `@vscode/ripgrep` 1.18.0이 설치하는 플랫폼 패키지, Extension Development Host용). 모두 없으면 fs 재귀 탐색으로 대체한다. 이 프로젝트는 esbuild CJS 번들 방식인 반면 `@vscode/ripgrep`은 ESM 전용이기 때문에 런타임에 import하거나 번들하면 안 된다
- **WASM 파일 복사**: Tree-sitter 언어 파서용

#### 빌드 명령어
```bash
# 개발 빌드 + 감시
npm run watch

# 프로덕션 빌드
npm run package

# 타입 체크
npm run check-types

# 린팅
npm run lint
```

### Webview UI 빌드 (Vite)

**설정 파일**: `webview-ui/vite.config.ts`

#### 주요 특징
- **React + SWC**: 빠른 개발 서버 및 빌드
- **TailwindCSS + VSCode 테마**: 유틸리티 우선 CSS + VSCode 네이티브 스타일
- **커스텀 UI 라이브러리**: VSCode 테마 통합 React 컴포넌트
- **HMR**: Hot Module Replacement로 빠른 개발
- **타입스크립트**: 완전한 타입 안정성 (UI 컴포넌트 포함)
- **테스트**: Vitest + JSdom 환경

#### 빌드 명령어
```bash
# 개발 서버 시작
cd webview-ui && npm run dev

# 프로덕션 빌드
cd webview-ui && npm run build

# 테스트 실행
cd webview-ui && npm run test

# 테스트 커버리지
cd webview-ui && npm run test:coverage
```

## 트러블슈팅

### 일반적인 문제들

#### 1. Extension이 활성화되지 않는 경우
```bash
# 빌드 상태 확인
npm run check-types
npm run compile

# VS Code 개발자 도구에서 오류 확인
Ctrl+Shift+I (또는 Cmd+Option+I)
```

#### 2. Webview가 로드되지 않는 경우
```bash
# Webview UI 빌드 확인
cd webview-ui
npm run build

# 개발 서버 포트 확인 (25463)
npm run dev
```

#### 3. 템플릿 생성 오류

##### 프로젝트 템플릿 생성 실패
- **ZIP 파일 문제**:
  - `templates/projects/examples/` 폴더의 ZIP 파일 존재 확인
  - Git LFS 설정 확인 (ZIP 파일이 포인터 파일이 아닌지 확인)
  - ZIP 파일 손상 여부 확인 (`unzip -t <파일명>`)
- **POM 파일 문제**:
  - `templates/projects/pom/` 폴더의 POM 템플릿 존재 확인
  - 선택한 템플릿에 맞는 POM 파일 존재 확인 (예: `egovframe-boot-web-pom.xml`)
- **출력 경로 문제**:
  - 프로젝트 생성 대상 디렉토리의 쓰기 권한 확인
  - 디스크 공간 부족 여부 확인
  - 경로에 특수문자나 한글이 포함되어 있는지 확인

##### CRUD 코드 템플릿 생성 실패
- **Handlebars 템플릿 문제**:
  - `templates/code/` 폴더의 11개 템플릿 파일 존재 확인
  - Handlebars 문법 오류 검토 (중괄호 매칭, 헬퍼 함수 등)
  - 템플릿 메타데이터: `src/utils/codeGenerator.ts`의 `getTemplateFilesConfig()` 함수 확인
- **DDL 파싱 문제**:
  - Monaco Editor의 SQL Worker가 정상 작동하는지 확인
  - `dist/tree-sitter-wasms.wasm`, `dist/tree-sitter-sql.wasm` 파일 존재 확인
  - DDL 문법이 MySQL/PostgreSQL 표준에 맞는지 확인
- **출력 경로 문제**:
  - 프로젝트 루트가 올바르게 선택되었는지 확인
  - `src/main/java/` 등 표준 Maven/Gradle 디렉토리 구조 확인
  - 패키지명이 유효한지 확인 (예: `egovframework.example.sample`)

##### 설정 템플릿 생성 실패
- **템플릿 파일 문제**:
  - `templates/config/` 폴더의 하위 디렉토리 확인 (datasource, cache, logging 등)
  - 선택한 설정 유형에 맞는 템플릿 파일 존재 확인
  - 템플릿 메타데이터: `templates/templates-context-xml.json` 파일 확인
- **Handlebars 컨텍스트 문제**:
  - 폼 입력값이 올바르게 전달되는지 확인
  - 필수 입력값 누락 여부 확인
  - 브라우저 개발자 도구의 Console에서 오류 확인

#### 4. 미리보기 기능 문제
- **미리보기가 표시되지 않는 경우**:
  - DDL 유효성 확인 (500ms 디바운스 후 즉시 검증 완료)
  - "미리보기 생성" 버튼 클릭
  - 브라우저 개발자 도구에서 오류 확인
- **미리보기가 업데이트되지 않는 경우**:
  - DDL 변경 후 자동 무효화 확인
  - 자동 업데이트 옵션 활성화 여부 확인
  - 수동으로 "미리보기 생성" 버튼 재클릭
- **미리보기 생성이 느린 경우**:
  - 11개 템플릿 병렬 렌더링 확인
  - 네트워크 상태 및 VSCode 성능 확인

### 로그 확인 방법
```bash
# Extension 로그
VS Code > View > Output(출력) > eGovFrame Initializr

# Webview 로그
VS Code > Help > Toggle Developer Tools > Console
```

### Git LFS 문제 해결

#### 큰 파일 다운로드 실패 시
```bash
# Git LFS 파일들 강제 다운로드
git lfs pull --include="*.zip"

# 특정 파일만 다운로드
git lfs pull --include="templates/projects/examples/*.zip"
```

#### Git LFS 추적 목록 확인
```bash
# LFS로 추적되는 파일 목록 확인
git lfs ls-files

# LFS 설정 확인
git lfs track
```

#### `git lfs install` 명령 실행 전에 clone 한 경우
```bash
# LFS 설정 초기화
git lfs uninstall
git lfs install

# LFS 파일들 다시 다운로드
git lfs pull
```

#### Git LFS 추적 파일들이 변경되거나 추가 시
```bash
# LFS로 추적되는 파일을 Reomte에 Push
git lfs push --all origin main

# 그 후 소스코드를 Remote에 Push 한다
git push origin main
```


## 성능 최적화

### Extension 최적화
- **지연 로딩**: `activationEvents`를 `onStartupFinished`로 설정
- **번들 크기**: ESBuild로 최소화된 번들 (~500KB)
- **메모리 관리**: Webview 인스턴스 적절한 해제
- **템플릿 처리**: Handlebars 템플릿 컴파일 최적화

### Webview UI 최적화
- **코드 분할**: Vite의 동적 import 활용
- **네이티브 HTML 엘리먼트**: 성능 최적화를 위해 textarea, select, button 직접 사용
- **VSCode CSS 변수**: 런타임 테마 전환 최적화
- **리소스 최적화**: 이미지 및 폰트 최적화
- **메모이제이션**: React.memo, useMemo, useCallback 활용
- **경량 UI 라이브러리**: Material-UI 등 제거로 번들 크기 최소화
- **Context 최적화**: 필요한 상태만 선택적으로 구독

### Monaco Editor 최적화
- **Worker 인라인 번들링**: Vite `?worker&inline`으로 CORS 문제 해결 및 로딩 속도 향상
- **지연 검증**: 입력 후 500ms 디바운스로 불필요한 검증 방지
- **백그라운드 파싱**: Web Worker를 통한 비동기 SQL 문법 분석
- **마커 기반 검증**: Monaco의 onDidChangeMarkers 이벤트로 효율적인 오류 감지
- **초기화 최적화**: Editor mount 시 100ms 지연으로 Worker 초기화 대기

### 미리보기 성능 최적화
**미리보기 기능의 성능 최적화 전략**

#### 병렬 렌더링
- `Promise.all()`을 사용하여 11개 템플릿을 병렬로 렌더링하여 11배 속도 향상

#### 지연 미리보기 (Lazy Preview)
- DDL 입력시 빠른 검증만 수행 (500ms 디바운스)
- DDL 입력시마다 모든 템플릿 미리보기 생성하는 대신(느림), 사용자가 "미리보기 생성" 버튼을 클릭할 때만 전체 미리보기 생성
- **목적**: 불필요한 리소스 사용 방지, 사용자 선택권 제공

#### 스마트 캐시 관리
- **DDL 변경 감지**: DDL이 변경되면 기존 미리보기 자동 무효화
- **선택적 자동 업데이트**: 사용자가 원할 때만 자동 미리보기 업데이트
- **디바운싱**: 500ms 디바운스로 불필요한 요청 방지
- **이벤트 최적화**: onDidChangeMarkers 등의 이벤트를 활용하여 불필요한 검증 배제

#### 성능 효과
| 작업 | 성능 최적화 적용 X | 성능 최적화 적용 O | 개선율 |
|------|------|------|--------|
| **DDL 검증** | 즉시 검증 (UI 블로킹) | 500ms 디바운스 (백그라운드) | **UI 반응성 향상** |
| **미리보기 생성** | 매번 자동 생성 | 필요시만 생성 | **선택적 생성** |
| **템플릿 렌더링** | 순차 처리 | 병렬 처리 (Promise.all) | **~11배 속도 향상** |
| **Worker 로딩** | 외부 파일 (CORS 문제) | 인라인 번들 (base64) | **로딩 안정성 향상** |

## 배포 및 퍼블리싱

### 1. Extension 패키징
```bash
# VSIX 파일 생성
npm run package # script : npm run check-types && npm run build:webview && npm run lint && node esbuild.js --production

#vscode 패키지를 전역 설치한 경우
vsce package
#vscode 패키지를 프로젝트 로컬에만 설치한 경우
npx vsce package

# 생성된 파일: egovframe-initializr-{version}.vsix
```

### 2. 마켓플레이스에 배포 및 퍼블리싱
VSCode의 [Publishing Extensions 문서](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)를 참고하시기 바랍니다.

### 3. 배포 전 체크리스트
- [ ] 모든 테스트 통과
- [ ] 린팅 오류 없음
- [ ] `package.json` 버전 업데이트
- [ ] `CHANGELOG.md` 작성
- [ ] 프로덕션 빌드 테스트
- [ ] Extension Host에서 수동 테스트

## 참고 자료

### 공식 문서
- [VS Code Extension API](https://code.visualstudio.com/api)
- [eGovFrame 공식 사이트](https://www.egovframe.go.kr)
- [Spring Framework 문서](https://spring.io/docs)

### 기술 문서
- [React 공식 문서](https://react.dev)
- [TypeScript 문서](https://www.typescriptlang.org/docs/)
- [Vite 문서](https://vitejs.dev)
- [TailwindCSS 문서](https://tailwindcss.com)
- [Handlebars 문서](https://handlebarsjs.com)

## 라이선스

이 프로젝트는 Apache-2.0 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](../LICENSE) 파일을 참조하세요.

## 개발팀

- **eGovFrame Center** - 주관 기관
- **개발자**: [기여자 목록](#)

## 지원 및 문의

- **이슈 트래킹**: [GitHub Issues](https://github.com/egovframework/egovframe-vscode-initializr/issues)
- **공식 홈페이지**: https://www.egovframe.go.kr
- **문서**: [Wiki 페이지](https://www.egovframe.go.kr/wiki/doku.php) / [GitHub Docs 페이지](https://egovframework.github.io/egovframe-docs/)