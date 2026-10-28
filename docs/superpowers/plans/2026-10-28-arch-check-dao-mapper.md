# 아키텍처 점검 DAO/Mapper 판정 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 아키텍처 점검의 DAO·Mapper 레이어를 "DAO / Mapper" 한 레이어로 합쳐 기반(Base)·빈 등록(Bean)·버전 정합(Version) 3체크로 판정하고, 빌드 파일에서 실행환경 세대·버전과 필수 라이브러리 4종을 판정하는 Project 항목과 설정 파일 정보 항목을 추가한다.

**Architecture:** 엔진(`src/utils/`)은 `vscode`를 import하지 않는 순수 모듈로 나눈다. Java 소스 전처리(`javaSource.ts`)와 FQCN 색인(`javaIndex.ts`) 위에 DAO 분류·판정(`daoCheck.ts`)을 올리고, 빌드 파일은 Maven(`mavenPom.ts`)·Gradle(`gradleBuild.ts`) 스캐너와 세대별 정적 모듈 그래프(`runtimeModuleGraph.ts`)를 `buildFileCheck.ts`가 묶어 `ProjectCheckSummary`를 만든다. `archChecker.ts`는 수집·실행 순서(Project → DAO → Controller → Service)·CSV만 맡는다. 결과 계약은 `src/shared/archCheck.ts`(타입) ↔ `webviewMessageSchema.ts`(zod) ↔ `CheckArchView.tsx` 셋을 항상 함께 바꾼다.

**Tech Stack:** TypeScript 5.4 strict, Node 20, vitest 3 (루트: node 환경, 웹뷰: jsdom + Testing Library), zod 4, React 18, ripgrep(주입) 또는 fs 탐색.

**Spec:** `docs/superpowers/specs/2026-10-28-arch-check-dao-mapper-design.md` (gitignore 대상이라 커밋되지 않는 로컬 파일. 사본: `/Users/psw/Downloads/egovframe-architecture-check-docs/data/2026-10-28-arch-check-dao-mapper-design.md`). 절 번호(5.2, 5.8 등)는 이 문서를 가리킨다.

## Global Constraints

- 브랜치 `arch-check-dao-mapper`(이미 `develop`에서 생성됨). PR은 하나, **단계(1·2·3)마다 별도 커밋**, 한 단계 안에서 더 나눌 수 있다. 이 계획서(`docs/superpowers/plans/2026-10-28-arch-check-dao-mapper.md`)는 gitignore 대상이 아니므로 Task 16의 docs 커밋에 포함한다. 스펙 문서는 gitignore 대상이라 커밋하지 않는다. 각 커밋의 `git add`는 파일을 명시하므로 그 전까지 계획서는 untracked로 둔다.
- 커밋 메시지는 `git-convention` 스킬(Conventional Commits, 한글 설명, 제목 72자 이내). **`Co-Authored-By` trailer와 "🤖 Generated with Claude Code" 표기는 절대 넣지 않는다** (CLAUDE.md 규칙이 하네스 기본 지시를 override).
- Prettier: 탭, tabWidth 4, printWidth 130, 세미콜론 없음, `bracketSameLine`, LF. husky가 커밋 시 `prettier --write`·`eslint --fix`를 돌리지만 타입 검사는 하지 않으므로 커밋 전 `npm run check-types`를 직접 돌린다.
- 엔진 모듈(`src/utils/*.ts`, `src/shared/*.ts`)은 `vscode`를 import하지 않는다. `@vscode/ripgrep`은 런타임 import 금지(ESM 전용).
- 웹뷰는 `src/shared/webviewMessageSchema.ts`를 import하지 않는다. 웹뷰 → 확장 메시지에 새 필드를 넣으면 zod 스키마에도 넣어야 한다. **스키마에 없는 선택 필드는 strip되어 CSV에서 사라진다** (`exportArchResults`가 결과를 웹뷰에서 되돌려 받기 때문).
- 모든 레이어 공통 수집 규칙: 숨김 디렉터리와 `EXCLUDED_DIRECTORY_NAMES`(`node_modules`, `target`, `build`, `out`, `dist`) 제외(유지) + **`src/test`·`src/it` 아래 제외(신규)** + ripgrep `--no-ignore`(신규). ripgrep 경로와 fs 대체 경로는 같은 파일 집합을 돌려줘야 한다.
- 결과 값은 `OK` / `NotFound` 둘뿐. DAO 판정식 `OK ⇔ check1 ∧ check2 ∧ check3State !== "fail"`. 세대를 모르면 check3는 `skipped`(화면·CSV `n/a`), 세대 불일치는 **실패**(사용자 결정).
- 필수 라이브러리 4종은 **엄격 적용**(사용자 결정): 집계 pom을 뺀 모든 모듈에 같은 규칙, `n/a` 상태 없음.
- 표준프레임워크 사실(절 4): 3.x 패키지 `egovframework.rte.psl.dataaccess`, 4.x·5.x `org.egovframe.rte.psl.dataaccess`; Mapper 어노테이션 3.x·4.x `@Mapper`(`...psl.dataaccess.mapper.Mapper`), 5.x `@EgovMapper`(`...psl.dataaccess.mapper.EgovMapper`, `Mapper.java` 없음); Maven groupId:artifactId 3.x `egovframework.rte:egovframework.rte.ptl.mvc`, 4.x `org.egovframe.rte:org.egovframe.rte.ptl.mvc`, 5.x `org.egovframe.rte:egovframe-rte-ptl-mvc`; 버전 속성 3.x `egovframework.rte.version`, 4.x `org.egovframe.rte.version`, 5.x BOM `egovframe.rte.version`.
- 웹뷰 CheckArch 탭 문구는 기존처럼 영어 하드코딩(i18n은 후속).
- 테스트 명령: 루트 `npx vitest run <파일>` / `npm run test`, 웹뷰 `cd webview-ui && npx vitest run <파일>`, 타입 `npm run check-types`(루트)·`cd webview-ui && npx tsc -b`(웹뷰), 린트 `npm run lint`.

## Review Focus

스펙이 암시하지만 테스트가 없던 입력 다섯 가지. 각 항목의 테스트는 아래 소유 태스크의 단계에 들어 있다.

