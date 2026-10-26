import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { checkEgovArchitecture, EXCLUDED_DIRECTORY_NAMES, type ArchCheckResults } from "../archChecker"
import { resolveRipgrepPath } from "../ripgrepPath"

/** 저장소 node_modules에 npm이 설치한 @vscode/ripgrep 플랫폼 패키지의 rg가 있으면 ripgrep 경로도 검증한다 */
const bundledRg = resolveRipgrepPath({ extensionPath: path.resolve(__dirname, "../../..") })

const tempDirs: string[] = []
function makeProject(files: Record<string, string>): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "egov-archcheck-"))
	tempDirs.push(root)
	for (const [relative, content] of Object.entries(files)) {
		const full = path.join(root, relative)
		fs.mkdirSync(path.dirname(full), { recursive: true })
		fs.writeFileSync(full, content)
	}
	return root
}

function fileNames(results: ArchCheckResults, layer: keyof ArchCheckResults): string[] {
	return (results[layer]?.results ?? []).map((r) => r.fileName).sort()
}

function resultOf(results: ArchCheckResults, layer: keyof ArchCheckResults, fileName: string) {
	const found = results[layer]?.results.find((r) => r.fileName === fileName)
	if (!found) {
		throw new Error(`${fileName} not in ${layer} results`)
	}
	return found
}

beforeAll(() => {
	// 엔진은 파일마다 console.log를 남기므로 테스트 출력에서는 숨긴다
	vi.spyOn(console, "log").mockImplementation(() => {})
	vi.spyOn(console, "error").mockImplementation(() => {})
})
afterAll(() => {
	vi.restoreAllMocks()
})
afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		fs.rmSync(dir, { recursive: true, force: true })
	}
})

const SRC = "src/main/java/egov/sample"

const collectionFixture = {
	[`${SRC}/web/UserController.java`]: `@Controller\npublic class UserController {\n\t@GetMapping("/a")\n\tpublic String a() { return "a"; }\n}\n`,
	// 숨김 디렉터리·빌드 산출물·의존성 디렉터리는 두 수집 경로 모두 제외해야 한다
	".hidden/HiddenController.java": `@Controller\n@RequestMapping("/h")\npublic class HiddenController {}\n`,
	".git/objects/GitController.java": `@Controller\npublic class GitController {}\n`,
	"target/classes/egov/TargetController.java": `@Controller\n@RequestMapping("/t")\npublic class TargetController {}\n`,
	"build/BuildController.java": `@Controller\npublic class BuildController {}\n`,
	"node_modules/dep/NmController.java": `@Controller\npublic class NmController {}\n`,
	// 접미어가 정확히 일치하지 않는 파일은 글롭에 걸리지 않는다
	[`${SRC}/web/OldController.java.bak`]: `@Controller\npublic class OldController {}\n`,
	[`${SRC}/web/controller.java`]: `public class controller {}\n`,
	[`${SRC}/dao/LowerDao.java`]: `@Repository\npublic class LowerDao extends EgovAbstractDAO {}\n`,
	[`${SRC}/dao/UserDAO.java`]: `@Repository\npublic class UserDAO extends EgovAbstractDAO {}\n`,
}

describe.each([
	{ name: "fs 대체 경로 (rgPath 없음)", options: {} },
	{ name: "fs 대체 경로 (존재하지 않는 rgPath)", options: { rgPath: path.join(os.tmpdir(), "no-such-dir", "rg") } },
])("파일 수집: $name", ({ options }) => {
	it("숨김·빌드 산출물·의존성 디렉터리를 제외하고 접미어가 정확히 일치하는 파일만 모은다", async () => {
		const root = makeProject(collectionFixture)
		const progress: string[] = []
		const results = await checkEgovArchitecture(root, (m) => progress.push(m), options)

		expect(fileNames(results, "Controller")).toEqual(["UserController.java"])
		expect(fileNames(results, "DAO")).toEqual(["UserDAO.java"])
		expect(results.Service?.totalFiles).toBe(0)
		expect(results.Mapper?.totalFiles).toBe(0)
		expect(progress).toHaveLength(5)
		expect(progress.every((m) => !m.includes("with ripgrep"))).toBe(true)
	})
})

