/**
 * Gradle 빌드 스크립트 스캐너 — 빌드 도구를 실행하지 않고 build.gradle(.kts) 텍스트 한 개를 GradleBuildModel로 바꾼다.
 *
 * Groovy/Kotlin 파서 없이 문자열 리터럴을 인식하는 주석 제거기와, 문자열을 가린 텍스트에서 중괄호 깊이를 세는
 * 줄 단위 정규식 스캐너로 읽는다. 인식 형태는 설계 5.8절 Gradle 1차 범위뿐이며, 해석이 확실하지 않은 형태
 * (번들·루프·헬퍼 함수·conventions 플러그인·egov를 포함한 낯선 선언)는 추측하지 않고 unresolvedSignals로 남긴다.
 * 파일을 읽지 않고(텍스트 입력만) `vscode`를 import하지 않는다.
 */
import type { MavenCoordinate } from "./mavenPom"

export interface GradleDependency {
	configuration: string
	group: string
	name: string
	/** 변수면 "${이름}" 꼴 */
	version?: string
	exclusions: Array<{ group?: string; module?: string }>
	evidence: string
}

export interface GradleBuildModel {
	/** implementation | api | compile | runtimeOnly | compileOnly (test*·그 밖의 구성은 버린다) */
	dependencies: GradleDependency[]
	/** platform(...) / enforcedPlatform(...) / dependencyManagement { imports { mavenBom "…" } } */
	platforms: MavenCoordinate[]
	/** project(":x") 경로 (":x") */
	projectDependencies: string[]
	/** ext { set('k','v') } / ext { k = 'v' } / ext.k = 'v' / def k = 'v' / val k by extra("v") */
	properties: Record<string, string>
	/** allprojects {} / subprojects {} 안의 dependencies {} (루트 파일이면 자식에 적용) */
	inheritedDependencies: GradleDependency[]
	/** apply from: '<경로>' / apply(from = "<경로>") 의 경로 원문 */
	appliedScripts: string[]
	/** "bundle libs.bundles.x", "loop", "helper function <이름>", "convention plugin <id>", "unparsed: <줄>" */
	unresolvedSignals: string[]
}

export interface VersionCatalog {
	versions: Record<string, string>
	libraries: Record<string, MavenCoordinate & { versionRef?: string }>
}

const COLLECTED_CONFIGURATIONS = new Set(["implementation", "api", "compile", "runtimeOnly", "compileOnly"])
const LOOP_LABELS = new Set(["each", "eachWithIndex", "forEach"])
const INHERITING_LABELS = new Set(["allprojects", "subprojects"])
const MASK_CHAR = "~"

interface Region {
	kind: "code" | "string" | "comment"
	start: number
	end: number
}

/** `${ … }` 보간을 짝 맞는 `}`까지 건너뛴다(줄바꿈에서 멈춘다). */
function skipInterpolation(text: string, start: number): number {
	let depth = 1
	for (let i = start; i < text.length; i++) {
		const c = text[i]
		if (c === "\n") {
			return i
		}
		if (c === "{") {
			depth++
		} else if (c === "}" && --depth === 0) {
			return i + 1
		}
	}
	return text.length
}

/** start의 따옴표로 시작하는 문자열 리터럴의 끝(닫는 따옴표 다음) 위치. 한 줄 문자열은 줄바꿈에서 끊는다. */
function skipString(text: string, start: number): number {
	const quote = text[start]
	const delimiter = text.startsWith(quote.repeat(3), start) ? quote.repeat(3) : quote
	const triple = delimiter.length === 3
	let i = start + delimiter.length
	while (i < text.length) {
		const c = text[i]
		if (c === "\\") {
			i += 2
		} else if (!triple && c === "\n") {
			return i
		} else if (quote === '"' && c === "$" && text[i + 1] === "{") {
			i = skipInterpolation(text, i + 2)
		} else if (text.startsWith(delimiter, i)) {
			return i + delimiter.length
		} else {
			i++
		}
	}
	return text.length
}

