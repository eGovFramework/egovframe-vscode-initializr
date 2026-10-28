/**
 * 프로젝트 빌드 점검 — pom.xml / build.gradle(.kts)를 텍스트로 읽어 모듈마다 실행환경 세대·버전, 필수 라이브러리 4종,
 * 그리고 프로젝트 전체의 버전 일관성을 판정한다 (설계 5.8절, 필수 4종은 집계 pom을 뺀 모든 모듈에 엄격 적용).
 *
 * 순수 모듈이다: 파일은 주입된 readFile로만 읽고 존재 여부는 files 목록으로만 판단한다. `vscode`를 import하지 않는다.
 * 흐름: 수집(모듈 행) → 빌드 도구별 모듈 모델(Maven parent 체인 / Gradle 보조 입력) → 세대·버전 → 4종 → 일관성 → 종합.
 */
import * as path from "path"
import type {
	BuildModuleCheck,
	ProjectCheckSummary,
	RequiredLibraryCheck,
	RuntimeGeneration,
	RuntimeSource,
} from "../shared/archCheck"
import {
	parseGradleBuild,
	parseGradleProperties,
	parseGradleSettings,
	parseVersionCatalog,
	resolveCatalogReference,
} from "./gradleBuild"
import type { GradleBuildModel, VersionCatalog } from "./gradleBuild"
import type { ReadFile } from "./javaIndex"
import { parseMavenPom, resolvePlaceholders } from "./mavenPom"
import type { MavenCoordinate, MavenPomModel } from "./mavenPom"
import {
	REQUIRED_LIBRARIES,
	RUNTIME_MODULE_GRAPH,
	generationOfArtifactId,
	reachRequiredLibrary,
	selectGraphBranch,
	toModuleKey,
} from "./runtimeModuleGraph"
import type { DirectDependency, ModuleGraph, RuntimeGraphBranch } from "./runtimeModuleGraph"

/** *.gradle(.kts)는 build·settings·apply-from 스크립트를 모두 모은다; 모듈 행은 이름이 pom.xml·build.gradle(.kts)인 것만 */
export const BUILD_FILE_PATTERNS = ["pom.xml", "*.gradle", "*.gradle.kts", "gradle.properties", "libs.versions.toml"]

export interface BuildFileCheckInput {
	projectPath: string
	/** BUILD_FILE_PATTERNS로 모은 절대 경로 */
	files: string[]
	readFile: ReadFile
	manualGeneration?: RuntimeGeneration
}

const MODULE_FILES: Record<string, BuildModuleCheck["buildTool"]> = {
	"pom.xml": "maven",
	"build.gradle": "gradle",
	"build.gradle.kts": "gradle-kts",
}
const RUNTIME_VERSION_PROPERTIES = ["egovframe.rte.version", "org.egovframe.rte.version", "egovframework.rte.version"]
const EGOV_BOM_ARTIFACTS = new Set([
	"egovframe-web-config-parent",
	"egovframe-boot-starter-parent",
	"org.egovframe.boot.starter.parent",
])
const RUNTIME_GROUPS = new Set(["org.egovframe.rte", "egovframework.rte"])
const MAVEN_SCOPES = new Set(["compile", "runtime", "provided"])
const MAX_DEPTH = 5
const UNION_BRANCHES: RuntimeGraphBranch[] = ["3.10.x", "4.3.x", "5.0.x"]

/** 세대를 모를 때 쓰는 3.10.x·4.3.x·5.0.x 그래프의 합집합 */
const UNION_GRAPH: ModuleGraph = (() => {
	const graph: ModuleGraph = {}
	for (const branch of UNION_BRANCHES) {
		for (const [key, edges] of Object.entries(RUNTIME_MODULE_GRAPH[branch])) {
			const list = (graph[key] ??= [])
			for (const edge of edges) {
				if (!list.includes(edge)) {
					list.push(edge)
				}
			}
		}
	}
	return graph
})()

/** 모듈이 실제로 쓰는 의존성 1개 (scope 필터·치환 후) */
interface CollectedDependency {
	groupId: string
	artifactId: string
	/** 해석된 버전 (`${`가 남지 않을 때만) */
	version?: string
	/** explicit: 선언 버전, managed: dependencyManagement 버전, bom: egov BOM 관리, none: 버전 없음·미해석 */
	versionOrigin: "explicit" | "managed" | "bom" | "none"
	/** 모듈 키 또는 "*" */
	exclusions: string[]
}

interface ModuleRef {
	key: string
	label: string
	exclusions: string[]
}