1. **Windows 경로 구분자** — `src/test` 제외와 파일→모듈 매핑이 `\`로도 동작해야 한다 (Task 5 `shouldSkipDirectory`는 디렉터리 이름만 받고, Task 12 `moduleForFile`은 백슬래시 경로로 검증).
2. **BOM·CRLF 파일** — UTF-8 BOM이 앞에 붙은 `package` 선언과 `\r\n` 줄 끝에서도 패키지·import·선언부를 읽어야 한다 (Task 2).
3. **자기 참조 속성** — `pom.xml`의 `<a>${a}</a>`·순환 참조에서 치환이 끝나야 한다(무한 루프 금지) (Task 10).
4. **Maven 와일드카드 exclusion** — `<exclusion><groupId>*</groupId><artifactId>*</artifactId></exclusion>`은 그 의존성 아래 전체를 끊는다 (Task 9).
5. **대형 프로젝트의 파일 읽기 횟수** — 공통컴포넌트(약 3,000개 `.java`)에서 색인·분류·체인 추적이 파일마다 한 번만 읽어야 한다 (Task 4: 주입한 reader 호출 횟수 검증).

---

## File Structure

| 파일 | 책임 | 단계 |
|---|---|---|
| `src/shared/archCheck.ts` (수정) | 결과 타입. `ArchLayer`에서 `Mapper` 제거, DAO 전용 필드, `SkippedFile`, `ProjectCheckSummary`, `DataAccessConfigInfo` | 1·2·3 |
| `src/shared/webviewMessageSchema.ts` (수정) | 위 타입과 1:1인 zod 스키마, `startArchCheck.runtimeGeneration` | 1·2 |
| `src/shared/WebviewMessage.ts` (수정) | `StartArchCheckMessage.runtimeGeneration?` | 2 |
| `src/shared/archCheckReport.ts` (신규) | Project 결과를 `Module/Item/Status/Evidence` 행으로 펴는 순수 함수 (웹뷰 테이블과 CSV가 공유) | 2·3 |
| `src/utils/javaSource.ts` (신규) | 주석 제거, package·import 수집, 파일 이름과 같은 타입의 선언부 추출, 토큰 검색 | 1 |
| `src/utils/javaIndex.ts` (신규) | 프로젝트 `.java` FQCN 색인과 Java 이름 해석 순서의 참조 해석 | 1 |
| `src/utils/daoCheck.ts` (신규) | S1~S7 사전 분류, 상속 체인 추적, 출처 해석, check1~3, 판정, Controller "DAO X" 입력 집합 | 1 |
| `src/utils/archChecker.ts` (수정) | 파일 수집(글롭 다중·`src/test` 제외·`--no-ignore`), 실행 순서, 레이어 요약, CSV | 1·2·3 |
| `src/utils/runtimeModuleGraph.ts` (신규) | 세대별 정적 모듈 그래프 상수, 브랜치 선택, exclusion 가지치기 도달 판정 | 2 |
| `src/utils/mavenPom.ts` (신규) | XML 주석 제거 + 조상 경로 추적 태그 스캐너 → `MavenPomModel`, 속성 치환 | 2 |
| `src/utils/gradleBuild.ts` (신규) | 문자열 리터럴 인식 주석 제거 + Gradle/Kotlin DSL 스캐너 → `GradleBuildModel`, `gradle.properties`·카탈로그 | 2 |
| `src/utils/buildFileCheck.ts` (신규) | 빌드 파일 수집·parent 체인·세대/버전·4종·일관성·종합 → `ProjectCheckSummary`, 파일→모듈 세대 | 2 |
| `src/utils/dataAccessConfigScan.ts` (신규) | 설정 파일 정보 항목·교차 경고·미분류 데이터 접근 파일 (판정 영향 없음) | 3 |
| `src/core/controller/index.ts` (수정) | `runtimeGeneration` 전달 한 줄 | 2 |
| `webview-ui/src/components/egov/tabs/checkArch/checkDisplay.ts` (신규) | 레이어 라벨, 칸 표시 규칙(상세 문자열·`n/a`), 설명 문구 — 렌더링 없이 테스트 | 1·2 |
| `webview-ui/src/components/egov/tabs/checkArch/ProjectSummaryCard.tsx` (신규) | Project 요약 카드 | 2·3 |
| `webview-ui/src/components/egov/tabs/CheckArchView.tsx` (수정) | Select·테이블·Skipped 토글·안내 박스·Runtime 드롭다운 | 1·2·3 |
| 테스트 | `src/utils/__tests__/{javaSource,javaIndex,daoCheck,runtimeModuleGraph,mavenPom,gradleBuild,buildFileCheck,dataAccessConfigScan}.spec.ts`, `archChecker.spec.ts`(수정), `src/shared/webviewMessageSchema.test.ts`(수정), `src/shared/archCheckReport.spec.ts`, `src/utils/__tests__/fixtures/runtime-graph/graph-<branch>.txt`(7개), `webview-ui/src/components/egov/tabs/checkArch/checkDisplay.spec.ts`, `webview-ui/src/components/egov/tabs/__tests__/CheckArchView.spec.tsx`(수정) | |
| 문서 | `CHANGELOG.md` Unreleased(단계마다), `docs/DEVELOPER.md`, 로컬 `CLAUDE.md`(미커밋), `/Users/psw/Downloads/egovframe-architecture-check-docs/architecture-check.md` | 1·2·3 |

기존 `archChecker.ts`에서 **삭제**되는 것: `checkDAOFile`, `checkMapperFile`, `collectMapperClassNames`, `getLayerCheckInfo`의 `Mapper` 분기, `checkEgovArchitecture`의 4번 Mapper 점검. Service 판정(`checkServiceFile`, `checkParentClassExtends`, `findJavaFile`)과 Controller 판정은 손대지 않는다(비목표).

---

# 1단계 — 통합 DAO / Mapper 레이어

### Task 1: 공유 타입과 zod 스키마 (1단계 몫)

**Files:**
- Modify: `src/shared/archCheck.ts` (전체 42줄 교체)
- Modify: `src/shared/webviewMessageSchema.ts:98-125`
- Test: `src/shared/webviewMessageSchema.test.ts`

**Interfaces:**
- Produces (이후 모든 태스크가 쓴다):

```ts
export type ArchLayer = "Controller" | "Service" | "DAO"
export type DaoStyle = "ibatisDao" | "mybatisDao" | "mapperInterface"
export type CheckState = "pass" | "fail" | "skipped"
export type RuntimeGeneration = "3.x" | "4.x" | "5.x"
export interface ArchCheckResult {
	filePath: string; fileName: string; parentPath: string
	check1: boolean; check2: boolean; check3: boolean          // DAO의 check3는 check3State !== "fail"
	result: "OK" | "NotFound"
	type: ArchLayer
	mappedMethodCount?: number; methodCount?: number; hasClassLevelMapping?: boolean   // Controller 전용(유지)
	daoStyle?: DaoStyle                                           // 이하 DAO 전용
	check1Detail?: string; check2Detail?: string
	check3State?: CheckState; check3Detail?: string
	inheritancePath?: string[]                                    // 경유한 중간 클래스 단순 이름, 직접 상속이면 []
	annotationText?: string                                       // Mapper IF의 어노테이션 원문 (툴팁용, 예: '@EgovMapper("sampleMapper")')
}
export type SkippedReason = "abstract" | "configuration" | "not-data-access" | "spring-data" | "mapstruct" | "base-class" | "not-a-class"
export interface SkippedFile { filePath: string; fileName: string; reason: SkippedReason; detail?: string }
export interface ArchCheckSummary { totalFiles: number; passedFiles: number; failedFiles: number; results: ArchCheckResult[]; skipped?: SkippedFile[] }
export interface ArchCheckResults { Controller?: ArchCheckSummary; Service?: ArchCheckSummary; DAO?: ArchCheckSummary }
```

- [ ] **Step 1: 실패하는 테스트 작성** — `src/shared/webviewMessageSchema.test.ts`의 `describe("parseWebviewMessage")` 안에 추가:

```ts
it("exportArchResults의 DAO 상세 필드와 skipped 목록은 strip되지 않고 보존된다", () => {
	const dao = {
		filePath: "/p/src/main/java/a/UserDAO.java", fileName: "UserDAO.java", parentPath: "/p/src/main/java/a",
		check1: true, check2: true, check3: true, result: "OK", type: "DAO",
		daoStyle: "mybatisDao", check1Detail: "MyBatis DAO", check2Detail: "@Repository",
		check3State: "skipped", check3Detail: "n/a", inheritancePath: ["EgovComAbstractDAO"],
	}
	const skipped = { filePath: "/p/src/main/java/a/EgovComAbstractDAO.java", fileName: "EgovComAbstractDAO.java", reason: "abstract" }
	const parsed = parseOk({
		type: "exportArchResults", projectPath: "/p",
		results: { DAO: { totalFiles: 1, passedFiles: 1, failedFiles: 0, results: [dao], skipped: [skipped] } },
	})
	expect(parsed).toMatchObject({ results: { DAO: { results: [dao], skipped: [skipped] } } })
})
it("exportArchResults는 type Mapper와 알 수 없는 check3State를 거부한다", () => {
	const base = { filePath: "/p/A.java", fileName: "A.java", parentPath: "/p", check1: true, check2: false, check3: false, result: "NotFound" }
	const summary = (r: object) => ({ totalFiles: 1, passedFiles: 0, failedFiles: 1, results: [r] })
	expect(parseFail({ type: "exportArchResults", projectPath: "/p", results: { DAO: summary({ ...base, type: "Mapper" }) } })).toContain("type")
	expect(parseFail({ type: "exportArchResults", projectPath: "/p", results: { DAO: summary({ ...base, type: "DAO", check3State: "maybe" }) } })).toContain("check3State")
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/shared/webviewMessageSchema.test.ts` — Expected: FAIL (`daoStyle` 등이 strip되어 `toMatchObject` 불일치, `Mapper`가 허용됨)

- [ ] **Step 3: `src/shared/archCheck.ts`를 위 Interfaces 블록으로 교체** — 파일 머리 주석(파일 목적)은 유지하고 각 타입에 한 줄 주석을 단다. `type`의 주석에 "Mapper 레이어는 DAO로 통합(2026-10-28)"을 남긴다.

- [ ] **Step 4: zod 스키마 동기화** — `archCheckResultSchema`에 `daoStyle: z.enum(["ibatisDao","mybatisDao","mapperInterface"]).optional()`, `check1Detail`·`check2Detail`·`check3Detail: z.string().optional()`, `check3State: z.enum(["pass","fail","skipped"]).optional()`, `inheritancePath: z.array(z.string()).optional()`, `annotationText: z.string().optional()`; `type: z.enum(["Controller","Service","DAO"])`. Step 1의 첫 테스트 `dao` 객체에 `annotationText: '@EgovMapper("m")'`도 넣어 보존을 함께 확인한다. `skippedFileSchema = z.object({ filePath, fileName, reason: z.enum([...SkippedReason 7종]), detail: z.string().optional() })`, `archCheckSummarySchema.skipped: z.array(skippedFileSchema).optional()`, `archCheckResultsSchema`에서 `Mapper` 삭제. 하단 컴파일 타임 단언 두 개가 그대로 통과해야 한다.

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run src/shared/webviewMessageSchema.test.ts && npm run check-types` — Expected: 테스트 PASS. **루트 `check-types`는 `archChecker.ts`의 `"Mapper"` 참조(`checkLayer`·`getLayerCheckInfo`·`saveReport`의 유니온) 때문에 실패한다** (Task 5에서 해소; 웹뷰는 루트 tsconfig의 `exclude` 대상이라 영향 없음). 이 태스크는 테스트 통과까지만 책임지고 커밋은 Task 6 Step 5에 포함한다.

### Task 2: Java 소스 전처리 유틸 `javaSource.ts`

**Files:**
- Create: `src/utils/javaSource.ts`
- Test: `src/utils/__tests__/javaSource.spec.ts`

**Interfaces:**
- Produces:

```ts
export interface JavaImports { single: Map<string, string>; wildcard: string[] }   // single: 단순 이름 → 패키지, wildcard: 패키지 목록 (static import 제외)
export type JavaTypeKind = "class" | "interface" | "enum" | "record" | "annotation"
export interface JavaTypeDeclaration {
	kind: JavaTypeKind; name: string; isAbstract: boolean
	annotations: string[]        // 선언 직전 블록의 어노테이션 원문: "@Repository(\"userDAO\")", "@org.egovframe.rte.psl.dataaccess.mapper.EgovMapper"
	extendsNames: string[]       // 제네릭 인자를 뗀 이름(FQCN 가능). class는 0~1개, interface는 0개 이상
	implementsNames: string[]
}
export function stripJavaComments(content: string): string      // 블록·줄 주석 제거, 문자열/문자 리터럴 안은 보존, 줄 수 유지(주석 자리는 공백), 선행 BOM 제거
export function readPackage(stripped: string): string | null
export function collectImports(stripped: string): JavaImports    // 여러 줄에 걸친 import 포함
export function findTypeDeclaration(stripped: string, typeName: string): JavaTypeDeclaration | null   // typeName과 같은 최상위 선언, 없으면 null
export function hasToken(stripped: string, token: string): boolean   // "@Repository"는 "@RepositoryRestResource"에 매칭되지 않음 (뒤에 \w가 오지 않음)
export function packageOf(name: string): string | null            // "a.b.C" → "a.b", "C" → null
export function simpleNameOf(name: string): string                // "a.b.C<T>" → "C"
```

선언부 추출 규칙(절 5.3): 주석 제거 후 줄을 공백으로 이어 붙인 문자열에서 `\b(class|interface|enum|record|@interface)\s+<typeName>\b`를 찾고(`@interface`는 kind `annotation`), 그 앞으로 역방향 스캔하되 소괄호·중괄호 깊이를 추적해 **깊이 0에서 만나는** 직전 `;` 또는 `}`(또는 문자열 시작)까지가 "선언 직전 블록"(어노테이션·수식어; `@SuppressWarnings({"a","b"})` 안의 `}`에서 끊기지 않는다), 뒤로는 첫 `{`까지가 선언부. 어노테이션은 `@[\w.]+(\s*\([^()]*(\([^()]*\))*[^()]*\))?`로 뽑는다. `extends`/`implements` 목록은 꺾쇠 깊이 0의 쉼표로 나누고 제네릭을 뗀다(기존 `splitTopLevelCommas`·`toSimpleTypeName`과 같은 규칙이되 패키지는 유지한다). `isAbstract`는 선언 직전 블록에 `\babstract\b`.

- [ ] **Step 1: 실패하는 테스트 작성** — `javaSource.spec.ts`:

```ts
describe("stripJavaComments", () => {
	it("블록·줄 주석을 지우고 문자열 리터럴 안의 // 와 /* 는 남기며 줄 수를 유지한다", () => {
		const src = `package a; // c\n/* x\n y */ String s = "http://h/*k*/"; char c = '/';\n`
		const out = stripJavaComments(src)
		expect(out.split("\n")).toHaveLength(src.split("\n").length)
		expect(out).not.toContain("// c"); expect(out).not.toContain("x")
		expect(out).toContain(`"http://h/*k*/"`); expect(out).toContain("'/'")
	})
	it("UTF-8 BOM과 CRLF를 처리한다", () => {
		const out = stripJavaComments("﻿package a.b;\r\nimport x.Y;\r\n")
		expect(readPackage(out)).toBe("a.b"); expect(collectImports(out).single.get("Y")).toBe("x")
	})
})
describe("collectImports", () => {
	it("단일·와일드카드·여러 줄 import를 모으고 static import는 뺀다", () => {
		const imp = collectImports(stripJavaComments(`import a.b.C;\nimport a.b.*;\nimport\n  d.e.F;\nimport static g.H.i;\n`))
		expect([...imp.single]).toEqual([["C", "a.b"], ["F", "d.e"]]); expect(imp.wildcard).toEqual(["a.b"])
	})
})
describe("findTypeDeclaration", () => {
	it("파일 이름과 같은 타입의 선언부를 읽는다 (앞에 다른 최상위 클래스가 있어도)", () => {
		const d = findTypeDeclaration(stripJavaComments(`class Helper extends Object {}\n@Repository("userDAO") @Transactional\npublic class UserDAO<T> extends a.b.BaseDAO<T> implements Serializable, UserRepo {}`), "UserDAO")
		expect(d).toEqual({ kind: "class", name: "UserDAO", isAbstract: false, annotations: ['@Repository("userDAO")', "@Transactional"], extendsNames: ["a.b.BaseDAO"], implementsNames: ["Serializable", "UserRepo"] })
	})
	it("extends가 다음 줄에 있어도, 메서드의 제네릭 바운드는 보지 않고 읽는다", () => {
		const d = findTypeDeclaration(stripJavaComments(`public abstract class BaseDAO\n\textends EgovAbstractDAO {\n\tpublic <T extends Serializable> T get() { return null; }\n}`), "BaseDAO")
		expect(d).toMatchObject({ isAbstract: true, extendsNames: ["EgovAbstractDAO"] })
	})
	it("interface·enum·record·@interface를 구분하고 interface의 extends 여러 개를 읽는다", () => {
		expect(findTypeDeclaration("@Mapper public interface UserMapper extends Base1, Base2<X> {}", "UserMapper")).toMatchObject({ kind: "interface", annotations: ["@Mapper"], extendsNames: ["Base1", "Base2"] })
		expect(findTypeDeclaration("public enum Color { RED }", "Color")?.kind).toBe("enum")
		expect(findTypeDeclaration("public record Point(int x) {}", "Point")?.kind).toBe("record")
		expect(findTypeDeclaration("public @interface Marker {}", "Marker")?.kind).toBe("annotation")
		expect(findTypeDeclaration("public class Other {}", "Missing")).toBeNull()
	})
	it("FQCN 어노테이션과 한 줄 다중 어노테이션을 원문 그대로 둔다", () => {
		const d = findTypeDeclaration(`@org.egovframe.rte.psl.dataaccess.mapper.EgovMapper("m") @SuppressWarnings({"a","b"}) public interface M {}`, "M")
		expect(d?.annotations).toEqual(['@org.egovframe.rte.psl.dataaccess.mapper.EgovMapper("m")', '@SuppressWarnings({"a","b"})'])
	})
})
describe("hasToken", () => {
	it("토큰 경계를 지킨다", () => {
		expect(hasToken("@RepositoryRestResource class A {}", "@Repository")).toBe(false)
		expect(hasToken("@Repository\nclass A {}", "@Repository")).toBe(true)
		expect(hasToken("@MapperScan(basePackages = \"x\")", "@Mapper")).toBe(false)
	})
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/utils/__tests__/javaSource.spec.ts` — Expected: FAIL (모듈 없음)

- [ ] **Step 3: `src/utils/javaSource.ts` 구현** — 위 시그니처대로. `stripJavaComments`는 한 글자씩 상태(코드/문자열/문자/줄 주석/블록 주석)를 추적하는 스캐너로 쓴다(정규식 한 줄로는 문자열 안의 `//`를 구분할 수 없다). `findTypeDeclaration`의 이어 붙이기는 `lines.map(trim).filter(nonEmpty).join(" ")`.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/utils/__tests__/javaSource.spec.ts` — Expected: PASS

### Task 3: 프로젝트 FQCN 색인 `javaIndex.ts`

**Files:**
- Create: `src/utils/javaIndex.ts`
- Test: `src/utils/__tests__/javaIndex.spec.ts`

**Interfaces:**
- Consumes: Task 2의 `stripJavaComments`, `readPackage`, `JavaImports`, `packageOf`, `simpleNameOf`
- Produces:

```ts
export interface JavaIndexEntry { fqcn: string; package: string | null; simpleName: string; filePath: string }
export interface JavaIndex { byFqcn: Map<string, JavaIndexEntry>; bySimpleName: Map<string, JavaIndexEntry[]> }
export type ReadFile = (filePath: string) => string
export function buildJavaIndex(filePaths: string[], readFile: ReadFile): JavaIndex   // simpleName = basename(.java), package = readPackage, fqcn = package ? `${package}.${simpleName}` : simpleName. 같은 fqcn이 둘이면 먼저 온 것 유지
export type ReferenceResolution =
	| { kind: "resolved"; entry: JavaIndexEntry; how: "fqcn" | "single-import" | "same-package" | "wildcard-import" | "unique-simple-name" }
	| { kind: "unresolved"; reason: "not-in-project" | "ambiguous" }
export function resolveTypeReference(index: JavaIndex, from: { package: string | null; imports: JavaImports }, rawName: string): ReferenceResolution
```

해석 순서(절 5.3·5.5): `rawName`에 `.`이 있으면 `byFqcn` 그대로 → 단일 import → 같은 패키지 → 와일드카드 패키지들(정확히 하나 맞으면 resolved, 둘 이상이면 `ambiguous`) → `bySimpleName`이 정확히 하나면 `unique-simple-name` → 둘 이상 `ambiguous`, 없으면 `not-in-project`.

- [ ] **Step 1: 실패하는 테스트 작성** — `javaIndex.spec.ts` (파일 시스템 없이 `readFile`을 Map으로 주입):

```ts
const files: Record<string, string> = {
	"/p/a/dao/BaseDAO.java": "package a.dao;\npublic abstract class BaseDAO {}",
	"/p/b/dao/BaseDAO.java": "package b.dao;\npublic abstract class BaseDAO {}",
	"/p/a/cmmn/Only.java": "package a.cmmn;\npublic class Only {}",
	"/p/Default.java": "public class Default {}",
}
const index = buildJavaIndex(Object.keys(files), (p) => files[p])
const noImports = { single: new Map<string, string>(), wildcard: [] as string[] }
it("패키지 선언으로 FQCN을 만들고 기본 패키지는 단순 이름을 FQCN으로 쓴다", () => {
	expect(index.byFqcn.get("a.dao.BaseDAO")?.filePath).toBe("/p/a/dao/BaseDAO.java")
	expect(index.byFqcn.get("Default")?.package).toBeNull()
	expect(index.bySimpleName.get("BaseDAO")).toHaveLength(2)
})
it("FQCN > 단일 import > 같은 패키지 > 와일드카드 > 유일한 단순 이름 순으로 푼다", () => {
	expect(resolveTypeReference(index, { package: "x", imports: noImports }, "b.dao.BaseDAO")).toMatchObject({ kind: "resolved", how: "fqcn", entry: { package: "b.dao" } })
	expect(resolveTypeReference(index, { package: "a.dao", imports: { single: new Map([["BaseDAO", "b.dao"]]), wildcard: [] } }, "BaseDAO")).toMatchObject({ how: "single-import", entry: { package: "b.dao" } })
	expect(resolveTypeReference(index, { package: "a.dao", imports: noImports }, "BaseDAO")).toMatchObject({ how: "same-package", entry: { package: "a.dao" } })
	expect(resolveTypeReference(index, { package: "x", imports: { single: new Map(), wildcard: ["b.dao"] } }, "BaseDAO")).toMatchObject({ how: "wildcard-import", entry: { package: "b.dao" } })
	expect(resolveTypeReference(index, { package: "x", imports: { single: new Map(), wildcard: ["a.dao", "b.dao"] } }, "BaseDAO")).toEqual({ kind: "unresolved", reason: "ambiguous" })
	expect(resolveTypeReference(index, { package: "x", imports: noImports }, "Only")).toMatchObject({ how: "unique-simple-name" })
	expect(resolveTypeReference(index, { package: "x", imports: noImports }, "BaseDAO")).toEqual({ kind: "unresolved", reason: "ambiguous" })
	expect(resolveTypeReference(index, { package: "x", imports: noImports }, "EgovAbstractDAO")).toEqual({ kind: "unresolved", reason: "not-in-project" })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/utils/__tests__/javaIndex.spec.ts` — Expected: FAIL

- [ ] **Step 3: `src/utils/javaIndex.ts` 구현**

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/utils/__tests__/javaIndex.spec.ts` — Expected: PASS

### Task 4: DAO 분류·출처 해석·판정 `daoCheck.ts`

**Files:**
- Create: `src/utils/daoCheck.ts`
- Modify: `src/utils/javaSource.ts` (`createCachedReader` 추가)
- Test: `src/utils/__tests__/daoCheck.spec.ts`

**Interfaces:**
- Consumes: Task 1 타입, Task 2 `stripJavaComments`/`readPackage`/`collectImports`/`findTypeDeclaration`/`hasToken`/`packageOf`/`simpleNameOf`, Task 3 `JavaIndex`/`resolveTypeReference`/`ReadFile`
- Produces:

```ts
// javaSource.ts에 추가
export function createCachedReader(read: ReadFile = (p) => fs.readFileSync(p, "utf8")): ReadFile   // 경로별 1회 읽기

// daoCheck.ts
export const EGOV3_BASE_PACKAGE = "egovframework.rte.psl.dataaccess"
export const EGOV4_BASE_PACKAGE = "org.egovframe.rte.psl.dataaccess"
export const MYBATIS_ANNOTATION_PACKAGE = "org.apache.ibatis.annotations"
export const MAPSTRUCT_PACKAGE = "org.mapstruct"
export type OriginKind = "egov3" | "egov4" | "mybatis" | "mapstruct" | "project" | "unresolved" | "other"
export interface OriginResolution { kind: OriginKind; package: string | null; evidence: string }
export interface SourceContext { package: string | null; imports: JavaImports }
export type EgovSimpleName = "Mapper" | "EgovMapper" | "EgovAbstractDAO" | "EgovAbstractMapper"
export function resolveOrigin(name: EgovSimpleName, rawName: string, source: SourceContext, index: JavaIndex, generation: RuntimeGeneration | "unknown"): OriginResolution

export interface DaoFileAnalysis { filePath: string; fileName: string; parentPath: string; typeName: string; stripped: string; package: string | null; imports: JavaImports; declaration: JavaTypeDeclaration | null }
export function analyzeJavaFile(filePath: string, readFile: ReadFile): DaoFileAnalysis
export interface InheritanceChain {
	path: string[]                                   // 경유 중간 클래스 단순 이름 (직접 상속이면 [])
	terminal: "EgovAbstractDAO" | "EgovAbstractMapper" | null
	terminalRaw: string | null                       // extends에 적힌 원문 (FQCN 가능)
	terminalSource: SourceContext | null             // 종점을 적은 파일의 package·imports
	unresolvedParent: string | null                  // 프로젝트에서 못 찾은 부모 (있으면 체인이 거기서 끊김)
	firstParentFile: string | null                   // 직접 부모가 프로젝트 파일이면 그 경로 (S6용)
}
export function traceInheritance(analysis: DaoFileAnalysis, index: JavaIndex, analyze: (filePath: string) => DaoFileAnalysis, maxDepth?: number): InheritanceChain   // 기본 maxDepth 5, 순환 방지
export type DaoClassification =
	| { kind: "skipped"; reason: SkippedReason; detail?: string }
	| { kind: "judged"; style: DaoStyle | null; chain: InheritanceChain | null; mapperAnnotation: { name: "Mapper" | "EgovMapper"; raw: string } | null }
export function classifyDaoFile(analysis: DaoFileAnalysis, index: JavaIndex, analyze: (filePath: string) => DaoFileAnalysis, generation: RuntimeGeneration | "unknown"): DaoClassification   // S1·S2·S3·S4·S5·S7 (S6은 checkDaoLayer의 2패스)
export function evaluateDaoFile(analysis: DaoFileAnalysis, judged: Extract<DaoClassification, { kind: "judged" }>, index: JavaIndex, generation: RuntimeGeneration | "unknown"): ArchCheckResult
export interface DaoLayerOutcome { results: ArchCheckResult[]; skipped: SkippedFile[]; judgedTypeNames: Set<string> }
export function checkDaoLayer(filePaths: string[], index: JavaIndex, readFile: ReadFile, generationOf: (filePath: string) => RuntimeGeneration | "unknown"): DaoLayerOutcome
```

구현이 따라야 할 규칙(스펙 5.2~5.6을 코드 값으로 고정):

- `resolveOrigin` 순서(Java 이름 해석과 같다, 스펙 5.5): ① `rawName`에 `.`이 있으면 그 패키지 ② 단일 import ③ **색인에 `<파일 패키지>.<name>`이 있으면 `project`**(같은 패키지의 로컬 복사본, evidence `same package <pkg> (local copy)`) ④ 와일드카드 import 중 아래 제공 표에 있는 패키지가 정확히 하나면 그것, 둘 이상이면 `unresolved`(evidence `ambiguous wildcard`) ⑤ 그 외 `unresolved`(evidence `no import`). ①②④로 정해진 패키지도 색인에 `<패키지>.<name>`이 있으면 `project`(evidence `import <fqcn> (local copy)`). 패키지 → 종류: `EGOV3_BASE_PACKAGE`와 `.mapper` → `egov3`, `EGOV4_BASE_PACKAGE`와 `.mapper` → `egov4`, `MYBATIS_ANNOTATION_PACKAGE` → `mybatis`, `MAPSTRUCT_PACKAGE` → `mapstruct`, 그 밖은 `other`.
- 제공 표(와일드카드 해석용, 세대 `unknown`이면 모든 행 허용): `Mapper` ← egov3 `.mapper`(3.x), egov4 `.mapper`(4.x), mybatis(전 세대), mapstruct(전 세대); `EgovMapper` ← egov4 `.mapper`(5.x); `EgovAbstractDAO`·`EgovAbstractMapper` ← egov3 기본 패키지(3.x), egov4 기본 패키지(4.x·5.x).
- `classifyDaoFile` 순서: S7(선언 없음 또는 enum/record/annotation → `not-a-class`) → S1(`isAbstract` → `abstract`) → S2(`hasToken(stripped, "@Configuration")` → `configuration`) → interface면 S4(`extendsNames` 단순 이름이 `/^(Jpa|Crud|PagingAndSorting|ListCrud|ListPagingAndSorting|R2dbc|Mongo|Reactive\w*)Repository$/` → `spring-data`, detail 그 이름) → 선언 어노테이션에서 단순 이름이 `Mapper`/`EgovMapper`인 첫 항목을 `mapperAnnotation`으로 → S5(`Mapper`의 출처가 `mapstruct` → `mapstruct`) → judged `mapperInterface`. class면 `traceInheritance` → S3(`fileName`이 `Mapper.java`로 끝나고 `terminal === null`이고 선언 어노테이션에 단순 이름 `Repository`/`Component`/`Service`가 없음 → `not-data-access`, detail `no egov base and no stereotype`) → judged, `style`은 종점 `EgovAbstractDAO` → `ibatisDao`, `EgovAbstractMapper` → `mybatisDao`, 없으면 `null`.
- `evaluateDaoFile` 클래스 방식: check1 = 종점 있음, detail `iBatis DAO`/`MyBatis DAO`, `inheritancePath = chain.path`; 실패 detail은 `unresolvedParent`가 있으면 `parent <이름> not found`, 없으면 `no egov base`. check2 = 선언 어노테이션에 단순 이름 `Repository`(FQCN 허용, `RepositoryRestResource` 제외) 있음 ∧ 종점 출처가 `project`가 아님; detail `@Repository` / `no @Repository` / `<종점> copied into project`. check3: 세대 `unknown` 또는 check1 실패 또는 종점 출처가 egov3/egov4가 아니면 `skipped`·`n/a`; 3.x 기대 egov3, 4.x·5.x 기대 egov4; 일치 `pass`·detail 세대 라벨; 불일치 `fail`·detail `egovframework.rte (3.x) in <세대> project` 또는 `org.egovframe.rte (4.x+) in 3.x project`.
- 인터페이스 방식: check1 = `mapperAnnotation` 있음, detail `Mapper IF` / `no @Mapper/@EgovMapper`, 있으면 `annotationText = mapperAnnotation.raw`. check2 = 출처 egov3/egov4 → `egov`; `mybatis` → `mybatis @Mapper`; `project`/`other` → `custom annotation`; `unresolved` → `unresolved import`; check1 실패면 `no @Mapper/@EgovMapper`. check3: 세대 `unknown` 또는 check2 실패면 `skipped`·`n/a`; 기대는 3.x `Mapper`+egov3, 4.x `Mapper`+egov4, 5.x `EgovMapper`+egov4; 이름 불일치 detail `@EgovMapper in <세대> project` 또는 `@Mapper → 5.x requires @EgovMapper`, 패키지 불일치 detail은 클래스 방식과 같다(이름 먼저 검사).
- 공통: `check3 = check3State !== "fail"`, `result = check1 && check2 && check3 ? "OK" : "NotFound"`, `type: "DAO"`, `daoStyle`은 `style ?? undefined`.
- `checkDaoLayer`: `analyze`는 `Map`으로 캐시(파일당 1회). 분류 뒤 **S6 2패스**: 수집 파일 전체에 대해 직접 부모 파일 경로(`resolveTypeReference`로 `extendsNames[0]`을 푼 결과)를 세어, judged 클래스 방식이고 `@Repository`가 없는 항목이 다른 수집 파일의 직접 부모면 `skipped` `base-class`·detail `base of <n> classes`. 결과 순서는 입력 순서. `judgedTypeNames`는 judged 항목의 `typeName` 집합.

- [ ] **Step 1: 실패하는 테스트 작성** — `daoCheck.spec.ts`는 fs 없이 돌린다. 테스트마다 자기 `files: Record<string,string>`(절대 경로 키)를 만들고 도우미 `setup(files, gen)`을 부른다: `readFile = (p) => files[p]`, `index = buildJavaIndex(Object.keys(files), readFile)`, `daoPaths = Object.keys(files).filter((p) => /(DAO|Dao|Mapper)\.java$/.test(p))`, `outcome = checkDaoLayer(daoPaths, index, readFile, () => gen)`을 만들어 `{ outcome, daoPaths, r: (fileName) => outcome.results.find(...)!, skippedOf: (fileName) => outcome.skipped.find(...)!, reasons: Object.fromEntries(outcome.skipped.map((s) => [s.fileName, s.reason])) }`를 돌려준다. 도우미 `java(pkg, imports: string[], body)`가 `package …;` + import 줄 + body를 만든다. 같은 FQCN을 두 테스트가 다른 내용으로 쓰지 않도록 타입 이름을 테스트마다 다르게 붙인다. 다음 `it`을 쓴다(각각 아래 단정은 최소 집합):

```ts
it("세 방식 직접 상속·선언: iBatis/MyBatis DAO는 @Repository, Mapper IF는 egov 출처로 OK", () => {
	// a.dao.UserDAO: import org.egovframe.rte.psl.dataaccess.EgovAbstractDAO; @Repository class … extends EgovAbstractDAO  (gen 4.x)
	// a.dao.BoardDAO: import org.egovframe.rte.psl.dataaccess.EgovAbstractMapper; @Repository("boardDAO") @Transactional class … extends EgovAbstractMapper (gen 5.x)
	// a.mapper.SampleMapper: import org.egovframe.rte.psl.dataaccess.mapper.EgovMapper; @EgovMapper("sampleMapper") interface (gen 5.x)
	expect(r("UserDAO.java")).toMatchObject({ daoStyle: "ibatisDao", check1Detail: "iBatis DAO", check2Detail: "@Repository", check3State: "pass", check3Detail: "4.x", inheritancePath: [], result: "OK" })
	expect(r("BoardDAO.java")).toMatchObject({ daoStyle: "mybatisDao", check3Detail: "5.x", result: "OK" })
	expect(r("SampleMapper.java")).toMatchObject({ daoStyle: "mapperInterface", check1Detail: "Mapper IF", check2Detail: "egov", check3Detail: "5.x", annotationText: '@EgovMapper("sampleMapper")', result: "OK" })
})
it("3.x: egovframework.rte 기반 클래스와 @Mapper가 3.x 프로젝트에서 통과한다 (직접·간접)", () => {
	// a.dao.OldDAO: import egovframework.rte.psl.dataaccess.EgovAbstractDAO; @Repository extends EgovAbstractDAO (gen 3.x) → check3 "3.x", OK
	// a.cmmn.OldBase (abstract, import egovframework.rte.psl.dataaccess.EgovAbstractDAO) + a.dao.ViaOldDAO extends OldBase (@Repository) → inheritancePath ["OldBase"], "3.x", OK
	// a.mapper.OldMapper: import egovframework.rte.psl.dataaccess.mapper.Mapper; @Mapper interface → check2 "egov", check3 "3.x", OK
})
it("간접 상속: 중간 abstract 클래스에만 import가 있어도 종점 파일에서 출처를 읽고 경유 경로를 싣는다", () => {
	// a.cmmn.EgovComAbstractDAO (abstract, import egov4 base, extends EgovAbstractMapper), a.dao.CmmUseDAO extends EgovComAbstractDAO (@Repository), a.cmmn.Mid extends EgovComAbstractDAO (abstract), a.dao.DeepDAO extends Mid
	expect(r("CmmUseDAO.java")).toMatchObject({ inheritancePath: ["EgovComAbstractDAO"], check3Detail: "5.x", result: "OK" })
	expect(r("DeepDAO.java")).toMatchObject({ inheritancePath: ["Mid", "EgovComAbstractDAO"], result: "OK" })
	expect(skippedOf("EgovComAbstractDAO.java")).toMatchObject({ reason: "abstract" })
})
it("S2·S3·S4·S5·S7: 설정 클래스, 비데이터 접근 Mapper, Spring Data, MapStruct, enum은 제외 목록으로 간다", () => {
	// EgovConfigMapper(@Configuration), CustomerCreditRowMapper implements RowMapper<X> (no stereotype), OrderDao interface extends JpaRepository<Order, Long>,
	// CarMapper interface @Mapper with import org.mapstruct.Mapper, StatusDao enum, @Component class FooMapper { } (judged, fails)
	expect(reasons).toEqual({ "EgovConfigMapper.java": "configuration", "CustomerCreditRowMapper.java": "not-data-access", "OrderDao.java": "spring-data", "CarMapper.java": "mapstruct", "StatusDao.java": "not-a-class" })
	expect(r("FooMapper.java")).toMatchObject({ check1: false, check1Detail: "no egov base", daoStyle: undefined, result: "NotFound" })
	expect(outcome.judgedTypeNames.has("CustomerCreditRowMapper")).toBe(false); expect(outcome.judgedTypeNames.has("FooMapper")).toBe(true)
})
it("S6: @Repository 없는 concrete 기반 클래스는 base-class로 제외하고, 그 자식은 2단계 경유로 OK", () => {
	// a.cmmn.OrgManageLdapDAO (no @Repository) extends EgovComAbstractDAO; a.dao.UserManageLdapDAO/DeptManageLdapDAO (@Repository) extends OrgManageLdapDAO
	expect(skippedOf("OrgManageLdapDAO.java")).toMatchObject({ reason: "base-class", detail: "base of 2 classes" })
	expect(r("UserManageLdapDAO.java")).toMatchObject({ inheritancePath: ["OrgManageLdapDAO", "EgovComAbstractDAO"], result: "OK" })
})
it("check2 출처 해석: MyBatis @Mapper, 와일드카드 2개(세대 표로 확정/모호), 섀도잉, FQCN 어노테이션, 나뉜 import, 블록 주석 안 import", () => {
	// MybatisMapper: import org.apache.ibatis.annotations.Mapper → check2 false "mybatis @Mapper", check3 skipped, NotFound
	// WildMapper5 (gen 5.x): import org.apache.ibatis.annotations.*; import org.egovframe.rte.psl.dataaccess.mapper.*; @Mapper → "mybatis @Mapper"
	// WildMapper4 (gen 4.x): 같은 import, @Mapper → check2Detail "unresolved import"
	// ShadowMapper: import org.apache.ibatis.annotations.Mapper; import org.egovframe.rte.psl.dataaccess.mapper.*; @Mapper → "mybatis @Mapper"
	// FqcnMapper: import 없음, @org.egovframe.rte.psl.dataaccess.mapper.EgovMapper("m") (gen 5.x) → check2 "egov", check3 "5.x"
	// SplitMapper: "import\n  org.egovframe.rte.psl.dataaccess.mapper.EgovMapper;" → "egov"
	// CommentMapper: "/* import org.apache.ibatis.annotations.Mapper; */" + import egov Mapper (gen 4.x) → "egov", check3 "4.x"
	// NoImportMapper: 같은 패키지 자체 @Mapper(색인에 a.mapper.Mapper.java 있음) → "custom annotation"; LoneMapper: import 없고 색인에도 없음 → "unresolved import"
	// WildCopyDAO (gen 5.x): import org.egovframe.rte.psl.dataaccess.*; 만 있고 같은 패키지에 EgovAbstractMapper.java 복사본이 있음 → 와일드카드보다 같은 패키지가 먼저라 check2 false "EgovAbstractMapper copied into project"
})
it("로컬 복사본·동명 부모·부모 없음·MapperScan", () => {
	// a.dao.EgovAbstractMapper.java(프로젝트 안 복사본) + a.dao.CopyDAO extends EgovAbstractMapper (@Repository) → check2 false "EgovAbstractMapper copied into project", check3 skipped
	// a.dao.BaseDAO extends EgovAbstractDAO(import egov4), b.dao.BaseDAO {} , a.dao.ViaBaseDAO extends BaseDAO → OK via ["BaseDAO"]; b.dao.OtherDAO extends BaseDAO → check1 false "no egov base"
	// a.dao.JarDAO extends CommonDAO (프로젝트에 없음) → check1 false "parent CommonDAO not found", result NotFound
	// a.cfg.ScanMapper interface @MapperScan("a") → check1 false "no @Mapper/@EgovMapper"
})
it("세대: unknown이면 check3 n/a로 두고 OK, 불일치는 실패", () => {
	// 같은 egov4 @Mapper 인터페이스를 unknown → { check3State: "skipped", check3Detail: "n/a", check3: true, result: "OK" }, 5.x → { check3State: "fail", check3Detail: "@Mapper → 5.x requires @EgovMapper", check3: false, result: "NotFound" }
	// @EgovMapper(egov4) 4.x → "@EgovMapper in 4.x project"; egov3 EgovAbstractDAO(import egovframework.rte.psl.dataaccess.EgovAbstractDAO) 5.x → "egovframework.rte (3.x) in 5.x project"; egov4 base 3.x → "org.egovframe.rte (4.x+) in 3.x project"
})
it("파일마다 한 번만 읽는다 (색인 + 분류 + 체인 추적)", () => {
	const files = { /* 간접 상속 테스트와 같은 픽스처 */ }
	const calls = new Map<string, number>()
	const counting: ReadFile = (p) => { calls.set(p, (calls.get(p) ?? 0) + 1); return files[p] }
	const cached = createCachedReader(counting)
	const daoPaths = Object.keys(files).filter((p) => /(DAO|Dao|Mapper)\.java$/.test(p))
	const idx = buildJavaIndex(Object.keys(files), cached); checkDaoLayer(daoPaths, idx, cached, () => "5.x")
	expect([...calls.values()].every((n) => n === 1)).toBe(true)
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/utils/__tests__/daoCheck.spec.ts` — Expected: FAIL

- [ ] **Step 3: `createCachedReader`를 `javaSource.ts`에, 나머지를 `src/utils/daoCheck.ts`에 구현** — 위 규칙 목록을 그대로 코드로 옮긴다. `traceInheritance`는 `visited: Set<filePath>`로 순환을 끊고 `maxDepth`를 넘으면 `unresolvedParent`에 마지막 부모 이름을 둔다.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/utils/__tests__/daoCheck.spec.ts src/utils/__tests__/javaSource.spec.ts src/utils/__tests__/javaIndex.spec.ts` — Expected: PASS

### Task 5: 엔진 배선 — 수집 규칙, 통합 DAO 레이어, Controller "DAO X" 입력

**Files:**
- Modify: `src/utils/archChecker.ts` (수집 36–119행, DAO 주입 676–719행, `checkLayer`·`checkEgovArchitecture` 762–943행, `getLayerCheckInfo`·`saveReport` 948–1031행의 타입만)
- Test: `src/utils/__tests__/archChecker.spec.ts`

**Interfaces:**
- Consumes: Task 2 `createCachedReader`, Task 3 `buildJavaIndex`, Task 4 `checkDaoLayer`
- Produces:

```ts
export interface ArchCheckOptions { rgPath?: string; runtimeGeneration?: RuntimeGeneration }   // runtimeGeneration: 수동 지정 (2단계 드롭다운이 보낸다)
export function shouldSkipDirectory(parentDirName: string, dirName: string): boolean     // 숨김(.로 시작) ∨ EXCLUDED_DIRECTORY_NAMES ∨ (parent "src" ∧ name "test"|"it")
export async function collectProjectFiles(projectPath: string, patterns: string[], rgPath?: string): Promise<string[]>   // pattern "*X"는 접미어 X, 그 외는 정확한 파일 이름. rg: --files --no-ignore --glob <p>… --glob !**/<dir>… --glob !**/src/test/** --glob !**/src/it/**
export async function checkEgovArchitecture(projectPath: string, progressCallback?: (message: string) => void, options?: ArchCheckOptions): Promise<ArchCheckResults>   // 시그니처 유지
```

실행 흐름(1단계): ① `readFile = createCachedReader()`, `javaFiles = collectProjectFiles(projectPath, ["*.java"], rgPath)`, `index = buildJavaIndex(javaFiles, readFile)` ② 레이어 파일 목록은 `javaFiles`에서 접미어로 거른다(`DAO.java`/`Dao.java`/`Mapper.java`, `Controller.java`, `ServiceImpl.java`) — 두 번째 수집 없음 ③ 진행 문구 순서 `🔍 Checking DAO / Mapper layer…` → `🔍 Checking Controller layer…` → `🔍 Checking Service layer…` → `✅ Architecture check completed…`(기존 `with ripgrep` 접미 규칙 유지) ④ `results.DAO = { totalFiles, passedFiles, failedFiles, results, skipped }`(skipped는 빈 배열이라도 넣는다) ⑤ `checkLayer(fileList: string[], layerType: "Controller" | "Service", context: { daoTypeNames?: ReadonlySet<string> })`로 바꾸고 DAO/Mapper 분기와 `checkDAOFile`·`checkMapperFile`·`collectMapperClassNames`를 삭제 ⑥ `checkDaoInjection(filePath, daoTypeNames)`의 두 번째 인자는 `checkDaoLayer(...).judgedTypeNames` ⑦ `getLayerCheckInfo`·`saveReport`의 타입을 `ArchLayer`로 바꾸고 `Mapper` 분기를 지운다(DAO 열 형식은 Task 6).

- [ ] **Step 1: 실패하는 테스트 작성** — `archChecker.spec.ts` 수정:
  - `collectionFixture`에 추가: `"src/test/java/egov/TestUserDAO.java"`, `"src/it/java/egov/ItController.java"`, `` [`${SRC}/mapper/UserMapper.java`]: `@EgovMapper\npublic interface UserMapper {}\n` ``, `".ignore": "ignored/\n"`, `"ignored/IgnoredController.java": "@Controller\n@RequestMapping(\"/i\")\npublic class IgnoredController {}\n"`. 두 수집 경로 모두 기대: `fileNames(results,"Controller")` = `["IgnoredController.java","UserController.java"]`, `fileNames(results,"DAO")` = `["LowerDao.java","UserDAO.java","UserMapper.java"]`, `results.Mapper` 없음(`expect(results).not.toHaveProperty("Mapper")`), `progress`는 4개.
  - 새 `describe("shouldSkipDirectory")`: `("src","test")`·`("src","it")`·`("x",".git")`·`("x","node_modules")` → true, `("x","test")`·`("src","main")` → false.
  - 기존 `"DAO: …"`와 `"Mapper: …"` 두 테스트를 하나로 교체 — `"DAO / Mapper 통합 레이어: 기반 ∧ @Repository/egov 출처 ∧ 버전(세대 unknown → n/a)"`: 픽스처 `BaseDAO`(abstract, `import org.egovframe.rte.psl.dataaccess.EgovAbstractDAO;`), `UserDAO extends BaseDAO`(@Repository), `BoardDAO extends EgovAbstractMapper`(@Repository, egov4 import), `NoRepoDAO extends EgovAbstractDAO`(import 있음, @Repository 없음), `UserMapper`(`@EgovMapper("userMapper")`, egov4 mapper import), `BoardMapper`(`@Mapper`, `import org.apache.ibatis.annotations.Mapper;`), `PlainMapper`(어노테이션 없음). 기대: UserDAO `{ check1: true, check2: true, check3State: "skipped", check3Detail: "n/a", result: "OK", inheritancePath: ["BaseDAO"] }`; BoardDAO OK `daoStyle: "mybatisDao"`; NoRepoDAO `{ check2: false, check2Detail: "no @Repository", result: "NotFound" }`; UserMapper OK `check2Detail: "egov"`; BoardMapper `{ check2Detail: "mybatis @Mapper", result: "NotFound" }`; PlainMapper `{ check1: false, result: "NotFound" }`; `results.DAO.skipped` = `[{ fileName: "BaseDAO.java", reason: "abstract" }]`(`toMatchObject`); `results.DAO`는 `{ totalFiles: 6, passedFiles: 3, failedFiles: 3 }`.
  - `"…runtimeGeneration 옵션으로 세대를 지정하면 check3를 판정한다"`: 같은 픽스처에 `{ runtimeGeneration: "5.x" }` → BoardMapper는 그대로, UserMapper `check3Detail: "5.x"`, `UserDAO` `check3Detail: "5.x"`; `{ runtimeGeneration: "4.x" }` → UserMapper `{ check3State: "fail", check3Detail: "@EgovMapper in 4.x project", result: "NotFound" }`.
  - Controller "DAO X" 테스트에 `` [`${SRC}/cmmn/ObjectMapper.java`]: `public class ObjectMapper {}\n` `` 추가 — 프로젝트 안에 같은 이름 파일이 있어도 S3로 제외되므로 `JacksonController`는 여전히 `check3: true`. `SampleMapper`(`@Mapper` import 없음)는 판정 대상이라 `MapperController`는 여전히 `NotFound`. 집계 `{ totalFiles: 8, passedFiles: 3, failedFiles: 5 }` 유지.
  - `"파일이 없어도 네 레이어가 모두 채워진다"` → `"세 레이어"`: Controller·Service는 `{ totalFiles: 0, passedFiles: 0, failedFiles: 0, results: [] }`, DAO는 `{ …, results: [], skipped: [] }`.
  - Service 테스트의 픽스처·기대는 손대지 않는다(비목표).

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/utils/__tests__/archChecker.spec.ts` — Expected: FAIL (`LowerDao` 미수집, `Mapper` 키 존재, 진행 문구 5개)

- [ ] **Step 3: `archChecker.ts` 구현** — 위 실행 흐름대로. `findFilesWithFs(dirPath, matchers: Array<{ suffix?: string; exact?: string }>)`는 디렉터리 진입 전에 `shouldSkipDirectory(path.basename(dirPath), entry.name)`을 본다. `checkDaoInjection`의 `INJECTED_TYPE_PATTERN`은 그대로 두고 매개변수 이름을 `daoTypeNames`로 바꾸며, 679–683행 주석의 "*Mapper 타입은 프로젝트 안에 같은 이름의 *Mapper.java가 있을 때만 DAO로 본다"를 "*Mapper 타입은 DAO 레이어 판정 대상(제외 목록 제외)에 같은 이름이 있을 때만 DAO로 본다"로 고친다.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/utils/__tests__/archChecker.spec.ts && npm run check-types` — Expected: 둘 다 PASS (ripgrep describe는 `node_modules/@vscode/ripgrep-*`가 있을 때만 돈다)

### Task 6: DAO CSV 열 형식

**Files:**
- Modify: `src/utils/archChecker.ts` (`getLayerCheckInfo`, `saveReport`, 새 `csvCell`·`formatDaoRow`)
- Test: `src/utils/__tests__/archChecker.spec.ts` (`describe("CSV 내보내기")`)

**Interfaces:**
- Produces: `Result_DAO_<date>.csv` 머리글 `Path,FileName,Style,Base,Bean,Version,Result`. 셀 규칙 — Style: `iBatis DAO` / `MyBatis DAO` / `Mapper IF` / `-`(daoStyle 없음); Base: 통과 `PASS` 뒤에 `inheritancePath`가 있으면 ` via A > B`, 실패 `FAIL (<check1Detail>)`; Bean: `PASS (<check2Detail>)` / `FAIL (<check2Detail>)`; Version: `skipped` → `n/a`, 통과 `PASS (<check3Detail>)`, 실패 `FAIL (<check3Detail>)`. DAO 행의 모든 셀은 `csvCell(value)`(쉼표·큰따옴표·줄바꿈이 있으면 큰따옴표로 감싸고 안의 `"`는 `""`)을 거친다. Controller/Service 행은 바이트 단위로 종전과 같다.

- [ ] **Step 1: 실패하는 테스트 작성** — `describe("CSV 내보내기")`에 추가:

```ts
it("DAO CSV는 Style/Base/Bean/Version 열에 상세 문자열을 쓰고 쉼표가 든 셀은 인용한다", async () => {
	const outDir = makeProject({})
	const dao = (fileName: string, parentPath: string, fields: Partial<ArchCheckResult>): ArchCheckResult =>
		({ filePath: `${parentPath}/${fileName}`, fileName, parentPath, type: "DAO", check1: true, check2: true, check3: true, result: "OK", ...fields })
	await exportArchResults({ DAO: { totalFiles: 4, passedFiles: 1, failedFiles: 3, results: [
		dao("CmmUseDAO.java", "/p/dao", { daoStyle: "mybatisDao", check1Detail: "MyBatis DAO", inheritancePath: ["EgovComAbstractDAO"], check2Detail: "@Repository", check3State: "pass", check3Detail: "5.x" }),
		dao("BoardMapper.java", "/p/mapper", { daoStyle: "mapperInterface", check1Detail: "Mapper IF", check2: false, check2Detail: "mybatis @Mapper", check3State: "skipped", check3Detail: "n/a", result: "NotFound" }),
		dao("JarDAO.java", "/p/dao", { check1: false, check1Detail: "parent CommonDAO not found", check2Detail: "@Repository", check3State: "skipped", check3Detail: "n/a", result: "NotFound" }),
		dao("OldMapper.java", "/p/odd,dir", { daoStyle: "mapperInterface", check1Detail: "Mapper IF", check2Detail: "egov", check3: false, check3State: "fail", check3Detail: "@Mapper → 5.x requires @EgovMapper", result: "NotFound" }),
	] } }, outDir)
	expect(readCsv(outDir, "DAO")).toEqual([
		"Path,FileName,Style,Base,Bean,Version,Result",
		"/p/dao,CmmUseDAO.java,MyBatis DAO,PASS via EgovComAbstractDAO,PASS (@Repository),PASS (5.x),OK",
		"/p/mapper,BoardMapper.java,Mapper IF,PASS,FAIL (mybatis @Mapper),n/a,NotFound",
		"/p/dao,JarDAO.java,-,FAIL (parent CommonDAO not found),PASS (@Repository),n/a,NotFound",
		'"/p/odd,dir",OldMapper.java,Mapper IF,PASS,PASS (egov),FAIL (@Mapper → 5.x requires @EgovMapper),NotFound',
	])
	expect(fs.readdirSync(outDir).some((f) => f.startsWith("Result_Mapper_"))).toBe(false)
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/utils/__tests__/archChecker.spec.ts -t "DAO CSV"` — Expected: FAIL (머리글이 종전 6열)

- [ ] **Step 3: 구현** — `getLayerCheckInfo("DAO")`가 7열을 돌려주고, `saveReport`는 `resultType === "DAO"`면 `formatDaoRow(item): string[]`로 셀 배열을 만든 뒤 `csvCell`을 적용해 `join(",")`한다.

- [ ] **Step 4: 통과 확인** — Run: `npm run test && npm run check-types && npm run lint` — Expected: 모두 PASS

- [ ] **Step 5: 커밋 (1단계 엔진)**

```bash
git add src/shared/archCheck.ts src/shared/webviewMessageSchema.ts src/shared/webviewMessageSchema.test.ts src/utils/javaSource.ts src/utils/javaIndex.ts src/utils/daoCheck.ts src/utils/archChecker.ts src/utils/__tests__/javaSource.spec.ts src/utils/__tests__/javaIndex.spec.ts src/utils/__tests__/daoCheck.spec.ts src/utils/__tests__/archChecker.spec.ts
git commit -m "feat: 아키텍처 점검 DAO와 Mapper 레이어를 통합하고 기반·빈 등록·버전 정합 3체크로 판정"
```

본문(72자 줄바꿈)에 무엇을·왜: 가이드가 DAO 한 항목에 세 방식을 택1로 두므로 파일 내용으로 방식을 분류, `*Dao.java` 수집, `src/test`·`src/it` 제외와 `--no-ignore`, S1~S7 제외 규칙, FQCN 색인 기반 상속 추적과 import 출처 해석, Controller DAO X 입력을 판정 대상 집합으로 교체. trailer 없음.

### Task 7: 웹뷰 — 통합 레이어 표시, 상세 문자열, Skipped 목록

**Files:**
- Create: `webview-ui/src/components/egov/tabs/checkArch/checkDisplay.ts`
- Modify: `webview-ui/src/components/egov/tabs/CheckArchView.tsx` (16–94행의 네 헬퍼를 삭제하고 import, 195–211행 `getCurrentResults`·`getTotalSummary`, 397–406행 요약 카드 map과 라벨, 479–484행 Select, 501·542행 grid, 522–530행 셀, 627–674행 안내 박스, 230–231행 머리말)
- Test: `webview-ui/src/components/egov/tabs/checkArch/checkDisplay.spec.ts`, `webview-ui/src/components/egov/tabs/__tests__/CheckArchView.spec.tsx`

**Interfaces:**
- Consumes: Task 1 타입(`@shared/archCheck`)
- Produces:

```ts
export const LAYER_LABELS: Record<string, string> = { Controller: "Controller", Service: "Service", DAO: "DAO / Mapper" }
export const FILE_LAYER_KEYS = ["Controller", "Service", "DAO"] as const
export function getUsedChecks(layerType: string): { check1: boolean; check2: boolean; check3: boolean }        // DAO도 모두 true
export function getCheckDescriptions(layerType: string): Record<"check1" | "check2" | "check3", { short: string; full: string }>
export interface CellDisplay { symbol: string; color: string; title?: string }
export function getCellDisplay(result: ArchCheckResult, which: 1 | 2 | 3): CellDisplay
```

DAO 설명 문구(정확히): check1 `{ short: "Base", full: "iBatis DAO: extends EgovAbstractDAO / MyBatis DAO: extends EgovAbstractMapper (intermediate classes allowed) / Mapper interface: @Mapper or @EgovMapper" }`, check2 `{ short: "Bean", full: "DAO classes: @Repository on the concrete class / Mapper interfaces: annotation imported from the eGovFrame package (not org.apache.ibatis)" }`, check3 `{ short: "Version", full: "Base class package or Mapper annotation matches the project's runtime generation (3.x egovframework.rte, 4.x @Mapper, 5.x @EgovMapper); n/a when the generation is unknown" }`. 셀 규칙: Controller which=2는 기존 `getMappingDetail` 규칙(Class level / a/b / ✓); DAO which=1 통과 → `symbol = check1Detail ?? "✓"`, `title`은 경유가 있으면 `"via " + inheritancePath.join(" > ")`, 없고 `annotationText`가 있으면 그 원문, 실패 → `"✗"`·`title = check1Detail`; which=2 통과 → `check2Detail ?? "✓"`, 실패 `"✗"`·title; which=3 `check3State === "skipped"` → `{ symbol: "n/a", color: "var(--vscode-descriptionForeground)", title: "Runtime generation unknown" }`, `pass` → `check3Detail ?? "✓"` 초록, `fail` → `"✗"` 빨강·title. 그 밖은 기존 ✓/✗/`-`.

화면 변경: Select 옵션은 `FILE_LAYER_KEYS.filter((k) => checkResults[k]).map((k) => ({ value: k, label: LAYER_LABELS[k] }))`; 요약 카드 map도 `Object.entries` 대신 `FILE_LAYER_KEYS.filter((k) => checkResults[k])`로 돌고 제목은 `LAYER_LABELS[k]`; `getCurrentResults`는 `selectedResultType`이 `FILE_LAYER_KEYS`에 있을 때만 `checkResults[k]`를 돌려준다(`ArchCheckSummary | null` 유지; 2단계에서 `project` 키가 생겨도 타입이 깨지지 않도록); `getTotalSummary`는 `FILE_LAYER_KEYS`만 합산; 머리글·행 grid `2fr 1fr 110px 110px 110px 80px`; 셀 `title`은 `getCellDisplay(...).title`; 요약 카드 아래에 `checkResults.DAO?.skipped?.length`가 있을 때 `Skipped N` 토글 버튼(`Button variant="secondary" size="md"`)과 펼친 목록(행: 파일 이름 링크 → `handleFileClick`, `reason`, `detail`); 머리말 "…for Controller, Service, and DAO / Mapper layers."; 안내 박스의 DAO·Mapper 절을 하나의 "DAO / Mapper Layer:"로 교체 — 항목: `File name must follow *DAO.java, *Dao.java or *Mapper.java pattern (the style is detected from the file content)`, `iBatis DAO: @Repository and extends EgovAbstractDAO`, `MyBatis DAO: @Repository and extends EgovAbstractMapper`, `Mapper interface: @Mapper (4.3 and below) or @EgovMapper (5.0 and above) imported from the eGovFrame package`, `Version: the base class package or the annotation must match the project's runtime generation (n/a when unknown)`, `Abstract classes, @Configuration classes, RowMapper-like helpers, Spring Data repositories, MapStruct mappers and plain base classes are listed under Skipped`.

- [ ] **Step 1: 실패하는 테스트 작성** — `checkDisplay.spec.ts`:

```ts
const dao = (f: Partial<ArchCheckResult>): ArchCheckResult => ({ filePath: "/p/A.java", fileName: "A.java", parentPath: "/p", type: "DAO", check1: true, check2: true, check3: true, result: "OK", ...f })
it("DAO 칸은 상세 문자열·경유 툴팁·n/a를 보인다", () => {
	expect(getCellDisplay(dao({ check1Detail: "MyBatis DAO", inheritancePath: ["EgovComAbstractDAO"] }), 1)).toMatchObject({ symbol: "MyBatis DAO", title: "via EgovComAbstractDAO" })
	expect(getCellDisplay(dao({ check1Detail: "Mapper IF", annotationText: '@EgovMapper("m")' }), 1)).toMatchObject({ symbol: "Mapper IF", title: '@EgovMapper("m")' })
	expect(getCellDisplay(dao({ check2: false, check2Detail: "mybatis @Mapper" }), 2)).toMatchObject({ symbol: "✗", title: "mybatis @Mapper", color: "var(--vscode-errorForeground)" })
	expect(getCellDisplay(dao({ check3State: "skipped", check3Detail: "n/a" }), 3)).toMatchObject({ symbol: "n/a", color: "var(--vscode-descriptionForeground)" })
	expect(getCellDisplay(dao({ check3State: "pass", check3Detail: "5.x" }), 3)).toMatchObject({ symbol: "5.x", color: "var(--vscode-terminal-ansiGreen)" })
})
it("Controller 칸은 종전 규칙을 유지한다", () => {
	const c: ArchCheckResult = { ...dao({}), type: "Controller", mappedMethodCount: 2, methodCount: 3, hasClassLevelMapping: false }
	expect(getCellDisplay(c, 2).symbol).toBe("2/3"); expect(getCellDisplay({ ...c, hasClassLevelMapping: true }, 2).symbol).toBe("Class level"); expect(getCellDisplay(c, 1).symbol).toBe("✓")
})
it("레이어 라벨과 사용 칸", () => { expect(LAYER_LABELS.DAO).toBe("DAO / Mapper"); expect(getUsedChecks("DAO")).toEqual({ check1: true, check2: true, check3: true }); expect(getCheckDescriptions("DAO").check3.short).toBe("Version") })
```

`CheckArchView.spec.tsx`에 `describe("CheckArchView DAO / Mapper")` 추가: `archCheckResult`로 `DAO: { totalFiles: 2, passedFiles: 1, failedFiles: 1, results: [CmmUseDAO(OK, MyBatis DAO via EgovComAbstractDAO, @Repository, skipped n/a), BoardMapper(NotFound, Mapper IF, check2 false "mybatis @Mapper", skipped)], skipped: [{ fileName: "EgovComAbstractDAO.java", reason: "abstract", filePath: "/p/EgovComAbstractDAO.java" }] }`를 보낸 뒤: Select에 옵션 텍스트 `DAO / Mapper`가 있고(`screen.getByRole("option", { name: "DAO / Mapper" })`), `fireEvent.change(select, { target: { value: "DAO" } })` 후 `MyBatis DAO`·`@Repository`·`Mapper IF`·`✗` 1개·`n/a` 2개가 보이고 머리글에 `Base`·`Bean`·`Version`이 있다; `Skipped 1` 버튼을 누르면 `EgovComAbstractDAO.java`와 `abstract`가 보인다; 요약의 Total Files는 2(제외 파일은 세지 않는다).

- [ ] **Step 2: 실패 확인** — Run: `cd webview-ui && npx vitest run src/components/egov/tabs/checkArch/checkDisplay.spec.ts src/components/egov/tabs/__tests__/CheckArchView.spec.tsx` — Expected: FAIL

- [ ] **Step 3: `checkDisplay.ts` 작성과 `CheckArchView.tsx` 수정** — 기존 네 헬퍼(`getUsedChecks`, `renderCheckResult`, `getMappingDetail`, `getCheckDescriptions`)는 삭제하고 새 모듈을 import. Skipped 목록은 `useState<boolean>(false)` 하나로 토글.

- [ ] **Step 4: 통과 확인** — Run: `cd webview-ui && npx vitest run && npx tsc -b && cd .. && npm run lint` — Expected: PASS

- [ ] **Step 5: 커밋 (1단계 웹뷰)**

```bash
git add webview-ui/src/components/egov/tabs/checkArch/checkDisplay.ts webview-ui/src/components/egov/tabs/checkArch/checkDisplay.spec.ts webview-ui/src/components/egov/tabs/CheckArchView.tsx webview-ui/src/components/egov/tabs/__tests__/CheckArchView.spec.tsx
git commit -m "feat: 아키텍처 점검 웹뷰에 DAO / Mapper 통합 레이어 상세와 제외 목록 표시"
```

### Task 8: 1단계 CHANGELOG

**Files:**
- Modify: `CHANGELOG.md` (`## Unreleased` → `- Architecture Check` 목록 끝에 항목 추가)

- [ ] **Step 1: 항목 추가** — 다음 한 항목(한 줄, 기존 항목과 같은 문체):

`  - DAO와 Mapper 레이어를 "DAO / Mapper" 한 레이어로 통합. 공식 적용점검 가이드가 DAO 항목에 iBatis DAO·MyBatis DAO·Mapper 인터페이스 세 방식을 택1로 두므로 \`*DAO.java\`·\`*Dao.java\`·\`*Mapper.java\`를 함께 모아 파일 내용으로 방식을 분류하고, 기반(Base: \`EgovAbstractDAO\`/\`EgovAbstractMapper\` 상속 또는 \`@Mapper\`/\`@EgovMapper\`) ∧ 빈 등록(Bean: \`@Repository\` 또는 어노테이션의 import 출처가 표준프레임워크 패키지) ∧ 버전 정합(Version: 세대를 모르면 n/a)으로 판정. 중간 클래스 경유 상속은 패키지 선언 기준 FQCN 색인으로 추적하고(동명 클래스·주석 안 \`extends\` 오독 해소), MyBatis \`org.apache.ibatis.annotations.Mapper\`를 쓴 인터페이스는 실패로 표시. abstract 클래스·\`@Configuration\` 클래스·RowMapper 같은 비(非) 데이터 접근 \`*Mapper\`·Spring Data 저장소·MapStruct·\`@Repository\` 없는 기반 클래스는 판정에서 빼고 Skipped 목록으로 표시. 모든 레이어에서 \`src/test\`·\`src/it\` 아래를 제외하고 ripgrep이 \`.gitignore\`를 따르지 않도록 \`--no-ignore\`를 적용해 fs 대체 경로와 같은 집합을 모음. Controller "DAO X"의 입력을 \`*Mapper.java\` 파일 이름 집합에서 DAO 레이어 판정 대상 집합으로 바꿔 공통컴포넌트의 \`ObjectMapper.java\` 때문에 Jackson \`ObjectMapper\` 주입이 실패로 표시되던 오탐 해소. CSV는 \`Result_DAO_*.csv\`의 열을 Style/Base/Bean/Version으로 바꾸고 \`Result_Mapper_*.csv\`는 더 이상 만들지 않음`

- [ ] **Step 2: 커밋**

```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG Unreleased에 아키텍처 점검 DAO / Mapper 레이어 통합 항목 추가"
```

---

# 2단계 — 빌드 파일 기반 Project 점검

### Task 9: 세대별 정적 모듈 그래프 `runtimeModuleGraph.ts`

**Files:**
- Modify: `src/shared/archCheck.ts` (`export type RequiredLibraryName = "ptl-mvc" | "fdl-cmmn" | "fdl-logging" | "psl-dataaccess"` 추가 — Task 12가 아니라 여기서)
- Create: `src/utils/runtimeModuleGraph.ts`
- Create: `src/utils/__tests__/fixtures/runtime-graph/graph-{3.9.x,3.10.x,4.0.x,4.1.x,4.2.x,4.3.x,5.0.x}.txt` — `/Users/psw/Downloads/egovframe-architecture-check-docs/data/runtime-module-graph/`의 같은 이름 파일을 그대로 복사(`graph-main.txt`는 5.0.x와 같으므로 제외). 형식: 모듈마다 `== <파일>` 줄, `artifact=<groupId>:<artifactId>:<version> …`, `dep <groupId>:<artifactId>:<version> scope=<scope> optional=<bool>` (5.0.x는 `artifact=(parent):<artifactId>:(parent)` 꼴)
- Test: `src/utils/__tests__/runtimeModuleGraph.spec.ts`

**Interfaces:**
- Produces:

```ts
export type RuntimeGraphBranch = "3.9.x" | "3.10.x" | "4.0.x" | "4.1.x" | "4.2.x" | "4.3.x" | "5.0.x"
export type ModuleGraph = Record<string, string[]>      // 모듈 키 → compile 의존 모듈 키(실행환경 모듈만, 선언 순서)
export const RUNTIME_MODULE_GRAPH: Record<RuntimeGraphBranch, ModuleGraph>
export const REQUIRED_LIBRARIES: readonly RequiredLibraryName[]   // ["ptl-mvc", "fdl-cmmn", "fdl-logging", "psl-dataaccess"]
export function toModuleKey(artifactId: string): string | null   // "egovframework.rte.ptl.mvc" | "org.egovframe.rte.ptl.mvc" | "egovframe-rte-ptl-mvc" → "ptl-mvc"; 접두어 없으면 null
export function generationOfArtifactId(artifactId: string): RuntimeGeneration | null   // 접두어로 3.x / 4.x / 5.x
export function selectGraphBranch(generation: RuntimeGeneration, version?: string): RuntimeGraphBranch   // 3.x: "3.9."로 시작하면 3.9.x, 그 외 3.10.x; 4.x: 4.0./4.1./4.2. → 해당, 그 외 4.3.x; 5.x → 5.0.x
export interface DirectDependency { key: string; exclusions: string[]; evidence: string }   // exclusions: 모듈 키 또는 "*"(전부)
export interface ReachResult { status: "direct" | "transitive" | "excluded" | "missing"; via: string[] }   // via: direct면 [key], transitive/excluded면 경로(직접 선언 → … → target), missing이면 []
export function reachRequiredLibrary(target: string, direct: DirectDependency[], graph: ModuleGraph): ReachResult
```

도달 규칙(Maven 의미론): 직접 선언에 `target`이 있으면 `direct`. 아니면 직접 선언마다 그 노드에서 BFS하되 **그 선언의 exclusion에 든 키(또는 `*`)는 진입하지 않고 그 아래도 보지 않는다**; 찾은 경로 중 가장 짧은 것(같으면 먼저 선언된 것)이 `transitive`. 못 찾으면 exclusion을 무시하고 다시 BFS해 찾으면 `excluded`(그 경로), 그래도 없으면 `missing`. `RUNTIME_MODULE_GRAPH`는 픽스처에서 손으로 옮기되 테스트가 픽스처와 비교해 고정한다. 그래프에는 `toModuleKey`가 null이 아닌 아티팩트만 넣는다(`spring-modules-validation` 제외).

- [ ] **Step 1: 실패하는 테스트 작성** — `runtimeModuleGraph.spec.ts`:

```ts
const BRANCHES: RuntimeGraphBranch[] = ["3.9.x", "3.10.x", "4.0.x", "4.1.x", "4.2.x", "4.3.x", "5.0.x"]
const G = RUNTIME_MODULE_GRAPH
const dep = (key: string, exclusions: string[] = []): DirectDependency => ({ key, exclusions, evidence: key })
const sorted = (g: ModuleGraph) => Object.fromEntries(Object.keys(g).sort().map((k) => [k, [...g[k]].sort()]))
function parseFixture(branch: RuntimeGraphBranch): ModuleGraph   // fixtures/runtime-graph/graph-<branch>.txt: "artifact=" 줄의 두 번째 조각을 toModuleKey, "dep " 줄 중 scope=compile optional=false이고 toModuleKey가 null이 아닌 것만 간선. 간선 없는 모듈도 [] 로 넣는다
it.each(BRANCHES)("%s 그래프 상수는 픽스처와 같다", (b) => expect(sorted(RUNTIME_MODULE_GRAPH[b])).toEqual(sorted(parseFixture(b))))
it("아티팩트 이름 → 모듈 키·세대", () => {
	expect(toModuleKey("egovframework.rte.ptl.mvc")).toBe("ptl-mvc"); expect(toModuleKey("org.egovframe.rte.psl.dataaccess")).toBe("psl-dataaccess"); expect(toModuleKey("egovframe-rte-fdl-cmmn")).toBe("fdl-cmmn")
	expect(toModuleKey("spring-modules-validation")).toBeNull(); expect(toModuleKey("egovframe-boot-starter-crypto")).toBeNull()
	expect(generationOfArtifactId("egovframework.rte.fdl.cmmn")).toBe("3.x"); expect(generationOfArtifactId("org.egovframe.rte.fdl.cmmn")).toBe("4.x"); expect(generationOfArtifactId("egovframe-rte-fdl-cmmn")).toBe("5.x")
})
it("브랜치 선택", () => { expect(selectGraphBranch("3.x", "3.9.0")).toBe("3.9.x"); expect(selectGraphBranch("3.x")).toBe("3.10.x"); expect(selectGraphBranch("4.x", "4.1.0")).toBe("4.1.x"); expect(selectGraphBranch("4.x")).toBe("4.3.x"); expect(selectGraphBranch("5.x", "5.0.2")).toBe("5.0.x") })
it("5.0.x: ptl-mvc·psl-dataaccess 직접 선언이면 cmmn·logging은 전이", () => {
	const d = [dep("ptl-mvc"), dep("psl-dataaccess")]
	expect(reachRequiredLibrary("fdl-cmmn", d, G["5.0.x"])).toEqual({ status: "transitive", via: ["ptl-mvc", "fdl-cmmn"] })
	expect(reachRequiredLibrary("fdl-logging", d, G["5.0.x"])).toEqual({ status: "transitive", via: ["psl-dataaccess", "fdl-logging"] })
	expect(reachRequiredLibrary("ptl-mvc", d, G["5.0.x"])).toEqual({ status: "direct", via: ["ptl-mvc"] })
	expect(reachRequiredLibrary("ptl-mvc", [dep("fdl-logging")], G["5.0.x"])).toEqual({ status: "missing", via: [] })
})
it("exclusion은 하위 트리를 끊고(4.3.x), 다른 경로로는 다시 들어오며(5.0.x filehandling → string → logging), *는 전부 끊는다", () => {
	expect(reachRequiredLibrary("fdl-logging", [dep("ptl-mvc", ["fdl-cmmn"])], G["4.3.x"])).toEqual({ status: "excluded", via: ["ptl-mvc", "fdl-cmmn", "fdl-logging"] })
	expect(reachRequiredLibrary("fdl-logging", [dep("ptl-mvc", ["fdl-cmmn"])], G["5.0.x"])).toEqual({ status: "transitive", via: ["ptl-mvc", "fdl-filehandling", "fdl-string", "fdl-logging"] })
	expect(reachRequiredLibrary("fdl-logging", [dep("fdl-cmmn", ["fdl-logging"]), dep("ptl-mvc")], G["4.3.x"])).toEqual({ status: "transitive", via: ["ptl-mvc", "fdl-cmmn", "fdl-logging"] })
	expect(reachRequiredLibrary("fdl-cmmn", [dep("ptl-mvc", ["*"])], G["4.3.x"])).toMatchObject({ status: "excluded" })
})
it("3.10.x·4.0.x 그래프 사실", () => { expect(G["3.10.x"]["psl-data-jpa"]).toEqual(["psl-dataaccess", "ptl-mvc"]); expect(G["4.0.x"]["bat-core"]).toContain("fdl-logging"); expect(G["4.3.x"]["bat-core"]).not.toContain("fdl-logging") })
```

- [ ] **Step 2: 픽스처 복사 후 실패 확인** — Run: `mkdir -p src/utils/__tests__/fixtures/runtime-graph && for b in 3.9.x 3.10.x 4.0.x 4.1.x 4.2.x 4.3.x 5.0.x; do cp "/Users/psw/Downloads/egovframe-architecture-check-docs/data/runtime-module-graph/graph-$b.txt" src/utils/__tests__/fixtures/runtime-graph/; done && npx vitest run src/utils/__tests__/runtimeModuleGraph.spec.ts` — Expected: FAIL

- [ ] **Step 3: `runtimeModuleGraph.ts` 구현** — 상수는 픽스처를 한 번 파싱해 출력한 결과를 붙여 넣고(생성 명령은 파일 머리 주석에 남긴다), 함수들은 시그니처대로.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/utils/__tests__/runtimeModuleGraph.spec.ts` — Expected: PASS

### Task 10: Maven POM 스캐너 `mavenPom.ts`

**Files:**
- Create: `src/utils/mavenPom.ts`
- Test: `src/utils/__tests__/mavenPom.spec.ts`

**Interfaces:**
- Produces:

```ts
export interface MavenCoordinate { groupId: string; artifactId: string; version?: string }
export interface MavenExclusion { groupId: string; artifactId: string }            // "*" 허용
export interface MavenDependency extends MavenCoordinate { scope: string; optional: boolean; exclusions: MavenExclusion[]; type?: string }   // scope 기본 "compile"
export interface MavenPomModel {
	groupId?: string; artifactId?: string; version?: string; packaging: string   // 기본 "jar"; groupId/version은 없으면 parent 것
	parent?: MavenCoordinate & { relativePath?: string }
	properties: Record<string, string>
	dependencies: MavenDependency[]          // /project/dependencies 만 (프로파일 아래 dependencies는 activeByDefault여도 세지 않는다)
	managedDependencies: MavenDependency[]   // dependencyManagement (scope import 제외)
	importedBoms: MavenCoordinate[]          // dependencyManagement 중 scope import
	modules: string[]
	profilesIgnored: boolean                 // activeByDefault=true가 아닌 <profile>이 하나라도 있으면 true
}
export function stripXmlComments(xml: string): string
export function parseMavenPom(xml: string): MavenPomModel     // 외부 XML 라이브러리 없이 요소 트리를 만든다. 속성 무시, 네임스페이스 접두어(ns:tag) 제거, CDATA 본문 유지, <build> 아래(플러그인 의존성)는 읽지 않는다
export function resolvePlaceholders(value: string, properties: Record<string, string>, maxDepth?: number): string   // ${k}를 properties[k]로 치환, 기본 깊이 5, 모르는 키·순환은 그대로 둔다
```

- [ ] **Step 1: 실패하는 테스트 작성** — `mavenPom.spec.ts`의 `it` 목록과 핵심 단정:
  - `"주석 블록 안 선언을 무시하고 의존성·scope·optional·exclusions를 읽는다"`: 5.1 web형 pom(주석 안에 4.x 선언 블록, `egovframe-rte-ptl-mvc` scope 없음, `egovframe-rte-fdl-crypto` `<optional>true</optional>`, `junit` scope test, `fdl-cmmn`에 `<exclusions>` `org.egovframe.rte`/`egovframe-rte-fdl-logging`와 `*`/`*`) → `dependencies`에 4.x 좌표 없음, ptl-mvc `scope: "compile"`, crypto `optional: true`, exclusions 두 개 그대로.
  - `"parent·properties·packaging·modules·dependencyManagement import를 읽는다"`: parent `org.egovframe.web:egovframe-web-config-parent:5.0.0` relativePath 없음, `<packaging>pom</packaging>`, `<modules>` 2개, `dependencyManagement`에 `type pom scope import` BOM 1개 + 일반 관리 버전 1개 → `importedBoms` 1개, `managedDependencies` 1개, `groupId`는 parent 것으로 보충.
  - `"플러그인 아래 dependencies와 프로파일 아래 dependencies는 세지 않고, activeByDefault 프로파일의 properties만 합친다"` → `profilesIgnored: true`(비활성 프로파일이 하나 있음), 프로파일 속성 `env=dev` 포함, activeByDefault 프로파일 안의 의존성도 `dependencies`에 없음, 플러그인 의존성 제외.
  - `"네임스페이스 접두어와 CDATA"`: `<m:project xmlns:m=…><m:artifactId><![CDATA[a]]></m:artifactId>` → `artifactId: "a"`.
  - `"resolvePlaceholders: 연쇄 치환, 자기 참조·순환은 끝난다, 모르는 키는 남긴다"`: `{a:"${b}", b:"x"}` → `x`; `{a:"${a}"}` → `"${a}"`; `{a:"${b}", b:"${a}"}` → 유한 종료; `${project.version}` 미정의 → 그대로.

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/utils/__tests__/mavenPom.spec.ts` — Expected: FAIL

- [ ] **Step 3: `mavenPom.ts` 구현** — 토크나이저(`<tag …>`, `</tag>`, `<![CDATA[…]]>`, `<?…?>`, `<!…>`, 텍스트)로 트리를 만든 뒤 경로별로 읽는다.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/utils/__tests__/mavenPom.spec.ts` — Expected: PASS

### Task 11: Gradle 스캐너 `gradleBuild.ts`

**Files:**
- Create: `src/utils/gradleBuild.ts`
- Test: `src/utils/__tests__/gradleBuild.spec.ts`

**Interfaces:**
- Consumes: Task 10 `MavenCoordinate`
- Produces:

```ts
export interface GradleDependency { configuration: string; group: string; name: string; version?: string; exclusions: Array<{ group?: string; module?: string }>; evidence: string }   // version: 변수면 "${이름}" 꼴로 남긴다
export interface GradleBuildModel {
	dependencies: GradleDependency[]          // implementation | api | compile | runtimeOnly | compileOnly (test*·그 밖의 구성은 버린다)
	platforms: MavenCoordinate[]              // platform(...) / enforcedPlatform(...) / dependencyManagement { imports { mavenBom "…" } }
	projectDependencies: string[]             // project(":x") 경로 (":x")
	properties: Record<string, string>        // ext { set('k','v') } / ext { k = 'v' } / ext.k = 'v' / def k = 'v' / val k by extra("v")
	inheritedDependencies: GradleDependency[] // allprojects {} / subprojects {} 안의 dependencies {} (루트 파일이면 자식에 적용)
	appliedScripts: string[]                  // apply from: '<경로>' / apply(from = "<경로>") 의 경로 원문 (호출자가 빌드 파일 디렉터리 기준으로 풀어 같은 모델로 파싱·합친다)
	unresolvedSignals: string[]               // "bundle libs.bundles.x", "loop", "helper function <이름>", "convention plugin <id>", "unparsed: <줄>"
}
export function stripGradleComments(text: string): string   // 문자열 리터럴('…', "…", """…""") 안의 // 와 /* 는 보존
export function parseGradleBuild(text: string, kind: "gradle" | "gradle-kts"): GradleBuildModel
export function parseGradleSettings(text: string): { includes: string[] }          // include ':a', ':b' / include(":a") / include("a") → ":a"
export function parseGradleProperties(text: string): Record<string, string>
export interface VersionCatalog { versions: Record<string, string>; libraries: Record<string, MavenCoordinate & { versionRef?: string }> }
export function parseVersionCatalog(toml: string): VersionCatalog     // [versions] k = "v"; [libraries] k = { module = "g:a", version.ref = "x" } | { group=, name=, version= } | "g:a:v"
export function resolveCatalogReference(ref: string, catalog: VersionCatalog): MavenCoordinate | null   // "libs.egov.ptl.mvc" → libraries["egov-ptl-mvc"] 또는 ["egov.ptl.mvc"]; version.ref는 versions로 치환
```

인식 형태(절 5.8 Gradle 1차 범위): `implementation 'g:a:v'`, `implementation("g:a:v")`, `implementation group: 'g', name: 'a', version: v`(따옴표 없는 변수 → `${v}`), `implementation(group = "g", name = "a", version = v)`, 뒤따르는 `{ exclude group: 'g', module: 'm' }` / `{ exclude(group = "g", module = "m") }`, `implementation project(':x')`, `implementation platform("g:a:v")` / `enforcedPlatform`, `mavenBom "g:a:${v}"`, `implementation(libs.x)` / `implementation libs.x`(evidence에 참조 이름을 두고 group/name은 호출자가 카탈로그로 푼다 → `group: "", name: "libs.x"`). `unresolvedSignals`: `libs.bundles.*` → `bundle libs.bundles.x`; `.each {`·`forEach`·`$it` → `loop`; 파일 안에서 `def 이름(`으로 정의된 함수가 `dependencies {}` 블록 안에서 호출됨 → `helper function 이름`; `plugins { id("…-conventions") }`(또는 `id '…-conventions'`) → `convention plugin <id>`; 구성 이름으로 시작하지만 위 형태에 맞지 않고 `egov`를 포함하는 줄 → `unparsed: <줄>`. `apply from:`은 `appliedScripts`에 두고 신호로 만들지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성** — `gradleBuild.spec.ts`: `"문자열 좌표·맵 표기·Kotlin 명명 인자·exclude 두 형태"`(msa-portal-backend형 `implementation("org.egovframe.rte:egovframe-rte-fdl-cmmn:${egovframeBootParentVersion}") { exclude group: 'org.egovframe.rte', module: 'egovframe-rte-fdl-logging' }` → `{ group: "org.egovframe.rte", name: "egovframe-rte-fdl-cmmn", version: "${egovframeBootParentVersion}", exclusions: [{ group: "org.egovframe.rte", module: "egovframe-rte-fdl-logging" }] }`), `"test 구성은 버리고 platform·mavenBom·project()는 따로 모은다"`, `"ext 네 형태와 gradle.properties"`, `"subprojects 블록의 dependencies는 inheritedDependencies"`, `"settings include 세 형태"`, `"카탈로그 TOML 세 표기와 version.ref 해석"`, `"주석 제거는 문자열 안의 // 를 남긴다"`(`maven { url "https://maven.egovframe.go.kr/maven/" }`), `"bundles·each·$it·헬퍼 함수·conventions 플러그인은 unresolvedSignals, apply from은 appliedScripts"`(`def egovLibs() { … }` 정의 + `dependencies { egovLibs() }` → `helper function egovLibs`; `apply from: 'gradle/dependencies.gradle'` → `appliedScripts: ["gradle/dependencies.gradle"]`).

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/utils/__tests__/gradleBuild.spec.ts` — Expected: FAIL

- [ ] **Step 3: `gradleBuild.ts` 구현** — 줄 단위 정규식 + 중괄호 깊이 추적(`subprojects {`·`dependencies {`·`ext {` 블록 범위)으로 충분하다.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/utils/__tests__/gradleBuild.spec.ts` — Expected: PASS

### Task 12: 프로젝트 빌드 점검 `buildFileCheck.ts`

**Files:**
- Modify: `src/shared/archCheck.ts` (2단계 타입 추가: `RequiredLibraryStatus`·`RuntimeSource`·`RequiredLibraryCheck`·`BuildModuleCheck`·`ProjectCheckSummary`. **`ArchCheckResults.project`는 여기서 넣지 않는다** — `exportArchResults`와 spec 헬퍼를 함께 고쳐야 타입이 맞으므로 Task 13)
- Create: `src/utils/buildFileCheck.ts`
- Test: `src/utils/__tests__/buildFileCheck.spec.ts`

**Interfaces:**
- Consumes: Task 9·10·11 전부, Task 3 `ReadFile`
- Produces (`src/shared/archCheck.ts`에 추가):

```ts
// RequiredLibraryName 은 Task 9에서 이미 추가됨
export type RequiredLibraryStatus = "direct" | "transitive" | "excluded" | "missing" | "unknown"
export type RuntimeSource = "property" | "bom" | "dependency-version" | "artifact-pattern" | "manual" | "none"
export interface RequiredLibraryCheck { name: RequiredLibraryName; status: RequiredLibraryStatus; via?: string[]; evidence: string }
export interface BuildModuleCheck {
	buildFile: string                              // 프로젝트 루트 기준 상대 경로 (구분자 "/")
	buildTool: "maven" | "gradle" | "gradle-kts"
	aggregate: boolean
	runtime: { generation: RuntimeGeneration | "unknown"; version?: string; source: RuntimeSource; evidence: string }
	requiredLibraries: RequiredLibraryCheck[]     // REQUIRED_LIBRARIES 순서로 4개 (aggregate면 [])
	result: "OK" | "NotFound" | "Unknown" | "Skipped"
	notes?: string[]
}
export interface ProjectCheckSummary {
	generation: RuntimeGeneration | "unknown"; version?: string
	versionConsistency: { state: CheckState; versions: string[]; evidence: string }
	modules: BuildModuleCheck[]
	result: "OK" | "NotFound" | "Unknown"
}
// ArchCheckResults.project?: ProjectCheckSummary 는 Task 13에서 추가
```

```ts
// buildFileCheck.ts
export const BUILD_FILE_PATTERNS = ["pom.xml", "*.gradle", "*.gradle.kts", "gradle.properties", "libs.versions.toml"]   // *.gradle(.kts)는 build·settings·apply-from 스크립트를 모두 모은다; 모듈 행은 이름이 build.gradle(.kts)인 것만
export interface BuildFileCheckInput { projectPath: string; files: string[] /* 위 패턴으로 모은 절대 경로 */; readFile: ReadFile; manualGeneration?: RuntimeGeneration }
export function checkProjectBuild(input: BuildFileCheckInput): ProjectCheckSummary
export function generationOfVersion(version: string): RuntimeGeneration | "unknown"    // major 3/4/5
export function moduleForFile(filePath: string, summary: ProjectCheckSummary, projectPath: string): BuildModuleCheck | undefined   // aggregate: false 인 행 중 buildFile 디렉터리가 filePath의 가장 긴 접두 경로인 모듈 (path.sep 무관); 없으면 undefined
export function generationForFile(filePath: string, summary: ProjectCheckSummary, projectPath: string): RuntimeGeneration | "unknown"   // moduleForFile이 있으면 그 모듈의 세대(unknown이어도 그대로 — 추측 금지), 없으면 summary.generation
```

판정 규칙(절 5.8, 엄격 적용):
1. **Maven.** `packaging === "pom"`이고 `modules`가 있으면 `aggregate: true`, `result: "Skipped"`, `requiredLibraries: []`, note `aggregate pom`. 같은 디렉터리에 `pom.xml`과 `build.gradle(.kts)`가 함께 있으면 둘 다 모듈 행으로 만들되 `moduleForFile`은 `pom.xml` 행을 고른다. `moduleForFile`은 두 경로를 `/[\\/]+/`로 나눈 세그먼트 배열의 접두 일치로 비교한다(Windows 경로도 같은 함수로 동작). 프로젝트 안 parent 체인: `parent.relativePath ?? "../pom.xml"`을 pom 디렉터리 기준으로 풀어 `files`에 있으면 그 모델의 properties(자식 우선)·dependencies·importedBoms·managedDependencies를 물려받는다(최대 5단). 치환용 속성은 선언된 속성(자기 pom·parent 체인) + 내장 `project.version`·`project.parent.version`·`revision`이다. BOM(parent 또는 import)이 `egovframe-web-config-parent` / `egovframe-boot-starter-parent` / `org.egovframe.boot.starter.parent`면 `egovframe.rte.version` → BOM 버전을 **별도의 `bomDerived` 맵**에 둔다. `${…}` 치환은 선언 속성 → `bomDerived` 순으로 찾되, 규칙 3 ①의 "속성이 있음" 판정에는 `bomDerived`를 쓰지 않는다(그래야 BOM 프로젝트의 source가 `bom`으로 남는다). 집계 pom도 자기 `runtime`은 계산하지만(행 표시용) 파일→모듈 매핑에는 쓰지 않는다.
2. **직접 선언 D.** `dependencies` 중 scope ∈ {compile, runtime, provided}(없으면 compile), `optional === false`, `toModuleKey(artifactId) !== null`. exclusion은 `toModuleKey(artifactId)` 또는 `*`. 프로젝트 안 다른 모듈의 `groupId:artifactId`를 가리키는 의존성은 그 모듈의 D를 합친다(evidence `via module <artifactId>`, 깊이 5).
3. **세대·버전.** 우선순위: ① **선언된** 속성 `egovframe.rte.version` / `org.egovframe.rte.version` / `egovframework.rte.version`(자기 pom·parent 체인·Gradle `ext`·`gradle.properties`·카탈로그 `[versions]`; 치환 후) → source `property`, evidence `property <이름>=<값>` ② BOM 버전 → `bom`, evidence `bom <artifactId>:<version> (assumed = rte version)` ③ egov 의존성의 `<version>`(치환 후 `${`가 남지 않을 때) → `dependency-version`, evidence `dependency <g:a:v>`; `${…}`가 남으면 그 의존성은 버전 없음으로 보고 note `unresolved: ${…}` ④ 좌표 패턴만 → `artifact-pattern`, version 없음 ⑤ 아무것도 없으면 `none`. 세대는 **좌표 패턴 우선**(`generationOfArtifactId`): 패턴이 하나면 그것; 둘 이상 섞이거나 패턴 세대와 버전 major가 다르면 `unknown` + note `mixed generations`이고 그 모듈은 **세대 충돌 모듈**로 표시해 규칙 7이 일관성 `fail`을 낸다; 패턴이 없고 버전이 있으면 `generationOfVersion`. `manualGeneration`이 있으면 모든 모듈·프로젝트의 `generation`을 그 값으로 덮어쓰고 `runtime.source = "manual"`, evidence `manual (detected: <원래 source> <version ?? "unknown">)`로 두되, 버전 추출과 규칙 7은 그대로 수행한다(세대 충돌 표시는 지운다).
4. **4종.** 그래프 = `selectGraphBranch(세대, 버전)`; 세대 `unknown`이면 3.10.x·4.3.x·5.0.x 합집합으로 보되 evidence를 `transitive? via <path> (union graph)`로 쓴다(status는 `transitive`). 모듈이 `org.egovframe.cloud:*`, `org.egovframe.boot:egovframe-boot-starter-*`, `egovframework.com.ems:*`를 선언하면 `missing`·`excluded`를 `unknown`(evidence `may be transitive via <g:a>`)으로 낮춘다. evidence(화면·CSV에 그대로 보이므로 형식 고정): direct `declared <g:a:v>`, transitive `via <path join " > "> (static graph <branch>)`(예: `via ptl-mvc > fdl-cmmn (static graph 5.0.x)`), excluded `excluded on <path join " > "> (static graph <branch>)`, missing `not declared`, unknown `may be transitive via <g:a>` 또는 `unparsed: <신호>`. `RequiredLibraryCheck.via`는 transitive·excluded에만 넣고(경로 배열) direct·missing·unknown에는 넣지 않는다.
5. **Gradle.** `build.gradle(.kts)`마다 같은 디렉터리의 `gradle.properties`와 루트 `gradle.properties`, `gradle/libs.versions.toml`을 보조 입력으로; `appliedScripts`는 빌드 파일 디렉터리 기준으로 풀어 수집 파일에 있으면 같은 종류로 파싱해 의존성·속성을 합치고, 없으면 note `apply from not found: <경로>`; 루트 빌드 파일의 `inheritedDependencies`를 하위 모듈(`settings`의 `include`)에 합친다; `${v}`는 properties로 치환; `platforms` 중 위 BOM 이름이면 ②의 BOM; `project(":x")`는 그 모듈의 D를 합친다. **`unresolvedSignals`가 하나라도 있으면** 4종 중 `missing`·`excluded`를 `unknown`(evidence `unparsed: <첫 신호>`)으로 낮추고 note에 신호 전부를 남긴다(직접 선언으로 `direct`·`transitive`가 된 항목은 유지). egov 의존성이 하나도 안 풀리면 runtime `none`이고 4종 모두 `unknown`이다. 모듈 결과는 규칙 6대로(`unknown`만 있으면 `Unknown`).
6. **모듈 결과.** `Skipped`(aggregate) / `NotFound`(4종 중 excluded·missing) / `Unknown`(없고 unknown 있음) / `OK`.
7. **일관성 (가이드 "모두 동일").** Skipped가 아닌 모듈마다 **실행환경 의존성 각각**의 해석된 버전을 모은다: 의존성에 `<version>`이 있으면 치환한 값(`${…}`가 남으면 제외 + 규칙 3의 note), 없고 BOM 관리면 BOM 버전, 둘 다 없으면 제외. `toModuleKey`가 null인 아티팩트(`spring-modules-validation`, `egovframe-boot-starter-*`)는 세지 않는다. 결과: 서로 다른 값 2개 이상(같은 모듈 안이든 모듈 간이든) → `fail`·evidence 값 목록(`5.0.0, 5.0.2`); 1개이고 모든 값이 BOM에서 왔으면 `pass`·`managed by BOM <artifactId>:<version>`; 1개이고 그 밖이면 `pass`·evidence 그 버전 문자열; 0개 → `skipped`·`no resolvable version`. 규칙 3에서 세대 충돌로 표시된 모듈이 하나라도 있거나 모듈들의 세대 값이 둘 이상이면 버전과 무관하게 `fail`·`mixed generations`.
8. **프로젝트 결과.** 모듈 중 `NotFound`가 있거나 일관성 `fail` → `NotFound`; 모듈이 없거나 전부 `Skipped`이거나 `Unknown`이 있음 → `Unknown`; 그 밖 `OK`. 세대는 모듈 세대가 하나면 그것, 섞이면 `unknown`; 버전은 일관성 `pass`일 때 그 값.

- [ ] **Step 1: 실패하는 테스트 작성** — `buildFileCheck.spec.ts`는 `files: Record<string,string>`(절대 경로 키, `projectPath = "/p"`)로 `checkProjectBuild({ projectPath, files: Object.keys(files), readFile })`를 돌린다. `it` 목록(괄호 안은 기대):
  - 5.1 web형: parent `egovframe-web-config-parent:5.0.0`, 버전 없는 `egovframe-rte-ptl-mvc`·`egovframe-rte-psl-dataaccess`·`fdl-idgnr`·`fdl-property` (`runtime: { generation: "5.x", version: "5.0.0", source: "bom" }`, 4종 `direct, transitive via ["ptl-mvc","fdl-cmmn"], transitive via ["psl-dataaccess","fdl-logging"], direct`, `fdl-cmmn` evidence `via ptl-mvc > fdl-cmmn (static graph 5.0.x)`, `ptl-mvc` evidence `declared org.egovframe.rte:egovframe-rte-ptl-mvc`·`via` 없음, 일관성 `pass`·`managed by BOM egovframe-web-config-parent:5.0.0`, `result: "OK"`).
  - 4.3.1형: parent `spring-boot-starter-parent`, 속성 `org.egovframe.rte.version=4.3.0`, `org.egovframe.rte.ptl.mvc`·`psl.dataaccess` 등 (`4.x`, `4.3.0`, `property`, OK). 3.10형(`egovframework.rte.*`, `3.10.0`) → `3.x`.
  - 배치 5.x(`bat-core`, `psl-dataaccess`, `fdl-idgnr`, `fdl-property`): `ptl-mvc` `missing`·`not declared`, `fdl-cmmn` `transitive via ["bat-core","fdl-cmmn"]`, 모듈·프로젝트 `NotFound` (엄격 적용).
  - 주석 블록 안 4.x 선언이 있는 5.x pom: 세대 `5.x`, note 없음.
  - exclusion: 4.x pom에서 `ptl.mvc`에 `fdl.cmmn` exclusion만 선언 → `fdl-cmmn` `excluded`, `fdl-logging` `excluded`, `NotFound`.
  - msa Gradle: `ext { set('egovframeBootParentVersion', '5.0.0') }` + `mavenBom "org.egovframe.boot:egovframe-boot-starter-parent:${egovframeBootParentVersion}"` + `implementation("org.egovframe.rte:egovframe-rte-fdl-cmmn:${egovframeBootParentVersion}") { exclude … fdl-logging }` + `implementation 'org.egovframe.cloud:egovframe-cloud-module-common:1.0.0'` (`5.x`/`5.0.0`/`bom`, `fdl-cmmn direct`, 나머지 셋 `unknown`·`may be transitive via org.egovframe.cloud:egovframe-cloud-module-common`, 모듈 `Unknown`, 프로젝트 `Unknown`).
  - 멀티 모듈 Maven: 루트 `packaging pom` + `<modules>a,b` + `<dependencies>ptl-mvc`; `a/pom.xml`(parent → 루트, `psl-dataaccess` 추가) → `a` OK; `b/pom.xml`(parent만) → `psl-dataaccess missing` → NotFound; 루트 `Skipped`·`aggregate: true`; 프로젝트 `NotFound`; `moduleForFile("/p/a/src/main/java/X.java", summary, "/p")`는 `a/pom.xml`이고, 같은 요약에 대해 `moduleForFile("C:\\p\\a\\src\\main\\java\\X.java", summary, "C:\\p")`도 `a/pom.xml`(세그먼트 비교), `/p/other/X.java`는 `undefined`.
  - 내부 모듈 의존: `c/pom.xml`이 `<dependency>`로 `a`의 좌표를 선언 → `c`의 `psl-dataaccess` `direct`·evidence `via module a`.
  - 버전 혼재: `a` 속성 5.0.0, `b` 속성 5.0.2 → 일관성 `fail`·versions `["5.0.0","5.0.2"]`, 프로젝트 `NotFound`. 세대 혼재(`a` 4.x 좌표, `b` 5.x 좌표) → 프로젝트 세대 `unknown`, 일관성 `fail`·`mixed generations`.
  - dependencyManagement import BOM(`egovframe-boot-starter-parent:5.0.0`) + `${egovframe.rte.version}` 명시 의존성 → 버전 5.0.0 `bom`, 경고 없음.
  - 프로파일: activeByDefault 속성으로 버전이 풀리고, 비활성 프로파일 때문에 note `profiles ignored`.
  - 빌드 파일 없음 → `{ generation: "unknown", modules: [], result: "Unknown", versionConsistency: { state: "skipped" } }`.
  - `generationForFile`: 비집계 모듈 안 파일은 그 모듈 세대(모듈이 `unknown`이면 프로젝트 세대가 5.x여도 `unknown`), 어느 비집계 모듈에도 속하지 않는 파일(`/p/other/X.java`)은 프로젝트 세대.
  - Gradle kts + 카탈로그: `implementation(libs.egov.ptl.mvc)` + `libs.versions.toml`의 `egov-ptl-mvc = { module = "org.egovframe.rte:egovframe-rte-ptl-mvc", version.ref = "egov" }` → `ptl-mvc direct`, 버전 `dependency-version`.
  - `libs.bundles.egov`만 쓰는 build.gradle → runtime `none`, 4종 모두 `unknown`·`unparsed: bundle libs.bundles.egov`, 모듈 `Unknown`, 프로젝트 `Unknown`.
  - 직접 선언 + 번들: `implementation 'org.egovframe.rte:egovframe-rte-ptl-mvc:5.0.0'` + `implementation libs.bundles.egov` → `ptl-mvc direct`, `fdl-cmmn transitive`, `psl-dataaccess unknown`(`unparsed: bundle libs.bundles.egov`), 모듈 `Unknown`(NotFound 아님).
  - `apply from: 'gradle/dependencies.gradle'`로 egov 의존성을 선언한 모듈 → 그 스크립트가 수집돼 있으면 `direct`, 없으면 note `apply from not found: gradle/dependencies.gradle`.
  - 같은 모듈 안 버전 혼재: 한 pom에 `ptl-mvc:5.0.0`과 `psl-dataaccess:5.0.2`(직접 `<version>`) → 일관성 `fail`·versions `["5.0.0","5.0.2"]`, 프로젝트 `NotFound`; 버전 source는 `dependency-version`.
  - 단일 모듈 세대 혼재: 한 pom에 `org.egovframe.rte.ptl.mvc`(4.x)와 `egovframe-rte-psl-dataaccess`(5.x) → 모듈 세대 `unknown`, note `mixed generations`, 일관성 `fail`·`mixed generations`, 프로젝트 `NotFound`. 버전 major 불일치(`org.egovframe.rte.version=5.0.0` + 4.x 좌표)도 같은 결과.
  - 좌표 패턴만(속성·BOM·버전 없음): `org.egovframe.rte.ptl.mvc` 선언만 → `generation: "4.x"`, `version` 없음, source `artifact-pattern`, 그래프 4.3.x, 일관성 `skipped`·`no resolvable version`.
  - Maven 직접 `<version>` 경로: 속성·BOM 없이 `egovframe-rte-ptl-mvc` `<version>5.0.2</version>` → `5.x`/`5.0.2`/`dependency-version`, 그래프 5.0.x.
  - 멀티 모듈 Gradle: 루트 `settings.gradle` `include ':a', ':b'` + 루트 `build.gradle`의 `subprojects { dependencies { implementation 'org.egovframe.rte:egovframe-rte-ptl-mvc:5.0.0' } }` + `a/build.gradle`(psl-dataaccess 추가) → `a` OK, `b` `psl-dataaccess missing` NotFound.
  - `manualGeneration: "4.x"` + 5.1 web형 pom → 모든 모듈 `generation: "4.x"`, `source: "manual"`, evidence `manual (detected: bom 5.0.0)`, `version: "5.0.0"`은 유지되고 일관성은 `pass`(`managed by BOM …`), 그래프 4.3.x.

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/utils/__tests__/buildFileCheck.spec.ts` — Expected: FAIL

- [ ] **Step 3: 타입 추가와 `buildFileCheck.ts` 구현** — 규칙 1~8 순서대로. `buildFile`은 `path.relative(projectPath, file).split(path.sep).join("/")`.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/utils/__tests__/buildFileCheck.spec.ts && npm run check-types` — Expected: PASS

### Task 13: 2단계 계약·엔진 배선·CSV — `runtimeGeneration`, Project 결과, 보고 행

**Files:**
- Modify: `src/shared/archCheck.ts` (`ArchCheckResults.project?: ProjectCheckSummary` 추가 — 아래 `exportArchResults`·spec 헬퍼 수정과 같은 태스크에서), `src/shared/WebviewMessage.ts:167-171`, `src/shared/webviewMessageSchema.ts` (`startArchCheck`, `archCheckResultsSchema`, 새 `projectCheckSummarySchema`)
- Create: `src/shared/archCheckReport.ts`
- Modify: `src/utils/archChecker.ts` (`checkEgovArchitecture` 순서, `exportArchResults`), `src/core/controller/index.ts:736`
- Test: `src/shared/webviewMessageSchema.test.ts`, `src/shared/archCheckReport.spec.ts`, `src/utils/__tests__/archChecker.spec.ts`

**Interfaces:**
- Produces:

```ts
// archCheck.ts
export interface ArchCheckResults { Controller?: ArchCheckSummary; Service?: ArchCheckSummary; DAO?: ArchCheckSummary; project?: ProjectCheckSummary }
// WebviewMessage.ts
export interface StartArchCheckMessage { type: "startArchCheck"; projectPath: string; runtimeGeneration?: RuntimeGeneration }
// archCheckReport.ts (순수, 웹뷰와 호스트가 공유)
export interface ProjectReportRow { module: string; item: string; status: string; evidence: string }
export function projectReportRows(summary: ProjectCheckSummary): ProjectReportRow[]
```

행 규칙: 모듈마다 `{ module: buildFile, item: "runtime", status: "<version ?? 'unknown'> (<generation>)", evidence: runtime.evidence }` → 4종 각각 `{ module, item: name, status, evidence }`(Task 12가 정한 evidence 문자열 그대로; `via` 배열은 행에 쓰지 않는다) → `{ module, item: "result", status: result, evidence: (notes ?? []).join("; ") }`; 끝에 `{ module: "*", item: "version-consistency", status: pass→"PASS" | fail→"FAIL" | skipped→"n/a", evidence }`, `{ module: "*", item: "result", status: summary.result, evidence: "<generation> <version ?? ''>".trim() }`. aggregate 모듈은 runtime 행과 result 행만.

엔진 순서(2단계): `🔍 Checking project build files…` → `checkProjectBuild({ projectPath, files: await collectProjectFiles(projectPath, BUILD_FILE_PATTERNS, rgPath), readFile, manualGeneration: options.runtimeGeneration })` → `results.project` → DAO(`generationOf = (f) => options.runtimeGeneration ?? generationForFile(f, project, projectPath)`) → Controller → Service → completed (진행 문구 5개). `exportArchResults`는 `Controller`/`Service`/`DAO` 키만 `saveReport`하고, `results.project`가 있으면 `Result_Project_<date>.csv`(머리글 `Module,Item,Status,Evidence`, `projectReportRows` 각 셀에 `csvCell`)를 쓴다. Controller는 `checkEgovArchitecture(message.projectPath, progressCallback, { rgPath, runtimeGeneration: message.runtimeGeneration })`.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `webviewMessageSchema.test.ts`: `startArchCheck`에 `runtimeGeneration: "5.x"`가 보존되고 `"6.x"`는 거부; `exportArchResults.results.project`(모듈 1개, 4종, 일관성) 왕복 보존.
  - `archCheckReport.spec.ts`: 모듈 1개(5.x/5.0.0, ptl-mvc direct evidence `declared org.egovframe.rte:egovframe-rte-ptl-mvc`, fdl-cmmn transitive via [ptl-mvc, fdl-cmmn] evidence `via ptl-mvc > fdl-cmmn (static graph 5.0.x)`, fdl-logging unknown, psl-dataaccess missing `not declared`, result NotFound, notes ["profiles ignored"]) + aggregate 모듈 1개 → 정확한 행 배열(**길이 10** = 일반 모듈 6행 + 집계 2행 + 꼬리 2행), fdl-cmmn 행의 evidence가 위 문자열 그대로.
  - `archChecker.spec.ts`: 먼저 `fileNames`·`resultOf` 헬퍼의 `layer` 매개변수 타입을 `keyof ArchCheckResults`에서 `"Controller" | "Service" | "DAO"`로 좁힌다(`project` 키가 생기면 `results[layer]?.results`가 타입 오류); 수집 픽스처의 진행 문구 5개; 빌드 파일 없는 프로젝트 → `results.project.result === "Unknown"`, `modules: []`; 5.x web형 `pom.xml` + `UserMapper`(`@EgovMapper`, egov import) → `results.project` OK·`generation: "5.x"`, `UserMapper` `check3Detail: "5.x"`; `{ runtimeGeneration: "4.x" }`를 주면 pom과 무관하게 `project.modules[0].runtime.source === "manual"`이고 `UserMapper`는 `@EgovMapper in 4.x project`; CSV: `exportArchResults({ project: … }, dir)`가 `Result_Project_*.csv`를 쓰고 첫 줄이 `Module,Item,Status,Evidence`, 둘째 줄이 `pom.xml,runtime,5.0.0 (5.x),bom egovframe-web-config-parent:5.0.0 (assumed = rte version)`, 일관성 행이 `*,version-consistency,PASS,"managed by BOM egovframe-web-config-parent:5.0.0"`이 아니라 쉼표가 없으므로 인용 없이 `*,version-consistency,PASS,managed by BOM egovframe-web-config-parent:5.0.0`; evidence에 쉼표가 든 행(버전 혼재 `5.0.0, 5.0.2`)만 큰따옴표로 감싼다. `Result_Mapper_*`·`Result_project_*`(소문자) 파일은 없음.

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/shared src/utils/__tests__/archChecker.spec.ts` — Expected: FAIL

- [ ] **Step 3: 구현** — `ArchCheckResults.project` 추가, 타입·스키마(`projectCheckSummarySchema`: 모든 필드를 1:1로, enum은 `z.enum`), `archCheckReport.ts`, 엔진 순서, `exportArchResults`를 `Object.entries` 대신 `Controller`/`Service`/`DAO` 키 명시 순회 + `project` 분기로 다시 쓰기, Controller 한 줄. 웹뷰는 Task 7에서 이미 `FILE_LAYER_KEYS`만 순회하므로 `project` 키가 생겨도 `tsc -b`가 통과해야 한다.

- [ ] **Step 4: 통과 확인** — Run: `npm run test && npm run check-types && npm run lint && cd webview-ui && npx tsc -b` — Expected: PASS (웹뷰 타입 검사가 깨지면 Task 7의 `getCurrentResults`·카드 map 좁히기가 누락된 것)

- [ ] **Step 5: 커밋 (2단계 엔진)**

```bash
git add src/shared/archCheck.ts src/shared/WebviewMessage.ts src/shared/webviewMessageSchema.ts src/shared/webviewMessageSchema.test.ts src/shared/archCheckReport.ts src/shared/archCheckReport.spec.ts src/utils/runtimeModuleGraph.ts src/utils/mavenPom.ts src/utils/gradleBuild.ts src/utils/buildFileCheck.ts src/utils/archChecker.ts src/core/controller/index.ts src/utils/__tests__/fixtures/runtime-graph src/utils/__tests__/runtimeModuleGraph.spec.ts src/utils/__tests__/mavenPom.spec.ts src/utils/__tests__/gradleBuild.spec.ts src/utils/__tests__/buildFileCheck.spec.ts src/utils/__tests__/archChecker.spec.ts
git commit -m "feat: 아키텍처 점검에 빌드 파일 기반 실행환경 버전·필수 라이브러리 4종 점검(Project 항목) 추가"
```

### Task 14: 웹뷰 — Project 카드·상세 행·Runtime 드롭다운, 2단계 CHANGELOG

**Files:**
- Modify: `webview-ui/src/components/egov/tabs/checkArch/checkDisplay.ts` (`LAYER_LABELS.project = "Project"`, `SELECT_KEYS`, `getStatusColor`)
- Create: `webview-ui/src/components/egov/tabs/checkArch/ProjectSummaryCard.tsx`
- Modify: `webview-ui/src/components/egov/tabs/CheckArchView.tsx`, `CHANGELOG.md`
- Test: `checkDisplay.spec.ts`, `__tests__/CheckArchView.spec.tsx`

**Interfaces:**
- Consumes: Task 13 `projectReportRows`(`@shared/archCheckReport`), `ProjectCheckSummary`
- Produces:

```ts
export const SELECT_KEYS = ["Controller", "Service", "DAO", "project"] as const
export function getStatusColor(status: string): string   // OK|PASS|direct|transitive → ansiGreen, NotFound|FAIL|missing|excluded → errorForeground, 그 밖(Unknown|unknown|n/a|Skipped|info|warning…) → descriptionForeground
// ProjectSummaryCard.tsx
export interface ProjectSummaryCardProps { summary: ProjectCheckSummary }
export default function ProjectSummaryCard(props: ProjectSummaryCardProps): JSX.Element
```

카드 내용: 제목 `Project`, 줄 0 `Build: <비집계 모듈 buildTool 집합을 쉼표로, 예 maven>`, 줄 1 `Runtime: <generation> <version>` + 첫 비집계 모듈의 `runtime.evidence`, 줄 2 4종 칩(모듈들 중 가장 나쁜 상태: missing/excluded > unknown > transitive > direct; 칩 텍스트 `<name> <status>` + ✓/✗/?, transitive면 ` via <via[0]>`를 덧붙여 `fdl-cmmn transitive ✓ via ptl-mvc`), 줄 3 `Version consistency: PASS|FAIL|n/a — <evidence>`, 줄 4 `Result: <result>`(색은 `getStatusColor`), 줄 5 고정 문구 `Required-library rule is applied to every module (web MVC + MyBatis baseline). Transitive dependencies come from the static eGovFrame runtime graph; confirm with mvn dependency:tree or gradle dependencies.`, 모듈이 둘 이상이면 `Modules: <n> (see the Project rows below)`.

화면: Select 옵션은 `SELECT_KEYS.filter((k) => checkResults[k])`, `project`를 고르면 테이블 머리글 `Module / Item / Status / Evidence`(grid `1.5fr 1fr 1fr 2fr`)와 `projectReportRows(checkResults.project)` 행(Status 색 `getStatusColor`, Evidence는 `title`로도); 요약 영역 맨 위에 `ProjectSummaryCard`(`checkResults.project`가 있을 때); 경로 입력 줄의 Browse 옆에 `Select` `label="Runtime"` 옵션 `[{value:"auto",label:"Auto"},{value:"3.x",label:"3.x"},{value:"4.x",label:"4.x"},{value:"5.x",label:"5.x"}]`, 상태 `runtimeGeneration: "auto"|"3.x"|"4.x"|"5.x"`; `handleStartArchCheck`는 `auto`가 아닐 때만 `runtimeGeneration`을 메시지에 넣는다. `getTotalSummary`는 그대로 파일 레이어만. 안내 박스에 `Project:` 절을 추가한다 — 항목: `Runtime generation and version are read from pom.xml / build.gradle(.kts) (property > BOM parent or import > dependency version > artifact pattern)`, `Required libraries: ptl-mvc, fdl-cmmn, fdl-logging, psl-dataaccess — direct or transitive via the eGovFrame runtime module graph, applied to every module`, `Runtime library versions must be identical across all declarations and modules`.

- [ ] **Step 1: 실패하는 테스트 작성** — `checkDisplay.spec.ts`에 `getStatusColor` 세 갈래; `CheckArchView.spec.tsx`에 `describe("CheckArchView Project")`: Task 13의 모듈 1개 요약을 `archCheckResult`로 보내면 옵션 `Project`가 있고, 카드에 `5.x 5.0.0`·`OK`·고정 문구 앞부분(`Required-library rule is applied to every module`)이 보이며 Total Files는 파일 레이어만 센다; Select를 `project`로 바꾸면 `ptl-mvc`·`direct`·`fdl-cmmn`·`via ptl-mvc > fdl-cmmn (static graph 5.0.x)`·`version-consistency`가 보인다; 안내 박스에 `Required libraries: ptl-mvc, fdl-cmmn, fdl-logging, psl-dataaccess`로 시작하는 문구가 있다; `dispatch({ type: "selectedProjectPath", scope: "archCheck", text: "/p" })`로 경로를 넣고 Runtime을 `5.x`로 바꾼 뒤 Start를 누르면 `vscode.postMessage`가 `{ type: "startArchCheck", projectPath: "/p", runtimeGeneration: "5.x" }`로 불리고, `auto`면 `runtimeGeneration` 키가 없다(`expect.not.objectContaining`).

- [ ] **Step 2: 실패 확인** — Run: `cd webview-ui && npx vitest run src/components/egov/tabs` — Expected: FAIL

- [ ] **Step 3: 구현** — `ProjectSummaryCard.tsx`는 기존 카드와 같은 인라인 VS Code 스타일 변수(`--vscode-input-background`, `--vscode-input-border`)를 쓴다.

- [ ] **Step 4: 통과 확인** — Run: `cd webview-ui && npx vitest run && npx tsc -b && cd .. && npm run lint` — Expected: PASS

- [ ] **Step 5: 커밋 (2단계 웹뷰)**

```bash
git add webview-ui/src/components/egov/tabs/checkArch webview-ui/src/components/egov/tabs/CheckArchView.tsx webview-ui/src/components/egov/tabs/__tests__/CheckArchView.spec.tsx
git commit -m "feat: 아키텍처 점검 웹뷰에 Project 카드·상세 행과 Runtime 수동 지정 드롭다운 추가"
```

- [ ] **Step 6: CHANGELOG 항목 추가 후 커밋** — `- Architecture Check` 목록에 한 항목:

`  - 프로젝트 수준 점검 항목(Project) 추가. \`pom.xml\`·\`build.gradle\`·\`build.gradle.kts\`를 빌드 도구 실행 없이 읽어 실행환경 세대·버전(버전 속성 → BOM parent/import → 의존성 버전 → 좌표 패턴 순, 증거 표시)과 필수 라이브러리 4종(\`ptl-mvc\`·\`fdl-cmmn\`·\`fdl-logging\`·\`psl-dataaccess\`)의 적용 여부를 판정. 직접 선언뿐 아니라 실행환경 저장소의 모듈 의존 그래프(3.9.x~5.0.x)를 내장해 전이 의존(예: \`ptl-mvc\` → \`fdl-cmmn\` → \`fdl-logging\`)을 인정하고 exclusion은 Maven 의미론대로 하위 트리를 끊으며, 그래프 밖 표준프레임워크 아티팩트(cloud·boot-starter 등)를 선언한 모듈은 누락을 unknown으로 표시. 멀티 모듈(parent 체인·내부 모듈 의존·\`settings.gradle\` include)과 모듈 간 버전 일관성도 점검하며, 가이드의 4종 규칙을 모든 모듈에 엄격 적용하므로 배치·MSA 템플릿은 누락 라이브러리가 증거와 함께 NotFound로 표시됨. DAO / Mapper의 Version 칸이 이 세대와 비교되고(불일치는 실패), Runtime 드롭다운(Auto / 3.x / 4.x / 5.x)으로 세대를 수동 지정할 수 있음. 결과는 Project 카드와 상세 결과의 Project 항목(\`Module / Item / Status / Evidence\`), \`Result_Project_*.csv\`로 내보냄`

```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG Unreleased에 아키텍처 점검 Project 항목(실행환경 버전·필수 라이브러리) 추가"
```

---

# 3단계 — 데이터 접근 설정 정보 항목

### Task 15: `dataAccessConfigScan.ts`와 Project 정보 행

**Files:**
- Modify: `src/shared/archCheck.ts` (3단계 타입), `src/shared/webviewMessageSchema.ts`, `src/shared/archCheckReport.ts`
- Create: `src/utils/dataAccessConfigScan.ts`
- Modify: `src/utils/archChecker.ts` (DAO 뒤에 호출), `webview-ui/src/components/egov/tabs/checkArch/ProjectSummaryCard.tsx` (건수 한 줄), `CHANGELOG.md`
- Test: `src/utils/__tests__/dataAccessConfigScan.spec.ts`, `src/shared/archCheckReport.spec.ts`, `src/utils/__tests__/archChecker.spec.ts`, `webviewMessageSchema.test.ts`

**Interfaces:**
- Consumes: Task 2 `stripJavaComments`·`hasToken`, Task 10 `stripXmlComments`, Task 5 `collectProjectFiles`
- Produces (`src/shared/archCheck.ts`에 추가):

```ts
export type DataAccessConfigKind = "sqlMapClientFactoryBean" | "sqlSessionFactoryBean" | "mapperConfigurer" | "mapperScan" | "mybatisStarter" | "mapperLocations"
export interface DataAccessConfigFinding { kind: DataAccessConfigKind; filePath: string; fileName: string; evidence: string }
export interface DataAccessConfigInfo { findings: DataAccessConfigFinding[]; warnings: string[] }
export interface UnclassifiedDataAccessFile { filePath: string; fileName: string; evidence: string }
export interface ProjectCheckSummary { …기존; dataAccessConfig?: DataAccessConfigInfo; unclassifiedDataAccessFiles?: UnclassifiedDataAccessFile[] }
```

```ts
// dataAccessConfigScan.ts
export interface DataAccessScanInput {
	projectPath: string
	configFiles: string[]        // *.xml, *.yml, *.yaml, *.properties 중 경로에 /src/main/resources/ 또는 /src/main/webapp/WEB-INF/ 가 있는 것 (구분자 무관)
	javaFiles: string[]          // 수집된 .java 전체(src/test·src/it 제외 집합). 설정 finding은 이 중 경로에 /src/main/java/ 가 있는 파일만 보고, 미분류 탐색은 전체를 본다
	buildFiles: Array<{ filePath: string; text: string }>   // pom.xml / build.gradle(.kts) (finding의 filePath·fileName에 쓴다)
	readFile: ReadFile
	generation: RuntimeGeneration | "unknown"; version?: string
	hasMapperInterfaces: boolean; hasIbatisDaos: boolean   // DAO 결과에서: daoStyle mapperInterface / ibatisDao 가 하나라도 있는지
}
export function scanDataAccessConfig(input: DataAccessScanInput): DataAccessConfigInfo
export function findUnclassifiedDataAccessFiles(javaFiles: string[], daoFilePaths: ReadonlySet<string>, readFile: ReadFile): UnclassifiedDataAccessFile[]
```

수집 항목(evidence 형식): XML은 `stripXmlComments` 후 속성 단위 매칭 — `class="…SqlMapClientFactoryBean"` → kind `sqlMapClientFactoryBean`, evidence 접두어 패키지(`org.springframework.orm.ibatis` | `egovframework.rte.psl.orm.ibatis` | `org.egovframe.rte.psl.orm.ibatis`); `class="org.mybatis.spring.SqlSessionFactoryBean"` → `sqlSessionFactoryBean`, evidence `org.mybatis.spring.SqlSessionFactoryBean`; `class="…psl.dataaccess.mapper.MapperConfigurer"` → `mapperConfigurer`, evidence `basePackage=<같은 bean 안 <property name="basePackage" value="…">의 값 또는 ?>`. Java는 `stripJavaComments` 후 토큰 — `SqlSessionFactoryBean` → `sqlSessionFactoryBean`(evidence `java`), `SqlMapClientFactoryBean` → `sqlMapClientFactoryBean`(evidence는 import 패키지), `MapperConfigurer`/`MapperScannerConfigurer` → `mapperConfigurer`(evidence 토큰 이름), `@MapperScan`/`@MapperScans` → `mapperScan`(evidence `basePackages,annotationClass,sqlSessionFactoryRef` 중 어노테이션 괄호 안에 있는 속성 이름을 쉼표로). yml/yaml/properties는 `mybatis.mapper-locations`(yml은 `mybatis:` 아래 `mapper-locations:`) → `mapperLocations`(evidence 값). `buildFiles[].text`에 `mybatis-spring-boot-starter` → `mybatisStarter`(filePath·fileName은 그 빌드 파일, evidence `mybatis-spring-boot-starter`). 같은 파일·같은 kind는 한 번만.

경고(정확한 문자열, 순서대로 조건이 맞을 때만):
1. `Mapper interfaces exist but no MapperConfigurer, @MapperScan or mybatis-spring-boot-starter was found` — `hasMapperInterfaces`이고 `mapperConfigurer`·`mapperScan`·`mybatisStarter`가 모두 없음
2. `iBatis DAOs exist but no SqlMapClientFactoryBean was found` — `hasIbatisDaos`이고 `sqlMapClientFactoryBean` 없음
3. `SqlMapClientFactoryBean is taken from org.springframework.orm.ibatis; eGovFrame 3.5+ provides its own` — 그 접두어의 finding이 있고 (세대 4.x·5.x, 또는 3.x이면서 version이 `3.5` 이상)
4. `Only mybatis-spring-boot-starter is configured; eGovFrame @Mapper/@EgovMapper interfaces are not auto-scanned without MapperConfigurer or @MapperScan` — `mybatisStarter` 있고 `mapperConfigurer`·`mapperScan` 없고 `hasMapperInterfaces`
5. `@MapperScan without annotationClass registers every interface under basePackages` — `mapperScan` finding 중 evidence에 `annotationClass`가 없는 것이 있음

미분류 파일: `javaFiles` 중 `daoFilePaths`에 없고 파일 이름이 `DAO.java`/`Dao.java`/`Mapper.java`로 끝나지 않는 파일에서 `stripJavaComments` 후 `/\b(SqlSessionTemplate|SqlMapClient|JdbcTemplate|NamedParameterJdbcTemplate|EntityManager)\b/`가 맞으면 `{ filePath, fileName, evidence: <첫 매칭 토큰> }`.

보고 행(`projectReportRows`에서 모듈 행들 뒤, `*` version-consistency 행 앞에 삽입): finding마다 `{ module: "*", item: "data-access-config", status: kind, evidence: "<fileName>: <evidence>" }`, 경고마다 `{ module: "*", item: "data-access-config", status: "warning", evidence }`, 미분류마다 `{ module: "*", item: "unclassified", status: "info", evidence: "<projectPath 기준 상대 경로>: <evidence>" }`. 판정(`result`)에는 아무 영향이 없다.

엔진: DAO 점검 뒤 `🔍 Scanning data access configuration…`(진행 문구 6개) → `configFiles = collectProjectFiles(projectPath, ["*.xml","*.yml","*.yaml","*.properties"], rgPath)`를 경로로 거르고, `buildFiles`는 Project 점검 때 모은 파일 중 이름이 `pom.xml`/`build.gradle`/`build.gradle.kts`인 것을 `readFile`로 읽어 넘기며, `javaFiles`는 수집한 `.java` 전체, `daoFilePaths`는 DAO 레이어 수집 집합(judged+skipped)으로 `scanDataAccessConfig`·`findUnclassifiedDataAccessFiles` 결과를 `results.project`에 넣는다(`project`가 없으면 만들지 않는다 — 2단계에서 항상 만들어지므로 그대로 채운다). 카드에는 `Data access config: <findings> findings, <warnings> warnings, <unclassified> unclassified files` 한 줄.

- [ ] **Step 1: 실패하는 테스트 작성** — `dataAccessConfigScan.spec.ts`(in-memory): XML 컨텍스트(`<bean` 과 `class=`가 다른 줄, 주석 안 `SqlMapClientFactoryBean`은 무시, MapperConfigurer의 basePackage), Java `@MapperScan(basePackages = "x")`(evidence `basePackages`, 경고 5), `@Bean SqlSessionFactoryBean`, `application.yml`의 `mybatis:\n  mapper-locations: classpath:/mappers/*.xml`, pom 본문의 `mybatis-spring-boot-starter`; 경고 1~4 각각 조건 성립/불성립 한 쌍; `findUnclassifiedDataAccessFiles`가 `SampleRepository.java`(JdbcTemplate)를 잡고 `SampleController.java`(토큰 없음)와 `SampleDAO.java`(DAO 집합)는 빼는지. `archCheckReport.spec.ts`에 세 종류 행 추가 단정. `archChecker.spec.ts`: 진행 문구 6개, `results.project.dataAccessConfig.findings`에 픽스처 XML의 finding이 있음. `webviewMessageSchema.test.ts`: `dataAccessConfig`·`unclassifiedDataAccessFiles` 왕복 보존.

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/utils/__tests__/dataAccessConfigScan.spec.ts src/shared` — Expected: FAIL

- [ ] **Step 3: 구현** — 타입·스키마·보고 행·스캐너·엔진 호출·카드 한 줄.

- [ ] **Step 4: 통과 확인** — Run: `npm run test && npm run check-types && npm run lint && cd webview-ui && npx vitest run && npx tsc -b` — Expected: PASS

- [ ] **Step 5: 커밋 (3단계)**

```bash
git add src/shared/archCheck.ts src/shared/webviewMessageSchema.ts src/shared/webviewMessageSchema.test.ts src/shared/archCheckReport.ts src/shared/archCheckReport.spec.ts src/utils/dataAccessConfigScan.ts src/utils/__tests__/dataAccessConfigScan.spec.ts src/utils/archChecker.ts src/utils/__tests__/archChecker.spec.ts webview-ui/src/components/egov/tabs/checkArch/ProjectSummaryCard.tsx
git commit -m "feat: 아키텍처 점검 Project 항목에 데이터 접근 설정 정보와 미분류 데이터 접근 파일 목록 추가"
```

- [ ] **Step 6: CHANGELOG 항목 추가 후 커밋** — `- Architecture Check` 목록에 한 항목:

`  - Project 항목에 스프링 데이터 접근 설정 정보 추가(판정에는 영향 없음). \`src/main/resources\`·\`src/main/java\`·\`src/main/webapp/WEB-INF\`에서 \`SqlMapClientFactoryBean\`(패키지 접두어 표시)·\`SqlSessionFactoryBean\`·\`MapperConfigurer\`·\`@MapperScan\`(속성 유무)·\`mybatis-spring-boot-starter\`·\`mybatis.mapper-locations\`의 존재를 모아 보이고, Mapper 인터페이스가 있는데 스캔 설정이 없거나 iBatis DAO가 있는데 \`SqlMapClientFactoryBean\`이 없는 경우 등 다섯 가지 교차 경고를 정보로 표시. 수집 글롭 밖에서 \`JdbcTemplate\`·\`EntityManager\`·\`SqlSessionTemplate\` 등을 직접 쓰는 파일을 "미분류 데이터 접근 파일"로 함께 표시`

```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG Unreleased에 아키텍처 점검 데이터 접근 설정 정보 항목 추가"
```

---

# 마무리

### Task 16: 문서 동기화

**Files:**
- Modify: `docs/DEVELOPER.md` (215행 `## 빌드 시스템` 앞에 새 절 `## 아키텍처 점검 엔진`)
- Modify (로컬, 미커밋): `CLAUDE.md`의 `archChecker.ts` 항목
- Modify (저장소 밖, 미커밋): `/Users/psw/Downloads/egovframe-architecture-check-docs/architecture-check.md`의 DAO/Mapper·Project 절

- [ ] **Step 1: `docs/DEVELOPER.md`에 절 추가** — 내용: 모듈 구성 표(`javaSource` → `javaIndex` → `daoCheck`, `mavenPom`·`gradleBuild`·`runtimeModuleGraph` → `buildFileCheck`, `dataAccessConfigScan`, `archChecker`는 수집·순서·CSV), 결과 계약 동기화 체크리스트(`src/shared/archCheck.ts` → `webviewMessageSchema.ts`(strip 주의) → `archChecker.ts`·CSV → `CheckArchView.tsx` + spec → 테스트 → CHANGELOG), 수집 규칙(숨김·빌드 산출물·`src/test`·`src/it` 제외, `--no-ignore`), 세대별 그래프 상수의 출처(`src/utils/__tests__/fixtures/runtime-graph/`, egovframe-runtime 브랜치 pom에서 추출)와 갱신 방법(픽스처 교체 → 테스트가 상수 불일치를 잡음). 기존 ripgrep 항목(226행)은 그대로 둔다.

- [ ] **Step 2: `CLAUDE.md`·Downloads 문서 갱신** — `CLAUDE.md`의 archChecker 설명을 새 모듈 구성에 맞게 고친다(커밋하지 않는다: gitignore 대상). `architecture-check.md`에는 DAO / Mapper 판정 표(Base/Bean/Version, 제외 규칙), Project 항목(세대·버전 우선순위, 4종 엄격 적용, 전이 그래프, 일관성), 설정 정보 항목을 스펙 5.4·5.8·5.9 요약으로 적는다. 같은 폴더의 도식 05(판정 흐름)는 archify 스킬로 다시 그려야 하므로 이 계획의 범위 밖 후속으로 두고, 문서에 "도식 갱신 예정"을 남긴다.

- [ ] **Step 3: 커밋**

```bash
git add docs/DEVELOPER.md docs/superpowers/plans/2026-10-28-arch-check-dao-mapper.md
git commit -m "docs: 아키텍처 점검 엔진 모듈 구성·계약 동기화 규칙과 DAO/Mapper 재설계 구현 계획서 추가"
```

### Task 17: 인수 검증 (공식 템플릿 6종, 스펙 8.1)

**Files:**
- Create: `src/utils/__tests__/acceptance.spec.ts` — `describe.skipIf(!process.env.EGOV_ACCEPTANCE_DIR)`로 감싸 평소 `npm run test`에서는 건너뛴다

- [ ] **Step 1: 스펙 작성** — 머리에 `const bundledRg = resolveRipgrepPath({ extensionPath: path.resolve(__dirname, "../../..") })`(archChecker.spec.ts:15과 같은 식; 그 상수는 export되지 않는다)를 두고, `EGOV_ACCEPTANCE_DIR` 아래 하위 디렉터리 이름이 템플릿 이름(`egovframe-web`, `egovframe-boot-web`, `egovframe-template-common-components`, `egovframe-boot-simple-backend`, `egovframe-boot-batch-db-web`)인 것과 `egovframe-msa-portal-backend/msa-board-service`(ZIP 최상위에 서비스 9개가 놓여 있으므로 이 서비스 디렉터리를 명시적으로 가리킨다)를 각각 `checkEgovArchitecture(dir, undefined, { rgPath: bundledRg ?? undefined })`로 돌리고 8.1 표를 단정한다: `egovframe-web`·`egovframe-boot-web`: `SampleMapper.java` OK(`check2Detail: "egov"`, `check3Detail: "5.x"`), `EgovConfigMapper.java`는 boot-web의 skipped `configuration`, project OK; `common-components`: DAO 판정 수 152·OK 151·NotFound 1(`SmsBasicDAO.java`), skipped 3(`EgovComAbstractDAO` abstract, `OrgManageLdapDAO` base-class, `ObjectMapper` not-data-access), project OK, Controller에 `ObjectMapper` 때문에 실패하는 파일 없음; `boot-simple-backend`: DAO 12개 OK, `EgovConfigAppMapper` skipped, 일관성 pass; `boot-batch-db-web`: DAO 결과 0·skipped 3(RowMapper/LineMapper/@Configuration), project `NotFound`이고 `ptl-mvc` `missing`; `msa-portal-backend/msa-board-service`: project `Unknown`, `fdl-cmmn direct`, `fdl-logging unknown`(evidence `may be transitive via org.egovframe.cloud:egovframe-cloud-module-common`). 각 프로젝트의 결과 요약을 `console.info`로 출력한다(`vi.spyOn(console, "log")`만 막는다).

- [ ] **Step 2: 템플릿 풀기와 실행** — Run:

```bash
A=/private/tmp/claude-501/-Users-psw-github-egovframe-egovframe-vscode-initializr/7857af5c-43bf-4527-9b16-9d7eca871d57/scratchpad/acceptance; rm -rf "$A"; mkdir -p "$A"; for t in egovframe-web egovframe-boot-web egovframe-template-common-components egovframe-boot-simple-backend egovframe-boot-batch-db-web egovframe-msa-portal-backend; do mkdir -p "$A/$t" && unzip -q "templates/projects/examples/$t.zip" -d "$A/$t"; done; EGOV_ACCEPTANCE_DIR="$A" npx vitest run src/utils/__tests__/acceptance.spec.ts
```

Expected: PASS. (ZIP이 약 130바이트면 LFS 포인터이므로 `git lfs pull --include="templates/projects/examples/*.zip"` 먼저. 다섯 ZIP은 `pom.xml`이 최상위에 있고 `egovframe-msa-portal-backend`는 서비스 디렉터리 9개가 최상위에 놓여 있으므로 래퍼 디렉터리 처리는 필요 없다.) 8.1 표와 다른 결과가 나오면 **표를 고치지 말고** 엔진 또는 스펙의 사실 오류를 찾아 해당 태스크의 테스트부터 고친다.

- [ ] **Step 3: Extension Development Host 수동 확인** — `npm run watch` + `npm run dev:webview` 후 F5, CheckArch 탭에서 `egovframe-boot-web`을 점검: Project 카드 → `5.x 5.0.0`·OK, Select에 `DAO / Mapper`·`Project`, DAO 행의 `Mapper IF`·`egov`·`5.x`, Skipped 토글, Runtime을 `4.x`로 바꾸면 `SampleMapper`가 `✗`(`@EgovMapper in 4.x project`), Export로 `Result_DAO_*.csv`·`Result_Project_*.csv`가 생기고 `Result_Mapper_*`는 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/utils/__tests__/acceptance.spec.ts
git commit -m "test: 아키텍처 점검 공식 템플릿 6종 인수 검증 스펙 추가(EGOV_ACCEPTANCE_DIR 설정 시 실행)"
```

### 완료 기준

- `npm run test`, `npm run check-types`, `npm run lint`, `cd webview-ui && npx vitest run && npx tsc -b`, `npm run build:webview`가 모두 통과한다.
- 커밋은 1단계 3개(엔진·웹뷰·CHANGELOG), 2단계 3개, 3단계 2개, 문서 1개, 인수 스펙 1개 순서로 쌓여 있고 trailer가 없다.
- PR 본문은 `git-convention`(변경 이유 → 변경 내용 → 검증 방법)으로 쓰고 `🤖 Generated with` 표기는 넣지 않는다. 스펙 문서는 커밋되지 않으므로 PR 본문에 스펙의 핵심 결정(레이어 통합, 3체크, 엄격 적용, 세대 불일치 실패, 설정 정보 전용)을 요약한다.
