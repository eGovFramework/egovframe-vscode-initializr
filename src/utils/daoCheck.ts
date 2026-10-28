/**
 * 아키텍처 점검의 DAO / Mapper 통합 레이어 판정.
 * 수집한 `*DAO.java`·`*Dao.java`·`*Mapper.java`를 내용으로 분류해(iBatis DAO / MyBatis DAO / Mapper 인터페이스, 또는 점검 제외)
 * check1 Base·check2 Bean·check3 Version을 판정한다. 어노테이션·기반 클래스의 출처는 Java 이름 해석 순서로 정한다.
 * 파일 시스템은 주입된 `readFile`로만 읽는 순수 모듈이며 `vscode`를 import하지 않는다.
 */
import * as path from "path"
import type { ArchCheckResult, CheckState, DaoStyle, RuntimeGeneration, SkippedFile, SkippedReason } from "../shared/archCheck"
import { resolveTypeReference, type JavaIndex, type ReadFile } from "./javaIndex"
import {
	collectImports,
	findTypeDeclaration,
	hasToken,
	packageOf,
	readPackage,
	simpleNameOf,
	stripJavaComments,
	type JavaImports,
	type JavaTypeDeclaration,
} from "./javaSource"

/** 표준프레임워크 3.x 데이터 접근 패키지 (Mapper 어노테이션은 `.mapper`) */
export const EGOV3_BASE_PACKAGE = "egovframework.rte.psl.dataaccess"
/** 표준프레임워크 4.x·5.x 데이터 접근 패키지 (Mapper 어노테이션은 `.mapper`) */
export const EGOV4_BASE_PACKAGE = "org.egovframe.rte.psl.dataaccess"
export const MYBATIS_ANNOTATION_PACKAGE = "org.apache.ibatis.annotations"
export const MAPSTRUCT_PACKAGE = "org.mapstruct"

export type OriginKind = "egov3" | "egov4" | "mybatis" | "mapstruct" | "project" | "unresolved" | "other"

export interface OriginResolution {
	kind: OriginKind
	package: string | null
	evidence: string
}

/** 이름을 적은 파일의 package·imports (이름 해석의 출발점) */
export interface SourceContext {
	package: string | null
	imports: JavaImports
}

export type EgovSimpleName = "Mapper" | "EgovMapper" | "EgovAbstractDAO" | "EgovAbstractMapper"

type Generation = RuntimeGeneration | "unknown"

/** 와일드카드 import 해석용 제공 표: 단순 이름 → 그 이름을 제공하는 패키지와 세대 */
const PROVIDERS: Record<EgovSimpleName, Array<{ package: string; generations: RuntimeGeneration[] }>> = {
	Mapper: [
		{ package: `${EGOV3_BASE_PACKAGE}.mapper`, generations: ["3.x"] },
		{ package: `${EGOV4_BASE_PACKAGE}.mapper`, generations: ["4.x"] },
		{ package: MYBATIS_ANNOTATION_PACKAGE, generations: ["3.x", "4.x", "5.x"] },
		{ package: MAPSTRUCT_PACKAGE, generations: ["3.x", "4.x", "5.x"] },
	],
	EgovMapper: [{ package: `${EGOV4_BASE_PACKAGE}.mapper`, generations: ["5.x"] }],
	EgovAbstractDAO: [
		{ package: EGOV3_BASE_PACKAGE, generations: ["3.x"] },
		{ package: EGOV4_BASE_PACKAGE, generations: ["4.x", "5.x"] },
	],
	EgovAbstractMapper: [
		{ package: EGOV3_BASE_PACKAGE, generations: ["3.x"] },
		{ package: EGOV4_BASE_PACKAGE, generations: ["4.x", "5.x"] },
	],
}

function fqcnOf(pkg: string | null, simpleName: string): string {
	return pkg ? `${pkg}.${simpleName}` : simpleName
}

/** 패키지 → 출처 종류 */
function originKindOf(pkg: string): OriginKind {
	if (pkg === EGOV3_BASE_PACKAGE || pkg === `${EGOV3_BASE_PACKAGE}.mapper`) {
		return "egov3"
	}
	if (pkg === EGOV4_BASE_PACKAGE || pkg === `${EGOV4_BASE_PACKAGE}.mapper`) {
		return "egov4"
	}
	if (pkg === MYBATIS_ANNOTATION_PACKAGE) {
		return "mybatis"
	}
	if (pkg === MAPSTRUCT_PACKAGE) {
		return "mapstruct"
	}
	return "other"
}

