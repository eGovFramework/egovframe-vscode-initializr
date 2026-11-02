import * as fs from "fs"
import * as path from "path"
import { spawn } from "child_process"
import type {
	ArchCheckResult,
	ArchCheckResults,
	ArchCheckSummary,
	ArchLayer,
	DaoStyle,
	ProjectCheckSummary,
	RuntimeGeneration,
} from "../shared/archCheck"
import { projectReportRows } from "../shared/archCheckReport"
import { BUILD_FILE_PATTERNS, checkProjectBuild, generationForFile } from "./buildFileCheck"
import {
	DATA_ACCESS_BUILD_FILE_NAMES,
	DATA_ACCESS_CONFIG_PATTERNS,
	findUnclassifiedDataAccessFiles,
	isDataAccessConfigPath,
	scanDataAccessConfig,
} from "./dataAccessConfigScan"
import { checkDaoLayer, type DaoLayerOutcome, type SourceContext } from "./daoCheck"
import { buildJavaIndex, resolveTypeReference, type JavaIndex, type ReadFile } from "./javaIndex"
import { collectImports, createCachedReader, readPackage, stripJavaComments } from "./javaSource"

// 결과 타입은 웹뷰·메시지 계약과 공유하므로 src/shared/archCheck.ts에 정의한다
export type { ArchCheckResult, ArchCheckResults, ArchCheckSummary } from "../shared/archCheck"

/** 점검 실행 옵션 */
export interface ArchCheckOptions {
	/**
	 * ripgrep 실행 파일 경로. 확장 호스트가 VS Code에 설치된 rg를 src/utils/ripgrepPath.ts로 찾아
	 * 넘긴다. 없거나 존재하지 않으면 fs 재귀 탐색으로 대체한다.
	 */
	rgPath?: string
	/**
	 * 실행환경 세대 수동 지정. 주면 빌드 파일 점검(project)과 DAO / Mapper 레이어의 check3(Version)를
	 * 그 세대 기준으로 판정하고, 없으면 빌드 파일에서 판정한 세대(파일이 속한 모듈 → 프로젝트)를 쓴다.
	 */
	runtimeGeneration?: RuntimeGeneration
}

/**
 * 파일 수집에서 제외하는 디렉터리 이름 (빌드 산출물·의존성).
 * ripgrep 경로와 fs 대체 경로 모두에 같은 규칙을 적용해 두 경로의 결과가 같도록 한다.
 * 숨김 디렉터리(.으로 시작, .git 포함)와 src 아래의 테스트 소스(src/test·src/it)는 별도로 항상 제외한다.
 */
export const EXCLUDED_DIRECTORY_NAMES = ["node_modules", "target", "build", "out", "dist"] as const

/** src 바로 아래에서 제외하는 테스트 소스 디렉터리 이름 (Maven/Gradle 관례: src/test, src/it) */
const TEST_SOURCE_DIRECTORY_NAMES: readonly string[] = ["test", "it"]

/** DAO / Mapper 통합 레이어로 모으는 파일 이름 접미어 */
const DAO_LAYER_FILE_SUFFIXES = ["DAO.java", "Dao.java", "Mapper.java"]

/**
 * 수집에서 건너뛸 디렉터리인지 — 숨김(.으로 시작) ∨ EXCLUDED_DIRECTORY_NAMES ∨ src 바로 아래의 test·it
 * (fs 경로의 판정이며, ripgrep 경로는 같은 규칙을 제외 글롭으로 준다)
 */
export function shouldSkipDirectory(parentDirName: string, dirName: string): boolean {
	if (dirName.startsWith(".") || (EXCLUDED_DIRECTORY_NAMES as readonly string[]).includes(dirName)) {
		return true
	}
	return parentDirName === "src" && TEST_SOURCE_DIRECTORY_NAMES.includes(dirName)
}

/**
 * 주어진 ripgrep 실행 파일 경로가 실제로 존재하는지 확인
 */
function isRipgrepAvailable(rgPath: string | undefined): rgPath is string {
	try {
		return typeof rgPath === "string" && rgPath.length > 0 && fs.existsSync(rgPath)
	} catch {
		return false
	}
}

/** 파일 이름 매처: suffix는 접미어 일치, exact는 정확한 이름 일치 (둘 다 대소문자 구분) */
type FileNameMatcher = { suffix?: string; exact?: string }

/** 패턴 "*X"는 접미어 X, 그 외는 정확한 파일 이름 */
function toFileNameMatcher(pattern: string): FileNameMatcher {
	return pattern.startsWith("*") ? { suffix: pattern.replace(/^\*+/, "") } : { exact: pattern }
}

function matchesFileName(fileName: string, matchers: FileNameMatcher[]): boolean {
	return matchers.some((m) => (m.suffix !== undefined ? fileName.endsWith(m.suffix) : fileName === m.exact))
}

/**
 * ripgrep을 사용하여 패턴과 매칭되는 파일 목록을 가져옴
 * - 글롭은 파일 이름 기준이며 대소문자를 구분한다 (여러 패턴은 OR)
 * - .gitignore·.ignore는 따르지 않는다(--no-ignore): fs 경로와 같은 파일 집합을 얻기 위함
 * - 숨김 디렉터리는 ripgrep 기본 동작으로, 빌드 산출물 디렉터리와 src/test·src/it는 제외 글롭으로 건너뛴다
 * - 종료 코드 0(매칭 있음)일 때만 목록을 쓰고, 1(매칭 없음)·2(오류)·spawn 실패는 빈 목록
 */
