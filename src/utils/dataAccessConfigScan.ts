/**
 * dataAccessConfigScan.ts
 *
 * 아키텍처 점검 Project 항목의 데이터 접근 설정 정보(3단계)와 미분류 데이터 접근 파일 목록.
 * 스프링 설정(XML·Java Config·yml·properties)과 빌드 파일에서 SqlMapClientFactoryBean·SqlSessionFactoryBean·
 * MapperConfigurer·@MapperScan·mybatis-spring-boot-starter·mybatis.mapper-locations의 존재를 모으고,
 * DAO / Mapper 판정 결과와 엇갈리는 경우를 교차 경고로 남긴다. 정보 항목이라 판정(result)에는 영향을 주지 않는다.
 * `vscode`를 import하지 않으며 파일 읽기는 주입받은 readFile로 한다.
 */

import * as path from "path"
import type {
	DataAccessConfigFinding,
	DataAccessConfigInfo,
	DataAccessConfigKind,
	RuntimeGeneration,
	UnclassifiedDataAccessFile,
} from "../shared/archCheck"
import type { ReadFile } from "./javaIndex"
import { collectImports, hasToken, stripJavaComments } from "./javaSource"
import { stripXmlComments } from "./mavenPom"

/** 데이터 접근 설정 파일 수집 글롭 */
export const DATA_ACCESS_CONFIG_PATTERNS = ["*.xml", "*.yml", "*.yaml", "*.properties"]

/** 데이터 접근 설정 finding을 줄 빌드 파일 이름 */
export const DATA_ACCESS_BUILD_FILE_NAMES: readonly string[] = ["pom.xml", "build.gradle", "build.gradle.kts"]

/** DAO / Mapper 레이어 수집 접미어 — 이 접미어 파일은 미분류 탐색에서 뺀다 */
const DAO_LAYER_FILE_SUFFIXES = ["DAO.java", "Dao.java", "Mapper.java"]

const UNCLASSIFIED_TOKEN = /\b(SqlSessionTemplate|SqlMapClient|JdbcTemplate|NamedParameterJdbcTemplate|EntityManager)\b/

const WARN_NO_MAPPER_SCAN =
	"Mapper interfaces exist but no MapperConfigurer, @MapperScan or mybatis-spring-boot-starter was found"
const WARN_NO_SQL_MAP_CLIENT = "iBatis DAOs exist but no SqlMapClientFactoryBean was found"
const WARN_SPRING_IBATIS = "SqlMapClientFactoryBean is taken from org.springframework.orm.ibatis; eGovFrame 3.5+ provides its own"
const WARN_STARTER_ONLY =
	"Only mybatis-spring-boot-starter is configured; eGovFrame @Mapper/@EgovMapper interfaces are not auto-scanned without MapperConfigurer or @MapperScan"
const WARN_MAPPER_SCAN_WITHOUT_ANNOTATION = "@MapperScan without annotationClass registers every interface under basePackages"

const SPRING_IBATIS_PACKAGE = "org.springframework.orm.ibatis"

/** @MapperScan evidence에 쓰는 속성 이름과 순서 */
const MAPPER_SCAN_ATTRIBUTES = ["basePackages", "annotationClass", "sqlSessionFactoryRef"] as const

export interface DataAccessScanInput {
	projectPath: string
	/** *.xml, *.yml, *.yaml, *.properties 중 경로에 /src/main/resources/ 또는 /src/main/webapp/WEB-INF/ 가 있는 것 (구분자 무관) */
	configFiles: string[]
	/** 수집된 .java 전체(src/test·src/it 제외 집합). 설정 finding은 이 중 경로에 /src/main/java/ 가 있는 파일만 본다 */
	javaFiles: string[]
	/** pom.xml / build.gradle(.kts) (finding의 filePath·fileName에 쓴다) */
	buildFiles: Array<{ filePath: string; text: string }>
	readFile: ReadFile
	generation: RuntimeGeneration | "unknown"
	version?: string
	/** DAO 결과에 daoStyle mapperInterface가 하나라도 있는지 */
	hasMapperInterfaces: boolean
	/** DAO 결과에 daoStyle ibatisDao가 하나라도 있는지 */
	hasIbatisDaos: boolean
}

const toSlash = (filePath: string) => filePath.replace(/\\/g, "/")

const baseName = (filePath: string) => toSlash(filePath).split("/").pop() ?? filePath

/** 데이터 접근 설정 수집 범위(src/main/resources·src/main/webapp/WEB-INF)에 드는 경로인지 (구분자 무관) */
export function isDataAccessConfigPath(filePath: string): boolean {
	const normalized = toSlash(filePath)
	return normalized.includes("/src/main/resources/") || normalized.includes("/src/main/webapp/WEB-INF/")
}

