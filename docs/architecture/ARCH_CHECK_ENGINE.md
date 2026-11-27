# 아키텍처 점검 엔진

이 문서는 아키텍쳐 탭의 점검을 수행하는 엔진의 모듈 구성과 동작 방식을 설명합니다. 판정 규칙 자체는 [ARCHITECTURE_CHECK.md](../reference/ARCHITECTURE_CHECK.md)에, 엔진을 고칠 때 지켜야 할 규칙은 [DEVELOPMENT_GUIDE.md](../development/DEVELOPMENT_GUIDE.md#아키텍처-점검-엔진을-고칠-때)에 있습니다.

## 전체 구조

```text
   CheckArchView (웹뷰)
          │  startArchCheck { projectPath, runtimeGeneration? }
          ▼
   Controller                               src/core/controller/index.ts
          │  resolveRipgrepPath()           src/utils/ripgrepPath.ts
          ▼
   checkEgovArchitecture()                  src/utils/archChecker.ts
          │
   ┌──────┴──────┬─────────────────┬──────────────┬───────────┐
   ▼             ▼                 ▼              ▼           ▼
 Project     DAO / Mapper     데이터 접근     Controller    Service
                               설정 정보
```

엔진의 모든 모듈은 `vscode`를 import하지 않습니다. 판정 모듈(`javaIndex`, `daoCheck`, `buildFileCheck`, `dataAccessConfigScan`)은 파일 읽기 함수(`readFile`)를 주입받고, 파서(`javaSource`, `mavenPom`, `gradleBuild`)는 텍스트를 받습니다. 진입점인 `archChecker.ts`만 ripgrep 또는 `fs`로 파일을 직접 수집하고, 읽기 캐시를 만들어 판정 모듈에 넘깁니다. 그래서 엔진 전체를 확장 호스트의 Vitest(`npm run test`)로 직접 검증합니다.

이 엔진은 MCP 서버 [egovframe-mcp-check](https://github.com/eGovFramework/egovframe-mcp-check)에도 이식되어 있습니다. 판정 로직을 바꿀 때에는 이 저장소에 먼저 반영하고, 그 뒤에 MCP 서버로 이식합니다.

## 모듈 구성

| 모듈 | 책임 |
|------|------|
| `src/utils/archChecker.ts` | 진입점 `checkEgovArchitecture`와 `exportArchResults`. 파일 수집(ripgrep 또는 fs), 실행 순서, Controller와 Service 판정, 레이어별 집계, CSV 작성 |
| `src/utils/javaSource.ts` | 주석 제거(`stripJavaComments`), `package`와 `import` 수집, 타입 선언부 추출(`findTypeDeclaration`), 읽기 캐시(`createCachedReader`) |
| `src/utils/javaIndex.ts` | 프로젝트 `.java` 파일의 FQCN 색인(`buildJavaIndex`)과 단순 이름 참조의 해석(`resolveTypeReference`). 해석 순서는 단일 import, 같은 패키지, 와일드카드 import, 유일한 단순 이름입니다. |
| `src/utils/daoCheck.ts` | DAO / Mapper 통합 레이어. 제외 규칙, 상속 체인 추적(`traceInheritance`), 어노테이션과 기반 클래스의 출처 해석(`resolveOrigin`), Base / Bean / Version 판정(`checkDaoLayer`) |
| `src/utils/runtimeModuleGraph.ts` | 실행환경 브랜치별 모듈 의존 그래프 상수(`RUNTIME_MODULE_GRAPH`), 필수 라이브러리 4종(`REQUIRED_LIBRARIES`), 전이 도달 판정(`reachRequiredLibrary`) |
| `src/utils/mavenPom.ts` | `pom.xml` 파서(`parseMavenPom`): parent, properties, dependencies, dependencyManagement, modules, 주석 제거, `${...}` 치환 |
| `src/utils/gradleBuild.ts` | `build.gradle`, `build.gradle.kts`, `settings.gradle`, `gradle.properties`, `libs.versions.toml` 파서 |
| `src/utils/buildFileCheck.ts` | 위 세 모듈을 묶어 Project 항목을 만듭니다(`checkProjectBuild`): 모듈별 세대와 버전, 필수 라이브러리 4종, 버전 일관성, 파일이 속한 모듈의 세대 조회(`generationForFile`) |
| `src/utils/dataAccessConfigScan.ts` | 데이터 접근 설정 정보(`scanDataAccessConfig`)와 미분류 데이터 접근 파일(`findUnclassifiedDataAccessFiles`). 정보 항목이어서 판정에 영향을 주지 않습니다. |
| `src/utils/ripgrepPath.ts` | VS Code에 내장된 ripgrep 실행 파일의 탐색(`resolveRipgrepPath`) |
| `src/shared/archCheck.ts` | 결과 타입 (확장 호스트와 웹뷰가 공유, 타입만 포함) |
| `src/shared/archCheckReport.ts` | Project 결과를 Module / Item / Status / Evidence 행으로 펴는 `projectReportRows`. 웹뷰의 상세 표와 `Result_Project` CSV가 같은 행 규칙을 씁니다. |

엔진 안의 의존 관계는 두 갈래입니다. Java 소스 쪽에서는 `daoCheck`가 `javaIndex`를, `javaIndex`가 `javaSource`를 사용합니다. 빌드 파일 쪽에서는 `buildFileCheck`가 `mavenPom`, `gradleBuild`, `runtimeModuleGraph`를 사용합니다. `archChecker.ts`가 이 모듈들을 순서대로 호출합니다.

DAO와 Mapper는 하나의 레이어(`DAO`)로 합쳐져 있습니다. 결과 객체에 `Mapper`라는 키는 없으며, 화면에는 "DAO / Mapper"로 표시됩니다.

## 점검이 진행되는 과정

### 1. ripgrep 탐색

엔진은 ripgrep을 직접 찾지 않고, Controller가 `resolveRipgrepPath({ appRoot, extensionPath })`로 찾은 경로를 `rgPath` 옵션으로 주입받습니다. 탐색은 네 단계로 진행합니다.

| 단계 | 후보 |
|------|------|
| 1 | `vscode.env.appRoot` 아래의 고정 후보 6개: `@vscode/ripgrep-universal/bin/<platform>-<arch>/rg`(VS Code 1.122 이후), `@vscode/ripgrep/bin/rg`, `vscode-ripgrep/bin/rg`를 각각 `node_modules`와 `node_modules.asar.unpacked`에서 찾습니다. |
| 2 | `appRoot` 아래의 `@vscode/ripgrep*` 패키지 디렉터리를 나열해 `bin/` 아래의 `rg`를 찾습니다. 패키지 이름이 바뀌어도 구조가 같으면 찾을 수 있습니다. |
| 3 | 시스템에 설치된 `rg` (`/usr/bin`, `/opt/homebrew/bin`, `/usr/local/bin`, `PATH`) |
| 4 | 저장소의 `node_modules/@vscode/ripgrep-<platform>-<arch>/bin/rg`와 `node_modules/@vscode/ripgrep/bin/rg`. Extension Development Host에서 쓰기 위한 후보입니다. |

네 단계에서 모두 찾지 못하면 엔진은 `fs`로 디렉터리를 재귀 탐색합니다.

확장은 ripgrep 실행 파일을 VSIX에 넣지 않습니다. `@vscode/ripgrep` 1.18.0은 개발용 의존성(devDependency)으로만 설치되며, ESM 전용 패키지여서 esbuild의 CommonJS 번들에 넣거나 런타임에 import하면 동작하지 않습니다.

### 2. 파일 수집

모든 레이어가 같은 규칙(`collectProjectFiles`)으로 파일을 수집합니다.

- `rgPath`의 실행 파일이 실제로 있으면 `rg --files --no-ignore`를 실행하고, 없으면 `fs`로 탐색합니다. ripgrep으로 수집했으면 진행 문구에 `with ripgrep`이 붙습니다.
- 이름이 `.`으로 시작하는 디렉터리와 `EXCLUDED_DIRECTORY_NAMES`(`node_modules`, `target`, `build`, `out`, `dist`)는 깊이와 관계없이 건너뛰고, `src/test`와 `src/it` 아래는 수집하지 않습니다. 테스트용 fixture가 판정과 Controller의 "DAO X" 이름 집합에 섞이지 않게 하기 위해서입니다.
- `--no-ignore`를 주어 `.gitignore`, `.ignore`와 관계없이 `fs` 경로와 같은 파일 집합을 얻습니다.
- ripgrep은 셸을 거치지 않고 인자 배열로 실행합니다. 프로젝트의 **부모 디렉터리**를 작업 디렉터리로 삼고 프로젝트 디렉터리 이름을 상대 경로로 넘깁니다. 절대 경로를 넘기면 심볼릭 링크(macOS의 `/var` → `/private/var`)를 거칠 때 제외 글롭이 경로 접두어를 떼지 못하고, 작업 디렉터리를 프로젝트로 두면 루트 이름이 `src`일 때 `src/test`가 제외되지 않기 때문입니다.
- 검색 경로 인자 앞에는 옵션의 끝을 뜻하는 `--`를 둡니다. 디렉터리 이름이 `-x`처럼 `-`로 시작해도 ripgrep의 옵션으로 읽히지 않게 하기 위해서입니다.
- `.java` 파일은 한 번만 모아서 색인하고, 레이어별 파일은 그 목록에서 파일 이름의 접미어로 거릅니다.

두 수집 경로의 결과가 달라지는 경우가 두 가지 있습니다.

| 경우 | ripgrep 경로 | fs 경로 |
|------|--------------|---------|
| 이름이 `.`으로 시작하는 파일 (예: macOS에서 만든 압축 파일을 풀면 생기는 `__MACOSX/._Foo.java`) | 수집함 | 수집하지 않음 |
| 프로젝트 안에 읽을 권한이 없는 디렉터리가 있음 | ripgrep이 오류 코드로 끝나서 수집 결과가 0건이 됨 | 그 디렉터리만 건너뛰고 나머지를 수집함 |

### 3. 실행 순서

Project(빌드 파일), DAO / Mapper, 데이터 접근 설정 정보, Controller, Service의 순서로 실행합니다.

- Project가 가장 먼저 실행되는 이유는, 여기에서 판정한 실행환경 세대가 DAO / Mapper의 Version 체크에 입력으로 쓰이기 때문입니다.
- DAO / Mapper가 Controller보다 먼저 실행되는 이유는, DAO / Mapper의 판정 대상 타입 이름이 Controller의 "DAO X" 체크에 입력으로 쓰이기 때문입니다.

### 4. 읽기 캐시와 상속 추적

- 빌드 파일과 `.java` 파일은 `createCachedReader`로 경로마다 한 번만 읽습니다.
- Service의 상속 체인에서 부모 클래스 파일은 디렉터리를 다시 훑지 않고 `.java` 색인(`buildJavaIndex`)에서 찾습니다. 자식의 `package`와 `import`로 해석하고(`resolveTypeReference`), 해석되지 않으면 이름이 같은 첫 후보를 씁니다. 그래서 부모 탐색 범위도 수집 규칙과 같습니다.

### 5. 결과 전달과 CSV

- 결과(`ArchCheckResults`)는 `archCheckResult` 메시지로 웹뷰에 전달됩니다.
- CSV는 웹뷰가 보관하던 결과를 `exportArchResults` 메시지로 되돌려 보내면 `exportArchResults()`가 작성합니다.
- CSV의 모든 셀은 `csvCell`을 거칩니다. 쉼표, 큰따옴표, 줄바꿈은 인용하고, `=`, `+`, `@`, 탭, CR로 시작하는 값과, `-`로 시작하면서 그 뒤에 숫자나 `.`이 아닌 글자가 오는 값에는 `'`를 붙여 스프레드시트의 수식 주입을 막습니다. `-12`나 `-.5` 같은 음수는 그대로 둡니다.

## 로그

엔진의 오류 로그는 `describeError`(시스템 오류는 code, 그 밖은 message)와 `path.basename`만 사용하며, Error 객체와 절대 경로, 스택은 남기지 않습니다. 엔진은 `console`로만 로그를 쓰고 "eGovFrame Initializr" 출력 채널에는 쓰지 않습니다. 그래서 엔진의 로그는 확장 호스트의 콘솔(F5로 실행했을 때의 Debug Console)에서 확인하고, 사용자에게는 점검 실패의 사유가 아키텍쳐 탭의 오류 영역에 표시됩니다.

## 실행환경 모듈 그래프

필수 라이브러리의 전이 의존을 판정하는 `RUNTIME_MODULE_GRAPH`(`src/utils/runtimeModuleGraph.ts`)는 실행환경 모듈 사이의 compile 의존을 추출한 상수입니다.

| 브랜치 | 추출 원본 | 추출일 |
|--------|-----------|--------|
| 3.9.x, 3.10.x, 4.0.x, 4.1.x, 4.2.x, 4.3.x, 5.0.x | GitHub `eGovFramework/egovframe-runtime`의 브랜치별 모듈 `pom.xml` | 2026-10-28 |
| 5.1.x | 실행환경 v5.1.0 **베타** sources jar의 `META-INF/maven` pom | 2026-11-03 |

- 5.1.x 그래프에는 AI 모듈(`ai-core`, `ai-langchain4j`, `ai-springai`)이 추가되어 있고, 필수 라이브러리 4종에 도달하는 경로는 5.0.x와 같습니다. 베타에서 추출했으므로 정식 5.1.0의 pom으로 다시 추출해 확인해야 합니다.
- `selectGraphBranch`는 버전이 `5.1.`로 시작할 때에만 5.1.x 그래프를 쓰고, 버전을 모르는 5.x 프로젝트에는 5.0.x 그래프를 씁니다.
- 추출 원본은 `src/utils/__tests__/fixtures/runtime-graph/graph-<브랜치>.txt`에 있고, `runtimeModuleGraph.spec.ts`가 상수와 추출 원본의 일치를 검증합니다. 변환 규칙은 `runtimeModuleGraph.ts`의 머리 주석과 테스트의 `parseFixture`에 적혀 있습니다.

그래프를 갱신하는 절차는 [DEVELOPMENT_GUIDE.md](../development/DEVELOPMENT_GUIDE.md#실행환경-모듈-그래프-갱신)에 있습니다.