interface ModuleModel {
	file: string
	buildFile: string
	buildTool: BuildModuleCheck["buildTool"]
	aggregate: boolean
	unreadable: boolean
	/** 내부 모듈 의존을 찾는 키 ("maven:g:a" / "gradle::a") */
	refKey?: string
	/** 규칙 3 ①: 선언된 실행환경 버전 속성 (치환 후) */
	runtimeProperty?: { name: string; value: string }
	bom?: { artifactId: string; version: string }
	dependencies: CollectedDependency[]
	moduleRefs: ModuleRef[]
	notes: string[]
	signals: string[]
}

interface Context {
	root: string
	has(file: string): boolean
	read(file: string): string | undefined
	poms: Map<string, MavenPomModel | undefined>
	gradles: Map<string, LoadedGradle | undefined>
}

interface LoadedGradle {
	model: GradleBuildModel
}

export function generationOfVersion(version: string): RuntimeGeneration | "unknown" {
	const major = /^\s*(\d+)(?:\.|$)/.exec(version)?.[1]
	return major === "3" ? "3.x" : major === "4" ? "4.x" : major === "5" ? "5.x" : "unknown"
}

function addNote(notes: string[], note: string): void {
	if (!notes.includes(note)) {
		notes.push(note)
	}
}

function unique<T>(values: T[]): T[] {
	return Array.from(new Set(values))
}

function coordinateText(groupId: string, artifactId: string, version?: string): string {
	return version ? `${groupId}:${artifactId}:${version}` : `${groupId}:${artifactId}`
}

function isEgovBom(coordinate: MavenCoordinate | undefined): coordinate is MavenCoordinate {
	return coordinate !== undefined && EGOV_BOM_ARTIFACTS.has(coordinate.artifactId)
}

/** 그래프 밖 표준프레임워크 아티팩트 (선언하면 missing·excluded를 unknown으로 낮춘다) */
function isOutsideArtifact(groupId: string, artifactId: string): boolean {
	return (
		groupId === "org.egovframe.cloud" ||
		groupId === "egovframework.com.ems" ||
		(groupId === "org.egovframe.boot" && artifactId.startsWith("egovframe-boot-starter-"))
	)
}

/** exclusion 좌표 → 모듈 키 또는 "*" (실행환경과 무관하면 null) */
function exclusionKey(groupId: string | undefined, artifactId: string | undefined): string | null {
	if (artifactId !== undefined && artifactId !== "*") {
		return toModuleKey(artifactId)
	}
	return groupId !== undefined && (groupId === "*" || RUNTIME_GROUPS.has(groupId)) ? "*" : null
}

/** 버전 치환: undefined = 선언 없음, null = `${…}`가 남음(notes가 있으면 `unresolved:` note) */
function resolveVersion(
	raw: string | undefined,
	properties: Record<string, string>,
	notes?: string[],
): string | null | undefined {
	if (raw === undefined) {
		return undefined
	}
	const resolved = resolvePlaceholders(raw, properties).trim()
	if (resolved.includes("${")) {
		if (notes) {
			addNote(notes, `unresolved: ${resolved}`)
		}
		return null
	}
	return resolved || undefined
}

function findRuntimeProperty(
	declared: Record<string, string>,
	properties: Record<string, string>,
): ModuleModel["runtimeProperty"] | undefined {
	for (const name of RUNTIME_VERSION_PROPERTIES) {
		if (Object.prototype.hasOwnProperty.call(declared, name)) {
			const value = resolveVersion(declared[name], properties)
			if (value) {
				return { name, value }
			}
		}
	}
	return undefined
}

// ───────────────────────── 수집 ─────────────────────────

function createContext(input: BuildFileCheckInput): Context {
	const originals = new Map(input.files.map((file) => [path.resolve(file), file]))
	return {
		root: path.resolve(input.projectPath),
		has: (file) => originals.has(path.resolve(file)),
		read: (file) => {
			const original = originals.get(path.resolve(file))
			if (original === undefined) {
				return undefined
			}
			try {
				const text = input.readFile(original)
				return typeof text === "string" ? text : undefined
			} catch {
				return undefined
			}
		},
		poms: new Map(),
		gradles: new Map(),
	}
}

function relativeBuildFile(root: string, file: string): string {
	return path.relative(root, file).split(path.sep).join("/")
}

