# 개발 가이드

이 문서는 확장을 개발할 때 쓰는 명령과 코드 규칙, 메시지와 템플릿을 추가하는 절차, 코드를 고칠 때 함께 맞춰야 하는 항목을 설명합니다. 저장소를 처음 받아 실행하는 절차는 [GETTING_STARTED.md](./GETTING_STARTED.md)에, 확장의 구조는 [ARCHITECTURE.md](../architecture/ARCHITECTURE.md)에 있습니다.

## 명령

### 루트 패키지 (확장 호스트)

| 명령 | 동작 |
|------|------|
| `npm run install:all` | 루트와 `webview-ui/`의 의존성을 모두 설치합니다. |
| `npm run watch` | esbuild 감시 빌드와 `tsc --noEmit --watch`를 함께 실행합니다. |
| `npm run compile` | 타입 검사와 린트를 거친 뒤 개발용으로 번들합니다. |
| `npm run check-types` | `tsc --noEmit` (확장 호스트만) |
| `npm run lint` | ESLint (`src`와 `webview-ui/src`) |
| `npm run format` | Prettier 검사 |
| `npm run format:fix` | Prettier로 형식을 맞춥니다. |
| `npm run test` | 확장 호스트 테스트 (Vitest) |
| `npm run test:watch` | 확장 호스트 테스트의 watch 모드 |
| `npm run build:webview` | 웹뷰를 `webview-ui/build/`에 빌드합니다. |
| `npm run package` | 타입 검사, 웹뷰 빌드, 린트를 거친 뒤 프로덕션 번들을 만듭니다. |

### 웹뷰 패키지 (`webview-ui/`)

| 명령 | 동작 |
|------|------|
| `npm run build` | `tsc -b`와 `vite build` |
| `npm run test` | 웹뷰 테스트 (Vitest, jsdom) |
| `npm run test:watch` | 웹뷰 테스트의 watch 모드 |
| `npm run test:coverage` | 커버리지와 함께 테스트를 실행합니다. |
| `npm run lint` | ESLint (flat config) |

## 기술 스택

| 구분 | 확장 호스트 | 웹뷰 |
|------|-------------|------|
| 언어 | TypeScript 5.4.5 (strict) | TypeScript 5.7.3 (strict) |
| 빌드 | esbuild 0.25.0 (CommonJS 번들) | Vite 6.4.3, `@vitejs/plugin-react-swc` |
| 프레임워크 | VS Code Extension API (`engines.vscode` ^1.84.0) | React 18.3.1, Tailwind CSS 4.1 |
| 주요 라이브러리 | handlebars 4.7.9, adm-zip 0.6.0, fs-extra 11.2.0, zod 4.4.3 | monaco-editor 0.31.1, `@monaco-editor/react` 4.7.0, monaco-sql-languages 0.15.2, i18next 25.8, react-i18next 16.5 |
| 테스트 | Vitest 3.0.9 (node) | Vitest 3.0.9 (jsdom), Testing Library |
| 린트와 형식 | ESLint 8.57 (`.eslintrc.json`), Prettier 3.8 | ESLint 9.21 (flat config) |
| 패키징 | `@vscode/vsce` 3.7.1 | |

- 확장 호스트의 런타임 의존성은 `handlebars`, `adm-zip`, `fs-extra`, `zod` 네 개이며 모두 `dist/extension.js`에 번들됩니다.
- `@vscode/ripgrep` 1.18.0은 개발용 의존성입니다. ESM 전용이어서 런타임에 import하거나 번들하면 안 됩니다.
- DDL 파싱에는 외부 파서를 쓰지 않습니다. tree-sitter와 WASM 파일은 이 프로젝트에 없습니다.

## 코드 규칙