/**
 * 단순 이름 `name`(사용처 원문 `rawName`)이 어느 패키지의 것인지 Java 이름 해석 순서로 정한다 (스펙 5.5).
 * ① 원문이 FQCN이면 그 패키지 ② 단일 import ③ 같은 패키지의 로컬 복사본(색인) → project
 * ④ 제공 표에 있는 와일드카드 import가 정확히 하나면 그것(세대로 거른다, 둘 이상이면 모호) ⑤ 그 외 unresolved.
 * ①②④로 정해진 패키지라도 프로젝트 색인에 그 FQCN이 있으면 실행환경 클래스를 복사해 둔 것이므로 project다.
 */
export function resolveOrigin(
	name: EgovSimpleName,
	rawName: string,
	source: SourceContext,
	index: JavaIndex,
	generation: Generation,
): OriginResolution {
	const decide = (pkg: string, evidence: string): OriginResolution => {
		const fqcn = fqcnOf(pkg, name)
		if (index.byFqcn.has(fqcn)) {
			return { kind: "project", package: pkg, evidence: `import ${fqcn} (local copy)` }
		}
		return { kind: originKindOf(pkg), package: pkg, evidence }
	}

	const written = rawName.trim()
	const writtenPackage = written.includes(".") ? packageOf(written) : null
	if (writtenPackage !== null) {
		return decide(writtenPackage, `fqcn ${written}`)
	}

	const importedPackage = source.imports.single.get(name)
	if (importedPackage !== undefined) {
		return decide(importedPackage, `import ${fqcnOf(importedPackage, name)}`)
	}

	if (index.byFqcn.has(fqcnOf(source.package, name))) {
		return {
			kind: "project",
			package: source.package,
			evidence: `same package ${source.package ?? "(default)"} (local copy)`,
		}
	}

	const providers = PROVIDERS[name].filter((row) => generation === "unknown" || row.generations.includes(generation))
	const wildcardMatches = source.imports.wildcard.filter((pkg) => providers.some((row) => row.package === pkg))
	if (wildcardMatches.length === 1) {
		return decide(wildcardMatches[0], `import ${wildcardMatches[0]}.*`)
	}
	if (wildcardMatches.length > 1) {
		return { kind: "unresolved", package: null, evidence: "ambiguous wildcard" }
	}
	return { kind: "unresolved", package: null, evidence: "no import" }
}

/** 판정에 쓰는 파일 한 개의 전처리 결과 */
export interface DaoFileAnalysis {
	filePath: string
	fileName: string
	parentPath: string
	/** 파일 이름에서 `.java`를 뗀 타입 이름 (NFC) */
	typeName: string
	/** 주석을 지운 소스 */
	stripped: string
	package: string | null
	imports: JavaImports
	/** 파일 이름과 같은 타입의 선언부. 없으면 null */
	declaration: JavaTypeDeclaration | null
}

/** 파일을 읽어 주석 제거·package·imports·선언부를 한 번에 만든다 */
export function analyzeJavaFile(filePath: string, readFile: ReadFile): DaoFileAnalysis {
	const stripped = stripJavaComments(readFile(filePath))
	// 파일 시스템(macOS)이 돌려주는 NFD 파일 이름을 소스 텍스트와 맞추려고 NFC로 정규화한다 (javaIndex와 같은 규칙)
	const typeName = path.basename(filePath, ".java").normalize("NFC")
	return {
		filePath,
		fileName: path.basename(filePath),
		parentPath: path.dirname(filePath),
		typeName,
		stripped,
		package: readPackage(stripped),
		imports: collectImports(stripped),
		declaration: findTypeDeclaration(stripped, typeName),
	}
}

export interface InheritanceChain {
	/** 경유 중간 클래스 단순 이름 (직접 상속이면 []) */
	path: string[]
	terminal: "EgovAbstractDAO" | "EgovAbstractMapper" | null
	/** extends에 적힌 원문 (FQCN 가능) */
	terminalRaw: string | null
	/** 종점을 적은 파일의 package·imports */
	terminalSource: SourceContext | null
	/** 프로젝트에서 못 찾은 부모 (있으면 체인이 거기서 끊김) */
	unresolvedParent: string | null
	/** 직접 부모가 프로젝트 파일이면 그 경로 (S6용) */
	firstParentFile: string | null
}

type EgovBaseName = "EgovAbstractDAO" | "EgovAbstractMapper"

function egovBaseNameOf(typeName: string): EgovBaseName | null {
	const simpleName = simpleNameOf(typeName)
	return simpleName === "EgovAbstractDAO" || simpleName === "EgovAbstractMapper" ? simpleName : null
}

