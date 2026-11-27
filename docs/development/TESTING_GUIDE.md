# 테스트 가이드

이 문서는 확장 호스트와 웹뷰의 테스트를 실행하는 방법, 테스트의 구성, 그리고 자동 테스트로 확인할 수 없는 부분을 직접 확인하는 절차를 설명합니다.

## 명령

테스트는 두 패키지에 따로 있고, 둘 다 Vitest로 작성되어 있습니다.

| 명령 | 실행 위치 | 대상 |
|------|-----------|------|
| `npm run test` | 저장소 루트 | 확장 호스트 (`src/**/*.{test,spec}.ts`, node 환경) |
| `npm run test:watch` | 저장소 루트 | 확장 호스트 테스트의 watch 모드 |
| `npm run test` | `webview-ui/` | 웹뷰 (`*.spec.ts`, `*.spec.tsx`, `*.test.tsx`, jsdom 환경) |
| `npm run test:coverage` | `webview-ui/` | 웹뷰 테스트와 커버리지 |
| `npm run check-types` | 저장소 루트 | 확장 호스트의 타입 검사 |

```bash
npm run check-types
npm run lint
npm run test
cd webview-ui && npm run test
```

5.1.0을 기준으로 확장 호스트는 테스트 파일 23개에 테스트 333개(환경 변수가 없으면 건너뛰는 인수 테스트 6개 포함), 웹뷰는 테스트 파일 16개에 테스트 178개이며, 각각 수 초 안에 끝납니다.

테스트 하나만 실행하려면 파일 경로를 지정합니다.

```bash
npx vitest run src/utils/__tests__/daoCheck.spec.ts
```

## 확장 호스트 테스트

설정 파일은 루트의 `vitest.config.ts`입니다. 테스트는 `vscode` 모듈 없이 실행되므로, 테스트 대상 모듈은 `vscode`를 import하지 않아야 합니다.

| 주제 | 테스트 파일 | 검증 대상 |
|------|-------------|-----------|
| 메시지 계약 | `src/shared/webviewMessageSchema.test.ts`, `src/shared/webviewMessageRouting.test.ts` | 웹뷰 → 확장 메시지의 zod 검증, 탭 스코프 라우팅 |
| 경로 안전 | `src/utils/__tests__/pathSafety.spec.ts` | 프로젝트 이름과 파일 이름의 검증, 경로 이탈 방지 |
| 프로젝트 템플릿 | `templateManifest.spec.ts`, `templateManifestIssues.spec.ts`, `templatesProjectsManifest.spec.ts` | 매니페스트의 해석 규칙, 일관성 검사, 실제 `templates-projects.json`의 검증 |
| 템플릿 다운로드 | `templateDownload.spec.ts`, `templateCache.spec.ts` | https 강제, 리다이렉트와 크기의 상한, sha256 검증, 캐시 경로와 삭제. 전송 계층을 대역으로 바꾸어 네트워크 없이 실행합니다. |
| CRUD 코드 생성 | `codeTemplateFiles.spec.ts`, `sampleMapperTemplate.spec.ts`, `sampleViewTemplates.spec.ts` | 템플릿별 출력 경로, 실제 `.hbs` 파일의 렌더링 결과 |
| 아키텍처 점검 엔진 | `archChecker.spec.ts`, `daoCheck.spec.ts`, `buildFileCheck.spec.ts`, `dataAccessConfigScan.spec.ts`, `mavenPom.spec.ts`, `gradleBuild.spec.ts`, `javaIndex.spec.ts`, `javaSource.spec.ts`, `src/shared/archCheckReport.spec.ts` | 레이어별 판정, 빌드 파일 해석, 데이터 접근 설정 정보, 보고 행 |
| ripgrep 탐색 | `ripgrepPath.spec.ts` | VS Code 설치 형태별 `rg` 후보의 탐색 순서 |
| 실행환경 모듈 그래프 | `runtimeModuleGraph.spec.ts` | `RUNTIME_MODULE_GRAPH` 상수가 `fixtures/runtime-graph/graph-<브랜치>.txt`의 추출 원본과 일치하는지 |
| 인수 검증 | `acceptance.spec.ts` | 공식 템플릿 6종에 대한 점검 결과. 환경 변수가 있을 때에만 실행합니다. |