function findFilesWithRipgrep(rgPath: string, projectPath: string, patterns: string[]): Promise<string[]> {
	return new Promise((resolve) => {
		const args = ["--files", "--no-ignore"]
		for (const pattern of patterns) {
			args.push("--glob", pattern)
		}
		for (const dir of EXCLUDED_DIRECTORY_NAMES) {
			args.push("--glob", `!**/${dir}`)
		}
		for (const dir of TEST_SOURCE_DIRECTORY_NAMES) {
			args.push("--glob", `!**/src/${dir}/**`)
		}
		// rg는 제외 글롭을 "프로세스 cwd를 뗀 나머지 경로"에 맞춘다. cwd를 프로젝트의 부모로 두고 검색 경로를 그 cwd 기준
		// 상대 경로(프로젝트 디렉터리 이름)로 넘겨, 글롭이 프로젝트 상위 경로의 src/test·src/it에는 걸리지 않게 한다
		// (fs 경로의 shouldSkipDirectory와 같은 결과). 절대 경로를 넘기면 cwd가 심볼릭 링크를 거칠 때(macOS /var → /private/var)
		// 접두어가 떼어지지 않아 절대 경로 전체가 매칭되고, cwd를 프로젝트 자신으로 두면 루트 이름이 src일 때 src/test가 제외되지 않는다.
		// 검색 경로 앞에 `--`로 옵션 끝을 명시한다: 디렉터리 이름이 `-x`·`-L`처럼 `-`로 시작하면 rg가 옵션으로 읽어
		// 프로젝트 밖(cwd 전체)을 훑거나 심볼릭 링크를 따라가게 된다
		const absoluteProjectPath = path.resolve(projectPath)
		const cwd = path.dirname(absoluteProjectPath)
		args.push("--", path.relative(cwd, absoluteProjectPath) || ".")
		const rg = spawn(rgPath, args, { cwd, stdio: ["ignore", "pipe", "ignore"] })

		let output = ""

		rg.stdout?.on("data", (data) => {
			output += data.toString()
		})

		rg.on("close", (code) => {
			if (code === 0) {
				const files = output
					.trim()
					.split("\n")
					.filter((f) => f.length > 0)
					.map((f) => path.resolve(cwd, f))
				resolve(files)
			} else {
				console.log(`No files found matching patterns: ${patterns.join(", ")}`)
				resolve([])
			}
		})

		rg.on("error", (error) => {
			console.error(`Error running ripgrep: ${error.message}`)
			resolve([])
		})
	})
}

/**
 * fallback: fs를 사용한 파일 찾기 (ripgrep 바이너리가 없는 경우)
 * - 파일 이름이 매처(접미어 또는 정확한 이름)에 맞는 파일만 고른다 (대소문자 구분)
 * - shouldSkipDirectory에 걸리는 디렉터리는 들어가지 않고, 숨김 파일은 고르지 않는다 (ripgrep 기본 동작과 같음)
 * - 심볼릭 링크는 따라가지 않는다 (ripgrep 기본 동작과 같음)
 */
function findFilesWithFs(dirPath: string, matchers: FileNameMatcher[]): string[] {
	const results: string[] = []
	const dirName = path.basename(dirPath)

	try {
		const entries = fs.readdirSync(dirPath, { withFileTypes: true })

		for (const entry of entries) {
			if (entry.isSymbolicLink()) {
				continue
			}
			const fullPath = path.join(dirPath, entry.name)

			if (entry.isFile()) {
				if (!entry.name.startsWith(".") && matchesFileName(entry.name, matchers)) {
					results.push(fullPath)
				}
			} else if (entry.isDirectory()) {
				if (shouldSkipDirectory(dirName, entry.name)) {
					continue
				}
				// 재귀적으로 하위 디렉토리 탐색
				results.push(...findFilesWithFs(fullPath, matchers))
			}
		}
	} catch (error) {
		console.error(`Error reading directory ${dirPath}:`, error)
	}

	return results
}

/**
 * 프로젝트에서 패턴에 맞는 파일을 모든 레이어 공통 수집 규칙으로 모은다 (정렬된 절대 경로 목록).
 * rgPath가 존재하는 파일이면 ripgrep으로, 아니면 fs 재귀 탐색으로 모으며 두 경로는 같은 파일 집합을 돌려준다.
 * - pattern "*X"는 파일 이름 접미어 X, 그 외는 정확한 파일 이름 (예: "*.java", "pom.xml")
 * - 숨김 디렉터리·EXCLUDED_DIRECTORY_NAMES·src/test·src/it 아래는 제외, .gitignore·.ignore는 따르지 않는다
 */
export async function collectProjectFiles(projectPath: string, patterns: string[], rgPath?: string): Promise<string[]> {
	const files = isRipgrepAvailable(rgPath)
		? await findFilesWithRipgrep(rgPath, projectPath, patterns)
		: findFilesWithFs(projectPath, patterns.map(toFileNameMatcher))
	return files.sort()
}

/**
 * 주석이 아닌 라인에서 패턴 찾기
 */
function findPatternIgnoringComments(lines: string[], pattern: string): boolean {
	for (const line of lines) {
		const trimmed = line.trim()
		// 주석이 아닌 라인에서만 패턴 찾기
		if (!trimmed.startsWith("//") && !trimmed.startsWith("/*") && !trimmed.startsWith("*")) {
			if (trimmed.includes(pattern)) {
				return true
			}
		}
	}
	return false
}

/**
 * 주석이 아닌 라인에서 정규식 패턴 찾기
 */
function findRegexPatternIgnoringComments(lines: string[], pattern: RegExp): boolean {
	for (const line of lines) {
		const trimmed = line.trim()
		// 주석이 아닌 라인에서만 패턴 찾기
		if (!trimmed.startsWith("//") && !trimmed.startsWith("/*") && !trimmed.startsWith("*")) {
			if (pattern.test(trimmed)) {
				return true
			}
		}
	}
	return false
}

/**
 * Controller 검사 결과 인터페이스
 */
interface ControllerCheckResult {
	hasControllerAnnotation: boolean
	hasAllMappings: boolean
	/** 점검 대상 public 메서드 수 */
	methodCount: number
	/** 매핑 어노테이션이 붙은 public 메서드 수 */
	mappedMethodCount: number
	/** 클래스 레벨 @RequestMapping 존재 여부 */
	hasClassLevelMapping: boolean
}