function lexRegions(text: string): Region[] {
	const regions: Region[] = []
	let codeStart = 0
	let i = 0
	const flush = (kind: Region["kind"], start: number, end: number) => {
		if (end > start) {
			regions.push({ kind, start, end })
		}
	}
	while (i < text.length) {
		const c = text[i]
		let end = -1
		let kind: Region["kind"] = "comment"
		if (c === "/" && text[i + 1] === "/") {
			end = text.indexOf("\n", i)
			end = end < 0 ? text.length : end
		} else if (c === "/" && text[i + 1] === "*") {
			end = text.indexOf("*/", i + 2)
			end = end < 0 ? text.length : end + 2
		} else if (c === '"' || c === "'") {
			end = skipString(text, i)
			kind = "string"
		}
		if (end < 0) {
			i++
			continue
		}
		flush("code", codeStart, i)
		flush(kind, i, end)
		i = end
		codeStart = end
	}
	flush("code", codeStart, text.length)
	return regions
}

/** `//`와 `/* *\/` 주석을 지운다. 문자열 리터럴('…', "…", """…""") 안은 보존하고, 블록 주석 안의 줄바꿈은 남겨 줄 번호를 유지한다. */
export function stripGradleComments(text: string): string {
	return lexRegions(text)
		.map((r) => (r.kind === "comment" ? text.slice(r.start, r.end).replace(/[^\n]/g, "") : text.slice(r.start, r.end)))
		.join("")
}

/** 문자열 리터럴 내용을 같은 길이의 MASK_CHAR로 가린다(줄바꿈 유지). 중괄호 깊이·구문 위치 판단용. */
function maskStrings(text: string): string {
	return lexRegions(text)
		.map((r) => (r.kind === "string" ? text.slice(r.start, r.end).replace(/[^\n]/g, MASK_CHAR) : text.slice(r.start, r.end)))
		.join("")
}