파일 경로를 적지 않은 테스트는 모두 `src/utils/__tests__/` 아래에 있습니다.

- `archChecker.spec.ts`는 임시 디렉터리에 Java fixture를 만들어 점검합니다. 저장소의 `node_modules`에 `@vscode/ripgrep`의 플랫폼 패키지가 설치되어 있으면 ripgrep 경로로도 같은 테스트를 실행합니다.
- `templatesProjectsManifest.spec.ts`는 실제 매니페스트를 읽어 검증하므로, 매니페스트를 고쳤을 때 형식 오류와 해시 누락을 잡아냅니다.

### 인수 테스트

공식 템플릿 프로젝트로 점검 엔진의 판정을 확인하는 테스트입니다. `EGOV_ACCEPTANCE_DIR`이 가리키는 디렉터리 아래에 템플릿 ZIP을 템플릿 이름의 디렉터리로 풀어 두고 실행합니다. 디렉터리가 없는 템플릿의 케이스는 건너뜁니다.

```bash
EGOV_ACCEPTANCE_DIR=/path/to/templates npx vitest run src/utils/__tests__/acceptance.spec.ts
```

대상 디렉터리 이름은 `egovframe-web`, `egovframe-boot-web`, `egovframe-template-common-components`, `egovframe-boot-simple-backend`, `egovframe-boot-batch-db-web`, `egovframe-msa-portal-backend/msa-board-service`입니다.

## 웹뷰 테스트

설정은 `webview-ui/vite.config.ts`의 `test` 블록에 있습니다. jsdom 환경에서 Testing Library로 컴포넌트를 렌더링하며, Monaco 편집기는 테스트 대상이 아니어서 빈 대역(`src/__mocks__/monaco-editor.ts`)으로 바꿉니다.

| 주제 | 테스트 파일 | 검증 대상 |
|------|-------------|-----------|
| 탭 화면 | `components/egov/tabs/__tests__/ProjectsView.spec.tsx`, `CodeView.spec.tsx`, `ConfigView.spec.tsx`, `CheckArchView.spec.tsx` | 메시지 수신에 따른 화면 상태, 탭 스코프에 따른 오류 표시, 기본 설정 반영 |
| 점검 결과 표시 | `components/egov/tabs/checkArch/checkDisplay.spec.ts` | 체크 값의 표시 규칙 |
| 다국어 | `i18n/__tests__/locales.spec.ts` | `en.json`과 `ko.json`의 키 집합이 같은지 |
| 공유 모듈 | `utils/__tests__/ddlParser.spec.ts`, `erdParser.spec.ts`, `dataTypes.spec.ts`, `placeholderUtil.spec.ts` | 루트의 `src/shared/`에 있는 DDL 파서, ERD 파서, 타입 매핑, 자리 표시자 치환 |
| 보조 함수 | `utils/__tests__/projectUtils.spec.ts`, `codeUtils.spec.ts`, `templateUtils.spec.ts`, `settingsUtils.spec.ts`, `platformUtils.spec.ts`, `hooks.spec.ts` | 입력값 검증, 메시지 생성, 설정 처리 |

경로는 모두 `webview-ui/src/` 기준입니다. DDL 파서와 ERD 파서의 소스는 루트의 `src/shared/`에 있지만, 테스트는 웹뷰 패키지에 있습니다. 파서를 고쳤으면 웹뷰 테스트도 함께 실행합니다.

## 테스트를 추가할 때