/**
 * Controller 파일의 전체 검증 (클래스 annotation + 메서드별 mapping annotation)
 * 1. 클래스에 @Controller 또는 @RestController annotation이 있는지 확인 (주석 제외)
 * 2. 각 public 메서드에 mapping annotation이 있는지 확인 (주석 제외)
 *    - 클래스 레벨에 @RequestMapping이 있으면 메서드 레벨 mapping은 선택 사항
 *    - 메서드 레벨에만 mapping이 있어도 OK
 */
function checkControllerMethods(filePath: string, readFile: ReadFile): ControllerCheckResult {
	const result: ControllerCheckResult = {
		hasControllerAnnotation: false,
		hasAllMappings: false,
		methodCount: 0,
		mappedMethodCount: 0,
		hasClassLevelMapping: false,
	}

	try {
		const content = readFile(filePath)
		const lines = content.split("\n")

		// 1. 클래스 레벨의 @Controller annotation 확인 (주석 제외)
		const hasControllerAnnotation = findPatternIgnoringComments(lines, "@Controller")
		const hasRestControllerAnnotation = findPatternIgnoringComments(lines, "@RestController")

		result.hasControllerAnnotation = hasControllerAnnotation || hasRestControllerAnnotation

		if (!result.hasControllerAnnotation) {
			console.log(
				`❌ ${path.basename(filePath)} is missing @Controller or @RestController annotation (or it's commented out)`,
			)
		}

		// 2. 클래스 레벨 @RequestMapping 확인 (있으면 메서드 레벨 mapping은 선택 사항)
		const hasClassLevelRequestMapping = checkClassLevelRequestMapping(lines)
		result.hasClassLevelMapping = hasClassLevelRequestMapping
		if (hasClassLevelRequestMapping) {
			console.log(`✅ ${path.basename(filePath)} has class-level @RequestMapping`)
		}

		// 3. 메서드별 mapping annotation 검사
		// mapping annotation 패턴들
		const mappingAnnotations = [
			"@RequestMapping",
			"@GetMapping",
			"@PostMapping",
			"@PutMapping",
			"@DeleteMapping",
			"@PatchMapping",
		]

		let allMethodsHaveMapping = true
		let methodCount = 0
		let methodsWithMapping = 0

		// 각 라인을 순회하면서 public 메서드를 찾고 그 위에 mapping annotation이 있는지 확인
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim()

			// public 메서드 정의인지 확인 (간단한 패턴)
			// public으로 시작하고 괄호가 있으면 메서드로 간주
			if (line.includes("public ") && line.includes("(")) {
				// 주석이나 문자열 안의 public은 제외
				if (line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) {
					continue
				}

				// public class나 public interface는 제외
				if (
					line.includes("public class") ||
					line.includes("public interface") ||
					line.includes("public enum") ||
					line.includes("public @interface")
				) {
					continue
				}

				methodCount++
				const methodMatch = line.match(/public\s+(?:[\w<>\[\],\s]+\s+)?(\w+)\s*\(/)
				const methodName = methodMatch ? methodMatch[1] : "unknown"

				// 현재 메서드 바로 위부터 역순으로 확인하여 mapping annotation 찾기
				let hasMappingAnnotation = false
				for (let j = i - 1; j >= Math.max(0, i - 15); j--) {
					const prevLine = lines[j].trim()

					// 빈 줄은 스킵
					if (prevLine.length === 0) {
						continue
					}

					// 다른 메서드의 닫는 괄호를 만나면 중단 (annotation 범위 벗어남)
					if (prevLine === "}" || prevLine.startsWith("}")) {
						break
					}

					// 다른 메서드를 만나면 중단 (annotation 범위 벗어남)
					if (prevLine.includes("public ") && prevLine.includes("(") && !prevLine.startsWith("//")) {
						break
					}

					// 클래스/인터페이스 선언을 만나면 중단
					if (prevLine.includes("class ") || prevLine.includes("interface ") || prevLine.includes("enum ")) {
						break
					}

					// 주석이 아닌 경우에만 mapping annotation 확인
					if (!prevLine.startsWith("//") && !prevLine.startsWith("/*") && !prevLine.startsWith("*")) {
						if (mappingAnnotations.some((annotation) => prevLine.includes(annotation))) {
							hasMappingAnnotation = true
							break
						}
					}
				}

				if (hasMappingAnnotation) {
					methodsWithMapping++
				} else if (!hasClassLevelRequestMapping) {
					// 클래스 레벨 @RequestMapping이 없는 경우에만 메서드 레벨 매핑 필수
					console.log(`❌ Method '${methodName}' in ${path.basename(filePath)} is missing mapping annotation`)
					allMethodsHaveMapping = false
				}
			}
		}

		result.methodCount = methodCount
		result.mappedMethodCount = methodsWithMapping

		// Mapping 검증 로직:
		// 1. 클래스 레벨에 @RequestMapping이 있으면 OK
		// 2. 또는 모든 메서드에 mapping annotation이 있으면 OK
		// 3. 또는 최소 1개 이상의 메서드에 mapping이 있으면 OK (일부 메서드는 내부용일 수 있음)
		if (methodCount === 0) {
			// Controller인데 public 메서드가 없으면 mapping 검사는 불필요하지만 경고
			console.log(`⚠️ No public methods found in ${path.basename(filePath)}`)
			result.hasAllMappings = hasClassLevelRequestMapping // 클래스 레벨 매핑이 있으면 OK
		} else if (hasClassLevelRequestMapping) {
			// 클래스 레벨 @RequestMapping이 있으면 OK
			result.hasAllMappings = true
		} else if (methodsWithMapping > 0) {
			// 최소 1개 이상의 메서드에 mapping이 있으면 OK
			result.hasAllMappings = true
			console.log(`✅ ${methodsWithMapping}/${methodCount} methods in ${path.basename(filePath)} have mapping annotations`)
		} else {
			result.hasAllMappings = false
		}

		console.log(
			`✅ Controller checks for ${path.basename(filePath)}: @Controller=${result.hasControllerAnnotation}, Mapping=${result.hasAllMappings}`,
		)
		return result
	} catch (error) {
		console.error(`Error checking controller methods in ${filePath}:`, error)
		return result
	}
}