/** 모듈 행이 될 빌드 파일 (디렉터리 순, 같은 디렉터리는 파일 이름 순) */
function moduleFiles(input: BuildFileCheckInput, root: string): string[] {
	return unique(input.files.map((file) => path.resolve(file)))
		.filter((file) => MODULE_FILES[path.basename(file)] !== undefined)
		.sort((a, b) => {
			const dirA = relativeBuildFile(root, path.dirname(a))
			const dirB = relativeBuildFile(root, path.dirname(b))
			return dirA === dirB ? path.basename(a).localeCompare(path.basename(b)) : dirA < dirB ? -1 : 1
		})
}

// ───────────────────────── Maven 모듈 모델 ─────────────────────────

function loadPom(ctx: Context, file: string): MavenPomModel | undefined {
	if (!ctx.poms.has(file)) {
		const text = ctx.read(file)
		ctx.poms.set(file, text === undefined ? undefined : parseMavenPom(text))
	}
	return ctx.poms.get(file)
}

/** 프로젝트 안 parent pom 경로 (`relativePath` ""면 찾지 않음, 기본 ../pom.xml, 디렉터리면 그 아래 pom.xml) */
function internalParentFile(ctx: Context, file: string, parent: NonNullable<MavenPomModel["parent"]>): string | undefined {
	if (parent.relativePath === "") {
		return undefined
	}
	const target = path.resolve(path.dirname(file), parent.relativePath ?? "../pom.xml")
	if (path.basename(target) === "pom.xml" && ctx.has(target)) {
		return target
	}
	const nested = path.join(target, "pom.xml")
	return ctx.has(nested) ? nested : undefined
}

/** 자기 pom + 프로젝트 안 parent 체인(최대 5단)과, 체인 끝의 외부 parent */
function mavenChain(
	ctx: Context,
	file: string,
	own: MavenPomModel,
): { chain: MavenPomModel[]; externalParent?: MavenCoordinate } {
	const chain = [own]
	const visited = new Set([file])
	let current = own
	let currentFile = file
	for (let depth = 0; current.parent; depth++) {
		const parent = current.parent
		const parentFile = depth < MAX_DEPTH ? internalParentFile(ctx, currentFile, parent) : undefined
		const model = parentFile && !visited.has(parentFile) ? loadPom(ctx, parentFile) : undefined
		const matches =
			model !== undefined &&
			(!parent.artifactId || model.artifactId === parent.artifactId) &&
			(!parent.groupId || !model.groupId || model.groupId === parent.groupId)
		if (!parentFile || !model || !matches) {
			return depth < MAX_DEPTH ? { chain, externalParent: parent } : { chain }
		}
		chain.push(model)
		visited.add(parentFile)
		current = model
		currentFile = parentFile
	}
	return { chain }
}

