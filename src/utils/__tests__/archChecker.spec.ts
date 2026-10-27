import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import {
	checkEgovArchitecture,
	exportArchResults,
	EXCLUDED_DIRECTORY_NAMES,
	type ArchCheckResult,
	type ArchCheckResults,
} from "../archChecker"
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
		// 프로젝트 안에 SampleMapper.java가 있으므로 DAO 역할의 Mapper 주입으로 본다
		expect(resultOf(results, "Controller", "MapperController.java")).toMatchObject({ check3: false, result: "NotFound" })
		expect(resultOf(results, "Controller", "CtorController.java")).toMatchObject({ check3: false, result: "NotFound" })
		// 프로젝트에 없는 라이브러리 타입(ObjectMapper)은 DAO로 보지 않는다
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
})