/**
 * 클래스 레벨 @RequestMapping 확인
 * 클래스 선언 전에 @RequestMapping이 있는지 확인
 */
function checkClassLevelRequestMapping(lines: string[]): boolean {
	let foundClassDeclaration = false

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim()

		// 주석 무시
		if (line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) {
			continue
		}

		// 클래스 선언을 찾으면 그 전까지의 @RequestMapping만 클래스 레벨
		if (line.includes("class ") && line.includes("{")) {
			foundClassDeclaration = true
			// 클래스 선언 이전 라인들에서 @RequestMapping 찾기
			for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
				const prevLine = lines[j].trim()
				if (prevLine.startsWith("//") || prevLine.startsWith("/*") || prevLine.startsWith("*")) {
					continue
				}
				if (prevLine.includes("@RequestMapping")) {
					return true
				}
				// 다른 어노테이션이 아닌 다른 코드를 만나면 중단
				if (prevLine.length > 0 && !prevLine.startsWith("@") && !prevLine.startsWith("public")) {
					break
				}
			}
			break
		}
	}

	return false
}

/** Controller·Service 점검이 공유하는 프로젝트 문맥: 수집된 .java의 FQCN 색인과 경로별 읽기 캐시 */
interface JavaProjectContext {
	index: JavaIndex
	readFile: ReadFile
}

/** 파일 내용에서 이름 해석에 쓸 package 선언과 import 목록을 읽는다 */
function sourceContextOf(content: string): SourceContext {
	const stripped = stripJavaComments(content)
	return { package: readPackage(stripped), imports: collectImports(stripped) }
}

/**
 * 부모 클래스의 단순 이름으로 프로젝트 색인에서 부모 파일을 찾는다.
 * 자식 파일의 package·import로 해석하고(단일 import → 같은 패키지 → 와일드카드 → 유일한 단순 이름), 해석되지 않으면
 * 종전의 파일 이름 탐색과 같이 이름이 같은 첫 후보(정렬된 경로 순)를 쓴다. 색인은 collectProjectFiles가 projectPath
 * 아래에서 모은 파일만 담으므로 프로젝트 밖·심볼릭 링크 너머·src/test 아래의 파일은 찾지 않고, 디렉터리를 다시 훑지 않는다.
 */
function findParentClassFile(index: JavaIndex, from: SourceContext, parentClassName: string): string | null {
	const resolved = resolveTypeReference(index, from, parentClassName)
	if (resolved.kind === "resolved") {
		return resolved.entry.filePath
	}
	const candidates = index.bySimpleName.get(parentClassName)
	return candidates && candidates.length > 0 ? candidates[0].filePath : null
}

/**
 * 주석이 아닌 줄에서 `extends <부모 클래스명>`의 부모 클래스 단순 이름을 찾는다.
 * 제네릭 인자(`extends Base<T>`)와 완전 한정 이름(`extends a.b.Base`)은 마지막 식별자만 취한다.
 */
function findExtendsParentIgnoringComments(lines: string[]): string | null {
	for (const line of lines) {
		const trimmed = line.trim()
		if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
			continue
		}
		const match = trimmed.match(/\bextends\s+([\w.]+)/)
		if (match) {
			const segments = match[1].split(".")
			return segments[segments.length - 1]
		}
	}
	return null
}

/**
 * 부모 클래스 파일에서 특정 클래스를 상속받는지 확인 (재귀적 상속 체인 추적)
 * maxDepth를 통해 무한 루프를 방지하며, 다단계 상속도 추적 가능
 */
function checkParentClassExtends(
	ctx: JavaProjectContext,
	from: SourceContext,
	parentClassName: string,
	targetClassName: string,
	maxDepth: number = 5,
): boolean {
	if (maxDepth <= 0) {
		return false
	}

	try {
		// 프로젝트 색인에서 부모 클래스 파일 찾기
		const parentFilePath = findParentClassFile(ctx.index, from, parentClassName)

		if (!parentFilePath) {
			console.log(`⚠️ Parent class file '${parentClassName}.java' not found in project`)
			return false
		}

		// 부모 클래스 파일 읽기 (읽기 캐시 공유)
		const content = ctx.readFile(parentFilePath)
		const lines = content.split("\n")

		// 대상 클래스를 직접 상속하는지 확인
		const extendsPattern = new RegExp(`extends.*${targetClassName}`)
		const hasExtends = findRegexPatternIgnoringComments(lines, extendsPattern)

		if (hasExtends) {
			console.log(`✅ Parent class '${parentClassName}' extends '${targetClassName}': true`)
			return true
		}

		// 직접 상속이 아닌 경우, 부모의 부모 클래스를 재귀적으로 추적 (주석에 적힌 extends는 무시)
		const grandParentClassName = findExtendsParentIgnoringComments(lines)
		if (grandParentClassName) {
			// 프레임워크 기본 클래스가 아니라면 계속 추적
			if (grandParentClassName !== targetClassName && grandParentClassName !== "Object") {
				console.log(`🔍 Tracing inheritance: ${parentClassName} → ${grandParentClassName} → ... → ${targetClassName}?`)
				return checkParentClassExtends(ctx, sourceContextOf(content), grandParentClassName, targetClassName, maxDepth - 1)
			}
		}

		console.log(`✅ Parent class '${parentClassName}' extends '${targetClassName}': false`)
		return false
	} catch (error) {
		console.error(`Error checking parent class ${parentClassName}:`, error)
		return false
	}
}

/**
 * 주석이 아닌 줄을 이어 붙인 문자열에서 점검 대상 클래스의 선언부를 돌려준다.
 * 선언부는 `class <클래스명>`부터 첫 `{` 직전까지이며, 파일 이름과 같은 클래스를 우선 찾고
 * 없으면 첫 class 선언을 쓴다. 선언부 밖(필드·메서드 본문)은 판정에 쓰지 않는다.
 */