function buildMavenModule(
	ctx: Context,
	file: string,
	base: Omit<ModuleModel, "buildTool" | "aggregate" | "unreadable">,
): ModuleModel {
	const own = loadPom(ctx, file)
	if (!own) {
		return { ...base, buildTool: "maven", aggregate: false, unreadable: true }
	}
	const notes = base.notes
	const { chain, externalParent } = mavenChain(ctx, file, own)
	const declared: Record<string, string> = {}
	for (const model of [...chain].reverse()) {
		Object.assign(declared, model.properties)
	}
	// 내장 속성: project.version·project.groupId는 모델 값(없으면 parent 것으로 보충됨), revision은 선언됐을 때만
	const builtins: Record<string, string> = {}
	if (own.version) {
		builtins["project.version"] = own.version
	}
	if (own.groupId) {
		builtins["project.groupId"] = own.groupId
	}
	if (own.parent?.version) {
		builtins["project.parent.version"] = own.parent.version
	}
	if (Object.prototype.hasOwnProperty.call(declared, "revision")) {
		builtins.revision = declared.revision
	}
	const baseProperties = { ...builtins, ...declared }

	let bom: ModuleModel["bom"]
	const bomCoordinate = [externalParent, ...chain.flatMap((model) => model.importedBoms)].find(isEgovBom)
	if (bomCoordinate) {
		const version = resolveVersion(bomCoordinate.version, baseProperties, notes)
		if (version) {
			bom = { artifactId: bomCoordinate.artifactId, version }
		}
	}
	// bomDerived는 치환에만 쓴다 (규칙 3 ①의 "선언된 속성"에는 넣지 않는다)
	const properties = { ...(bom ? { "egovframe.rte.version": bom.version } : {}), ...baseProperties }
	const resolve = (value: string) => resolvePlaceholders(value, properties)

	const managed = chain.flatMap((model) => model.managedDependencies)
	const dependencies: CollectedDependency[] = []
	const seen = new Set<string>()
	for (const declaredDependency of chain.flatMap((model) => model.dependencies)) {
		if (!MAVEN_SCOPES.has(declaredDependency.scope) || declaredDependency.optional) {
			continue
		}
		const groupId = resolve(declaredDependency.groupId)
		const artifactId = resolve(declaredDependency.artifactId)
		if (seen.has(`${groupId}:${artifactId}`)) {
			continue
		}
		seen.add(`${groupId}:${artifactId}`)
		const report = toModuleKey(artifactId) !== null ? notes : undefined
		const collected: CollectedDependency = {
			groupId,
			artifactId,
			versionOrigin: "none",
			exclusions: declaredDependency.exclusions
				.map((exclusion) => exclusionKey(exclusion.groupId, exclusion.artifactId))
				.filter((key): key is string => key !== null),
		}
		const explicit = resolveVersion(declaredDependency.version, properties, report)
		if (explicit) {
			collected.version = explicit
			collected.versionOrigin = "explicit"
		} else if (explicit === undefined) {
			const entry = managed.find((m) => resolve(m.groupId) === groupId && resolve(m.artifactId) === artifactId)
			const managedVersion = entry ? resolveVersion(entry.version, properties, report) : undefined
			if (managedVersion) {
				collected.version = managedVersion
				collected.versionOrigin = "managed"
			} else if (managedVersion === undefined && bom) {
				collected.version = bom.version
				collected.versionOrigin = "bom"
			}
		}
		dependencies.push(collected)
	}

	const aggregate = own.packaging === "pom" && own.modules.length > 0
	if (aggregate) {
		notes.unshift("aggregate pom")
	}
	if (own.profilesIgnored) {
		addNote(notes, "profiles ignored")
	}
	return {
		...base,
		buildTool: "maven",
		aggregate,
		unreadable: false,
		refKey: own.artifactId ? `maven:${resolve(own.groupId ?? "")}:${resolve(own.artifactId)}` : undefined,
		runtimeProperty: findRuntimeProperty(declared, properties),
		bom,
		dependencies,
	}
}

/** Maven 의존성 중 프로젝트 안 다른 모듈 좌표를 가리키는 것을 내부 모듈 의존으로 잇는다 */
function linkMavenModules(models: ModuleModel[], byRef: Map<string, ModuleModel>): void {
	for (const model of models) {
		if (model.buildTool !== "maven") {
			continue
		}
		for (const dependency of model.dependencies) {
			const key = `maven:${dependency.groupId}:${dependency.artifactId}`
			if (key !== model.refKey && byRef.has(key)) {
				model.moduleRefs.push({ key, label: dependency.artifactId, exclusions: dependency.exclusions })
			}
		}
	}
}

// ───────────────────────── Gradle 모듈 모델 ─────────────────────────

function gradleKind(file: string): "gradle" | "gradle-kts" {
	return file.endsWith(".kts") ? "gradle-kts" : "gradle"
}

/** `apply from:` 경로를 빌드 파일 디렉터리 기준으로 푼다 (URL이면 undefined) */
function resolveScriptPath(script: string, dir: string, root: string): string | undefined {
	if (script.includes("://")) {
		return undefined
	}
	const expanded = script.replace(/\$\{?rootDir\}?/g, root).replace(/\$\{?projectDir\}?/g, dir)
	return path.resolve(dir, expanded)
}

/**
 * build.gradle(.kts)를 파싱하고 `apply from:` 스크립트(수집된 것만, 최대 5단)의 의존성·속성을 합친다.
 * 읽지 못한 스크립트는 해석 불가 신호 `apply from not found: <경로>`로 남긴다 (규칙 5대로 missing·excluded → unknown).
 */
function loadGradle(ctx: Context, file: string, depth = 0, visited = new Set<string>()): LoadedGradle | undefined {
	if (depth === 0 && ctx.gradles.has(file)) {
		return ctx.gradles.get(file)
	}
	const text = ctx.read(file)
	let loaded: LoadedGradle | undefined
	if (text !== undefined) {
		const model = parseGradleBuild(text, gradleKind(file))
		visited.add(file)
		for (const script of model.appliedScripts) {
			const target = resolveScriptPath(script, path.dirname(file), ctx.root)
			const sub =
				target && ctx.has(target) && !visited.has(target) && depth < MAX_DEPTH
					? loadGradle(ctx, target, depth + 1, visited)
					: undefined
			if (!sub) {
				addNote(model.unresolvedSignals, `apply from not found: ${script}`)
				continue
			}
			model.dependencies.push(...sub.model.dependencies)
			model.inheritedDependencies.push(...sub.model.inheritedDependencies)
			model.platforms.push(...sub.model.platforms)
			model.projectDependencies.push(...sub.model.projectDependencies)
			model.properties = { ...sub.model.properties, ...model.properties }
			for (const signal of sub.model.unresolvedSignals) {
				addNote(model.unresolvedSignals, signal)
			}
		}
		loaded = { model }
	}
	if (depth === 0) {
		ctx.gradles.set(file, loaded)
	}
	return loaded
}