/**
 * extends 체인을 `EgovAbstractDAO`/`EgovAbstractMapper`(종점)까지 따라간다.
 * 종점은 프로젝트 밖(jar)이므로 단순 이름으로만 알아보고, 그 밖의 부모는 프로젝트 색인에서 찾아 그 파일의 extends를 다시 읽는다.
 * 같은 파일을 두 번 만나면(순환) 종점 없이 끝내고, 중간 클래스가 `maxDepth`개를 넘으면 마지막 부모를 `unresolvedParent`에 둔다.
 */
export function traceInheritance(
	analysis: DaoFileAnalysis,
	index: JavaIndex,
	analyze: (filePath: string) => DaoFileAnalysis,
	maxDepth = 5,
): InheritanceChain {
	const chain: InheritanceChain = {
		path: [],
		terminal: null,
		terminalRaw: null,
		terminalSource: null,
		unresolvedParent: null,
		firstParentFile: null,
	}
	const visited = new Set<string>([analysis.filePath])
	let current = analysis
	for (let depth = 0; ; depth++) {
		const parentName = current.declaration?.extendsNames[0]
		if (!parentName) {
			return chain
		}
		const terminal = egovBaseNameOf(parentName)
		if (terminal) {
			return {
				...chain,
				terminal,
				terminalRaw: parentName,
				terminalSource: { package: current.package, imports: current.imports },
			}
		}
		if (depth >= maxDepth) {
			return { ...chain, unresolvedParent: parentName }
		}
		const resolved = resolveTypeReference(index, current, parentName)
		if (resolved.kind === "unresolved") {
			return { ...chain, unresolvedParent: parentName }
		}
		if (visited.has(resolved.entry.filePath)) {
			return chain
		}
		visited.add(resolved.entry.filePath)
		if (depth === 0) {
			chain.firstParentFile = resolved.entry.filePath
		}
		chain.path.push(resolved.entry.simpleName)
		current = analyze(resolved.entry.filePath)
	}
}

export type DaoClassification =
	| { kind: "skipped"; reason: SkippedReason; detail?: string }
	| {
			kind: "judged"
			style: DaoStyle | null
			chain: InheritanceChain | null
			mapperAnnotation: { name: "Mapper" | "EgovMapper"; raw: string } | null
	  }

type JudgedClassification = Extract<DaoClassification, { kind: "judged" }>

/** Spring Data 저장소 인터페이스 (S4) */
const SPRING_DATA_REPOSITORY = /^(Jpa|Crud|PagingAndSorting|ListCrud|ListPagingAndSorting|R2dbc|Mongo|Reactive\w*)Repository$/

/** 어노테이션 원문에서 `@`를 떼고 괄호 앞까지의 이름: `@a.b.EgovMapper("m")` → `a.b.EgovMapper` */
function annotationRawName(annotation: string): string {
	return /^@\s*([\w$.]+)/.exec(annotation)?.[1] ?? ""
}

/** 어노테이션의 단순 이름: `@org.springframework.stereotype.Repository("x")` → `Repository` */
function annotationSimpleName(annotation: string): string {
	return simpleNameOf(annotationRawName(annotation))
}

function hasAnnotation(declaration: JavaTypeDeclaration, simpleNames: string[]): boolean {
	return declaration.annotations.some((annotation) => simpleNames.includes(annotationSimpleName(annotation)))
}

/**
 * 판정 대상인지와 구현 방식을 정한다. 순서: S7(타입 선언 없음·enum/record/@interface) → S1(abstract) → S2(@Configuration)
 * → interface면 S4(Spring Data) → S5(MapStruct @Mapper) → Mapper 인터페이스, class면 상속 체인 추적 → S3(비데이터 접근 *Mapper) → DAO 클래스.
 * S6(다른 수집 파일의 부모인 기반 클래스)은 파일 하나로 정할 수 없어 `checkDaoLayer`가 2패스로 처리한다.
 */