function extractClassDeclaration(lines: string[], className: string): string | null {
	const joined = lines
		.map((l) => l.trim())
		.filter((l) => l.length > 0 && !l.startsWith("//") && !l.startsWith("/*") && !l.startsWith("*"))
		.join(" ")
	const escaped = className.replace(/[$]/g, "\\$&")
	let start = joined.search(new RegExp(`\\bclass\\s+${escaped}\\b`))
	if (start === -1) {
		start = joined.search(/\bclass\s+\w+/)
	}
	if (start === -1) {
		return null
	}
	const brace = joined.indexOf("{", start)
	return brace === -1 ? joined.slice(start) : joined.slice(start, brace)
}

/** 꺾쇠(제네릭) 깊이가 0인 쉼표에서만 나눈다: `Comparator<Map<String, Object>>, FooService` → 2항목 */
function splitTopLevelCommas(list: string): string[] {
	const items: string[] = []
	let depth = 0
	let current = ""
	for (const ch of list) {
		if (ch === "<") {
			depth++
		} else if (ch === ">") {
			depth = Math.max(0, depth - 1)
		} else if (ch === "," && depth === 0) {
			items.push(current)
			current = ""
			continue
		}
		current += ch
	}
	items.push(current)
	return items
}

/** 제네릭 인자(`<...>`)를 떼고 패키지 경로를 뗀 단순 타입 이름을 돌려준다: `a.b.FooService<T>` → `FooService` */
function toSimpleTypeName(typeText: string): string {
	let depth = 0
	let stripped = ""
	for (const ch of typeText) {
		if (ch === "<") {
			depth++
		} else if (ch === ">") {
			depth = Math.max(0, depth - 1)
		} else if (depth === 0) {
			stripped += ch
		}
	}
	const segments = stripped.trim().split(".")
	return segments[segments.length - 1]
}

/**
 * 클래스 선언부의 implements 목록에 단순 이름이 `Service`로 끝나는 인터페이스가 하나 이상 있는지 확인한다.
 * `implements Serializable` 뒤 본문 어딘가의 "Service" 문자열이나 주입 필드 타입은 보지 않는다.
 */
function implementsServiceInterface(lines: string[], className: string): boolean {
	const declaration = extractClassDeclaration(lines, className)
	if (!declaration) {
		return false
	}
	const match = declaration.match(/\bimplements\s+(.+)$/)
	if (!match) {
		return false
	}
	return splitTopLevelCommas(match[1]).some((item) => /Service$/.test(toSimpleTypeName(item)))
}

/**
 * Service 파일의 검증 (주석 제외)
 * 1. extends EgovAbstractServiceImpl 확인
 *    - 직접 상속이 아니면 부모 클래스(프로젝트마다 이름이 다른 공통 ServiceImpl 등)의 .java를
 *      프로젝트 .java 색인에서 찾아 EgovAbstractServiceImpl까지 상속 체인을 추적
 * 2. @Service annotation 확인
 * 3. 클래스 선언부의 implements 목록에 Service로 끝나는 인터페이스가 있는지 확인
 */
function checkServiceFile(filePath: string, ctx: JavaProjectContext): boolean[] {
	try {
		const content = ctx.readFile(filePath)
		const lines = content.split("\n")

		// 1. extends 체크
		const hasExtendsAbstract = findRegexPatternIgnoringComments(lines, /extends.*EgovAbstractServiceImpl/)

		let extendsCheck = false
		if (hasExtendsAbstract) {
			// 직접 EgovAbstractServiceImpl을 상속한 경우
			extendsCheck = true
			console.log(`✅ ${path.basename(filePath)} directly extends EgovAbstractServiceImpl`)
		} else {
			// 다른 클래스를 상속한 경우, 그 부모 클래스가 EgovAbstractServiceImpl을 상속하는지 체인을 추적
			const parentClassName = findExtendsParentIgnoringComments(lines)
			if (parentClassName && parentClassName !== "Object") {
				const parentExtendsAbstract = checkParentClassExtends(
					ctx,
					sourceContextOf(content),
					parentClassName,
					"EgovAbstractServiceImpl",
				)
				extendsCheck = parentExtendsAbstract
				console.log(
					`${parentExtendsAbstract ? "✅" : "❌"} ${path.basename(filePath)} extends ${parentClassName}, which extends EgovAbstractServiceImpl: ${parentExtendsAbstract}`,
				)
			} else {
				console.log(`❌ ${path.basename(filePath)} does not extend EgovAbstractServiceImpl`)
			}
		}

		// 2. @Service annotation (주석 제외)
		const hasServiceAnnotation = findPatternIgnoringComments(lines, "@Service")

		// 3. 클래스 선언부의 implements 목록에 Service 인터페이스가 있는지 확인 (주석 제외, 여러 줄 선언 포함)
		const hasImplements = implementsServiceInterface(lines, path.basename(filePath, ".java"))

		console.log(
			`✅ Service checks for ${path.basename(filePath)}: extends=${extendsCheck}, @Service=${hasServiceAnnotation}, implements=${hasImplements}`,
		)

		return [extendsCheck, hasServiceAnnotation, hasImplements]
	} catch (error) {
		console.error(`Error checking service file ${filePath}:`, error)
		return [false, false, false]
	}
}

/**
 * 주입(필드·생성자/메서드 매개변수·지역 선언)된 타입 이름 패턴
 * - 단어 경계에서 시작하는 대문자 타입 이름만 본다 (mySampleDAO 같은 변수 이름의 일부는 제외)
 * - 패키지 경로를 다 적은 완전 한정 이름(egov.sample.SampleDAO sampleDAO)도 마지막 조각으로 매칭
 * - 타입 뒤에 식별자가 오고 ; = , ) 또는 줄 끝으로 끝나는 선언만 매칭
 */