function readProperties(ctx: Context, file: string): Record<string, string> {
	const text = ctx.read(file)
	return text === undefined ? {} : parseGradleProperties(text)
}

function gradlePathOf(root: string, dir: string): string {
	const relative = relativeBuildFile(root, dir)
	return relative === "" ? ":" : ":" + relative.split("/").join(":")
}

/** 같은 디렉터리의 settings.gradle(.kts)에 include가 하나라도 있으면 집계 빌드 */
function hasSettingsInclude(ctx: Context, dir: string): boolean {
	return ["settings.gradle", "settings.gradle.kts"].some((name) => {
		const text = ctx.read(path.join(dir, name))
		return text !== undefined && parseGradleSettings(text).includes.length > 0
	})
}

function buildGradleModule(
	ctx: Context,
	file: string,
	base: Omit<ModuleModel, "buildTool" | "aggregate" | "unreadable">,
): ModuleModel {
	const buildTool = gradleKind(file)
	const loaded = loadGradle(ctx, file)
	if (!loaded) {
		return { ...base, buildTool, aggregate: false, unreadable: true }
	}
	const { model } = loaded
	const notes = base.notes
	const dir = path.dirname(file)
	const rootFile = ["build.gradle", "build.gradle.kts"].map((name) => path.join(ctx.root, name)).find((f) => ctx.has(f))
	const root = rootFile && dir !== ctx.root ? loadGradle(ctx, rootFile)?.model : undefined

	const catalogText = ctx.read(path.join(ctx.root, "gradle", "libs.versions.toml"))
	const catalog: VersionCatalog | undefined = catalogText === undefined ? undefined : parseVersionCatalog(catalogText)
	// 우선순위: 자기 ext → 같은 디렉터리 gradle.properties → 루트 gradle.properties → 루트 ext → 카탈로그 [versions]
	const declared: Record<string, string> = {
		...(catalog?.versions ?? {}),
		...(root?.properties ?? {}),
		...readProperties(ctx, path.join(ctx.root, "gradle.properties")),
		...readProperties(ctx, path.join(dir, "gradle.properties")),
		...model.properties,
	}

	const signals = [...model.unresolvedSignals]
	// 루트 빌드 파일의 신호(예: subprojects {} 안의 번들)는 하위 모듈에도 적용한다
	for (const signal of root?.unresolvedSignals ?? []) {
		addNote(signals, signal)
	}
	let bom: ModuleModel["bom"]
	const platforms = model.platforms.length > 0 ? model.platforms : (root?.platforms ?? [])
	const bomCoordinate = platforms.find(isEgovBom)
	if (bomCoordinate) {
		const version = resolveVersion(bomCoordinate.version, declared, notes)
		if (version) {
			bom = { artifactId: bomCoordinate.artifactId, version }
		}
	}
	const properties = { ...(bom ? { "egovframe.rte.version": bom.version } : {}), ...declared }

	const dependencies: CollectedDependency[] = []
	for (const declaredDependency of [...model.dependencies, ...(root?.inheritedDependencies ?? [])]) {
		let { group: groupId, name: artifactId, version: rawVersion } = declaredDependency
		if (!groupId && artifactId.startsWith("libs.")) {
			const reference = catalog ? resolveCatalogReference(artifactId, catalog) : null
			if (!reference) {
				if (/egov/i.test(artifactId)) {
					addNote(signals, `unresolved catalog reference ${artifactId}`)
				}
				continue
			}
			groupId = reference.groupId
			artifactId = reference.artifactId
			rawVersion = reference.version
		}
		const collected: CollectedDependency = {
			groupId,
			artifactId,
			versionOrigin: "none",
			exclusions: declaredDependency.exclusions
				.map((exclusion) => exclusionKey(exclusion.group, exclusion.module))
				.filter((key): key is string => key !== null),
		}
		const version = resolveVersion(rawVersion, properties, toModuleKey(artifactId) !== null ? notes : undefined)
		if (version) {
			collected.version = version
			collected.versionOrigin = "explicit"
		} else if (version === undefined && bom) {
			collected.version = bom.version
			collected.versionOrigin = "bom"
		}
		dependencies.push(collected)
	}

	const aggregate = hasSettingsInclude(ctx, dir)
	if (aggregate) {
		notes.unshift("aggregate build (settings include)")
	}
	return {
		...base,
		buildTool,
		aggregate,
		unreadable: false,
		refKey: `gradle:${gradlePathOf(ctx.root, dir)}`,
		runtimeProperty: findRuntimeProperty(declared, properties),
		bom,
		dependencies,
		moduleRefs: unique(model.projectDependencies).map((ref) => ({ key: `gradle:${ref}`, label: ref, exclusions: [] })),
		signals,
	}
}