/** 속성 목록 문자열에서 name="value" / name='value' 쌍을 읽는다 */
function readAttributes(attributeText: string): Map<string, string> {
	const attributes = new Map<string, string>()
	const attribute = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
	for (let match = attribute.exec(attributeText); match; match = attribute.exec(attributeText)) {
		attributes.set(match[1], (match[2] ?? match[3]).trim())
	}
	return attributes
}

/** <bean> 시작 태그 바로 뒤부터 짝이 되는 </bean>까지 (self-closing이면 빈 문자열) */
function beanBody(xml: string, tagEnd: number, selfClosing: boolean): string {
	if (selfClosing) {
		return ""
	}
	const close = /<\/(?:[\w-]+:)?bean\s*>/g
	close.lastIndex = tagEnd
	const match = close.exec(xml)
	return xml.slice(tagEnd, match ? match.index : xml.length)
}

/** MapperConfigurer bean 본문의 <property name="basePackage" value="…"> 값 */
function basePackageOf(body: string): string | undefined {
	const property = /<(?:[\w-]+:)?property\b([^>]*)>/g
	for (let match = property.exec(body); match; match = property.exec(body)) {
		const attributes = readAttributes(match[1])
		if (attributes.get("name") === "basePackage" && attributes.has("value")) {
			return attributes.get("value")
		}
	}
	return undefined
}

type RawFinding = { kind: DataAccessConfigKind; evidence: string }

function scanXml(text: string): RawFinding[] {
	const xml = stripXmlComments(text)
	const found: RawFinding[] = []
	// <bean과 class=가 다른 줄이어도 되도록 시작 태그 전체([^>]*는 줄바꿈 포함)를 속성 단위로 읽는다
	const beanTag = /<(?:[\w-]+:)?bean\b([^>]*)>/g
	for (let match = beanTag.exec(xml); match; match = beanTag.exec(xml)) {
		const className = readAttributes(match[1]).get("class")
		if (!className) {
			continue
		}
		if (className.endsWith(".SqlMapClientFactoryBean")) {
			found.push({ kind: "sqlMapClientFactoryBean", evidence: className.slice(0, -".SqlMapClientFactoryBean".length) })
		} else if (className === "org.mybatis.spring.SqlSessionFactoryBean") {
			found.push({ kind: "sqlSessionFactoryBean", evidence: className })
		} else if (className.endsWith("psl.dataaccess.mapper.MapperConfigurer")) {
			const body = beanBody(xml, beanTag.lastIndex, match[1].trimEnd().endsWith("/"))
			found.push({ kind: "mapperConfigurer", evidence: `basePackage=${basePackageOf(body) ?? "?"}` })
		}
	}
	return found
}

