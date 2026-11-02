import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import {
	checkEgovArchitecture,
	collectProjectFiles,
	exportArchResults,
	EXCLUDED_DIRECTORY_NAMES,
	shouldSkipDirectory,
	type ArchCheckResult,
	type ArchCheckResults,
} from "../archChecker"
import type { ProjectCheckSummary } from "../../shared/archCheck"
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

type FileLayer = "Controller" | "Service" | "DAO"

function fileNames(results: ArchCheckResults, layer: FileLayer): string[] {
	return (results[layer]?.results ?? []).map((r) => r.fileName).sort()
}

function resultOf(results: ArchCheckResults, layer: FileLayer, fileName: string) {
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
	[`${SRC}/mapper/UserMapper.java`]: `@EgovMapper\npublic interface UserMapper {}\n`,
	// 테스트 소스(src/test·src/it)는 모든 레이어에서 제외한다
	"src/test/java/egov/TestUserDAO.java": `@Repository\npublic class TestUserDAO extends EgovAbstractDAO {}\n`,
	"src/it/java/egov/ItController.java": `@Controller\n@RequestMapping("/it")\npublic class ItController {}\n`,
	// .ignore·.gitignore는 따르지 않는다 (ripgrep --no-ignore, fs 경로와 같은 결과)
	".ignore": "ignored/\n",
	"ignored/IgnoredController.java": `@Controller\n@RequestMapping("/i")\npublic class IgnoredController {}\n`,
}

describe.each([
	{ name: "fs 대체 경로 (rgPath 없음)", options: {} },
	{ name: "fs 대체 경로 (존재하지 않는 rgPath)", options: { rgPath: path.join(os.tmpdir(), "no-such-dir", "rg") } },
])("파일 수집: $name", ({ options }) => {
	it("숨김·빌드 산출물·의존성 디렉터리를 제외하고 접미어가 정확히 일치하는 파일만 모은다", async () => {
		const root = makeProject(collectionFixture)
		const progress: string[] = []
		const results = await checkEgovArchitecture(root, (m) => progress.push(m), options)

		expect(fileNames(results, "Controller")).toEqual(["IgnoredController.java", "UserController.java"])
		expect(fileNames(results, "DAO")).toEqual(["LowerDao.java", "UserDAO.java", "UserMapper.java"])
		expect(results.Service?.totalFiles).toBe(0)
		expect(results).not.toHaveProperty("Mapper")
		expect(progress).toEqual([
			"🔍 Checking project build files...",
			"🔍 Checking DAO / Mapper layer...",
			"🔍 Scanning data access configuration...",
			"🔍 Checking Controller layer...",
			"🔍 Checking Service layer...",
			"✅ Architecture check completed",
		])
	})
})

describe.skipIf(!bundledRg)("파일 수집: ripgrep 경로", () => {
	it("fs 대체 경로와 같은 파일 집합을 모으고 진행 문구에 ripgrep을 표시한다", async () => {
		const root = makeProject(collectionFixture)
		const progress: string[] = []
		const results = await checkEgovArchitecture(root, (m) => progress.push(m), { rgPath: bundledRg })

		expect(fileNames(results, "Controller")).toEqual(["IgnoredController.java", "UserController.java"])
		expect(fileNames(results, "DAO")).toEqual(["LowerDao.java", "UserDAO.java", "UserMapper.java"])
		expect(results).not.toHaveProperty("Mapper")
		expect(progress).toEqual([
			"🔍 Checking project build files with ripgrep...",
			"🔍 Checking DAO / Mapper layer with ripgrep...",
			"🔍 Scanning data access configuration with ripgrep...",
			"🔍 Checking Controller layer with ripgrep...",
			"🔍 Checking Service layer with ripgrep...",
			"✅ Architecture check completed with ripgrep",
		])
	})

	/** 임시 디렉터리 아래 relativeRoot 위치에 프로젝트를 만든다 (프로젝트 상위 경로의 이름을 정하기 위함) */
	function makeNestedProject(relativeRoot: string, files: Record<string, string>): string {
		const projectRoot = path.join(makeProject({}), relativeRoot)
		for (const [relative, content] of Object.entries(files)) {
			const full = path.join(projectRoot, relative)
			fs.mkdirSync(path.dirname(full), { recursive: true })
			fs.writeFileSync(full, content)
		}
		return projectRoot
	}

	it("프로젝트 상위 경로에 src/test·src/it가 있어도 프로젝트 파일을 fs 경로와 똑같이 모은다", async () => {
		const controller = `@Controller\n@RequestMapping("/a")\npublic class AController {}\n`
		for (const relativeRoot of [path.join("src", "test", "proj"), path.join("src", "it", "proj2")]) {
			const root = makeNestedProject(relativeRoot, { [`${SRC}/web/AController.java`]: controller })
			const expected = [path.join(root, SRC, "web", "AController.java")]
			expect(await collectProjectFiles(root, ["*.java"], bundledRg)).toEqual(expected)
			expect(await collectProjectFiles(root, ["*.java"])).toEqual(expected)
			const results = await checkEgovArchitecture(root, undefined, { rgPath: bundledRg })
			expect(fileNames(results, "Controller")).toEqual(["AController.java"])
		}
	})

	it("프로젝트 루트 이름이 src이면 그 아래 test·it를 fs 경로와 똑같이 제외한다", async () => {
		const root = makeNestedProject("src", {
			"main/MController.java": `@Controller\npublic class MController {}\n`,
			"test/TController.java": `@Controller\npublic class TController {}\n`,
			"it/IController.java": `@Controller\npublic class IController {}\n`,
		})
		const expected = [path.join(root, "main", "MController.java")]
		expect(await collectProjectFiles(root, ["*.java"], bundledRg)).toEqual(expected)
		expect(await collectProjectFiles(root, ["*.java"])).toEqual(expected)
	})

	it("git 저장소가 아니어도 target/ 아래는 제외한다 (제외 글롭)", async () => {
		const root = makeProject({
			"target/generated-sources/GenController.java": `@Controller\n@RequestMapping("/g")\npublic class GenController {}\n`,
			[`${SRC}/web/RealController.java`]: `@Controller\n@RequestMapping("/r")\npublic class RealController {}\n`,
		})
		const results = await checkEgovArchitecture(root, undefined, { rgPath: bundledRg })
		expect(fileNames(results, "Controller")).toEqual(["RealController.java"])
	})

	it("프로젝트 디렉터리 이름이 -로 시작해도 rg 옵션으로 읽히지 않고 프로젝트 안의 파일만 모은다", async () => {
		const controller = `@Controller\n@RequestMapping("/a")\npublic class AController {}\n`
		// -x(--line-regexp)·-L(--follow)처럼 rg 옵션과 같은 이름: 옵션으로 읽히면 cwd(부모) 전체를 훑거나 심볼릭 링크를 따라간다
		for (const dirName of ["-x", "-L"]) {
			const root = makeNestedProject(dirName, { [`${SRC}/web/AController.java`]: controller })
			const outside = path.join(path.dirname(root), "outside", "OutsideController.java")
			fs.mkdirSync(path.dirname(outside), { recursive: true })
			fs.writeFileSync(outside, controller)
			const expected = [path.join(root, SRC, "web", "AController.java")]
			expect(await collectProjectFiles(root, ["*.java"], bundledRg)).toEqual(expected)
			expect(await collectProjectFiles(root, ["*.java"])).toEqual(expected)
		}
	})
})

