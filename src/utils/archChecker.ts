import * as fs from "fs"
import * as path from "path"
import { spawn } from "child_process"
import type { ArchCheckResult, ArchCheckResults, ArchCheckSummary } from "../shared/archCheck"

// 결과 타입은 웹뷰·메시지 계약과 공유하므로 src/shared/archCheck.ts에 정의한다
export type { ArchCheckResult, ArchCheckResults, ArchCheckSummary } from "../shared/archCheck"

/** 점검 실행 옵션 */
export interface ArchCheckOptions {
	/**
	 * ripgrep 실행 파일 경로. 확장 호스트가 VS Code에 설치된 rg를 src/utils/ripgrepPath.ts로 찾아
	 * 넘긴다. 없거나 존재하지 않으면 fs 재귀 탐색으로 대체한다.
	 */
	rgPath?: string
}

/**
 * 파일 수집에서 제외하는 디렉터리 이름 (빌드 산출물·의존성).
 * ripgrep 경로와 fs 대체 경로 모두에 같은 규칙을 적용해 두 경로의 결과가 같도록 한다.
 * 숨김 디렉터리(.으로 시작, .git 포함)는 별도로 항상 제외한다.
 */
export const EXCLUDED_DIRECTORY_NAMES = ["node_modules", "target", "build", "out", "dist"] as const

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

/**
 * 레이어 글롭(*Controller.java)에서 파일명 접미어(Controller.java)를 얻는다
 */
function globToSuffix(filePattern: string): string {
	return filePattern.replace(/^\*+/, "")
}

/**
 * ripgrep을 사용하여 패턴과 매칭되는 파일 목록을 가져옴
 * - 글롭은 파일 이름 기준이며 대소문자를 구분한다
 * - 숨김 디렉터리는 ripgrep 기본 동작으로, 빌드 산출물 디렉터리는 제외 글롭으로 건너뛴다
 * - 종료 코드 0(매칭 있음)일 때만 목록을 쓰고, 1(매칭 없음)·2(오류)·spawn 실패는 빈 목록
 */