describe.skipIf(!bundledRg)("파일 수집: ripgrep 경로", () => {
	it("fs 대체 경로와 같은 파일 집합을 모으고 진행 문구에 ripgrep을 표시한다", async () => {
		const root = makeProject(collectionFixture)
		const progress: string[] = []
		const results = await checkEgovArchitecture(root, (m) => progress.push(m), { rgPath: bundledRg })

		expect(fileNames(results, "Controller")).toEqual(["UserController.java"])
		expect(fileNames(results, "DAO")).toEqual(["UserDAO.java"])
		expect(progress).toHaveLength(5)
		expect(progress.every((m) => m.includes("with ripgrep"))).toBe(true)
	})

	it("git 저장소가 아니어도 target/ 아래는 제외한다 (제외 글롭)", async () => {
		const root = makeProject({
			"target/generated-sources/GenController.java": `@Controller\n@RequestMapping("/g")\npublic class GenController {}\n`,
			[`${SRC}/web/RealController.java`]: `@Controller\n@RequestMapping("/r")\npublic class RealController {}\n`,
		})
		const results = await checkEgovArchitecture(root, undefined, { rgPath: bundledRg })
		expect(fileNames(results, "Controller")).toEqual(["RealController.java"])
	})
})

describe("판정 규칙 (fs 경로)", () => {
	it("Controller: @Controller|@RestController ∧ 매핑(클래스 레벨 또는 메서드 1개 이상)", async () => {
		const root = makeProject({
			[`${SRC}/web/UserController.java`]: `@Controller\npublic class UserController {\n\t@GetMapping("/list")\n\tpublic String list() { return "l"; }\n\tpublic String helper() { return "h"; }\n}\n`,
			[`${SRC}/web/BoardController.java`]: `@RestController\n@RequestMapping("/board")\npublic class BoardController {\n\tpublic String list() { return "l"; }\n}\n`,
			[`${SRC}/web/NoMappingController.java`]: `@Controller\npublic class NoMappingController {\n\tpublic String list() { return "l"; }\n}\n`,
			[`${SRC}/web/CommentedController.java`]: `// @Controller\npublic class CommentedController {\n\t@GetMapping("/x")\n\tpublic String x() { return "x"; }\n}\n`,
			[`${SRC}/web/AbstractBaseController.java`]: `public abstract class AbstractBaseController {\n\tpublic String base() { return "b"; }\n}\n`,
		})
		const results = await checkEgovArchitecture(root)

		expect(fileNames(results, "Controller")).toEqual([
			"BoardController.java",
			"CommentedController.java",
			"NoMappingController.java",
			"UserController.java",
		])
		expect(resultOf(results, "Controller", "UserController.java")).toMatchObject({ check1: true, check2: true, result: "OK" })
		expect(resultOf(results, "Controller", "BoardController.java")).toMatchObject({
			check1: true,
			check2: true,
			result: "OK",
		})
		expect(resultOf(results, "Controller", "NoMappingController.java")).toMatchObject({
			check1: true,
			check2: false,
			result: "NotFound",
		})
		expect(resultOf(results, "Controller", "CommentedController.java")).toMatchObject({
			check1: false,
			check2: true,
			result: "NotFound",
		})
		expect(results.Controller).toMatchObject({ totalFiles: 4, passedFiles: 2, failedFiles: 2 })
	})

	it("Service: extends(직접 또는 EgovCommonServiceImpl 경유) ∧ @Service ∧ implements", async () => {
		const root = makeProject({
			[`${SRC}/service/impl/UserServiceImpl.java`]: `@Service("userService")\npublic class UserServiceImpl extends EgovAbstractServiceImpl implements UserService {}\n`,
			[`${SRC}/cmmn/EgovCommonServiceImpl.java`]: `public abstract class EgovCommonServiceImpl extends EgovAbstractServiceImpl {}\n`,
			[`${SRC}/service/impl/BoardServiceImpl.java`]: `@Service\npublic class BoardServiceImpl extends EgovCommonServiceImpl\n\t\timplements BoardService {}\n`,
			[`${SRC}/service/impl/PlainServiceImpl.java`]: `@Service\npublic class PlainServiceImpl implements PlainService {}\n`,
		})
		const results = await checkEgovArchitecture(root)

		expect(fileNames(results, "Service")).toEqual(["BoardServiceImpl.java", "PlainServiceImpl.java", "UserServiceImpl.java"])
		expect(resultOf(results, "Service", "UserServiceImpl.java")).toMatchObject({
			check1: true,
			check2: true,
			check3: true,
			result: "OK",
		})
		expect(resultOf(results, "Service", "BoardServiceImpl.java")).toMatchObject({
			check1: true,
			check2: true,
			check3: true,
			result: "OK",
		})
		expect(resultOf(results, "Service", "PlainServiceImpl.java")).toMatchObject({
			check1: false,
			check2: true,
			check3: true,
			result: "NotFound",
		})
	})

	it("DAO: @Repository ∧ (EgovAbstractDAO ∨ EgovAbstractMapper), 중간 클래스 경유 상속 포함", async () => {
		const root = makeProject({
			[`${SRC}/dao/BaseDAO.java`]: `public abstract class BaseDAO extends EgovAbstractDAO {}\n`,
			[`${SRC}/dao/UserDAO.java`]: `@Repository("userDAO")\npublic class UserDAO extends BaseDAO {}\n`,
			[`${SRC}/dao/BoardDAO.java`]: `@Repository\npublic class BoardDAO extends EgovAbstractMapper {}\n`,
			[`${SRC}/dao/NoRepoDAO.java`]: `public class NoRepoDAO extends EgovAbstractDAO {}\n`,
		})
		const results = await checkEgovArchitecture(root)

		expect(fileNames(results, "DAO")).toEqual(["BoardDAO.java", "NoRepoDAO.java", "UserDAO.java"])
		expect(resultOf(results, "DAO", "UserDAO.java")).toMatchObject({ check1: true, check2: false, result: "OK" })
		expect(resultOf(results, "DAO", "BoardDAO.java")).toMatchObject({ check1: false, check2: true, result: "OK" })
		expect(resultOf(results, "DAO", "NoRepoDAO.java")).toMatchObject({ check1: false, check2: false, result: "NotFound" })
	})

	it("Mapper: @Mapper 또는 @EgovMapper", async () => {
		const root = makeProject({
			[`${SRC}/mapper/UserMapper.java`]: `@EgovMapper("userMapper")\npublic interface UserMapper {}\n`,
			[`${SRC}/mapper/BoardMapper.java`]: `@Mapper\npublic interface BoardMapper {}\n`,
			[`${SRC}/mapper/PlainMapper.java`]: `public interface PlainMapper {}\n`,
		})
		const results = await checkEgovArchitecture(root)

		expect(resultOf(results, "Mapper", "UserMapper.java")).toMatchObject({ check1: true, result: "OK" })
		expect(resultOf(results, "Mapper", "BoardMapper.java")).toMatchObject({ check1: true, result: "OK" })
		expect(resultOf(results, "Mapper", "PlainMapper.java")).toMatchObject({ check1: false, result: "NotFound" })
	})

	it("파일이 없어도 네 레이어가 모두 채워진다", async () => {
		const results = await checkEgovArchitecture(makeProject({}))
		for (const layer of ["Controller", "Service", "DAO", "Mapper"] as const) {
			expect(results[layer]).toEqual({ totalFiles: 0, passedFiles: 0, failedFiles: 0, results: [] })
		}
	})
})

describe("EXCLUDED_DIRECTORY_NAMES", () => {
	it("빌드 산출물과 의존성 디렉터리를 포함한다", () => {
		expect(EXCLUDED_DIRECTORY_NAMES).toEqual(["node_modules", "target", "build", "out", "dist"])
	})
})