export function classifyDaoFile(
	analysis: DaoFileAnalysis,
	index: JavaIndex,
	analyze: (filePath: string) => DaoFileAnalysis,
	generation: Generation,
): DaoClassification {
	const declaration = analysis.declaration
	if (!declaration || declaration.kind === "enum" || declaration.kind === "record" || declaration.kind === "annotation") {
		return { kind: "skipped", reason: "not-a-class" }
	}
	if (declaration.isAbstract) {
		return { kind: "skipped", reason: "abstract" }
	}
	if (hasToken(analysis.stripped, "@Configuration")) {
		return { kind: "skipped", reason: "configuration" }
	}

	if (declaration.kind === "interface") {
		const springData = declaration.extendsNames.map(simpleNameOf).find((name) => SPRING_DATA_REPOSITORY.test(name))
		if (springData) {
			return { kind: "skipped", reason: "spring-data", detail: springData }
		}
		let mapperAnnotation: JudgedClassification["mapperAnnotation"] = null
		for (const annotation of declaration.annotations) {
			const name = annotationSimpleName(annotation)
			if (name === "Mapper" || name === "EgovMapper") {
				mapperAnnotation = { name, raw: annotation }
				break
			}
		}
		if (
			mapperAnnotation?.name === "Mapper" &&
			resolveOrigin("Mapper", annotationRawName(mapperAnnotation.raw), analysis, index, generation).kind === "mapstruct"
		) {
			return { kind: "skipped", reason: "mapstruct" }
		}
		return { kind: "judged", style: "mapperInterface", chain: null, mapperAnnotation }
	}

	const chain = traceInheritance(analysis, index, analyze)
	if (
		analysis.fileName.endsWith("Mapper.java") &&
		chain.terminal === null &&
		!hasAnnotation(declaration, ["Repository", "Component", "Service"])
	) {
		return { kind: "skipped", reason: "not-data-access", detail: "no egov base and no stereotype" }
	}
	const style: DaoStyle | null =
		chain.terminal === "EgovAbstractDAO" ? "ibatisDao" : chain.terminal === "EgovAbstractMapper" ? "mybatisDao" : null
	return { kind: "judged", style, chain, mapperAnnotation: null }
}

const NOT_APPLICABLE = { state: "skipped" as CheckState, detail: "n/a" }

/** 기반 클래스·어노테이션 패키지가 세대 기대(3.x → egov3, 4.x·5.x → egov4)와 맞는지 */
function checkGenerationPackage(origin: OriginKind, generation: RuntimeGeneration): { state: CheckState; detail: string } {
	const expected: OriginKind = generation === "3.x" ? "egov3" : "egov4"
	if (origin === expected) {
		return { state: "pass", detail: generation }
	}
	return {
		state: "fail",
		detail:
			origin === "egov3" ? `egovframework.rte (3.x) in ${generation} project` : "org.egovframe.rte (4.x+) in 3.x project",
	}
}

function isEgovOrigin(kind: OriginKind): boolean {
	return kind === "egov3" || kind === "egov4"
}

/**
 * 판정 대상 한 파일의 세 칸을 채운다 (스펙 5.4·5.6). 판정식은 `OK ⇔ check1 ∧ check2 ∧ check3State ≠ "fail"`이다.
 * 클래스 방식: check1 = 체인 종점, check2 = 자기 선언의 @Repository ∧ 종점이 프로젝트 복사본이 아님, check3 = 종점 파일에서 읽은 기반 패키지.
 * 인터페이스 방식: check1 = @Mapper/@EgovMapper, check2 = 어노테이션 출처가 표준프레임워크, check3 = 어노테이션 이름과 패키지.
 */
export function evaluateDaoFile(
	analysis: DaoFileAnalysis,
	judged: JudgedClassification,
	index: JavaIndex,
	generation: Generation,
): ArchCheckResult {
	let check1: boolean
	let check1Detail: string
	let check2: boolean
	let check2Detail: string
	let check3 = NOT_APPLICABLE
	const extra: Pick<ArchCheckResult, "inheritancePath" | "annotationText"> = {}

	if (judged.chain) {
		const chain = judged.chain
		extra.inheritancePath = chain.path
		check1 = chain.terminal !== null
		if (chain.terminal) {
			check1Detail = chain.terminal === "EgovAbstractDAO" ? "iBatis DAO" : "MyBatis DAO"
		} else {
			check1Detail = chain.unresolvedParent ? `parent ${chain.unresolvedParent} not found` : "no egov base"
		}
		const origin =
			chain.terminal && chain.terminalSource
				? resolveOrigin(chain.terminal, chain.terminalRaw ?? chain.terminal, chain.terminalSource, index, generation)
				: null
		const hasRepository = analysis.declaration !== null && hasAnnotation(analysis.declaration, ["Repository"])
		if (!hasRepository) {
			check2 = false
			check2Detail = "no @Repository"
		} else if (origin?.kind === "project") {
			check2 = false
			check2Detail = `${chain.terminal} copied into project`
		} else {
			check2 = true
			check2Detail = "@Repository"
		}
		if (generation !== "unknown" && check1 && origin && isEgovOrigin(origin.kind)) {
			check3 = checkGenerationPackage(origin.kind, generation)
		}
	} else {
		const annotation = judged.mapperAnnotation
		check1 = annotation !== null
		check1Detail = annotation ? "Mapper IF" : "no @Mapper/@EgovMapper"
		if (annotation) {
			extra.annotationText = annotation.raw
		}
		const origin = annotation
			? resolveOrigin(annotation.name, annotationRawName(annotation.raw), analysis, index, generation)
			: null
		check2 = origin !== null && isEgovOrigin(origin.kind)
		if (!origin) {
			check2Detail = "no @Mapper/@EgovMapper"
		} else if (check2) {
			check2Detail = "egov"
		} else if (origin.kind === "mybatis") {
			check2Detail = "mybatis @Mapper"
		} else if (origin.kind === "unresolved") {
			check2Detail = "unresolved import"
		} else {
			check2Detail = "custom annotation"
		}
		if (generation !== "unknown" && annotation && origin && check2) {
			const expectedName = generation === "5.x" ? "EgovMapper" : "Mapper"
			if (annotation.name !== expectedName) {
				check3 = {
					state: "fail",
					detail:
						annotation.name === "EgovMapper"
							? `@EgovMapper in ${generation} project`
							: "@Mapper → 5.x requires @EgovMapper",
				}
			} else {
				check3 = checkGenerationPackage(origin.kind, generation)
			}
		}
	}

	const check3Passed = check3.state !== "fail"
	return {
		filePath: analysis.filePath,
		fileName: analysis.fileName,
		parentPath: analysis.parentPath,
		check1,
		check2,
		check3: check3Passed,
		result: check1 && check2 && check3Passed ? "OK" : "NotFound",
		type: "DAO",
		daoStyle: judged.style ?? undefined,
		check1Detail,
		check2Detail,
		check3State: check3.state,
		check3Detail: check3.detail,
		...extra,
	}
}