/** 문자열·문자 리터럴의 내용을 공백으로 지운다 (속성 이름 탐색이 리터럴 안의 "x="에 속지 않도록) */
function blankLiterals(text: string): string {
	return text.replace(/"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'/g, (literal) => `"${" ".repeat(literal.length - 2)}"`)
}

/** start 위치의 "(" 와 짝이 되는 ")"까지의 괄호 안 내용 (리터럴은 이미 지운 텍스트를 받는다) */
function parenthesizedArguments(text: string, start: number): string | undefined {
	if (text[start] !== "(") {
		return undefined
	}
	let depth = 0
	for (let i = start; i < text.length; i++) {
		if (text[i] === "(") {
			depth++
		} else if (text[i] === ")") {
			depth--
			if (depth === 0) {
				return text.slice(start + 1, i)
			}
		}
	}
	return text.slice(start + 1)
}

/** 첫 @MapperScan(괄호 안)의 속성 이름 — value는 basePackages로, 값만 있으면 basePackages */
function mapperScanEvidence(stripped: string): string {
	const text = blankLiterals(stripped)
	const annotation = /@\s*(?:[\w$]+\s*\.\s*)*MapperScan\b\s*/g
	const match = annotation.exec(text)
	if (!match) {
		return "no attributes"
	}
	const args = parenthesizedArguments(text, match.index + match[0].length)
	if (args === undefined || args.trim().length === 0) {
		return "no attributes"
	}
	const names = new Set<string>()
	const assignment = /\b([A-Za-z_$][\w$]*)\s*=(?!=)/g
	for (let found = assignment.exec(args); found; found = assignment.exec(args)) {
		names.add(found[1] === "value" ? "basePackages" : found[1])
	}
	if (names.size === 0) {
		names.add("basePackages")
	}
	const present = MAPPER_SCAN_ATTRIBUTES.filter((name) => names.has(name))
	return present.length > 0 ? present.join(",") : "no attributes"
}

/** SqlMapClientFactoryBean의 출처 패키지 — 단일 import → 코드의 FQCN → 와일드카드 import(…ibatis) 순 */
function sqlMapClientPackage(stripped: string): string {
	const imports = collectImports(stripped)
	const imported = imports.single.get("SqlMapClientFactoryBean")
	if (imported) {
		return imported
	}
	const qualified = /\b((?:[a-z_$][\w$]*\.)+)SqlMapClientFactoryBean\b/.exec(stripped)
	if (qualified) {
		return qualified[1].slice(0, -1)
	}
	return imports.wildcard.find((pkg) => pkg.endsWith(".ibatis")) ?? "?"
}

function scanJava(text: string): RawFinding[] {
	const stripped = stripJavaComments(text)
	const found: RawFinding[] = []
	if (hasToken(stripped, "SqlSessionFactoryBean")) {
		found.push({ kind: "sqlSessionFactoryBean", evidence: "java" })
	}
	if (hasToken(stripped, "SqlMapClientFactoryBean")) {
		found.push({ kind: "sqlMapClientFactoryBean", evidence: sqlMapClientPackage(stripped) })
	}
	const configurer = ["MapperConfigurer", "MapperScannerConfigurer"].find((token) => hasToken(stripped, token))
	if (configurer) {
		found.push({ kind: "mapperConfigurer", evidence: configurer })
	}
	if (/@\s*(?:[\w$]+\s*\.\s*)*MapperScans?\b/.test(stripped)) {
		found.push({ kind: "mapperScan", evidence: mapperScanEvidence(stripped) })
	}
	return found
}

/** 줄 끝 주석(공백 뒤 #)과 감싼 따옴표를 뗀 값 */
function cleanValue(value: string): string {
	const withoutComment = value.replace(/\s+#.*$/, "").trim()
	const quoted = /^(["'])(.*)\1$/.exec(withoutComment)
	return quoted ? quoted[2] : withoutComment
}

const indentOf = (line: string) => line.length - line.trimStart().length

/** yml: mybatis: 블록(들여쓰기로 판단) 아래 mapper-locations: 값, 또는 최상위 mybatis.mapper-locations: 값 */
function scanYaml(text: string): RawFinding[] {
	const lines = text.split(/\r?\n/)
	let blockIndent: number | undefined
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		const trimmed = line.trim()
		if (trimmed.length === 0 || trimmed.startsWith("#")) {
			continue
		}
		const indent = indentOf(line)
		if (blockIndent !== undefined && indent <= blockIndent) {
			blockIndent = undefined
		}
		if (/^mybatis\s*:\s*(#.*)?$/.test(trimmed)) {
			blockIndent = indent
			continue
		}
		const flat = /^mybatis\.mapper-locations\s*:(.*)$/.exec(trimmed)
		const nested = blockIndent !== undefined ? /^mapper-locations\s*:(.*)$/.exec(trimmed) : null
		const match = flat ?? nested
		if (!match) {
			continue
		}
		let value = cleanValue(match[1])
		if (value.length === 0) {
			// 값이 다음 줄들의 목록(- item)으로 이어지는 경우
			const items: string[] = []
			for (let j = i + 1; j < lines.length; j++) {
				const item = /^\s*-\s*(.*)$/.exec(lines[j])
				if (!item || indentOf(lines[j]) < indent) {
					break
				}
				items.push(cleanValue(item[1]))
			}
			value = items.join(",")
		}
		return [{ kind: "mapperLocations", evidence: value }]
	}
	return []
}

function scanProperties(text: string): RawFinding[] {
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim()
		if (trimmed.startsWith("#") || trimmed.startsWith("!")) {
			continue
		}
		const match = /^mybatis\.mapper-locations\s*[=:]\s*(.*)$/.exec(trimmed)
		if (match) {
			return [{ kind: "mapperLocations", evidence: match[1].trim() }]
		}
	}
	return []
}

function scanBuildFile(filePath: string, text: string): RawFinding[] {
	const body = baseName(filePath) === "pom.xml" ? stripXmlComments(text) : stripJavaComments(text)
	return body.includes("mybatis-spring-boot-starter")
		? [{ kind: "mybatisStarter", evidence: "mybatis-spring-boot-starter" }]
		: []
}

function scanConfigFile(filePath: string, text: string): RawFinding[] {
	const lower = filePath.toLowerCase()
	if (lower.endsWith(".xml")) {
		return scanXml(text)
	}
	if (lower.endsWith(".yml") || lower.endsWith(".yaml")) {
		return scanYaml(text)
	}
	if (lower.endsWith(".properties")) {
		return scanProperties(text)
	}
	return []
}

/** major.minor가 3.5 이상인지 */
function isAtLeast35(version: string | undefined): boolean {
	const match = version ? /^(\d+)\.(\d+)/.exec(version) : null
	if (!match) {
		return false
	}
	const major = Number(match[1])
	const minor = Number(match[2])
	return major > 3 || (major === 3 && minor >= 5)
}

function crossWarnings(input: DataAccessScanInput, findings: DataAccessConfigFinding[]): string[] {
	const has = (kind: DataAccessConfigKind) => findings.some((f) => f.kind === kind)
	const warnings: string[] = []
	if (input.hasMapperInterfaces && !has("mapperConfigurer") && !has("mapperScan") && !has("mybatisStarter")) {
		warnings.push(WARN_NO_MAPPER_SCAN)
	}
	if (input.hasIbatisDaos && !has("sqlMapClientFactoryBean")) {
		warnings.push(WARN_NO_SQL_MAP_CLIENT)
	}
	const springIbatis = findings.some((f) => f.kind === "sqlMapClientFactoryBean" && f.evidence === SPRING_IBATIS_PACKAGE)
	const providesOwn =
		input.generation === "4.x" || input.generation === "5.x" || (input.generation === "3.x" && isAtLeast35(input.version))
	if (springIbatis && providesOwn) {
		warnings.push(WARN_SPRING_IBATIS)
	}
	if (has("mybatisStarter") && !has("mapperConfigurer") && !has("mapperScan") && input.hasMapperInterfaces) {
		warnings.push(WARN_STARTER_ONLY)
	}
	if (findings.some((f) => f.kind === "mapperScan" && !f.evidence.split(",").includes("annotationClass"))) {
		warnings.push(WARN_MAPPER_SCAN_WITHOUT_ANNOTATION)
	}
	return warnings
}

/**
 * 데이터 접근 설정 finding과 교차 경고를 모은다. 순서: 설정 파일 → Java(src/main/java) → 빌드 파일.
 * 읽지 못한 파일은 건너뛴다.
 */
export function scanDataAccessConfig(input: DataAccessScanInput): DataAccessConfigInfo {
	const findings: DataAccessConfigFinding[] = []
	const seen = new Set<string>()
	const add = (filePath: string, raw: RawFinding[]) => {
		for (const { kind, evidence } of raw) {
			const key = `${filePath}\0${kind}`
			if (!seen.has(key)) {
				seen.add(key)
				findings.push({ kind, filePath, fileName: baseName(filePath), evidence })
			}
		}
	}
	const read = (filePath: string): string | undefined => {
		try {
			return input.readFile(filePath)
		} catch {
			return undefined
		}
	}

	for (const filePath of input.configFiles.filter(isDataAccessConfigPath)) {
		const text = read(filePath)
		if (text !== undefined) {
			add(filePath, scanConfigFile(filePath, text))
		}
	}
	for (const filePath of input.javaFiles.filter((p) => toSlash(p).includes("/src/main/java/"))) {
		const text = read(filePath)
		if (text !== undefined) {
			add(filePath, scanJava(text))
		}
	}
	for (const { filePath, text } of input.buildFiles) {
		add(filePath, scanBuildFile(filePath, text))
	}

	return { findings, warnings: crossWarnings(input, findings) }
}

/**
 * DAO / Mapper 레이어로 수집되지 않은 .java 중 데이터 접근 타입(SqlSessionTemplate·SqlMapClient·JdbcTemplate·
 * NamedParameterJdbcTemplate·EntityManager)을 주석 밖에서 직접 쓰는 파일. DAO 수집 집합과 DAO.java·Dao.java·Mapper.java
 * 접미어 파일은 뺀다. relativePath는 projectPath 기준 상대 경로(구분자 "/").
 */
export function findUnclassifiedDataAccessFiles(
	javaFiles: string[],
	daoFilePaths: ReadonlySet<string>,
	readFile: ReadFile,
	projectPath: string,
): UnclassifiedDataAccessFile[] {
	const unclassified: UnclassifiedDataAccessFile[] = []
	for (const filePath of javaFiles) {
		const fileName = baseName(filePath)
		if (daoFilePaths.has(filePath) || DAO_LAYER_FILE_SUFFIXES.some((suffix) => fileName.endsWith(suffix))) {
			continue
		}
		let text: string
		try {
			text = readFile(filePath)
		} catch {
			continue
		}
		const match = UNCLASSIFIED_TOKEN.exec(stripJavaComments(text))
		if (match) {
			unclassified.push({
				filePath,
				fileName,
				relativePath: toSlash(path.relative(projectPath, filePath)),
				evidence: match[1],
			})
		}
	}
	return unclassified
}