const INJECTED_TYPE_PATTERN = /\b([A-Z]\w*(?:DAO|Dao|Mapper))\s+[A-Za-z_$][\w$]*\s*(?:[;=,)]|$)/g

/**
 * Controller가 DAO 역할의 타입을 주입받는지 확인 (주석 제외)
 * - *DAO / *Dao 타입은 항상 DAO로 본다
 * - *Mapper 타입은 DAO 레이어 판정 대상(제외 목록 제외)에 같은 이름이 있을 때만 DAO(MyBatis 매퍼)로 본다
 *   (ObjectMapper 같은 라이브러리 타입을 오탐하지 않기 위함)
 */
function checkDaoInjection(filePath: string, daoTypeNames: ReadonlySet<string>, readFile: ReadFile): boolean {
	try {
		const content = readFile(filePath)
		const lines = content.split("\n")

		for (const rawLine of lines) {
			const line = rawLine.trim()
			if (line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) {
				continue
			}
			for (const match of line.matchAll(INJECTED_TYPE_PATTERN)) {
				const typeName = match[1]
				const isDao = /(?:DAO|Dao)$/.test(typeName) || daoTypeNames.has(typeName)
				if (isDao) {
					console.log(`❌ ${path.basename(filePath)} injects DAO-role type '${typeName}'`)
					return true
				}
			}
		}
		return false
	} catch (error) {
		console.error(`Error checking DAO injection in ${filePath}:`, error)
		return false
	}
}

/**
 * 파일이 abstract class인지 확인 (주석 제외)
 * abstract class는 직접 인스턴스화되지 않는 기반 클래스이므로 아키텍처 점검 대상에서 제외
 */
function isAbstractClass(filePath: string, readFile: ReadFile): boolean {
	try {
		const content = readFile(filePath)
		const lines = content.split("\n")
		return findRegexPatternIgnoringComments(lines, /\babstract\s+class\b/)
	} catch {
		return false
	}
}

/**
 * Controller 또는 Service 레이어의 파일 목록을 점검한다
 * context.index·readFile: 프로젝트 .java 색인과 읽기 캐시 (Service 상속 체인의 부모 파일 조회와 모든 파일 읽기에 쓴다)
 * context.daoTypeNames: Controller "DAO X" 검사에 쓸 DAO 레이어 판정 대상 타입 이름
 */
function checkLayer(
	fileList: string[],
	layerType: "Controller" | "Service",
	context: JavaProjectContext & { daoTypeNames?: ReadonlySet<string> },
): ArchCheckResult[] {
	const results: ArchCheckResult[] = []
	const { readFile } = context
	const daoTypeNames = context.daoTypeNames ?? new Set<string>()

	try {
		for (const filePath of fileList) {
			const fileName = path.basename(filePath)
			const parentPath = path.dirname(filePath)

			// abstract class는 점검 대상에서 제외 (기반 클래스이므로 어노테이션/매핑이 없는 것이 정상)
			if (isAbstractClass(filePath, readFile)) {
				console.log(`⏭️ Skipping abstract class: ${fileName}`)
				continue
			}

			// 각 패턴별로 검사 (주석 제외 처리)
			let checks: boolean[]
			// Controller 전용 상세 집계 (매핑된 메서드 수 / 점검 대상 메서드 수 / 클래스 레벨 매핑 여부)
			let methodCounts: Pick<ArchCheckResult, "mappedMethodCount" | "methodCount" | "hasClassLevelMapping"> = {}

			if (layerType === "Controller") {
				const controllerResult = checkControllerMethods(filePath, readFile)
				// check3 'DAO X'는 소극 조건: DAO 역할 타입을 주입받지 않아야 통과
				const injectsDao = checkDaoInjection(filePath, daoTypeNames, readFile)
				checks = [controllerResult.hasControllerAnnotation, controllerResult.hasAllMappings, !injectsDao]
				methodCounts = {
					mappedMethodCount: controllerResult.mappedMethodCount,
					methodCount: controllerResult.methodCount,
					hasClassLevelMapping: controllerResult.hasClassLevelMapping,
				}
			} else {
				checks = checkServiceFile(filePath, context)
			}

			// 결과 판정: Controller·Service 모두 세 항목이 모두 통과해야 OK
			const result: "OK" | "NotFound" = checks[0] && checks[1] && checks[2] ? "OK" : "NotFound"

			results.push({
				filePath,
				fileName,
				parentPath,
				check1: checks[0] || false,
				check2: checks[1] || false,
				check3: checks[2] || false,
				result,
				type: layerType,
				...methodCounts,
			})
		}
	} catch (error) {
		console.error(`Error checking ${layerType} layer:`, error)
	}

	return results
}

/** 레이어 결과 목록을 요약(전체·통과·실패 수)으로 묶는다 */
function summarize(results: ArchCheckResult[]): ArchCheckSummary {
	const passedFiles = results.filter((r) => r.result === "OK").length
	return { totalFiles: results.length, passedFiles, failedFiles: results.length - passedFiles, results }
}

/**
 * 전체 아키텍처 점검 실행
 * options.rgPath에 존재하는 ripgrep 실행 파일을 주면 ripgrep으로, 아니면 fs 재귀 탐색으로 파일을 모은다.
 * .java 파일은 한 번만 모아 색인하고, 레이어별 파일은 그 목록에서 파일 이름 접미어로 거른다.
 * 순서: 빌드 파일(project — DAO check3 세대의 입력) → DAO / Mapper(판정 대상 타입 이름이 Controller "DAO X"의 입력)
 * → 데이터 접근 설정 정보(project에 덧붙이는 정보 항목) → Controller → Service
 */