/** `"$v"` → `${v}` (이미 `${v}`인 것은 그대로) */
function normalizeVariables(value: string): string {
	return value.replace(/\$(?!\{)([A-Za-z_]\w*)/g, (_, name: string) => "${" + name + "}")
}

/** "g:a[:v[:classifier]][@ext]" */
function parseCoordinate(value: string): MavenCoordinate | null {
	const parts = normalizeVariables(value).split(":")
	if (parts.length < 2 || !parts[0] || !parts[1]) {
		return null
	}
	const coordinate: MavenCoordinate = { groupId: parts[0], artifactId: parts[1].split("@")[0] }
	const version = parts[2]?.split("@")[0]
	if (version) {
		coordinate.version = version
	}
	return coordinate
}

/** `group: 'g', name: 'a', version: v` / `group = "g", …` → 키 → 값(따옴표 없는 식별자는 `${식별자}`) */
function parseNamedArgs(text: string, keys: string): Record<string, string> {
	const args: Record<string, string> = {}
	const pattern = new RegExp(`\\b(${keys})\\s*[:=]\\s*(?:(['"])(.*?)\\2|([A-Za-z_][\\w.]*))`, "g")
	for (const m of text.matchAll(pattern)) {
		args[m[1]] = m[2] ? normalizeVariables(m[3]) : "${" + m[4] + "}"
	}
	return args
}

/** 바깥을 감싼 괄호 한 겹씩을 벗긴다. 괄호 짝은 문자열을 가린 텍스트로 센다. */
function unwrapParens(body: string, masked: string): [string, string] {
	while (masked.startsWith("(")) {
		let depth = 0
		let close = -1
		for (let i = 0; i < masked.length && close < 0; i++) {
			if (masked[i] === "(") {
				depth++
			} else if (masked[i] === ")" && --depth === 0) {
				close = i
			}
		}
		if (close !== masked.length - 1) {
			break
		}
		body = body.slice(1, -1).trim()
		masked = masked.slice(1, -1).trim()
	}
	return [body, masked]
}

/** `{` 바로 앞 구문의 이름(`subprojects`, `dependencies`, `implementation(…)` → `implementation`, `list.each` → `each`) */
function blockLabel(maskedSegment: string): string {
	const m = /([A-Za-z_][\w.]*)\s*(?:\([^()]*\))?\s*$/.exec(maskedSegment)
	return m ? m[1].split(".").pop()! : ""
}

interface Frame {
	label: string
	/** 의존성 선언 뒤의 `{ exclude … }` 블록이면 그 의존성 */
	dependency?: GradleDependency
}

export function parseGradleBuild(text: string, kind: "gradle" | "gradle-kts"): GradleBuildModel {
	const model: GradleBuildModel = {
		dependencies: [],
		platforms: [],
		projectDependencies: [],
		properties: {},
		inheritedDependencies: [],
		appliedScripts: [],
		unresolvedSignals: [],
	}
	const signal = (value: string) => {
		if (!model.unresolvedSignals.includes(value)) {
			model.unresolvedSignals.push(value)
		}
	}
	const source = stripGradleComments(text)
	const masked = maskStrings(source)
	const helpers = new Set(kind === "gradle" ? Array.from(masked.matchAll(/\bdef\s+([A-Za-z_]\w*)\s*\(/g), (m) => m[1]) : [])
	const stack: Frame[] = []
	const inside = (label: string) => stack.some((f) => f.label === label)

	const parseDeclaration = (segment: string, maskedSegment: string): GradleDependency | undefined => {
		const m = /^([A-Za-z_]\w*)(?=[\s('"])/.exec(segment)
		if (!m) {
			return undefined
		}
		const configuration = m[1]
		const offset = configuration.length
		if (helpers.has(configuration) && maskedSegment.slice(offset).trimStart().startsWith("(")) {
			signal(`helper function ${configuration}`)
			return undefined
		}
		if (!COLLECTED_CONFIGURATIONS.has(configuration)) {
			return undefined
		}
		const [body, maskedBody] = unwrapParens(segment.slice(offset).trim(), maskedSegment.slice(offset).trim())
		const helperArgument = /^([A-Za-z_]\w*)\s*\(/.exec(maskedBody)?.[1]
		if (helperArgument && helpers.has(helperArgument)) {
			signal(`helper function ${helperArgument}`)
			return undefined
		}
		const inherited = stack.some((f) => INHERITING_LABELS.has(f.label))
		const add = (group: string, name: string, version: string | undefined) => {
			const dependency: GradleDependency = { configuration, group, name, exclusions: [], evidence: segment }
			if (version) {
				dependency.version = version
			}
			;(inherited ? model.inheritedDependencies : model.dependencies).push(dependency)
			return dependency
		}
		const unparsed = () => {
			if (/egov/i.test(segment)) {
				signal(`unparsed: ${segment}`)
			}
			return undefined
		}

		const literal = /^(['"])([^'"]*)\1$/.exec(body)
		if (literal) {
			const coordinate = parseCoordinate(literal[2])
			return coordinate ? add(coordinate.groupId, coordinate.artifactId, coordinate.version) : unparsed()
		}
		const platform = /^(?:platform|enforcedPlatform)\s*\(\s*(['"])([^'"]*)\1\s*\)$/.exec(body)
		if (platform) {
			const coordinate = parseCoordinate(platform[2])
			if (coordinate) {
				model.platforms.push(coordinate)
			}
			return coordinate ? undefined : unparsed()
		}
		const project = /^project\s*\(\s*(['"])([^'"]*)\1\s*\)$/.exec(body)
		if (project) {
			model.projectDependencies.push(":" + project[2].replace(/^:/, ""))
			return undefined
		}
		if (/^libs\.bundles\.[\w.]+$/.test(body)) {
			signal(`bundle ${body}`)
			return undefined
		}
		if (/^libs\.[\w.]+$/.test(body)) {
			return add("", body, undefined)
		}
		if (/^\w+\s*[:=]/.test(maskedBody)) {
			const args = parseNamedArgs(body, "group|name|version")
			return args.group && args.name ? add(args.group, args.name, args.version) : unparsed()
		}
		return unparsed()
	}

	const processSegment = (segment: string, maskedSegment: string): GradleDependency | undefined => {
		const top = stack[stack.length - 1]
		const applied = /^apply\s*\(?\s*from\s*[:=]\s*(['"])([^'"]*)\1/.exec(segment)
		if (applied) {
			model.appliedScripts.push(applied[2])
			return undefined
		}
		const property =
			(top?.label === "ext" &&
				(/^set\s*\(\s*(['"])([^'"]+)\1\s*,\s*(['"])(.*?)\3\s*\)$/.exec(segment)?.slice(2) ??
					/^([A-Za-z_]\w*)\s*=\s*(['"])(.*?)\2$/.exec(segment)?.slice(1))) ||
			/^(?:[\w.]*\.)?ext\.([A-Za-z_]\w*)\s*=\s*(['"])(.*?)\2$/.exec(segment)?.slice(1) ||
			(kind === "gradle"
				? /^def\s+([A-Za-z_]\w*)\s*=\s*(['"])(.*?)\2$/.exec(segment)?.slice(1)
				: /^val\s+([A-Za-z_]\w*)(?:\s*:\s*\w+)?\s+by\s+extra\s*\(\s*(")(.*?)"\s*\)$/.exec(segment)?.slice(1))
		if (property) {
			model.properties[property[0]] = normalizeVariables(property[2])
			return undefined
		}
		if (top?.label === "plugins") {
			const id = /^id\s*\(?\s*(['"])([^'"]+)\1/.exec(segment)?.[2]
			if (id?.endsWith("-conventions")) {
				signal(`convention plugin ${id}`)
			}
			return undefined
		}
		if (top?.label === "imports" && inside("dependencyManagement")) {
			const bom = /^mavenBom\s*\(?\s*(['"])([^'"]*)\1/.exec(segment)
			const coordinate = bom && parseCoordinate(bom[2])
			if (coordinate) {
				model.platforms.push(coordinate)
			}
			return undefined
		}
		if (top?.dependency) {
			for (const m of segment.matchAll(/\bexclude\b\s*\(?([^)]*)/g)) {
				const args = parseNamedArgs(m[1], "group|module")
				if (args.group || args.module) {
					top.dependency.exclusions.push({
						...(args.group ? { group: args.group } : {}),
						...(args.module ? { module: args.module } : {}),
					})
				}
			}
			return undefined
		}
		if (!inside("dependencies")) {
			return undefined
		}
		if (/\$\{?it\b/.test(segment) || /\bforEach\b/.test(maskedSegment)) {
			signal("loop")
			return undefined
		}
		if (inside("dependencyManagement") || stack.some((f) => LOOP_LABELS.has(f.label))) {
			return undefined
		}
		if (top?.label !== "dependencies") {
			// if·try 같은 dependencies 안의 내부 블록: 추측해서 모으지 않되 egov 선언은 조용히 버리지 않는다
			const configuration = /^([A-Za-z_]\w*)(?=[\s('"])/.exec(segment)?.[1]
			if (
				top?.label !== "constraints" &&
				configuration &&
				COLLECTED_CONFIGURATIONS.has(configuration) &&
				/egov/i.test(segment)
			) {
				signal(`unparsed: ${segment}`)
			}
			return undefined
		}
		return parseDeclaration(segment, maskedSegment)
	}

	const openBlock = (label: string, dependency: GradleDependency | undefined) => {
		const inLoop = stack.some((f) => LOOP_LABELS.has(f.label))
		if ((LOOP_LABELS.has(label) && inside("dependencies")) || (label === "dependencies" && inLoop)) {
			signal("loop")
		}
		stack.push(dependency ? { label, dependency } : { label })
	}

	// 문자열을 가린 텍스트에서 `{` `}` `;` 줄바꿈을 구문 경계로 삼는다. 위치는 source와 같다.
	let segmentStart = 0
	let pendingLabel = ""
	let pendingDependency: GradleDependency | undefined
	for (let i = 0; i <= masked.length; i++) {
		const c = i < masked.length ? masked[i] : "\n"
		if (c !== "{" && c !== "}" && c !== ";" && c !== "\n") {
			continue
		}
		const segment = source.slice(segmentStart, i).trim()
		if (segment) {
			const maskedSegment = masked.slice(segmentStart, i).trim()
			pendingDependency = processSegment(segment, maskedSegment)
			pendingLabel = blockLabel(maskedSegment)
		}
		if (c === "{") {
			openBlock(pendingLabel, pendingDependency)
		} else if (c === "}") {
			stack.pop()
		}
		if (c !== "\n") {
			pendingLabel = ""
			pendingDependency = undefined
		}
		segmentStart = i + 1
	}
	return model
}

/** settings.gradle(.kts)의 include 목록. `include ':a', ':b'` / `include(":a")` / `include("a")` / 줄 바뀐 목록 → ":a" */
export function parseGradleSettings(text: string): { includes: string[] } {
	const source = stripGradleComments(text)
	const masked = maskStrings(source)
	const includes: string[] = []
	for (const m of masked.matchAll(/\binclude\b\s*\(?/g)) {
		let i = m.index! + m[0].length
		for (;;) {
			while (/\s/.test(source[i] ?? "")) {
				i++
			}
			if (source[i] !== '"' && source[i] !== "'") {
				break
			}
			const end = skipString(source, i)
			const path = ":" + source.slice(i + 1, end - 1).replace(/^:/, "")
			if (!includes.includes(path)) {
				includes.push(path)
			}
			i = end
			while (/\s/.test(source[i] ?? "")) {
				i++
			}
			if (source[i] !== ",") {
				break
			}
			i++
		}
	}
	return { includes }
}

/** gradle.properties (`k=v` / `k = v` / `k: v`, `#`·`!` 주석 줄 무시) */
export function parseGradleProperties(text: string): Record<string, string> {
	const properties: Record<string, string> = {}
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim()
		if (!line || line.startsWith("#") || line.startsWith("!")) {
			continue
		}
		const m = /^([^=:\s]+)\s*[=:]\s*(.*)$/.exec(line) ?? /^(\S+)\s+(.*)$/.exec(line)
		if (m) {
			properties[m[1]] = m[2].trim()
		}
	}
	return properties
}

/** TOML 한 줄에서 문자열 밖의 `#` 주석을 지운다. */
function stripTomlComment(line: string): string {
	let quoted = false
	for (let i = 0; i < line.length; i++) {
		if (line[i] === '"' && line[i - 1] !== "\\") {
			quoted = !quoted
		} else if (line[i] === "#" && !quoted) {
			return line.slice(0, i)
		}
	}
	return line
}

/** gradle/libs.versions.toml의 [versions]·[libraries]만 읽는다([bundles]·[plugins]는 무시). */
export function parseVersionCatalog(toml: string): VersionCatalog {
	const catalog: VersionCatalog = { versions: {}, libraries: {} }
	let section = ""
	for (const raw of toml.split(/\r?\n/)) {
		const line = stripTomlComment(raw).trim()
		const header = /^\[([^\]]+)\]$/.exec(line)
		if (header) {
			section = header[1].trim()
			continue
		}
		const entry = /^(?:"([^"]+)"|([A-Za-z0-9_.-]+))\s*=\s*(.+)$/.exec(line)
		if (!entry) {
			continue
		}
		const key = entry[1] ?? entry[2]
		const value = entry[3].trim()
		const literal = /^"([^"]*)"$/.exec(value)?.[1]
		if (section === "versions" && literal !== undefined) {
			catalog.versions[key] = literal
		} else if (section === "libraries") {
			const library = literal !== undefined ? parseCoordinate(literal) : parseCatalogTable(value)
			if (library) {
				catalog.libraries[key] = library
			}
		}
	}
	return catalog
}

/** `{ module = "g:a", version.ref = "x" }` / `{ group = "g", name = "a", version = "v" }` */
function parseCatalogTable(value: string): (MavenCoordinate & { versionRef?: string }) | null {
	const body = /^\{(.*)\}$/.exec(value)?.[1]
	if (body === undefined) {
		return null
	}
	const fields: Record<string, string> = {}
	for (const m of body.matchAll(/([\w.]+)\s*=\s*"([^"]*)"/g)) {
		fields[m[1]] = m[2]
	}
	const [groupId, artifactId] = fields.module ? fields.module.split(":") : [fields.group, fields.name]
	if (!groupId || !artifactId) {
		return null
	}
	const library: MavenCoordinate & { versionRef?: string } = { groupId, artifactId }
	if (fields.version) {
		library.version = fields.version
	}
	if (fields["version.ref"]) {
		library.versionRef = fields["version.ref"]
	}
	return library
}

/** "libs.egov.ptl.mvc" → libraries["egov-ptl-mvc"] 또는 ["egov.ptl.mvc"]. version.ref는 [versions]로 치환한다. */
export function resolveCatalogReference(ref: string, catalog: VersionCatalog): MavenCoordinate | null {
	if (!ref.startsWith("libs.")) {
		return null
	}
	const key = ref.slice("libs.".length)
	const library = catalog.libraries[key.replace(/\./g, "-")] ?? catalog.libraries[key]
	if (!library) {
		return null
	}
	const coordinate: MavenCoordinate = { groupId: library.groupId, artifactId: library.artifactId }
	const version = library.version ?? (library.versionRef ? catalog.versions[library.versionRef] : undefined)
	if (version) {
		coordinate.version = version
	}
	return coordinate
}