// ───────────────────────── 직접 선언 D ─────────────────────────

interface Declarations {
	direct: DirectDependency[]
	/** 그래프 밖 표준프레임워크 아티팩트 "g:a" */
	outside: string[]
	/** 내부 모듈 의존으로 들어온 실행환경 의존성 (세대 패턴 판정용) */
	viaRuntime: CollectedDependency[]
}

function collectDeclarations(
	model: ModuleModel,
	byRef: Map<string, ModuleModel>,
	depth: number,
	visited: Set<string>,
): Declarations {
	const declarations: Declarations = { direct: [], outside: [], viaRuntime: [] }
	for (const dependency of model.dependencies) {
		const key = toModuleKey(dependency.artifactId)
		if (key) {
			const evidence = `declared ${coordinateText(dependency.groupId, dependency.artifactId, dependency.versionOrigin === "bom" ? undefined : dependency.version)}`
			declarations.direct.push({ key, exclusions: dependency.exclusions, evidence })
		} else if (isOutsideArtifact(dependency.groupId, dependency.artifactId)) {
			declarations.outside.push(`${dependency.groupId}:${dependency.artifactId}`)
		}
	}
	if (depth >= MAX_DEPTH) {
		return declarations
	}
	for (const ref of model.moduleRefs) {
		const target = byRef.get(ref.key)
		if (!target || visited.has(target.file)) {
			continue
		}
		visited.add(target.file)
		const sub = collectDeclarations(target, byRef, depth + 1, visited)
		if (!ref.exclusions.includes("*")) {
			for (const direct of sub.direct.filter((d) => !ref.exclusions.includes(d.key))) {
				declarations.direct.push({
					key: direct.key,
					exclusions: [...direct.exclusions, ...ref.exclusions],
					evidence: `via module ${ref.label}`,
				})
			}
		}
		declarations.outside.push(...sub.outside)
		declarations.viaRuntime.push(...target.dependencies.filter((d) => toModuleKey(d.artifactId) !== null), ...sub.viaRuntime)
	}
	return declarations
}

// ───────────────────────── 세대·버전 판정 ─────────────────────────

interface RuntimeJudgement {
	runtime: BuildModuleCheck["runtime"]
	/** 세대 충돌 모듈 (규칙 7이 일관성 fail을 낸다) */
	conflict: boolean
}

function judgeRuntime(model: ModuleModel, viaRuntime: CollectedDependency[], notes: string[]): RuntimeJudgement {
	const own = model.dependencies.filter((d) => toModuleKey(d.artifactId) !== null)
	let version: string | undefined
	let source: RuntimeSource
	let evidence: string
	const versioned = own.find((d) => d.versionOrigin === "explicit" || d.versionOrigin === "managed")
	const patternDependencies = [...own, ...viaRuntime]
	if (model.runtimeProperty) {
		version = model.runtimeProperty.value
		source = "property"
		evidence = `property ${model.runtimeProperty.name}=${version}`
	} else if (model.bom) {
		version = model.bom.version
		source = "bom"
		evidence = `bom ${model.bom.artifactId}:${version} (assumed = rte version)`
	} else if (versioned) {
		version = versioned.version
		source = "dependency-version"
		const label = versioned.versionOrigin === "managed" ? "managed" : "dependency"
		evidence = `${label} ${coordinateText(versioned.groupId, versioned.artifactId, version)}`
	} else if (patternDependencies.length > 0) {
		source = "artifact-pattern"
		evidence = `artifact pattern ${coordinateText(patternDependencies[0].groupId, patternDependencies[0].artifactId)}`
	} else {
		source = "none"
		evidence = "no runtime dependency"
	}

	const patterns = unique(
		patternDependencies.map((d) => generationOfArtifactId(d.artifactId)).filter((g): g is RuntimeGeneration => g !== null),
	)
	const versionGeneration = version ? generationOfVersion(version) : "unknown"
	let generation: RuntimeGeneration | "unknown" = patterns.length === 1 ? patterns[0] : versionGeneration
	const conflict =
		patterns.length > 1 || (patterns.length === 1 && versionGeneration !== "unknown" && versionGeneration !== patterns[0])
	if (conflict) {
		generation = "unknown"
		addNote(notes, "mixed generations")
	}
	return { runtime: version ? { generation, version, source, evidence } : { generation, source, evidence }, conflict }
}