export async function checkEgovArchitecture(
	projectPath: string,
	progressCallback?: (message: string) => void,
	options: ArchCheckOptions = {},
): Promise<ArchCheckResults> {
	const results: ArchCheckResults = {}
	const rgPath = isRipgrepAvailable(options.rgPath) ? options.rgPath : undefined
	const useRipgrep = rgPath !== undefined
	const via = useRipgrep ? " with ripgrep" : ""

	if (useRipgrep) {
		console.log(`🚀 Using ripgrep (${rgPath}) for fast architecture checking`)
	} else {
		console.log("⚠️ ripgrep binary not available, falling back to fs-based search")
	}

	try {
		// 경로별로 한 번만 읽는다 (빌드 파일·.java 공용)
		const readFile = createCachedReader()

		// 1. 빌드 파일 점검 — 모듈별 실행환경 세대·버전, 필수 라이브러리 4종, 버전 일관성
		progressCallback?.(`🔍 Checking project build files${via}...`)
		let project: ProjectCheckSummary
		let buildFiles: string[] = []
		try {
			buildFiles = await collectProjectFiles(projectPath, BUILD_FILE_PATTERNS, rgPath)
			project = checkProjectBuild({
				projectPath,
				files: buildFiles,
				readFile,
				manualGeneration: options.runtimeGeneration,
			})
		} catch (error) {
			console.error("Error checking project build files:", error)
			const message = error instanceof Error ? error.message : String(error)
			project = {
				generation: "unknown",
				versionConsistency: { state: "skipped", versions: [], evidence: `error: ${message}` },
				modules: [],
				result: "Unknown",
			}
		}
		results.project = project

		// 2. .java 수집·색인
		const javaFiles = await collectProjectFiles(projectPath, ["*.java"], rgPath)
		const index = buildJavaIndex(javaFiles, readFile)
		const filesEndingWith = (suffixes: string[]) =>
			javaFiles.filter((filePath) => suffixes.some((suffix) => path.basename(filePath).endsWith(suffix)))
		// 수동 지정이 없으면 파일이 속한 모듈의 세대(속한 모듈이 없으면 프로젝트 세대)로 check3를 판정한다
		const generationOf = (filePath: string) => options.runtimeGeneration ?? generationForFile(filePath, project, projectPath)

		// 3. DAO / Mapper 통합 레이어 점검
		progressCallback?.(`🔍 Checking DAO / Mapper layer${via}...`)
		let daoOutcome: DaoLayerOutcome = { results: [], skipped: [], judgedTypeNames: new Set() }
		try {
			daoOutcome = checkDaoLayer(filesEndingWith(DAO_LAYER_FILE_SUFFIXES), index, readFile, generationOf)
		} catch (error) {
			console.error("Error checking DAO layer:", error)
		}
		results.DAO = { ...summarize(daoOutcome.results), skipped: daoOutcome.skipped }

		// 3-1. 데이터 접근 설정 정보와 미분류 데이터 접근 파일 (정보 항목 — 판정에는 영향 없음)
		progressCallback?.(`🔍 Scanning data access configuration${via}...`)
		try {
			const configFiles = (await collectProjectFiles(projectPath, DATA_ACCESS_CONFIG_PATTERNS, rgPath)).filter(
				isDataAccessConfigPath,
			)
			const buildFileTexts: Array<{ filePath: string; text: string }> = []
			for (const filePath of buildFiles.filter((f) => DATA_ACCESS_BUILD_FILE_NAMES.includes(path.basename(f)))) {
				try {
					buildFileTexts.push({ filePath, text: readFile(filePath) })
				} catch (error) {
					console.error(`Error reading build file ${filePath}:`, error)
				}
			}
			const daoStyles = new Set(daoOutcome.results.map((r) => r.daoStyle))
			project.dataAccessConfig = scanDataAccessConfig({
				projectPath,
				configFiles,
				javaFiles,
				buildFiles: buildFileTexts,
				readFile,
				generation: project.generation,
				version: project.version,
				hasMapperInterfaces: daoStyles.has("mapperInterface"),
				hasIbatisDaos: daoStyles.has("ibatisDao"),
			})
			// DAO 레이어 수집 집합(판정 대상 + 제외 목록)
			const daoFilePaths = new Set([...daoOutcome.results, ...daoOutcome.skipped].map((r) => r.filePath))
			project.unclassifiedDataAccessFiles = findUnclassifiedDataAccessFiles(javaFiles, daoFilePaths, readFile, projectPath)
		} catch (error) {
			console.error("Error scanning data access configuration:", error)
		}

		// 4. Controller 점검 ("DAO X"는 DAO 레이어 판정 대상 타입 이름을 본다)
		progressCallback?.(`🔍 Checking Controller layer${via}...`)
		results.Controller = summarize(
			checkLayer(filesEndingWith(["Controller.java"]), "Controller", {
				index,
				readFile,
				daoTypeNames: daoOutcome.judgedTypeNames,
			}),
		)

		// 5. Service 점검
		progressCallback?.(`🔍 Checking Service layer${via}...`)
		results.Service = summarize(checkLayer(filesEndingWith(["ServiceImpl.java"]), "Service", { index, readFile }))

		progressCallback?.(`✅ Architecture check completed${via}`)
		return results
	} catch (error) {
		console.error("Architecture check error:", error)
		throw error
	}
}

/**
 * 레이어별 CSV 컬럼명 및 사용 여부 반환
 */
function getLayerCheckInfo(layerType: ArchLayer) {
	switch (layerType) {
		case "Controller":
			return {
				columns: ["Path", "FileName", "@Controller", "Mapping Annotation", "DAO X", "Result"],
				used: [true, true, true], // check1, check2, check3 사용 여부
			}
		case "Service":
			return {
				columns: ["Path", "FileName", "Extends EgovAbstractServiceImpl", "@Service", "Implements Service", "Result"],
				used: [true, true, true],
			}
		case "DAO":
			return {
				columns: ["Path", "FileName", "Style", "Base", "Bean", "Version", "Result"],
				used: [true, true, true],
			}
	}
}

/**
 * Check 값을 CSV용으로 포맷팅 (사용하지 않는 체크는 '-'로 표시)
 */
function formatCheckValue(value: boolean, isUsed: boolean): string {
	if (!isUsed) {
		return "-"
	}
	return value ? "PASS" : "FAIL"
}