describe.each([{ name: "fs 경로", rgPath: undefined }, ...(bundledRg ? [{ name: "ripgrep 경로", rgPath: bundledRg }] : [])])(
	"collectProjectFiles: $name",
	({ rgPath }) => {
		it("'*X'는 접미어로, 그 외 패턴은 정확한 파일 이름으로 모으고 같은 제외 규칙을 따른다", async () => {
			const root = makeProject({
				"pom.xml": "<project/>",
				"sub/pom.xml": "<project/>",
				"sub/my-pom.xml": "<project/>",
				"build.gradle": "",
				"src/test/resources/pom.xml": "<project/>",
				"target/pom.xml": "<project/>",
			})
			const files = await collectProjectFiles(root, ["pom.xml", "*.gradle"], rgPath)
			expect(files.map((f) => path.relative(root, f)).sort()).toEqual([
				"build.gradle",
				"pom.xml",
				path.join("sub", "pom.xml"),
			])
		})
	},
)

describe("shouldSkipDirectory", () => {
	it("숨김·빌드 산출물·의존성 디렉터리와 src/test·src/it를 건너뛴다", () => {
		expect(shouldSkipDirectory("src", "test")).toBe(true)
		expect(shouldSkipDirectory("src", "it")).toBe(true)
		expect(shouldSkipDirectory("x", ".git")).toBe(true)
		expect(shouldSkipDirectory("x", "node_modules")).toBe(true)
		expect(shouldSkipDirectory("x", "test")).toBe(false)
		expect(shouldSkipDirectory("src", "main")).toBe(false)
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

	it("Controller: 결과에 매핑된 메서드 수·점검 대상 메서드 수·클래스 레벨 매핑 여부를 싣는다", async () => {
		const root = makeProject({
			[`${SRC}/web/UserController.java`]: `@Controller\npublic class UserController {\n\t@GetMapping("/list")\n\tpublic String list() { return "l"; }\n\t@PostMapping("/add")\n\tpublic String add() { return "a"; }\n\tpublic String helper() { return "h"; }\n}\n`,
			[`${SRC}/web/BoardController.java`]: `@RestController\n@RequestMapping("/board")\npublic class BoardController {\n\tpublic String list() { return "l"; }\n}\n`,
			[`${SRC}/web/NoMappingController.java`]: `@Controller\npublic class NoMappingController {\n\tpublic String list() { return "l"; }\n}\n`,
			[`${SRC}/web/EmptyController.java`]: `@Controller\n@RequestMapping("/empty")\npublic class EmptyController {\n}\n`,
			[`${SRC}/service/impl/UserServiceImpl.java`]: `@Service\npublic class UserServiceImpl extends EgovAbstractServiceImpl implements UserService {}\n`,
		})
		const results = await checkEgovArchitecture(root)

		// 매핑 2개 + 헬퍼 1개 → 2/3, 현재 규칙대로 OK
		expect(resultOf(results, "Controller", "UserController.java")).toMatchObject({
			check2: true,
			mappedMethodCount: 2,
			methodCount: 3,
			hasClassLevelMapping: false,
		})
		// 클래스 레벨 @RequestMapping으로 통과 (메서드 매핑은 0/1)
		expect(resultOf(results, "Controller", "BoardController.java")).toMatchObject({
			check2: true,
			mappedMethodCount: 0,
			methodCount: 1,
			hasClassLevelMapping: true,
		})
		// 실패한 파일에도 집계값은 실린다
		expect(resultOf(results, "Controller", "NoMappingController.java")).toMatchObject({
			check2: false,
			mappedMethodCount: 0,
			methodCount: 1,
			hasClassLevelMapping: false,
		})
		// public 메서드가 없으면 0/0, 클래스 레벨 매핑으로 통과
		expect(resultOf(results, "Controller", "EmptyController.java")).toMatchObject({
			check2: true,
			mappedMethodCount: 0,
			methodCount: 0,
			hasClassLevelMapping: true,
		})
		// 다른 레이어의 결과에는 Controller 전용 필드가 없다
		const service = resultOf(results, "Service", "UserServiceImpl.java")
		expect(service).not.toHaveProperty("mappedMethodCount")
		expect(service).not.toHaveProperty("methodCount")
		expect(service).not.toHaveProperty("hasClassLevelMapping")
	})

	it("Controller: check3 'DAO X' — DAO/Dao 또는 프로젝트의 *Mapper 타입을 주입받으면(완전 한정 이름 포함) 실패한다", async () => {
		const root = makeProject({
			[`${SRC}/mapper/SampleMapper.java`]: `@Mapper\npublic interface SampleMapper {}\n`,
			// 프로젝트 안에 같은 이름의 파일이 있어도 데이터 접근 클래스가 아니면(S3) DAO 판정 대상이 아니다
			[`${SRC}/cmmn/ObjectMapper.java`]: `public class ObjectMapper {}\n`,
			[`${SRC}/web/CleanController.java`]: `@Controller\npublic class CleanController {\n\t@Resource(name = "sampleService")\n\tprivate SampleService sampleService;\n\t@GetMapping("/a")\n\tpublic String a() { return "a"; }\n}\n`,
			[`${SRC}/web/DaoFieldController.java`]: `@Controller\npublic class DaoFieldController {\n\t@Resource(name = "sampleDAO")\n\tprivate SampleDAO sampleDAO;\n\t@GetMapping("/a")\n\tpublic String a() { return "a"; }\n}\n`,
			[`${SRC}/web/DaoLowerController.java`]: `@Controller\n@RequiredArgsConstructor\npublic class DaoLowerController {\n\tprivate final SampleDao sampleDao;\n\t@GetMapping("/a")\n\tpublic String a() { return "a"; }\n}\n`,
			[`${SRC}/web/MapperController.java`]: `@Controller\npublic class MapperController {\n\t@Autowired\n\tprivate SampleMapper sampleMapper;\n\t@GetMapping("/a")\n\tpublic String a() { return "a"; }\n}\n`,
			[`${SRC}/web/CtorController.java`]: `@Controller\npublic class CtorController {\n\tprivate final SampleService svc;\n\tpublic CtorController(SampleService svc, SampleDAO sampleDAO) {\n\t\tthis.svc = svc;\n\t}\n\t@GetMapping("/a")\n\tpublic String a() { return "a"; }\n}\n`,
			[`${SRC}/web/JacksonController.java`]: `@RestController\npublic class JacksonController {\n\t@Autowired\n\tprivate ObjectMapper objectMapper;\n\t@GetMapping("/a")\n\tpublic String a() { return "a"; }\n}\n`,
			[`${SRC}/web/CommentedDaoController.java`]: `@Controller\npublic class CommentedDaoController {\n\t// private SampleDAO sampleDAO;\n\t/**\n\t * SampleMapper sampleMapper;\n\t */\n\t@GetMapping("/a")\n\tpublic String a() { return "a"; }\n}\n`,
			[`${SRC}/web/FqnController.java`]: `@Controller\npublic class FqnController {\n\t@Resource(name = "sampleDAO")\n\tprivate egov.sample.service.SampleDAO sampleDAO;\n\t@GetMapping("/a")\n\tpublic String a() { return "a"; }\n}\n`,
		})
		const results = await checkEgovArchitecture(root)

		expect(resultOf(results, "Controller", "CleanController.java")).toMatchObject({ check3: true, result: "OK" })
		expect(resultOf(results, "Controller", "DaoFieldController.java")).toMatchObject({
			check1: true,
			check2: true,
			check3: false,
			result: "NotFound",
		})
		expect(resultOf(results, "Controller", "DaoLowerController.java")).toMatchObject({ check3: false, result: "NotFound" })
		// SampleMapper는 DAO 레이어 판정 대상이므로 DAO 역할의 Mapper 주입으로 본다
		expect(resultOf(results, "Controller", "MapperController.java")).toMatchObject({ check3: false, result: "NotFound" })
		expect(resultOf(results, "Controller", "CtorController.java")).toMatchObject({ check3: false, result: "NotFound" })
		// DAO 판정 대상이 아닌 타입(ObjectMapper — 같은 이름 파일은 S3로 제외)은 DAO로 보지 않는다
		expect(resultOf(results, "Controller", "JacksonController.java")).toMatchObject({ check3: true, result: "OK" })
		// 주석 안의 선언은 무시한다
		expect(resultOf(results, "Controller", "CommentedDaoController.java")).toMatchObject({ check3: true, result: "OK" })
		// 패키지 경로를 다 적은 완전 한정 이름의 주입도 잡는다
		expect(resultOf(results, "Controller", "FqnController.java")).toMatchObject({ check3: false, result: "NotFound" })
		expect(results.Controller).toMatchObject({ totalFiles: 8, passedFiles: 3, failedFiles: 5 })
	})

	it("Service: extends(직접 또는 프로젝트의 임의 중간 클래스 경유) ∧ @Service ∧ implements", async () => {
		const root = makeProject({
			[`${SRC}/service/impl/UserServiceImpl.java`]: `@Service("userService")\npublic class UserServiceImpl extends EgovAbstractServiceImpl implements UserService {}\n`,
			// 중간 클래스 이름은 프로젝트마다 다르다: 고정 이름(EgovCommonServiceImpl)을 가정하면 안 된다
			[`${SRC}/cmmn/ProjectBaseServiceImpl.java`]: `public abstract class ProjectBaseServiceImpl extends EgovAbstractServiceImpl {}\n`,
			[`${SRC}/service/impl/BoardServiceImpl.java`]: `@Service\npublic class BoardServiceImpl extends ProjectBaseServiceImpl\n\t\timplements BoardService {}\n`,
			// 2단계 경유: ChainServiceImpl → CmmnBase → ProjectBaseServiceImpl → EgovAbstractServiceImpl
			[`${SRC}/cmmn/CmmnBase.java`]: `public abstract class CmmnBase extends ProjectBaseServiceImpl {}\n`,
			[`${SRC}/service/impl/ChainServiceImpl.java`]: `@Service\npublic class ChainServiceImpl extends CmmnBase implements ChainService {}\n`,
			// 부모가 EgovAbstractServiceImpl 계열이 아니면 실패
			[`${SRC}/cmmn/OtherBase.java`]: `public abstract class OtherBase {}\n`,
			[`${SRC}/service/impl/OtherServiceImpl.java`]: `@Service\npublic class OtherServiceImpl extends OtherBase implements OtherService {}\n`,
			// 주석에 적힌 extends는 무시하고 코드의 extends만 본다
			[`${SRC}/service/impl/CommentServiceImpl.java`]: `// legacy: extends EgovAbstractServiceImpl\n@Service\npublic class CommentServiceImpl extends OtherBase implements CommentService {}\n`,
			// 중간 클래스 파일의 주석에 적힌 extends도 무시하고, 코드의 extends로 조부모를 추적한다
			[`${SRC}/cmmn/CommentedMidBase.java`]: `/**\n * 과거에는 extends OtherBase 였음\n */\npublic abstract class CommentedMidBase extends ProjectBaseServiceImpl {}\n`,
			[`${SRC}/service/impl/ViaCommentedMidServiceImpl.java`]: `@Service\npublic class ViaCommentedMidServiceImpl extends CommentedMidBase implements ViaCommentedMidService {}\n`,
			[`${SRC}/service/impl/PlainServiceImpl.java`]: `@Service\npublic class PlainServiceImpl implements PlainService {}\n`,
		})
		const results = await checkEgovArchitecture(root)

		expect(fileNames(results, "Service")).toEqual([
			"BoardServiceImpl.java",
			"ChainServiceImpl.java",
			"CommentServiceImpl.java",
			"OtherServiceImpl.java",
			"PlainServiceImpl.java",
			"UserServiceImpl.java",
			"ViaCommentedMidServiceImpl.java",
		])
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
		expect(resultOf(results, "Service", "ChainServiceImpl.java")).toMatchObject({
			check1: true,
			check2: true,
			check3: true,
			result: "OK",
		})
		expect(resultOf(results, "Service", "OtherServiceImpl.java")).toMatchObject({ check1: false, result: "NotFound" })
		expect(resultOf(results, "Service", "CommentServiceImpl.java")).toMatchObject({ check1: false, result: "NotFound" })
		expect(resultOf(results, "Service", "ViaCommentedMidServiceImpl.java")).toMatchObject({ check1: true, result: "OK" })
		expect(resultOf(results, "Service", "PlainServiceImpl.java")).toMatchObject({
			check1: false,
			check2: true,
			check3: true,
			result: "NotFound",
		})
	})

	it("Service check3: 클래스 선언부의 implements 목록에 Service로 끝나는 인터페이스가 있어야 한다", async () => {
		const head = "@Service\npublic class"
		const base = "extends EgovAbstractServiceImpl"
		const root = makeProject({
			[`${SRC}/service/impl/MultiServiceImpl.java`]: `${head} MultiServiceImpl ${base} implements Serializable, MultiService {}\n`,
			[`${SRC}/service/impl/WrappedServiceImpl.java`]: `${head} WrappedServiceImpl ${base}\n\t\timplements\n\t\tWrappedService {\n}\n`,
			[`${SRC}/service/impl/FqnServiceImpl.java`]: `${head} FqnServiceImpl<T> ${base} implements egov.sample.service.FqnService<T> {}\n`,
			[`${SRC}/service/impl/GenericServiceImpl.java`]: `${head} GenericServiceImpl ${base} implements Comparator<Map<String, Object>>, GenericService {}\n`,
			// 선언부 밖(메서드 본문·필드)의 Service는 보지 않는다
			[`${SRC}/service/impl/LooseServiceImpl.java`]: `${head} LooseServiceImpl ${base} implements Serializable {\n\tpublic String name() {\n\t\treturn "Service";\n\t}\n}\n`,
			[`${SRC}/service/impl/InjectServiceImpl.java`]: `${head} InjectServiceImpl ${base} implements Serializable {\n\t@Resource\n\tprivate UserService userService;\n}\n`,
			// Service로 끝나지 않는 이름은 Service 인터페이스가 아니다
			[`${SRC}/service/impl/HelperServiceImpl.java`]: `${head} HelperServiceImpl ${base} implements ServiceHelper {}\n`,
			[`${SRC}/service/impl/ListenerServiceImpl.java`]: `${head} ListenerServiceImpl ${base} implements ApplicationListener<ServiceEvent> {}\n`,
			[`${SRC}/service/impl/NoneServiceImpl.java`]: `${head} NoneServiceImpl ${base} {}\n`,
			// 파일 이름과 같은 클래스의 선언부만 본다 (앞에 다른 최상위 클래스가 있어도)
			[`${SRC}/service/impl/TopServiceImpl.java`]: `class Helper implements Runnable {}\n${head} TopServiceImpl ${base} implements TopService {}\n`,
			[`${SRC}/service/impl/OtherTopServiceImpl.java`]: `class Helper implements HelperService {}\n${head} OtherTopServiceImpl ${base} {}\n`,
		})
		const results = await checkEgovArchitecture(root)

		const check3Of = (name: string) => resultOf(results, "Service", name)?.check3
		expect(check3Of("MultiServiceImpl.java")).toBe(true)
		expect(check3Of("WrappedServiceImpl.java")).toBe(true)
		expect(check3Of("FqnServiceImpl.java")).toBe(true)
		expect(check3Of("GenericServiceImpl.java")).toBe(true)
		expect(check3Of("TopServiceImpl.java")).toBe(true)
		expect(check3Of("LooseServiceImpl.java")).toBe(false)
		expect(check3Of("InjectServiceImpl.java")).toBe(false)
		expect(check3Of("HelperServiceImpl.java")).toBe(false)
		expect(check3Of("ListenerServiceImpl.java")).toBe(false)
		expect(check3Of("NoneServiceImpl.java")).toBe(false)
		expect(check3Of("OtherTopServiceImpl.java")).toBe(false)
		expect(resultOf(results, "Service", "LooseServiceImpl.java")).toMatchObject({
			check1: true,
			check2: true,
			result: "NotFound",
		})
	})

	const daoMapperFixture = {
		[`${SRC}/dao/BaseDAO.java`]: `import org.egovframe.rte.psl.dataaccess.EgovAbstractDAO;\npublic abstract class BaseDAO extends EgovAbstractDAO {}\n`,
		[`${SRC}/dao/UserDAO.java`]: `@Repository("userDAO")\npublic class UserDAO extends BaseDAO {}\n`,
		[`${SRC}/dao/BoardDAO.java`]: `import org.egovframe.rte.psl.dataaccess.EgovAbstractMapper;\n@Repository\npublic class BoardDAO extends EgovAbstractMapper {}\n`,
		[`${SRC}/dao/NoRepoDAO.java`]: `import org.egovframe.rte.psl.dataaccess.EgovAbstractDAO;\npublic class NoRepoDAO extends EgovAbstractDAO {}\n`,
		[`${SRC}/mapper/UserMapper.java`]: `import org.egovframe.rte.psl.dataaccess.mapper.EgovMapper;\n@EgovMapper("userMapper")\npublic interface UserMapper {}\n`,
		[`${SRC}/mapper/BoardMapper.java`]: `import org.apache.ibatis.annotations.Mapper;\n@Mapper\npublic interface BoardMapper {}\n`,
		[`${SRC}/mapper/PlainMapper.java`]: `public interface PlainMapper {}\n`,
	}

	it("DAO / Mapper 통합 레이어: 기반 ∧ @Repository/egov 출처 ∧ 버전(세대 unknown → n/a)", async () => {
		const results = await checkEgovArchitecture(makeProject(daoMapperFixture))

		expect(fileNames(results, "DAO")).toEqual([
			"BoardDAO.java",
			"BoardMapper.java",
			"NoRepoDAO.java",
			"PlainMapper.java",
			"UserDAO.java",
			"UserMapper.java",
		])
		expect(resultOf(results, "DAO", "UserDAO.java")).toMatchObject({
			check1: true,
			check2: true,
			check3State: "skipped",
			check3Detail: "n/a",
			result: "OK",
			inheritancePath: ["BaseDAO"],
		})
		expect(resultOf(results, "DAO", "BoardDAO.java")).toMatchObject({ result: "OK", daoStyle: "mybatisDao" })
		expect(resultOf(results, "DAO", "NoRepoDAO.java")).toMatchObject({
			check2: false,
			check2Detail: "no @Repository",
			result: "NotFound",
		})
		expect(resultOf(results, "DAO", "UserMapper.java")).toMatchObject({ result: "OK", check2Detail: "egov" })
		expect(resultOf(results, "DAO", "BoardMapper.java")).toMatchObject({
			check2Detail: "mybatis @Mapper",
			result: "NotFound",
		})
		expect(resultOf(results, "DAO", "PlainMapper.java")).toMatchObject({ check1: false, result: "NotFound" })
		expect(results.DAO?.skipped).toMatchObject([{ fileName: "BaseDAO.java", reason: "abstract" }])
		expect(results.DAO).toMatchObject({ totalFiles: 6, passedFiles: 3, failedFiles: 3 })
	})

	it("DAO / Mapper 통합 레이어: runtimeGeneration 옵션으로 세대를 지정하면 check3를 판정한다", async () => {
		const root = makeProject(daoMapperFixture)

		const v5 = await checkEgovArchitecture(root, undefined, { runtimeGeneration: "5.x" })
		expect(resultOf(v5, "DAO", "BoardMapper.java")).toMatchObject({
			check2Detail: "mybatis @Mapper",
			check3State: "skipped",
			check3Detail: "n/a",
			result: "NotFound",
		})
		expect(resultOf(v5, "DAO", "UserMapper.java")).toMatchObject({ check3State: "pass", check3Detail: "5.x", result: "OK" })
		expect(resultOf(v5, "DAO", "UserDAO.java")).toMatchObject({ check3State: "pass", check3Detail: "5.x", result: "OK" })

		const v4 = await checkEgovArchitecture(root, undefined, { runtimeGeneration: "4.x" })
		expect(resultOf(v4, "DAO", "UserMapper.java")).toMatchObject({
			check3State: "fail",
			check3Detail: "@EgovMapper in 4.x project",
			result: "NotFound",
		})
	})

	it("파일이 없어도 세 레이어가 모두 채워진다", async () => {
		const results = await checkEgovArchitecture(makeProject({}))
		for (const layer of ["Controller", "Service"] as const) {
			expect(results[layer]).toEqual({ totalFiles: 0, passedFiles: 0, failedFiles: 0, results: [] })
		}
		expect(results.DAO).toEqual({ totalFiles: 0, passedFiles: 0, failedFiles: 0, results: [], skipped: [] })
		expect(Object.keys(results).sort()).toEqual(["Controller", "DAO", "Service", "project"])
	})
})

describe("Project 빌드 점검 (2단계)", () => {
	const web5Pom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
<modelVersion>4.0.0</modelVersion>
<parent><groupId>org.egovframe.web</groupId><artifactId>egovframe-web-config-parent</artifactId><version>5.0.0</version></parent>
<groupId>egovframework</groupId><artifactId>web</artifactId><version>1.0.0</version><packaging>war</packaging>
<dependencies>
<dependency><groupId>org.egovframe.rte</groupId><artifactId>egovframe-rte-ptl-mvc</artifactId></dependency>
<dependency><groupId>org.egovframe.rte</groupId><artifactId>egovframe-rte-psl-dataaccess</artifactId></dependency>
</dependencies>
</project>
`
	const web5Fixture = {
		"pom.xml": web5Pom,
		[`${SRC}/mapper/UserMapper.java`]: `import org.egovframe.rte.psl.dataaccess.mapper.EgovMapper;\n@EgovMapper\npublic interface UserMapper {}\n`,
	}

	it("빌드 파일이 없으면 project는 Unknown이고 모듈이 없다", async () => {
		const results = await checkEgovArchitecture(
			makeProject({ [`${SRC}/web/AController.java`]: "@Controller\nclass AController {}\n" }),
		)
		expect(results.project).toMatchObject({ generation: "unknown", modules: [], result: "Unknown" })
	})

	it("5.x web형 pom.xml이면 project가 OK·5.x이고 DAO check3는 파일이 속한 모듈의 세대로 판정한다", async () => {
		const results = await checkEgovArchitecture(makeProject(web5Fixture))
		expect(results.project).toMatchObject({ generation: "5.x", version: "5.0.0", result: "OK" })
		expect(results.project?.modules.map((m) => m.buildFile)).toEqual(["pom.xml"])
		expect(resultOf(results, "DAO", "UserMapper.java")).toMatchObject({
			check3State: "pass",
			check3Detail: "5.x",
			result: "OK",
		})
	})

	it("runtimeGeneration을 주면 pom과 무관하게 수동 세대가 project와 DAO check3에 적용된다", async () => {
		const results = await checkEgovArchitecture(makeProject(web5Fixture), undefined, { runtimeGeneration: "4.x" })
		expect(results.project?.generation).toBe("4.x")
		expect(results.project?.modules[0].runtime.source).toBe("manual")
		expect(resultOf(results, "DAO", "UserMapper.java")).toMatchObject({
			check3State: "fail",
			check3Detail: "@EgovMapper in 4.x project",
			result: "NotFound",
		})
	})
})

describe("데이터 접근 설정 정보 (3단계)", () => {
	const contextMapperXml = `<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans">
	<bean id="sqlSession" class="org.mybatis.spring.SqlSessionFactoryBean">
		<property name="dataSource" ref="dataSource"/>
	</bean>
	<bean class="org.egovframe.rte.psl.dataaccess.mapper.MapperConfigurer">
		<property name="basePackage" value="egov.sample.**.mapper"/>
	</bean>
</beans>
`
	const fixture = {
		"pom.xml": `<project><dependencies><dependency><groupId>org.egovframe.rte</groupId><artifactId>egovframe-rte-ptl-mvc</artifactId><version>4.3.0</version></dependency></dependencies></project>\n`,
		"src/main/resources/egovframework/spring/context-mapper.xml": contextMapperXml,
		// 수집 범위(src/main/resources·src/main/webapp/WEB-INF) 밖의 설정 파일은 보지 않는다
		"src/test/resources/context-test.xml": `<beans><bean class="org.springframework.orm.ibatis.SqlMapClientFactoryBean"/></beans>`,
		[`${SRC}/mapper/UserMapper.java`]: `import org.egovframe.rte.psl.dataaccess.mapper.Mapper;\n@Mapper("userMapper")\npublic interface UserMapper {}\n`,
		[`${SRC}/repo/UserRepository.java`]: `import org.springframework.jdbc.core.JdbcTemplate;\npublic class UserRepository { private JdbcTemplate jdbc; }\n`,
	}

	it("설정 finding과 미분류 데이터 접근 파일을 project에 넣고 판정은 바꾸지 않는다", async () => {
		const root = makeProject(fixture)
		const results = await checkEgovArchitecture(root)
		const contextPath = path.join(root, "src/main/resources/egovframework/spring/context-mapper.xml")
		expect(results.project?.dataAccessConfig).toEqual({
			findings: [
				{
					kind: "sqlSessionFactoryBean",
					filePath: contextPath,
					fileName: "context-mapper.xml",
					evidence: "org.mybatis.spring.SqlSessionFactoryBean",
				},
				{
					kind: "mapperConfigurer",
					filePath: contextPath,
					fileName: "context-mapper.xml",
					evidence: "basePackage=egov.sample.**.mapper",
				},
			],
			warnings: [],
		})
		expect(results.project?.unclassifiedDataAccessFiles).toEqual([
			{
				filePath: path.join(root, SRC, "repo/UserRepository.java"),
				fileName: "UserRepository.java",
				relativePath: `${SRC}/repo/UserRepository.java`,
				evidence: "JdbcTemplate",
			},
		])

		// 설정 정보 유무와 무관하게 판정(result)은 같다
		const withoutConfig = await checkEgovArchitecture(
			makeProject({
				"pom.xml": fixture["pom.xml"],
				[`${SRC}/mapper/UserMapper.java`]: fixture[`${SRC}/mapper/UserMapper.java`],
			}),
		)
		expect(withoutConfig.project?.dataAccessConfig?.warnings).toEqual([
			"Mapper interfaces exist but no MapperConfigurer, @MapperScan or mybatis-spring-boot-starter was found",
		])
		expect(withoutConfig.project?.result).toBe(results.project?.result)
		expect(resultOf(withoutConfig, "DAO", "UserMapper.java").result).toBe(resultOf(results, "DAO", "UserMapper.java").result)
	})
})

describe("EXCLUDED_DIRECTORY_NAMES", () => {
	it("빌드 산출물과 의존성 디렉터리를 포함한다", () => {
		expect(EXCLUDED_DIRECTORY_NAMES).toEqual(["node_modules", "target", "build", "out", "dist"])
	})
})

describe("CSV 내보내기", () => {
	const controller = (
		fileName: string,
		fields: {
			check2: boolean
			check3?: boolean
			mappedMethodCount: number
			methodCount: number
			hasClassLevelMapping: boolean
		},
	): ArchCheckResult => {
		const check3 = fields.check3 ?? true
		return {
			filePath: `/p/web/${fileName}`,
			fileName,
			parentPath: "/p/web",
			check1: true,
			result: fields.check2 && check3 ? "OK" : "NotFound",
			type: "Controller",
			...fields,
			check3,
		}
	}

	function readCsv(dir: string, layer: string): string[] {
		const file = fs.readdirSync(dir).find((f) => f.startsWith(`Result_${layer}_`) && f.endsWith(".csv"))
		if (!file) {
			throw new Error(`${layer} CSV not written`)
		}
		return fs.readFileSync(path.join(dir, file), "utf8").trimEnd().split("\n")
	}

	it("Controller의 Mapping Annotation 열은 화면 규칙(FAIL / Class level / a/b / PASS)을, 'DAO X' 열은 PASS/FAIL을 쓴다", async () => {
		const outDir = makeProject({})
		const results: ArchCheckResults = {
			Controller: {
				totalFiles: 5,
				passedFiles: 3,
				failedFiles: 2,
				results: [
					controller("NoMappingController.java", {
						check2: false,
						mappedMethodCount: 0,
						methodCount: 1,
						hasClassLevelMapping: false,
					}),
					controller("ClassLevelController.java", {
						check2: true,
						mappedMethodCount: 0,
						methodCount: 1,
						hasClassLevelMapping: true,
					}),
					controller("PartialController.java", {
						check2: true,
						mappedMethodCount: 2,
						methodCount: 3,
						hasClassLevelMapping: false,
					}),
					controller("FullController.java", {
						check2: true,
						mappedMethodCount: 3,
						methodCount: 3,
						hasClassLevelMapping: false,
					}),
					controller("DaoController.java", {
						check2: true,
						check3: false,
						mappedMethodCount: 3,
						methodCount: 3,
						hasClassLevelMapping: false,
					}),
				],
			},
			Service: {
				totalFiles: 1,
				passedFiles: 1,
				failedFiles: 0,
				results: [
					{
						filePath: "/p/service/UserServiceImpl.java",
						fileName: "UserServiceImpl.java",
						parentPath: "/p/service",
						check1: true,
						check2: true,
						check3: true,
						result: "OK",
						type: "Service",
					},
				],
			},
		}

		await exportArchResults(results, outDir)

		expect(readCsv(outDir, "Controller")).toEqual([
			"Path,FileName,@Controller,Mapping Annotation,DAO X,Result",
			"/p/web,NoMappingController.java,PASS,FAIL,PASS,NotFound",
			"/p/web,ClassLevelController.java,PASS,Class level,PASS,OK",
			"/p/web,PartialController.java,PASS,2/3,PASS,OK",
			"/p/web,FullController.java,PASS,PASS,PASS,OK",
			"/p/web,DaoController.java,PASS,PASS,FAIL,NotFound",
		])
		// 다른 레이어는 종전대로 PASS/FAIL만 쓴다
		expect(readCsv(outDir, "Service")[1]).toBe("/p/service,UserServiceImpl.java,PASS,PASS,PASS,OK")
	})

	it("DAO CSV는 Style/Base/Bean/Version 열에 상세 문자열을 쓰고 쉼표가 든 셀은 인용한다", async () => {
		const outDir = makeProject({})
		const dao = (fileName: string, parentPath: string, fields: Partial<ArchCheckResult>): ArchCheckResult => ({
			filePath: `${parentPath}/${fileName}`,
			fileName,
			parentPath,
			type: "DAO",
			check1: true,
			check2: true,
			check3: true,
			result: "OK",
			...fields,
		})
		await exportArchResults(
			{
				DAO: {
					totalFiles: 4,
					passedFiles: 1,
					failedFiles: 3,
					results: [
						dao("CmmUseDAO.java", "/p/dao", {
							daoStyle: "mybatisDao",
							check1Detail: "MyBatis DAO",
							inheritancePath: ["EgovComAbstractDAO"],
							check2Detail: "@Repository",
							check3State: "pass",
							check3Detail: "5.x",
						}),
						dao("BoardMapper.java", "/p/mapper", {
							daoStyle: "mapperInterface",
							check1Detail: "Mapper IF",
							check2: false,
							check2Detail: "mybatis @Mapper",
							check3State: "skipped",
							check3Detail: "n/a",
							result: "NotFound",
						}),
						dao("JarDAO.java", "/p/dao", {
							check1: false,
							check1Detail: "parent CommonDAO not found",
							check2Detail: "@Repository",
							check3State: "skipped",
							check3Detail: "n/a",
							result: "NotFound",
						}),
						dao("OldMapper.java", "/p/odd,dir", {
							daoStyle: "mapperInterface",
							check1Detail: "Mapper IF",
							check2Detail: "egov",
							check3: false,
							check3State: "fail",
							check3Detail: "@Mapper → 5.x requires @EgovMapper",
							result: "NotFound",
						}),
					],
				},
			},
			outDir,
		)
		expect(readCsv(outDir, "DAO")).toEqual([
			"Path,FileName,Style,Base,Bean,Version,Result",
			"/p/dao,CmmUseDAO.java,MyBatis DAO,PASS via EgovComAbstractDAO,PASS (@Repository),PASS (5.x),OK",
			"/p/mapper,BoardMapper.java,Mapper IF,PASS,FAIL (mybatis @Mapper),n/a,NotFound",
			"/p/dao,JarDAO.java,-,FAIL (parent CommonDAO not found),PASS (@Repository),n/a,NotFound",
			'"/p/odd,dir",OldMapper.java,Mapper IF,PASS,PASS (egov),FAIL (@Mapper → 5.x requires @EgovMapper),NotFound',
		])
		expect(fs.readdirSync(outDir).some((f) => f.startsWith("Result_Mapper_"))).toBe(false)
	})

	const projectSummary = (overrides: Partial<ProjectCheckSummary> = {}): ProjectCheckSummary => ({
		generation: "5.x",
		version: "5.0.0",
		versionConsistency: { state: "pass", versions: ["5.0.0"], evidence: "managed by BOM egovframe-web-config-parent:5.0.0" },
		modules: [
			{
				buildFile: "pom.xml",
				buildTool: "maven",
				aggregate: false,
				runtime: {
					generation: "5.x",
					version: "5.0.0",
					source: "bom",
					evidence: "bom egovframe-web-config-parent:5.0.0 (assumed = rte version)",
				},
				requiredLibraries: [
					{ name: "ptl-mvc", status: "direct", evidence: "declared org.egovframe.rte:egovframe-rte-ptl-mvc" },
					{
						name: "fdl-cmmn",
						status: "transitive",
						via: ["ptl-mvc", "fdl-cmmn"],
						evidence: "via ptl-mvc > fdl-cmmn (static graph 5.0.x)",
					},
					{
						name: "fdl-logging",
						status: "transitive",
						via: ["psl-dataaccess", "fdl-logging"],
						evidence: "via psl-dataaccess > fdl-logging (static graph 5.0.x)",
					},
					{
						name: "psl-dataaccess",
						status: "direct",
						evidence: "declared org.egovframe.rte:egovframe-rte-psl-dataaccess",
					},
				],
				result: "OK",
			},
		],
		result: "OK",
		...overrides,
	})

	it("Project CSV는 Module,Item,Status,Evidence 머리글과 projectReportRows 행을 쓰고 쉼표가 든 셀만 인용한다", async () => {
		const outDir = makeProject({})
		await exportArchResults({ project: projectSummary() }, outDir)
		expect(readCsv(outDir, "Project")).toEqual([
			"Module,Item,Status,Evidence",
			"pom.xml,runtime,5.0.0 (5.x),bom egovframe-web-config-parent:5.0.0 (assumed = rte version)",
			"pom.xml,ptl-mvc,direct,declared org.egovframe.rte:egovframe-rte-ptl-mvc",
			"pom.xml,fdl-cmmn,transitive,via ptl-mvc > fdl-cmmn (static graph 5.0.x)",
			"pom.xml,fdl-logging,transitive,via psl-dataaccess > fdl-logging (static graph 5.0.x)",
			"pom.xml,psl-dataaccess,direct,declared org.egovframe.rte:egovframe-rte-psl-dataaccess",
			"pom.xml,result,OK,",
			"*,version-consistency,PASS,managed by BOM egovframe-web-config-parent:5.0.0",
			"*,result,OK,5.x 5.0.0",
		])
		const written = fs.readdirSync(outDir)
		expect(written.filter((f) => f.startsWith("Result_"))).toHaveLength(1)
		expect(written.some((f) => f.startsWith("Result_Mapper_") || f.startsWith("Result_project_"))).toBe(false)

		const mixedDir = makeProject({})
		await exportArchResults(
			{
				project: projectSummary({
					version: undefined,
					versionConsistency: { state: "fail", versions: ["5.0.0", "5.0.2"], evidence: "5.0.0, 5.0.2" },
					result: "NotFound",
				}),
			},
			mixedDir,
		)
		expect(readCsv(mixedDir, "Project").slice(-2)).toEqual([
			'*,version-consistency,FAIL,"5.0.0, 5.0.2"',
			"*,result,NotFound,5.x",
		])
	})
})