- **형식**: Prettier 설정(`.prettierrc.json`)은 탭 들여쓰기, 폭 130자, **세미콜론 없음**, `bracketSameLine`, LF입니다.
- **타입**: 두 패키지 모두 `strict`입니다. 다만 확장 호스트(루트 `tsconfig.json`)는 `noUnusedLocals`와 `useUnknownInCatchVariables`를 꺼 두어서 `catch`의 오류가 `any`입니다. 웹뷰에서는 `unknown`입니다.
- **이름**: 변수와 함수는 camelCase, 클래스와 인터페이스는 PascalCase를 씁니다.
- **경로 별칭**: 새 코드에서는 `@shared/*` 등의 별칭을 사용합니다. 별칭의 정의는 [ARCHITECTURE.md](../architecture/ARCHITECTURE.md#경로-별칭)에 있습니다.
- **`vscode` 의존성 분리**: 테스트할 로직은 `vscode`를 import하지 않는 모듈에 둡니다. 확장 호스트의 테스트는 `vscode` 모듈 없이 실행되기 때문입니다.
- **커밋 훅**: husky와 lint-staged가 커밋할 때 스테이징된 파일에 `prettier --write`와 `eslint --fix`를 실행합니다. 타입 검사는 하지 않으므로 `npm run check-types`를 직접 실행합니다. `.md` 파일은 `.prettierignore`에 있어 형식을 바꾸지 않습니다.

## 메시지 타입을 추가할 때

1. `src/shared/WebviewMessage.ts`(웹뷰 → 확장) 또는 `src/shared/ExtensionMessage.ts`(확장 → 웹뷰)에 타입을 선언합니다.
2. 웹뷰 → 확장 메시지이면 `src/shared/webviewMessageSchema.ts`의 `webviewMessageSchema` 유니온에 같은 모양의 zod 스키마를 추가합니다.
3. `Controller.handleWebviewMessage()`(`src/core/controller/index.ts`)에 `case`를 추가합니다.
4. 웹뷰에서 `vscode.postMessage({ type: "...", ... })`로 보냅니다.

지켜야 할 사항은 다음과 같습니다.

- `WebviewMessage.ts`에는 타입만 둡니다. 웹뷰가 이 파일을 import하므로 zod 같은 런타임 의존성을 넣으면 웹뷰 번들에 섞입니다.
- 타입과 스키마가 어긋나면 `npm run check-types`가 실패합니다. 스키마가 없는 메시지는 런타임에 거부됩니다.
- zod는 스키마에 없는 필드를 제거합니다. 페이로드에 필드를 추가했으면 스키마에도 추가해야 값이 전달됩니다. 예를 들어 `Column`의 필드를 추가했는데 `columnSchema`에 넣지 않으면, 템플릿 컨텍스트 다운로드에서 그 필드가 사라집니다.
- 경로를 만드는 데 쓰이는 필드는 스키마에서 안전한 문자 집합으로 제한합니다.
- 특정 탭의 요청에 대한 응답에는 `scope`를 붙여서, 다른 탭이 그 응답을 처리하지 않게 합니다.
- 웹뷰가 보낸 값으로 파일 이름, URL, 다운로드 경로를 정하지 않습니다. 식별자만 받고 나머지는 확장에 번들된 메타데이터에서 확정합니다.

## CRUD 코드 템플릿을 고칠 때

`templates/code/*.hbs`는 탭으로 들여쓰기합니다. Handlebars의 다음 동작이 생성 코드의 결함으로 이어진 적이 있으므로 주의합니다.

| 상황 | 문제 | 작성 방법 |
|------|------|-----------|
| mustache 옆에 `{`나 `}`를 그대로 씀 | `*{{{ccName}}}`가 `*price`로 렌더링되어 중괄호가 사라집니다. | `{{concat "*{" ccName "}"}}`처럼 `concat`으로 만듭니다. `${...}`, `#{...}`, `[[@{...}]]`도 같습니다. |
| `{{ }}` 안에 `=`, `'`, `"`가 있는 값을 넣음 | HTML 이스케이프되어 `&#x3D;` 등으로 바뀝니다. | `==`는 mustache 밖에 두고, 따옴표가 들어간 값은 `{{{dateTimePattern}}}`처럼 삼중 중괄호를 씁니다. |
| `{{else if}}` 체인의 닫는 `{{/if}}`를 들여씀 | 마지막 분기 뒤에 들여쓰기가 남습니다. | 닫는 `{{/if}}`를 0열에 둡니다. |

새 CRUD 템플릿을 추가하는 절차는 다음과 같습니다.

1. `templates/code/`에 템플릿을 만듭니다. 기존 파일의 이름은 Java와 XML이 `sample-<이름>-template.hbs`, 화면이 `sample-<thymeleaf|jsp>-<list|register>.hbs` 형태입니다.
2. `src/utils/codeTemplateFiles.ts`의 `getTemplateFilesConfig()`에 항목(templateFile, outputPath, fileName, language)을 추가합니다.
3. `src/utils/previewGenerator.ts`의 미리보기 목록과 웹뷰의 미리보기 드롭다운에 추가합니다.
4. `src/utils/__tests__/codeTemplateFiles.spec.ts`의 기대값을 고치고, 렌더링 결과를 검사하는 테스트를 추가합니다.

생성 코드는 5.1.0 버전의 `egovframe-web`(JSP)과 `egovframe-boot-web`(Thymeleaf)에서 고치지 않고 동작해야 합니다. 템플릿을 고쳤으면 [TESTING_GUIDE.md](./TESTING_GUIDE.md#생성-코드의-실제-동작-확인)의 절차로 실제 프로젝트에서 확인합니다.

## 설정 템플릿을 추가할 때

1. `templates/config/<category>/<name>.hbs`를 만들고, 필요한 출력 형식에 따라 `<name>-java.hbs`, `<name>-yaml.hbs`, `<name>-properties.hbs`를 함께 만듭니다.
2. `templates/templates-context-xml.json`에 항목을 등록합니다.

   ```json
   {
   	"displayName": "Category > Template Name",
   	"templateFolder": "category",
   	"templateFile": "name.hbs",
   	"webView": "category-name-form.html",
   	"fileNameProperty": "txtFileName",
   	"javaConfigTemplate": "name-java.hbs",
   	"yamlTemplate": "name-yaml.hbs",
   	"propertiesTemplate": "name-properties.hbs"
   }
   ```

3. `webview-ui/src/components/egov/forms/`에 폼 컴포넌트를 만듭니다. 입력 컴포넌트는 `components/ui/`의 것을 사용합니다.
4. `FormFactory.tsx`에 분기를 추가합니다. `FormFactory`는 메타데이터의 `webView` 값에 들어 있는 문자열(예: `logging-`, `cache-ehcacheConfig`)로 폼을 고르고, 어느 분기에도 해당하지 않으면 `DatasourceForm`을 씁니다. 그래서 `webView` 값은 기존 값과 겹치지 않게 `<카테고리>-<이름>-form.html` 형태로 정합니다.

## UI를 고칠 때

- 화면 문구는 컴포넌트에 직접 쓰지 않고 `webview-ui/src/i18n/locales/en.json`과 `ko.json`에 같은 키로 추가합니다. `src/i18n/__tests__/locales.spec.ts`가 두 파일의 키 집합이 다르면 실패합니다.
- 색과 테두리는 VS Code의 CSS 변수(`--vscode-*`)로 지정해서 테마를 따르게 합니다.
- 새 공통 컴포넌트는 `webview-ui/src/components/ui/`에 만들고 `index.ts`에서 내보냅니다.
- 웹뷰에서 외부 리소스(CDN의 스크립트, 폰트, 이미지)를 불러오지 않습니다. CSP가 차단합니다.

## 아키텍처 점검 엔진을 고칠 때

### 결과 계약 동기화

점검 결과의 필드를 추가하거나 바꿀 때에는 아래를 항상 함께 고칩니다. 하나라도 빠지면 웹뷰나 CSV에서 값이 사라집니다.

1. `src/shared/archCheck.ts`: 타입을 추가하거나 고칩니다.
2. `src/shared/webviewMessageSchema.ts`: 같은 모양의 zod 스키마(`archCheckResultSchema` 등)를 고칩니다. 스키마에 없는 필드는 확장이 메시지를 검증할 때 제거되므로, 결과가 웹뷰에서 확장으로 되돌아오는 CSV 내보내기에서 조용히 사라집니다.
3. `src/utils/archChecker.ts`와 해당 모듈: 값을 채우는 코드와 CSV의 열(`exportArchResults`, `projectReportRows`)을 고칩니다.
4. `webview-ui/src/components/egov/tabs/CheckArchView.tsx`: 화면 표시를 고칩니다. 공통 표시 규칙은 `checkArch/checkDisplay.ts`에, Project 카드와 상세 표는 `ProjectSummaryCard.tsx`와 `ProjectReportTable.tsx`에 있습니다.
5. 테스트: `src/utils/__tests__/*.spec.ts`, `src/shared/webviewMessageSchema.test.ts`, `src/shared/archCheckReport.spec.ts`, 웹뷰의 `__tests__/CheckArchView.spec.tsx`와 `checkArch/checkDisplay.spec.ts`를 고칩니다.
6. `CHANGELOG.md`와 [ARCHITECTURE_CHECK.md](../reference/ARCHITECTURE_CHECK.md)의 판정 규칙을 고칩니다.

### 엔진의 규칙

- 엔진 모듈(`archChecker`, `daoCheck`, `buildFileCheck`, `dataAccessConfigScan`, `runtimeModuleGraph`, `mavenPom`, `gradleBuild`, `javaIndex`, `javaSource`)은 `vscode`와 `@vscode/ripgrep`을 import하지 않습니다. ripgrep 경로는 Controller가 찾아서 주입합니다.
- 해석이 확실하지 않은 입력은 추측하지 않고 `unknown`이나 `n/a`로 남깁니다.
- 테스트의 기대값을 맞추려고 판정을 바꾸지 않습니다. 판정을 바꿀 때에는 근거가 되는 가이드나 실제 프로젝트의 사례를 테스트로 함께 남깁니다.
- 오류 로그에는 파일 이름만 남기고 절대 경로와 스택은 남기지 않습니다.
- 이 엔진은 MCP 서버 [egovframe-mcp-check](https://github.com/eGovFramework/egovframe-mcp-check)에 이식되어 있습니다. 판정 로직은 이 저장소에 먼저 반영한 뒤에 이식하며, 이식할 때에는 테스트도 함께 가져갑니다.

### 실행환경 모듈 그래프 갱신

새 실행환경 버전이 나와 모듈 사이의 의존이 바뀌면 다음 순서로 갱신합니다. 그래프의 출처는 [ARCH_CHECK_ENGINE.md](../architecture/ARCH_CHECK_ENGINE.md#실행환경-모듈-그래프)에 있습니다.

1. 해당 브랜치의 모듈 pom에서 의존을 다시 추출해 `src/utils/__tests__/fixtures/runtime-graph/graph-<브랜치>.txt`를 교체합니다. 새 브랜치이면 파일을 추가하고 `RuntimeGraphBranch`와 `selectGraphBranch`도 확장합니다.
2. `npm run test`를 실행합니다. `runtimeModuleGraph.spec.ts`가 상수와 추출 원본의 불일치를 잡아냅니다.
3. 실패한 모듈 항목을 `RUNTIME_MODULE_GRAPH`에 반영하고 테스트가 통과하는지 확인합니다.

5.1.x 그래프는 실행환경 5.1.0 베타에서 추출한 것이므로, 정식 5.1.0의 pom으로 다시 추출해 확인하는 일이 남아 있습니다.

## 보안과 관련된 규칙

- **경로**: 사용자 입력으로 경로를 만들 때에는 `src/utils/pathSafety.ts`의 `assertSafeProjectName`, `sanitizeFileName`, `resolveWithinBase`를 사용해서 결과가 지정한 디렉터리 밖으로 나가지 않게 합니다.
- **다운로드**: 내려받은 파일은 `templateDownload.ts`의 `ensureVerifiedFile()`로만 얻습니다. 해시가 기록되지 않은 항목을 내려받는 경로를 만들지 않습니다.
- **캐시 위치**: 내려받은 파일을 확장 디렉터리에 쓰지 않습니다. `.vscodeignore`가 `templates/` 아래를 제외하지 않으므로 그곳에 쓴 파일은 VSIX에 섞여 들어갑니다.
- **압축 해제**: `adm-zip`의 동기 추출을 유지합니다. 스트림 방식의 추출기(extract-zip, yauzl)로 되돌리면 VS Code 1.128 이후의 Node.js에서 큰 템플릿의 압축 해제가 끝나지 않습니다.
- **CSP**: 웹뷰 HTML의 CSP를 제거하지 않습니다. Worker가 동작하지 않으면 `worker-src`를 확인합니다. 설명은 [ARCHITECTURE.md](../architecture/ARCHITECTURE.md#보안-설정-csp)에 있습니다.
- **CSV**: CSV의 셀은 `csvCell`을 거쳐 수식 주입을 막습니다.

## Git LFS 문제 해결

`templates/projects/examples/`의 ZIP은 모두 Git LFS로 관리합니다(`.gitattributes`의 `*.zip`).

### ZIP이 포인터 파일로 받아진 경우

```bash
git lfs install
git lfs pull --include="templates/projects/examples/*.zip"
```

### `git lfs install`보다 클론을 먼저 한 경우

```bash
git lfs uninstall
git lfs install
git lfs pull
```

### 추적 상태 확인

```bash
git lfs ls-files    # LFS로 추적되는 파일 목록
git lfs track       # LFS 추적 패턴
```

### 템플릿 ZIP을 바꾸거나 추가한 뒤에 푸시하는 경우

`.husky/pre-push` 훅이 `git lfs pre-push`를 실행해서 LFS 객체를 함께 올립니다. 훅을 건너뛰고 푸시했거나 LFS 객체가 원격에 없다는 오류(`GH008`)가 나면 LFS 객체를 먼저 올립니다.

```bash
git lfs push --all origin <브랜치>
git push origin <브랜치>
```

## Git 규칙

- 커밋 메시지는 [Conventional Commits 1.0](https://www.conventionalcommits.org/ko/v1.0.0/)을 따릅니다(`feat`, `fix`, `docs`, `refactor`, `test`, `chore` 등).
- `develop` 브랜치에서 작업한 뒤 `main`으로 병합합니다. 5.0.x의 유지보수는 `5.0.x` 브랜치에서 합니다.
- 사용자에게 보이는 변경은 `CHANGELOG.md`의 해당 버전 항목에 기록합니다.
- 기여 절차(Fork, PR)는 [CONTRIBUTING.md](../../CONTRIBUTING.md)에 있습니다.