- 확장 호스트의 새 로직은 `vscode`에 의존하지 않는 모듈로 분리하고, `src/utils/__tests__/`에 `*.spec.ts`로 테스트를 추가합니다.
- 웹뷰 → 확장 메시지를 추가했으면 `src/shared/webviewMessageSchema.test.ts`에 통과하는 예와 거부되는 예를 추가합니다.
- CRUD 템플릿을 고쳤으면 실제 `.hbs`를 렌더링해서 결과 텍스트를 검사하는 테스트(`sampleMapperTemplate.spec.ts`, `sampleViewTemplates.spec.ts`)에 케이스를 추가합니다. 실행해야 드러나는 결함을 고친 경우에도, 같은 결함을 렌더링 결과의 텍스트로 검사하는 테스트를 남겨서 다시 발생하지 않게 합니다.
- 화면 문구를 추가했으면 두 locale 파일에 같은 키를 넣습니다. `locales.spec.ts`가 불일치를 잡아냅니다.
- 점검 엔진의 판정을 바꿨으면 [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md#결과-계약-동기화)의 목록에 있는 테스트를 함께 고칩니다.

## 직접 확인해야 하는 부분

자동 테스트는 확장 호스트의 순수 모듈과 웹뷰 컴포넌트를 검증합니다. `vscode` API에 의존하는 부분은 Extension Development Host(F5)에서 직접 확인합니다.

| 기능 | 확인할 것 |
|------|-----------|
| 프로젝트 생성 | 내장 버전(5.1.0)으로 생성되는지, 다운로드 버전(4.3.2)이 처음에는 내려받고 두 번째에는 캐시를 쓰는지, 같은 이름의 폴더가 있으면 중단되는지 |
| 캐시 명령 | **Show Template Cache Info**가 내려받은 파일을 보여 주는지, **Clear Template Cache** 뒤에 다시 내려받는지 |
| CRUD 코드 생성 | DDL 검증, 미리보기, ERD가 표시되는지, 파일 선택 뒤에 파일이 생성 위치에 만들어지는지 |
| 설정 파일 생성 | 출력 형식별로 파일이 만들어지는지, 같은 이름의 파일이 있는 폴더가 거부되는지 |
| 아키텍처 점검 | 진행 문구에 `with ripgrep`이 붙는지, 결과 요약과 상세, CSV 내보내기가 동작하는지 |
| 설정과 테마 | 언어를 바꾸면 화면 문구가 바뀌는지, VS Code의 테마를 바꾸면 편집기의 테마가 따라 바뀌는지 |

## 생성 코드의 실제 동작 확인

CRUD 템플릿을 고쳤을 때에는 생성한 코드를 실제 프로젝트에 넣어 빌드하고 실행해서 확인합니다. 렌더링 결과의 텍스트만으로는 컴파일 오류, 화면의 동작, SQL의 실행 결과를 알 수 없기 때문입니다.

1. 대상 템플릿 ZIP(`templates/projects/examples/egovframe-boot-web.zip` 또는 `egovframe-web.zip`)을 임시 디렉터리에 풉니다.
2. 압축을 푼 프로젝트의 `pom.xml`에 있는 `###NAME###` 등의 자리 표시자를 실제 값으로 바꿉니다. 확장으로 프로젝트를 생성해서 쓰면 1단계와 2단계가 필요하지 않습니다.
3. 확인할 DDL로 CRUD 코드를 그 프로젝트에 생성합니다.
4. 프로젝트의 내장 DB 스크립트(`DATABASE/hsql/all_sample_ddl_hsql.sql`)에 같은 테이블의 HSQL DDL을 추가합니다.
5. 프로젝트를 실행합니다.

   ```bash
   # Boot > Web Project (Thymeleaf)
   mvn spring-boot:run

   # Web Project (JSP)
   mvn org.eclipse.jetty.ee10:jetty-ee10-maven-plugin:12.0.16:run
   ```

   Web Project를 Jetty로 실행할 때에는, 확인용으로 푼 사본의 `web.xml`에서 `<login-config>` 블록을 지워야 기동됩니다.

6. 브라우저에서 `/<table>/<table>List.do`에 접속해 목록, 등록, 수정, 삭제, 검색을 확인합니다. 날짜와 숫자 컬럼, NULL을 허용하는 컬럼을 비운 등록, NOT NULL 컬럼을 비운 등록을 함께 확인합니다.