/**
 * Controller의 Mapping(check2) 열을 CSV용으로 포맷팅 — 웹뷰 Detailed Results와 같은 규칙
 * 실패 FAIL, 클래스 레벨 @RequestMapping으로 통과 'Class level', 일부 메서드만 매핑 'a/b', 전부 매핑 PASS
 */
function formatMappingCheckValue(item: ArchCheckResult): string {
	if (!item.check2) {
		return "FAIL"
	}
	if (item.hasClassLevelMapping) {
		return "Class level"
	}
	if (item.mappedMethodCount !== undefined && item.methodCount !== undefined && item.mappedMethodCount < item.methodCount) {
		return `${item.mappedMethodCount}/${item.methodCount}`
	}
	return "PASS"
}

/** 스프레드시트가 수식으로 해석할 수 있는 셀 머리: `=`·`+`·`@`·탭·CR, 또는 숫자·`.`·끝이 아닌 글자가 뒤따르는 `-` */
const FORMULA_LEADING_PATTERN = /^(?:[=+@\t\r]|-(?![\d.]|$))/

/**
 * CSV 셀 값 이스케이프 — 모든 열(경로·파일 이름 포함)이 이 함수를 거친다
 * - 수식으로 읽힐 수 있는 머리(FORMULA_LEADING_PATTERN)에는 `'`를 붙여 Excel 등에서 수식 주입(CSV injection)을 막는다.
 *   `-` 하나(미사용 열 표시)와 `-5` 같은 음수 표기는 그대로 둔다
 * - 쉼표·큰따옴표·줄바꿈이 있으면 큰따옴표로 감싸고 안의 큰따옴표는 두 번 쓴다
 */
function csvCell(value: string): string {
	const guarded = FORMULA_LEADING_PATTERN.test(value) ? `'${value}` : value
	if (/[,"\n\r]/.test(guarded)) {
		return `"${guarded.replace(/"/g, '""')}"`
	}
	return guarded
}

const DAO_STYLE_LABELS: Record<DaoStyle, string> = {
	ibatisDao: "iBatis DAO",
	mybatisDao: "MyBatis DAO",
	mapperInterface: "Mapper IF",
}

/**
 * DAO / Mapper 레이어의 CSV 행 셀(Path, FileName, Style, Base, Bean, Version, Result)을 만든다
 */
function formatDaoRow(item: ArchCheckResult): string[] {
	const style = item.daoStyle ? DAO_STYLE_LABELS[item.daoStyle] : "-"
	const base = item.check1
		? item.inheritancePath && item.inheritancePath.length > 0
			? `PASS via ${item.inheritancePath.join(" > ")}`
			: "PASS"
		: `FAIL (${item.check1Detail ?? ""})`
	const bean = `${item.check2 ? "PASS" : "FAIL"} (${item.check2Detail ?? ""})`
	let version = "n/a"
	if (item.check3State === "pass") {
		version = `PASS (${item.check3Detail ?? ""})`
	} else if (item.check3State === "fail") {
		version = `FAIL (${item.check3Detail ?? ""})`
	}
	return [item.parentPath, item.fileName, style, base, bean, version, item.result]
}

/**
 * 아키텍처 점검 결과를 CSV 형식으로 저장
 */
function saveReport(resultType: ArchLayer, outputPath: string, resultList: ArchCheckResult[]): void {
	try {
		const layerInfo = getLayerCheckInfo(resultType)

		// CSV 헤더 (컬럼명)
		let csvContent = layerInfo.columns.join(",") + "\n"

		// 각 파일별 결과
		for (const item of resultList) {
			if (resultType === "DAO") {
				csvContent += formatDaoRow(item).map(csvCell).join(",") + "\n"
				continue
			}

			const check1Str = formatCheckValue(item.check1, layerInfo.used[0])
			const check2Str =
				resultType === "Controller" ? formatMappingCheckValue(item) : formatCheckValue(item.check2, layerInfo.used[1])
			const check3Str = formatCheckValue(item.check3, layerInfo.used[2])

			csvContent +=
				[item.parentPath, item.fileName, check1Str, check2Str, check3Str, item.result].map(csvCell).join(",") + "\n"
		}

		fs.writeFileSync(outputPath, csvContent, "utf8")
		console.log(`Report saved to: ${outputPath}`)
	} catch (error) {
		console.error(`Error saving report to ${outputPath}:`, error)
		throw error
	}
}

/**
 * 프로젝트 빌드 점검 결과를 CSV로 저장 — 행 규칙은 웹뷰와 공유하는 projectReportRows를 따른다
 */
function saveProjectReport(outputPath: string, summary: ProjectCheckSummary): void {
	try {
		let csvContent = "Module,Item,Status,Evidence\n"
		for (const row of projectReportRows(summary)) {
			csvContent += [row.module, row.item, row.status, row.evidence].map(csvCell).join(",") + "\n"
		}
		fs.writeFileSync(outputPath, csvContent, "utf8")
		console.log(`Report saved to: ${outputPath}`)
	} catch (error) {
		console.error(`Error saving report to ${outputPath}:`, error)
		throw error
	}
}

const FILE_LAYERS: readonly ArchLayer[] = ["Controller", "Service", "DAO"]

/**
 * 아키텍처 점검 결과를 CSV 파일로 내보내기 — 레이어별 Result_<Layer>_<date>.csv와 Result_Project_<date>.csv
 */
export async function exportArchResults(results: ArchCheckResults, projectPath: string): Promise<void> {
	try {
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0]

		for (const layer of FILE_LAYERS) {
			const summary = results[layer]
			if (summary && summary.results.length > 0) {
				saveReport(layer, path.join(projectPath, `Result_${layer}_${timestamp}.csv`), summary.results)
			}
		}
		if (results.project) {
			saveProjectReport(path.join(projectPath, `Result_Project_${timestamp}.csv`), results.project)
		}

		console.log("All reports exported successfully")
	} catch (error) {
		console.error("Error exporting results:", error)
		throw error
	}
}