function applyManualGeneration(runtime: BuildModuleCheck["runtime"], manual: RuntimeGeneration): BuildModuleCheck["runtime"] {
	const evidence = `manual (detected: ${runtime.source} ${runtime.version ?? "unknown"})`
	return runtime.version
		? { generation: manual, version: runtime.version, source: "manual", evidence }
		: { generation: manual, source: "manual", evidence }
}

// ───────────────────────── 필수 4종 판정 ─────────────────────────

function judgeRequiredLibraries(
	runtime: BuildModuleCheck["runtime"],
	declarations: Declarations,
	signals: string[],
): RequiredLibraryCheck[] {
	const branch = runtime.generation === "unknown" ? undefined : selectGraphBranch(runtime.generation, runtime.version)
	const graph = branch ? RUNTIME_MODULE_GRAPH[branch] : UNION_GRAPH
	const graphLabel = branch ? `static graph ${branch}` : "union graph"
	return REQUIRED_LIBRARIES.map((name): RequiredLibraryCheck => {
		const reach = reachRequiredLibrary(name, declarations.direct, graph)
		if (reach.status === "direct") {
			return { name, status: "direct", evidence: declarations.direct.find((d) => d.key === name)!.evidence }
		}
		const route = reach.via.join(" > ")
		if (reach.status === "transitive") {
			const evidence = branch ? `via ${route} (${graphLabel})` : `transitive? via ${route} (${graphLabel})`
			return { name, status: "transitive", via: reach.via, evidence }
		}
		if (declarations.outside.length > 0) {
			return { name, status: "unknown", evidence: `may be transitive via ${declarations.outside[0]}` }
		}
		if (signals.length > 0) {
			return { name, status: "unknown", evidence: `unparsed: ${signals[0]}` }
		}
		return reach.status === "excluded"
			? { name, status: "excluded", via: reach.via, evidence: `excluded on ${route} (${graphLabel})` }
			: { name, status: "missing", evidence: "not declared" }
	})
}

function moduleResult(libraries: RequiredLibraryCheck[]): BuildModuleCheck["result"] {
	if (libraries.some((l) => l.status === "excluded" || l.status === "missing")) {
		return "NotFound"
	}
	return libraries.some((l) => l.status === "unknown") ? "Unknown" : "OK"
}

// ───────────────────────── 일관성 ─────────────────────────

interface JudgedModule {
	model: ModuleModel
	check: BuildModuleCheck
	conflict: boolean
}

function judgeConsistency(judged: JudgedModule[]): ProjectCheckSummary["versionConsistency"] {
	const active = judged.filter((j) => j.check.result !== "Skipped")
	const values = active.flatMap(({ model }) =>
		model.dependencies
			.filter((d) => toModuleKey(d.artifactId) !== null && d.version !== undefined)
			.map((d) => ({ version: d.version!, bom: d.versionOrigin === "bom" ? model.bom : undefined })),
	)
	const versions = unique(values.map((v) => v.version))
	const generations = unique(active.map((j) => j.check.runtime.generation).filter((g) => g !== "unknown"))
	if (active.some((j) => j.conflict) || generations.length > 1) {
		return { state: "fail", versions, evidence: "mixed generations" }
	}
	if (versions.length > 1) {
		return { state: "fail", versions, evidence: versions.join(", ") }
	}
	if (versions.length === 1) {
		const bom = values.every((v) => v.bom) ? values[0].bom : undefined
		return { state: "pass", versions, evidence: bom ? `managed by BOM ${bom.artifactId}:${bom.version}` : versions[0] }
	}
	return { state: "skipped", versions, evidence: "no resolvable version" }
}

// ───────────────────────── 종합 ─────────────────────────

