/**
 * Maven POM 스캐너 — 빌드 도구를 실행하지 않고 pom.xml 텍스트 한 개를 구조(MavenPomModel)로 바꾼다.
 *
 * 외부 XML 라이브러리 없이 작은 토크나이저로 요소 트리를 만든다. 속성은 무시하고 네임스페이스
 * 접두어(`m:project` → `project`)는 떼며 CDATA 본문은 텍스트로 둔다. parent 체인·BOM 해석·판정은
 * buildFileCheck가 담당하고, 이 모듈은 한 pom의 구조화와 `${…}` 치환만 한다. `vscode`를 import하지 않는다.
 */

export interface MavenCoordinate {
	groupId: string
	artifactId: string
	version?: string
}

/** 제외 대상 좌표. `*` 와일드카드를 그대로 보존한다. */
export interface MavenExclusion {
	groupId: string
	artifactId: string
}

export interface MavenDependency extends MavenCoordinate {
	/** 기본 "compile" */
	scope: string
	/** 기본 false */
	optional: boolean
	exclusions: MavenExclusion[]
	type?: string
}

export interface MavenPomModel {
	/** 없으면 parent의 groupId */
	groupId?: string
	artifactId?: string
	/** 없으면 parent의 version */
	version?: string
	/** 기본 "jar" */
	packaging: string
	/** `<relativePath/>`는 빈 문자열("")로 읽는다 */
	parent?: MavenCoordinate & { relativePath?: string }
	/** /project/properties + activeByDefault 프로파일의 properties */
	properties: Record<string, string>
	/** /project/dependencies 만(플러그인·프로파일 아래 의존성은 세지 않는다) */
	dependencies: MavenDependency[]
	/** dependencyManagement 중 scope import가 아닌 항목 */
	managedDependencies: MavenDependency[]
	/** dependencyManagement 중 scope import(type pom) 항목 */
	importedBoms: MavenCoordinate[]
	modules: string[]
	/** activeByDefault=true가 아닌 <profile>이 하나라도 있으면 true */
	profilesIgnored: boolean
}

interface XmlElement {
	name: string
	children: XmlElement[]
	/** 직접 텍스트 노드(CDATA 포함)를 이어 붙여 trim한 값 */
	text: string
}

interface MutableElement {
	name: string
	children: MutableElement[]
	textParts: string[]
}

/** `<!-- … -->` 주석을 제거한다. CDATA 본문 안의 `<!--`는 주석으로 보지 않는다. 닫히지 않은 주석은 끝까지 지운다. */
export function stripXmlComments(xml: string): string {
	let out = ""
	let i = 0
	while (i < xml.length) {
		const next = xml.indexOf("<", i)
		if (next < 0) {
			out += xml.slice(i)
			break
		}
		out += xml.slice(i, next)
		if (xml.startsWith("<!--", next)) {
			const end = xml.indexOf("-->", next + 4)
			if (end < 0) {
				break
			}
			i = end + 3
		} else if (xml.startsWith("<![CDATA[", next)) {
			const end = xml.indexOf("]]>", next + 9)
			const stop = end < 0 ? xml.length : end + 3
			out += xml.slice(next, stop)
			i = stop
		} else {
			out += "<"
			i = next + 1
		}
	}
	return out
}

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" }

function decodeEntities(text: string): string {
	return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, body: string) => {
		if (body.startsWith("#x")) {
			const code = parseInt(body.slice(2), 16)
			return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole
		}
		if (body.startsWith("#")) {
			const code = parseInt(body.slice(1), 10)
			return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole
		}
		return ENTITIES[body] ?? whole
	})
}

function localName(qualified: string): string {
	const colon = qualified.lastIndexOf(":")
	return colon < 0 ? qualified : qualified.slice(colon + 1)
}

/** 따옴표 안의 `>`를 건너뛰며 태그 끝 위치를 찾는다. 없으면 -1. */
function findTagEnd(xml: string, from: number): number {
	let quote: string | undefined
	for (let i = from; i < xml.length; i++) {
		const ch = xml[i]
		if (quote) {
			if (ch === quote) {
				quote = undefined
			}
		} else if (ch === '"' || ch === "'") {
			quote = ch
		} else if (ch === ">") {
			return i
		}
	}
	return -1
}

/** 주석을 제거한 XML로 요소 트리를 만든다. 어긋난 닫는 태그에서도 예외 없이 가능한 만큼 읽는다. */
function parseXmlTree(xml: string): XmlElement[] {
	const source = stripXmlComments(xml)
	const document: MutableElement = { name: "#document", children: [], textParts: [] }
	const stack: MutableElement[] = [document]
	const top = () => stack[stack.length - 1]
	let i = 0
	while (i < source.length) {
		const lt = source.indexOf("<", i)
		if (lt < 0) {
			top().textParts.push(decodeEntities(source.slice(i)))
			break
		}
		if (lt > i) {
			top().textParts.push(decodeEntities(source.slice(i, lt)))
		}
		if (source.startsWith("<![CDATA[", lt)) {
			const end = source.indexOf("]]>", lt + 9)
			top().textParts.push(source.slice(lt + 9, end < 0 ? source.length : end))
			i = end < 0 ? source.length : end + 3
			continue
		}
		if (source.startsWith("<?", lt)) {
			const end = source.indexOf("?>", lt + 2)
			i = end < 0 ? source.length : end + 2
			continue
		}
		if (source.startsWith("<!", lt)) {
			// DOCTYPE 등 선언. 내부 서브셋 `[ … ]`이 있으면 `]>`까지 건너뛴다.
			const bracket = source.indexOf("[", lt)
			const close = source.indexOf(">", lt)
			const end = bracket >= 0 && close >= 0 && bracket < close ? source.indexOf("]>", bracket) : close
			i = end < 0 ? source.length : end + (end === close ? 1 : 2)
			continue
		}
		const end = findTagEnd(source, lt + 1)
		if (end < 0) {
			break
		}
		const inner = source.slice(lt + 1, end)
		i = end + 1
		if (inner.startsWith("/")) {
			const name = localName(inner.slice(1).trim())
			const index = stack.map((el) => el.name).lastIndexOf(name)
			if (index > 0) {
				stack.length = index
			}
			continue
		}
		const match = /^\s*([^\s/>]+)/.exec(inner)
		if (!match) {
			top().textParts.push(`<${inner}>`)
			continue
		}
		const element: MutableElement = { name: localName(match[1]), children: [], textParts: [] }
		top().children.push(element)
		if (!inner.trimEnd().endsWith("/")) {
			stack.push(element)
		}
	}
	return document.children.map(freeze)
}