function findFilesWithRipgrep(rgPath: string, projectPath: string, filePattern: string): Promise<string[]> {
	return new Promise((resolve) => {
		const args = ["--files", "--glob", filePattern]
		for (const dir of EXCLUDED_DIRECTORY_NAMES) {
			args.push("--glob", `!**/${dir}`)
		}
		args.push(projectPath)
		const rg = spawn(rgPath, args, { stdio: ["ignore", "pipe", "ignore"] })

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
				resolve(files)
			} else {
				console.log(`No files found matching pattern: ${filePattern}`)
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
 * - 파일 이름이 접미어(Controller.java 등)로 끝나는 파일만 고른다 (대소문자 구분)
 * - 숨김 디렉터리(.git 등)와 EXCLUDED_DIRECTORY_NAMES는 들어가지 않는다
 * - 심볼릭 링크는 따라가지 않는다 (ripgrep 기본 동작과 같음)
 */
function findFilesWithFs(dirPath: string, fileSuffix: string): string[] {
	const results: string[] = []

	try {
		const entries = fs.readdirSync(dirPath, { withFileTypes: true })

		for (const entry of entries) {
			if (entry.isSymbolicLink()) {
				continue
			}
			const fullPath = path.join(dirPath, entry.name)

			if (entry.isFile()) {
				if (entry.name.endsWith(fileSuffix)) {
					results.push(fullPath)
				}
			} else if (entry.isDirectory()) {
				if (entry.name.startsWith(".") || (EXCLUDED_DIRECTORY_NAMES as readonly string[]).includes(entry.name)) {
					continue
				}
				// 재귀적으로 하위 디렉토리 탐색
				results.push(...findFilesWithFs(fullPath, fileSuffix))
			}
		}
	} catch (error) {
		console.error(`Error reading directory ${dirPath}:`, error)
	}

	return results
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
function checkControllerMethods(filePath: string): ControllerCheckResult {
	const result: ControllerCheckResult = {
		hasControllerAnnotation: false,
		hasAllMappings: false,
		methodCount: 0,
		mappedMethodCount: 0,
		hasClassLevelMapping: false,
	}

	try {
		const content = fs.readFileSync(filePath, "utf8")
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

/**
 * 파일 경로에서 Java 소스 루트(src/main/java) 디렉토리를 찾아 반환
 * 패키지 깊이에 관계없이 정확한 소스 루트를 반환
 */
function findSourceRoot(filePath: string): string {
	const srcMainJava = `${path.sep}src${path.sep}main${path.sep}java${path.sep}`
	const idx = filePath.indexOf(srcMainJava)
	if (idx !== -1) {
		return filePath.substring(0, idx + srcMainJava.length)
	}
	// src/main/java를 찾지 못한 경우 fallback: 프로젝트 루트 추정
	const srcMain = `${path.sep}src${path.sep}main${path.sep}`
	const srcIdx = filePath.indexOf(srcMain)
	if (srcIdx !== -1) {
		return filePath.substring(0, srcIdx)
	}
	// 최후의 fallback
	return path.dirname(path.dirname(path.dirname(filePath)))
}

/**
 * 프로젝트 내에서 특정 이름의 Java 파일을 재귀적으로 찾기
 */
function findJavaFile(searchPath: string, fileName: string): string | null {
	try {
		const files = fs.readdirSync(searchPath)
		for (const file of files) {
			const fullPath = path.join(searchPath, file)
			const stat = fs.statSync(fullPath)

			if (stat.isDirectory()) {
				const found = findJavaFile(fullPath, fileName)
				if (found) {
					return found
				}
			} else if (file === fileName) {
				return fullPath
			}
		}
	} catch {
		// 권한 없는 디렉토리는 스킵
	}
	return null
}

/**
 * 부모 클래스 파일에서 특정 클래스를 상속받는지 확인 (재귀적 상속 체인 추적)
 * maxDepth를 통해 무한 루프를 방지하며, 다단계 상속도 추적 가능
 */
function checkParentClassExtends(
	projectPath: string,
	parentClassName: string,
	targetClassName: string,
	maxDepth: number = 5,
): boolean {
	if (maxDepth <= 0) {
		return false
	}

	try {
		// 프로젝트에서 부모 클래스 파일 찾기
		const parentClassFile = `${parentClassName}.java`
		const parentFilePath = findJavaFile(projectPath, parentClassFile)

		if (!parentFilePath) {
			console.log(`⚠️ Parent class file '${parentClassFile}' not found in project`)
			return false
		}

		// 부모 클래스 파일 읽기
		const content = fs.readFileSync(parentFilePath, "utf8")
		const lines = content.split("\n")

		// 대상 클래스를 직접 상속하는지 확인
		const extendsPattern = new RegExp(`extends.*${targetClassName}`)
		const hasExtends = findRegexPatternIgnoringComments(lines, extendsPattern)

		if (hasExtends) {
			console.log(`✅ Parent class '${parentClassName}' extends '${targetClassName}': true`)
			return true
		}

		// 직접 상속이 아닌 경우, 부모의 부모 클래스를 재귀적으로 추적
		const grandParentMatch = content.match(/extends\s+(\w+)/)
		if (grandParentMatch) {
			const grandParentClassName = grandParentMatch[1]
			// 프레임워크 기본 클래스가 아니라면 계속 추적
			if (grandParentClassName !== targetClassName && grandParentClassName !== "Object") {
				console.log(`🔍 Tracing inheritance: ${parentClassName} → ${grandParentClassName} → ... → ${targetClassName}?`)
				return checkParentClassExtends(projectPath, grandParentClassName, targetClassName, maxDepth - 1)
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
 * Service 파일의 검증 (주석 제외)
 * 1. extends EgovAbstractServiceImpl 또는 EgovCommonServiceImpl 확인
 *    - EgovCommonServiceImpl인 경우, 해당 클래스가 EgovAbstractServiceImpl을 상속하는지 체크
 * 2. @Service annotation 확인
 * 3. implements Service interface 확인
 */
function checkServiceFile(filePath: string): boolean[] {
	try {
		const content = fs.readFileSync(filePath, "utf8")
		const lines = content.split("\n")

		// 1. extends 체크 (우선순위: EgovCommonServiceImpl > EgovAbstractServiceImpl)
		const hasExtendsCommon = findRegexPatternIgnoringComments(lines, /extends.*EgovCommonServiceImpl/)
		const hasExtendsAbstract = findRegexPatternIgnoringComments(lines, /extends.*EgovAbstractServiceImpl/)

		let extendsCheck = false
		if (hasExtendsAbstract) {
			// 직접 EgovAbstractServiceImpl을 상속한 경우
			extendsCheck = true
			console.log(`✅ ${path.basename(filePath)} directly extends EgovAbstractServiceImpl`)
		} else if (hasExtendsCommon) {
			// EgovCommonServiceImpl을 상속한 경우, 해당 클래스가 EgovAbstractServiceImpl을 상속하는지 체크
			const projectPath = findSourceRoot(filePath)
			const parentExtendsAbstract = checkParentClassExtends(projectPath, "EgovCommonServiceImpl", "EgovAbstractServiceImpl")
			extendsCheck = parentExtendsAbstract
			console.log(
				`✅ ${path.basename(filePath)} extends EgovCommonServiceImpl, which extends EgovAbstractServiceImpl: ${parentExtendsAbstract}`,
			)
		} else {
			console.log(`❌ ${path.basename(filePath)} does not extend EgovAbstractServiceImpl or EgovCommonServiceImpl`)
		}

		// 2. @Service annotation (주석 제외)
		const hasServiceAnnotation = findPatternIgnoringComments(lines, "@Service")

		// 3. implements Service (주석 제외, 여러 줄에 걸친 클래스 선언도 처리)
		let hasImplements = findRegexPatternIgnoringComments(lines, /implements.*Service/)
		if (!hasImplements) {
			// 클래스 선언이 여러 줄에 걸쳐 있는 경우를 처리
			// 주석이 아닌 라인만 합쳐서 implements...Service 패턴 확인
			const nonCommentLines = lines
				.map((l) => l.trim())
				.filter((l) => !l.startsWith("//") && !l.startsWith("/*") && !l.startsWith("*"))
				.join(" ")
			hasImplements = /implements.*Service/.test(nonCommentLines)
		}

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
 * DAO 파일의 검증 (주석 제외)
 * 1. @Repository + extends EgovAbstractDAO 확인
 * 2. @Repository + extends EgovAbstractMapper 확인
 *    - 직접 상속이 아닌 중간 클래스를 통한 간접 상속도 추적하여 확인
 */
function checkDAOFile(filePath: string): boolean[] {
	try {
		const content = fs.readFileSync(filePath, "utf8")
		const lines = content.split("\n")

		// @Repository 확인 (주석 제외)
		const hasRepository = findPatternIgnoringComments(lines, "@Repository")

		// extends EgovAbstractDAO 확인 (주석 제외)
		let hasAbstractDAO = findRegexPatternIgnoringComments(lines, /extends.*EgovAbstractDAO/)

		// extends EgovAbstractMapper 확인 (주석 제외)
		let hasAbstractMapper = findRegexPatternIgnoringComments(lines, /extends.*EgovAbstractMapper/)

		// 직접 상속이 아닌 경우, 부모 클래스를 추적하여 간접 상속 확인
		if (!hasAbstractDAO && !hasAbstractMapper) {
			const extendsMatch = content.match(/extends\s+(\w+)/)
			if (extendsMatch) {
				const parentClassName = extendsMatch[1]
				if (parentClassName !== "EgovAbstractDAO" && parentClassName !== "EgovAbstractMapper") {
					const projectPath = findSourceRoot(filePath)
					// 부모 클래스가 EgovAbstractDAO를 상속하는지 확인
					if (checkParentClassExtends(projectPath, parentClassName, "EgovAbstractDAO")) {
						hasAbstractDAO = true
						console.log(`✅ ${path.basename(filePath)} indirectly extends EgovAbstractDAO via ${parentClassName}`)
					}
					// 부모 클래스가 EgovAbstractMapper를 상속하는지 확인
					if (!hasAbstractDAO && checkParentClassExtends(projectPath, parentClassName, "EgovAbstractMapper")) {
						hasAbstractMapper = true
						console.log(`✅ ${path.basename(filePath)} indirectly extends EgovAbstractMapper via ${parentClassName}`)
					}
				}
			}
		}

		// Check1: @Repository + EgovAbstractDAO
		const check1 = hasRepository && hasAbstractDAO

		// Check2: @Repository + EgovAbstractMapper
		const check2 = hasRepository && hasAbstractMapper

		console.log(`✅ DAO checks for ${path.basename(filePath)}: @Repository+DAO=${check1}, @Repository+Mapper=${check2}`)

		return [check1, check2, false]
	} catch (error) {
		console.error(`Error checking DAO file ${filePath}:`, error)
		return [false, false, false]
	}
}

/**
 * Mapper 파일의 검증 (주석 제외)
 * 1. @Mapper 또는 @EgovMapper annotation 확인
 */
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
 * - *Mapper 타입은 프로젝트 안에 같은 이름의 *Mapper.java가 있을 때만 DAO(MyBatis 매퍼)로 본다
 *   (ObjectMapper 같은 라이브러리 타입을 오탐하지 않기 위함)
 */
function checkDaoInjection(filePath: string, mapperClassNames: ReadonlySet<string>): boolean {
	try {
		const content = fs.readFileSync(filePath, "utf8")
		const lines = content.split("\n")

		for (const rawLine of lines) {
			const line = rawLine.trim()
			if (line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) {
				continue
			}
			for (const match of line.matchAll(INJECTED_TYPE_PATTERN)) {
				const typeName = match[1]
				const isDao = /(?:DAO|Dao)$/.test(typeName) || mapperClassNames.has(typeName)
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
 * 프로젝트 안의 *Mapper.java 파일 이름(확장자 제외)을 모은다 — Controller의 DAO 주입 검사에 쓴다
 */
async function collectMapperClassNames(projectPath: string, rgPath?: string): Promise<Set<string>> {
	const filePattern = "*Mapper.java"
	const files = isRipgrepAvailable(rgPath)
		? await findFilesWithRipgrep(rgPath, projectPath, filePattern)
		: findFilesWithFs(projectPath, globToSuffix(filePattern))
	return new Set(files.map((file) => path.basename(file, ".java")))
}

function checkMapperFile(filePath: string): boolean[] {
	try {
		const content = fs.readFileSync(filePath, "utf8")
		const lines = content.split("\n")

		// @Mapper 또는 @EgovMapper annotation (주석 제외)
		// @EgovMapper는 eGovFrame 전용 어노테이션으로 @Mapper와 동일한 역할 수행
		const hasMapperAnnotation = findPatternIgnoringComments(lines, "@Mapper")
		const hasEgovMapperAnnotation = findPatternIgnoringComments(lines, "@EgovMapper")

		const isValid = hasMapperAnnotation || hasEgovMapperAnnotation

		console.log(
			`✅ Mapper check for ${path.basename(filePath)}: @Mapper=${hasMapperAnnotation}, @EgovMapper=${hasEgovMapperAnnotation}`,
		)

		return [isValid, false, false]
	} catch (error) {
		console.error(`Error checking mapper file ${filePath}:`, error)
		return [false, false, false]
	}
}

/**
 * 파일이 abstract class인지 확인 (주석 제외)
 * abstract class는 직접 인스턴스화되지 않는 기반 클래스이므로 아키텍처 점검 대상에서 제외
 */
function isAbstractClass(filePath: string): boolean {
	try {
		const content = fs.readFileSync(filePath, "utf8")
		const lines = content.split("\n")
		return findRegexPatternIgnoringComments(lines, /\babstract\s+class\b/)
	} catch {
		return false
	}
}

/**
 * ripgrep 또는 fs를 사용하여 특정 레이어의 아키텍처 점검
 * rgPath가 존재하는 파일이면 ripgrep으로, 아니면 fs 재귀 탐색으로 파일을 모은다
 */
async function checkLayer(
	projectPath: string,
	filePattern: string,
	layerType: "Controller" | "Service" | "DAO" | "Mapper",
	rgPath?: string,
	context: { mapperClassNames?: ReadonlySet<string> } = {},
): Promise<ArchCheckResult[]> {
	const results: ArchCheckResult[] = []
	const mapperClassNames = context.mapperClassNames ?? new Set<string>()

	try {
		// 1. 파일 목록 가져오기
		let fileList: string[]
		if (isRipgrepAvailable(rgPath)) {
			fileList = await findFilesWithRipgrep(rgPath, projectPath, filePattern)
		} else {
			// fallback to fs-based search
			fileList = findFilesWithFs(projectPath, globToSuffix(filePattern))
		}

		// 2. 각 파일에 대해 패턴 검사
		for (const filePath of fileList) {
			const fileName = path.basename(filePath)
			const parentPath = path.dirname(filePath)

			// abstract class는 점검 대상에서 제외 (기반 클래스이므로 어노테이션/매핑이 없는 것이 정상)
			if (isAbstractClass(filePath)) {
				console.log(`⏭️ Skipping abstract class: ${fileName}`)
				continue
			}

			// 3. 각 패턴별로 검사 (주석 제외 처리)
			let checks: boolean[]
			// Controller 전용 상세 집계 (매핑된 메서드 수 / 점검 대상 메서드 수 / 클래스 레벨 매핑 여부)
			let methodCounts: Pick<ArchCheckResult, "mappedMethodCount" | "methodCount" | "hasClassLevelMapping"> = {}

			// 모든 레이어는 주석을 무시하는 파일 기반 검사 사용
			switch (layerType) {
				case "Controller":
					const controllerResult = checkControllerMethods(filePath)
					// check3 'DAO X'는 소극 조건: DAO 역할 타입을 주입받지 않아야 통과
					const injectsDao = checkDaoInjection(filePath, mapperClassNames)
					checks = [controllerResult.hasControllerAnnotation, controllerResult.hasAllMappings, !injectsDao]
					methodCounts = {
						mappedMethodCount: controllerResult.mappedMethodCount,
						methodCount: controllerResult.methodCount,
						hasClassLevelMapping: controllerResult.hasClassLevelMapping,
					}
					break
				case "Service":
					checks = checkServiceFile(filePath)
					break
				case "DAO":
					checks = checkDAOFile(filePath)
					break
				case "Mapper":
					checks = checkMapperFile(filePath)
					break
				default:
					checks = [false, false, false]
			}

			// 4. 결과 판정
			let result: "OK" | "NotFound" = "NotFound"
			switch (layerType) {
				case "Controller":
					if (checks[0] && checks[1] && checks[2]) {
						result = "OK"
					}
					break
				case "Service":
					if (checks[0] && checks[1] && checks[2]) {
						result = "OK"
					}
					break
				case "DAO":
					if (checks[0] || checks[1]) {
						result = "OK"
					}
					break
				case "Mapper":
					if (checks[0]) {
						result = "OK"
					}
					break
			}

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

/**
 * 전체 아키텍처 점검 실행
 * options.rgPath에 존재하는 ripgrep 실행 파일을 주면 ripgrep으로, 아니면 fs 재귀 탐색으로 파일을 모은다
 */
export async function checkEgovArchitecture(
	projectPath: string,
	progressCallback?: (message: string) => void,
	options: ArchCheckOptions = {},
): Promise<ArchCheckResults> {
	const results: ArchCheckResults = {}
	const rgPath = isRipgrepAvailable(options.rgPath) ? options.rgPath : undefined
	const useRipgrep = rgPath !== undefined

	if (useRipgrep) {
		console.log(`🚀 Using ripgrep (${rgPath}) for fast architecture checking`)
	} else {
		console.log("⚠️ ripgrep binary not available, falling back to fs-based search")
	}

	try {
		// 1. Controller 점검 (DAO 주입 검사를 위해 프로젝트의 *Mapper.java 이름을 먼저 모은다)
		progressCallback?.(`🔍 Checking Controller layer${useRipgrep ? " with ripgrep" : ""}...`)
		const mapperClassNames = await collectMapperClassNames(projectPath, rgPath)
		const controllerResults = await checkLayer(projectPath, "*Controller.java", "Controller", rgPath, { mapperClassNames })

		const controllerPassed = controllerResults.filter((r) => r.result === "OK").length
		results.Controller = {
			totalFiles: controllerResults.length,
			passedFiles: controllerPassed,
			failedFiles: controllerResults.length - controllerPassed,
			results: controllerResults,
		}

		// 2. Service 점검
		progressCallback?.(`🔍 Checking Service layer${useRipgrep ? " with ripgrep" : ""}...`)
		const serviceResults = await checkLayer(projectPath, "*ServiceImpl.java", "Service", rgPath)

		const servicePassed = serviceResults.filter((r) => r.result === "OK").length
		results.Service = {
			totalFiles: serviceResults.length,
			passedFiles: servicePassed,
			failedFiles: serviceResults.length - servicePassed,
			results: serviceResults,
		}

		// 3. DAO 점검
		progressCallback?.(`🔍 Checking DAO layer${useRipgrep ? " with ripgrep" : ""}...`)
		const daoResults = await checkLayer(projectPath, "*DAO.java", "DAO", rgPath)

		const daoPassed = daoResults.filter((r) => r.result === "OK").length
		results.DAO = {
			totalFiles: daoResults.length,
			passedFiles: daoPassed,
			failedFiles: daoResults.length - daoPassed,
			results: daoResults,
		}

		// 4. Mapper 점검
		progressCallback?.(`🔍 Checking Mapper layer${useRipgrep ? " with ripgrep" : ""}...`)
		const mapperResults = await checkLayer(projectPath, "*Mapper.java", "Mapper", rgPath)

		const mapperPassed = mapperResults.filter((r) => r.result === "OK").length
		results.Mapper = {
			totalFiles: mapperResults.length,
			passedFiles: mapperPassed,
			failedFiles: mapperResults.length - mapperPassed,
			results: mapperResults,
		}

		progressCallback?.(`✅ Architecture check completed${useRipgrep ? " with ripgrep" : ""}`)
		return results
	} catch (error) {
		console.error("Architecture check error:", error)
		throw error
	}
}

/**
 * 레이어별 CSV 컬럼명 및 사용 여부 반환
 */
function getLayerCheckInfo(layerType: "Controller" | "Service" | "DAO" | "Mapper") {
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
				columns: ["Path", "FileName", "@Repository + EgovAbstractDAO", "@Repository + EgovAbstractMapper", "-", "Result"],
				used: [true, true, false],
			}
		case "Mapper":
			return {
				columns: ["Path", "FileName", "@Mapper/@EgovMapper", "-", "-", "Result"],
				used: [true, false, false],
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

/**
 * 아키텍처 점검 결과를 CSV 형식으로 저장
 */
function saveReport(
	resultType: "Controller" | "Service" | "DAO" | "Mapper",
	outputPath: string,
	resultList: ArchCheckResult[],
): void {
	try {
		const layerInfo = getLayerCheckInfo(resultType)

		// CSV 헤더 (컬럼명)
		let csvContent = layerInfo.columns.join(",") + "\n"

		// 각 파일별 결과
		for (const item of resultList) {
			const check1Str = formatCheckValue(item.check1, layerInfo.used[0])
			const check2Str =
				resultType === "Controller" ? formatMappingCheckValue(item) : formatCheckValue(item.check2, layerInfo.used[1])
			const check3Str = formatCheckValue(item.check3, layerInfo.used[2])

			const report = `${item.parentPath},${item.fileName},${check1Str},${check2Str},${check3Str},${item.result}\n`
			csvContent += report
		}

		fs.writeFileSync(outputPath, csvContent, "utf8")
		console.log(`Report saved to: ${outputPath}`)
	} catch (error) {
		console.error(`Error saving report to ${outputPath}:`, error)
		throw error
	}
}

/**
 * 아키텍처 점검 결과를 CSV 파일로 내보내기
 */
export async function exportArchResults(results: ArchCheckResults, projectPath: string): Promise<void> {
	try {
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0]

		for (const [type, summary] of Object.entries(results)) {
			if (summary && summary.results.length > 0) {
				const fileName = `Result_${type}_${timestamp}.csv`
				const outputPath = path.join(projectPath, fileName)
				saveReport(type as "Controller" | "Service" | "DAO" | "Mapper", outputPath, summary.results)
			}
		}

		console.log("All reports exported successfully")
	} catch (error) {
		console.error("Error exporting results:", error)
		throw error
	}
}