export function checkProjectBuild(input: BuildFileCheckInput): ProjectCheckSummary {
	const ctx = createContext(input)
	const models = moduleFiles(input, ctx.root).map((file) => {
		const base = {
			file,
			buildFile: relativeBuildFile(ctx.root, file),
			dependencies: [],
			moduleRefs: [],
			notes: [],
			signals: [],
		}
		return MODULE_FILES[path.basename(file)] === "maven"
			? buildMavenModule(ctx, file, base)
			: buildGradleModule(ctx, file, base)
	})
	const byRef = new Map<string, ModuleModel>()
	for (const model of models) {
		if (model.refKey && !model.aggregate && !byRef.has(model.refKey)) {
			byRef.set(model.refKey, model)
		}
	}
	linkMavenModules(models, byRef)

	const judged: JudgedModule[] = models.map((model) => {
		const notes = model.notes
		const declarations = collectDeclarations(model, byRef, 0, new Set([model.file]))
		const judgement = judgeRuntime(model, declarations.viaRuntime, notes)
		let { runtime, conflict } = judgement
		if (input.manualGeneration) {
			runtime = applyManualGeneration(runtime, input.manualGeneration)
			conflict = false
			const index = notes.indexOf("mixed generations")
			if (index >= 0) {
				notes.splice(index, 1)
			}
		}
		model.signals.forEach((signal) => addNote(notes, signal))
		if (model.unreadable) {
			addNote(notes, "unreadable build file")
		}
		const skipped = model.aggregate || model.unreadable
		const requiredLibraries = skipped ? [] : judgeRequiredLibraries(runtime, declarations, model.signals)
		const check: BuildModuleCheck = {
			buildFile: model.buildFile,
			buildTool: model.buildTool,
			aggregate: model.aggregate,
			runtime,
			requiredLibraries,
			result: skipped ? "Skipped" : moduleResult(requiredLibraries),
		}
		if (notes.length > 0) {
			check.notes = notes
		}
		return { model, check, conflict }
	})

	const versionConsistency = judgeConsistency(judged)
	const modules = judged.map((j) => j.check)
	const active = judged.filter((j) => j.check.result !== "Skipped")
	let result: ProjectCheckSummary["result"] = "OK"
	if (active.some((j) => j.check.result === "NotFound") || versionConsistency.state === "fail") {
		result = "NotFound"
	} else if (active.length === 0 || active.some((j) => j.check.result === "Unknown")) {
		result = "Unknown"
	}
	const generations = unique(active.map((j) => j.check.runtime.generation).filter((g) => g !== "unknown"))
	const generation =
		input.manualGeneration ?? (generations.length === 1 && !active.some((j) => j.conflict) ? generations[0] : "unknown")
	const summary: ProjectCheckSummary = { generation, versionConsistency, modules, result }
	if (versionConsistency.state === "pass") {
		summary.version = versionConsistency.versions[0]
	}
	return summary
}

// ───────────────────────── 파일 → 모듈 매핑 ─────────────────────────

function segments(value: string): string[] {
	return value.split(/[\\/]+/).filter((segment) => segment !== "")
}

function startsWithSegments(value: string[], prefix: string[]): boolean {
	return prefix.length <= value.length && prefix.every((segment, i) => value[i] === segment)
}

/** aggregate가 아닌 행 중 buildFile 디렉터리가 filePath의 가장 긴 접두 경로인 모듈 (같은 디렉터리면 pom.xml 행 우선) */
export function moduleForFile(filePath: string, summary: ProjectCheckSummary, projectPath: string): BuildModuleCheck | undefined {
	const file = segments(filePath)
	const root = segments(projectPath)
	if (!startsWithSegments(file, root)) {
		return undefined
	}
	const rest = file.slice(root.length)
	let best: BuildModuleCheck | undefined
	let bestDepth = -1
	for (const module of summary.modules) {
		if (module.aggregate) {
			continue
		}
		const dir = segments(module.buildFile).slice(0, -1)
		if (!startsWithSegments(rest, dir)) {
			continue
		}
		if (dir.length > bestDepth || (dir.length === bestDepth && module.buildTool === "maven" && best?.buildTool !== "maven")) {
			best = module
			bestDepth = dir.length
		}
	}
	return best
}

/** 파일이 속한 모듈의 세대(unknown이어도 그대로), 속한 모듈이 없으면 프로젝트 세대 */
export function generationForFile(
	filePath: string,
	summary: ProjectCheckSummary,
	projectPath: string,
): RuntimeGeneration | "unknown" {
	const module = moduleForFile(filePath, summary, projectPath)
	return module ? module.runtime.generation : summary.generation
}