function freeze(element: MutableElement): XmlElement {
	return { name: element.name, children: element.children.map(freeze), text: element.textParts.join("").trim() }
}

function child(element: XmlElement | undefined, name: string): XmlElement | undefined {
	return element?.children.find((c) => c.name === name)
}

function childrenNamed(element: XmlElement | undefined, name: string): XmlElement[] {
	return element ? element.children.filter((c) => c.name === name) : []
}

/** 요소가 있으면 그 텍스트(빈 요소는 ""), 없으면 undefined. */
function childText(element: XmlElement | undefined, name: string): string | undefined {
	return child(element, name)?.text
}

function nonEmpty(value: string | undefined): string | undefined {
	return value === undefined || value === "" ? undefined : value
}

function readDependency(element: XmlElement): MavenDependency {
	return {
		groupId: childText(element, "groupId") ?? "",
		artifactId: childText(element, "artifactId") ?? "",
		version: nonEmpty(childText(element, "version")),
		scope: nonEmpty(childText(element, "scope")) ?? "compile",
		optional: childText(element, "optional")?.toLowerCase() === "true",
		exclusions: childrenNamed(child(element, "exclusions"), "exclusion").map((exclusion) => ({
			groupId: childText(exclusion, "groupId") ?? "",
			artifactId: childText(exclusion, "artifactId") ?? "",
		})),
		type: nonEmpty(childText(element, "type")),
	}
}

function readDependencies(container: XmlElement | undefined): MavenDependency[] {
	return childrenNamed(child(container, "dependencies"), "dependency").map(readDependency)
}

function readProperties(element: XmlElement | undefined, into: Record<string, string>): void {
	for (const property of child(element, "properties")?.children ?? []) {
		into[property.name] = property.text
	}
}

export function parseMavenPom(xml: string): MavenPomModel {
	const project = parseXmlTree(xml).find((el) => el.name === "project")

	const parentElement = child(project, "parent")
	const parent: MavenPomModel["parent"] = parentElement
		? {
				groupId: childText(parentElement, "groupId") ?? "",
				artifactId: childText(parentElement, "artifactId") ?? "",
				version: nonEmpty(childText(parentElement, "version")),
				relativePath: childText(parentElement, "relativePath"),
			}
		: undefined

	const properties: Record<string, string> = {}
	readProperties(project, properties)
	let profilesIgnored = false
	for (const profile of childrenNamed(child(project, "profiles"), "profile")) {
		if (childText(child(profile, "activation"), "activeByDefault")?.toLowerCase() === "true") {
			readProperties(profile, properties)
		} else {
			profilesIgnored = true
		}
	}

	const managedDependencies: MavenDependency[] = []
	const importedBoms: MavenCoordinate[] = []
	for (const dependency of readDependencies(child(project, "dependencyManagement"))) {
		if (dependency.scope === "import") {
			importedBoms.push({ groupId: dependency.groupId, artifactId: dependency.artifactId, version: dependency.version })
		} else {
			managedDependencies.push(dependency)
		}
	}

	return {
		groupId: nonEmpty(childText(project, "groupId")) ?? nonEmpty(parent?.groupId),
		artifactId: nonEmpty(childText(project, "artifactId")),
		version: nonEmpty(childText(project, "version")) ?? parent?.version,
		packaging: nonEmpty(childText(project, "packaging")) ?? "jar",
		parent,
		properties,
		dependencies: readDependencies(project),
		managedDependencies,
		importedBoms,
		modules: childrenNamed(child(project, "modules"), "module")
			.map((module) => module.text)
			.filter((module) => module !== ""),
		profilesIgnored,
	}
}

/**
 * `${k}`를 `properties[k]`로 치환한다. 치환 결과에 다시 나온 `${…}`도 최대 `maxDepth`회까지 연쇄 치환한다.
 * 모르는 키는 그대로 남기고, 자기 참조·순환은 깊이 제한 안에서 끝난다.
 */
export function resolvePlaceholders(value: string, properties: Record<string, string>, maxDepth = 5): string {
	let current = value
	for (let depth = 0; depth < maxDepth; depth++) {
		const next = current.replace(/\$\{([^}]+)\}/g, (whole, key: string) =>
			Object.prototype.hasOwnProperty.call(properties, key) ? properties[key] : whole,
		)
		if (next === current) {
			break
		}
		current = next
	}
	return current
}