export interface DaoLayerOutcome {
	results: ArchCheckResult[]
	skipped: SkippedFile[]
	/** 판정 대상(제외 목록 제외) 파일의 타입 이름 — Controller "DAO X" 입력 (스펙 5.7) */
	judgedTypeNames: Set<string>
}

/**
 * DAO / Mapper 레이어를 점검한다. 파일 분석은 경로별로 한 번만 한다(체인 추적이 같은 부모를 거듭 읽지 않도록).
 * 분류 뒤 S6 2패스: 수집 파일 전체의 직접 부모(`extends` 첫 이름을 색인에서 푼 파일)를 세어,
 * @Repository 없는 판정 대상 클래스가 다른 수집 파일의 직접 부모면 `base-class`로 제외한다. 결과 순서는 입력 순서다.
 */
export function checkDaoLayer(
	filePaths: string[],
	index: JavaIndex,
	readFile: ReadFile,
	generationOf: (filePath: string) => Generation,
): DaoLayerOutcome {
	const analyses = new Map<string, DaoFileAnalysis>()
	const analyze = (filePath: string): DaoFileAnalysis => {
		let analysis = analyses.get(filePath)
		if (!analysis) {
			analysis = analyzeJavaFile(filePath, readFile)
			analyses.set(filePath, analysis)
		}
		return analysis
	}

	const entries = filePaths.map((filePath) => {
		const analysis = analyze(filePath)
		return { analysis, classification: classifyDaoFile(analysis, index, analyze, generationOf(filePath)) }
	})

	const childCounts = new Map<string, number>()
	for (const { analysis } of entries) {
		const parentName = analysis.declaration?.extendsNames[0]
		if (!parentName || egovBaseNameOf(parentName)) {
			continue
		}
		const resolved = resolveTypeReference(index, analysis, parentName)
		if (resolved.kind === "resolved" && resolved.entry.filePath !== analysis.filePath) {
			childCounts.set(resolved.entry.filePath, (childCounts.get(resolved.entry.filePath) ?? 0) + 1)
		}
	}

	const outcome: DaoLayerOutcome = { results: [], skipped: [], judgedTypeNames: new Set() }
	for (const { analysis, classification } of entries) {
		const { filePath, fileName } = analysis
		if (classification.kind === "skipped") {
			const { reason, detail } = classification
			outcome.skipped.push(detail === undefined ? { filePath, fileName, reason } : { filePath, fileName, reason, detail })
			continue
		}
		const childCount = childCounts.get(filePath) ?? 0
		const isBaseClass =
			classification.chain !== null &&
			childCount > 0 &&
			analysis.declaration !== null &&
			!hasAnnotation(analysis.declaration, ["Repository"])
		if (isBaseClass) {
			outcome.skipped.push({ filePath, fileName, reason: "base-class", detail: `base of ${childCount} classes` })
			continue
		}
		outcome.results.push(evaluateDaoFile(analysis, classification, index, generationOf(filePath)))
		outcome.judgedTypeNames.add(analysis.typeName)
	}
	return outcome
}
