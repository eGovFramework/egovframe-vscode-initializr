import { describe, it, expect } from "vitest"
import type { RuntimeGeneration } from "../../shared/archCheck"
import { checkDaoLayer } from "../daoCheck"
import { buildJavaIndex, type ReadFile } from "../javaIndex"
import { createCachedReader } from "../javaSource"

type Generation = RuntimeGeneration | "unknown"

const EGOV4 = "org.egovframe.rte.psl.dataaccess"
const EGOV3 = "egovframework.rte.psl.dataaccess"

/** `package …;` + import 줄 + 본문 */
function java(pkg: string, imports: string[], body: string): string {
	return [`package ${pkg};`, "", ...imports.map((name) => `import ${name};`), "", body, ""].join("\n")
}

/** 테스트 픽스처를 색인하고 DAO 레이어를 점검한다. 파일 이름이 DAO/Dao/Mapper로 끝나는 파일만 수집 대상이다 */
function setup(files: Record<string, string>, gen: Generation) {
	const readFile: ReadFile = (p) => files[p]
	const index = buildJavaIndex(Object.keys(files), readFile)
	const daoPaths = Object.keys(files).filter((p) => /(DAO|Dao|Mapper)\.java$/.test(p))
	const outcome = checkDaoLayer(daoPaths, index, readFile, () => gen)
	return {
		outcome,
		daoPaths,
		r: (fileName: string) => outcome.results.find((result) => result.fileName === fileName)!,
		skippedOf: (fileName: string) => outcome.skipped.find((skipped) => skipped.fileName === fileName)!,
		reasons: Object.fromEntries(outcome.skipped.map((s) => [s.fileName, s.reason])),
	}
}

/** 공통컴포넌트의 중간 기반 클래스: egov4 EgovAbstractMapper를 import해 상속하는 abstract 클래스 */
const EGOV_COM_ABSTRACT_DAO = java(
	"a.cmmn",
	[`${EGOV4}.EgovAbstractMapper`],
	"public abstract class EgovComAbstractDAO extends EgovAbstractMapper {\n}",
)

/** 간접 상속 픽스처: 직접 경유(CmmUseDAO)와 2단계 경유(DeepDAO) */
function indirectFixture(): Record<string, string> {
	return {
		"/p/a/cmmn/EgovComAbstractDAO.java": EGOV_COM_ABSTRACT_DAO,
		"/p/a/dao/CmmUseDAO.java": java(
			"a.dao",
			["a.cmmn.EgovComAbstractDAO", "org.springframework.stereotype.Repository"],
			'@Repository("cmmUseDAO")\npublic class CmmUseDAO extends EgovComAbstractDAO {\n}',
		),
		"/p/a/cmmn/Mid.java": java("a.cmmn", [], "public abstract class Mid extends EgovComAbstractDAO {\n}"),
		"/p/a/dao/DeepDAO.java": java(
			"a.dao",
			["a.cmmn.Mid", "org.springframework.stereotype.Repository"],
			"@Repository\npublic class DeepDAO extends Mid {\n}",
		),
	}
}

describe("checkDaoLayer", () => {
	it("세 방식 직접 상속·선언: iBatis/MyBatis DAO는 @Repository, Mapper IF는 egov 출처로 OK", () => {
		const gen4 = setup(
			{
				"/p/a/dao/UserDAO.java": java(
					"a.dao",
					[`${EGOV4}.EgovAbstractDAO`, "org.springframework.stereotype.Repository"],
					'@Repository("userDAO")\npublic class UserDAO extends EgovAbstractDAO {\n}',
				),
			},
			"4.x",
		)
		expect(gen4.r("UserDAO.java")).toMatchObject({
			daoStyle: "ibatisDao",
			check1Detail: "iBatis DAO",
			check2Detail: "@Repository",
			check3State: "pass",
			check3Detail: "4.x",
			inheritancePath: [],
			result: "OK",
		})

		const gen5 = setup(
			{
				"/p/a/dao/BoardDAO.java": java(
					"a.dao",
					[
						`${EGOV4}.EgovAbstractMapper`,
						"org.springframework.stereotype.Repository",
						"org.springframework.transaction.annotation.Transactional",
					],
					'@Repository("boardDAO")\n@Transactional\npublic class BoardDAO extends EgovAbstractMapper {\n}',
				),
				"/p/a/mapper/SampleMapper.java": java(
					"a.mapper",
					[`${EGOV4}.mapper.EgovMapper`],
					'@EgovMapper("sampleMapper")\npublic interface SampleMapper {\n}',
				),
			},
			"5.x",
		)
		expect(gen5.r("BoardDAO.java")).toMatchObject({ daoStyle: "mybatisDao", check3Detail: "5.x", result: "OK" })
		expect(gen5.r("SampleMapper.java")).toMatchObject({
			daoStyle: "mapperInterface",
			check1Detail: "Mapper IF",
			check2Detail: "egov",
			check3Detail: "5.x",
			annotationText: '@EgovMapper("sampleMapper")',
			result: "OK",
		})
	})

	it("3.x: egovframework.rte 기반 클래스와 @Mapper가 3.x 프로젝트에서 통과한다 (직접·간접)", () => {
		const { r } = setup(
			{
				"/p/a/dao/OldDAO.java": java(
					"a.dao",
					[`${EGOV3}.EgovAbstractDAO`, "org.springframework.stereotype.Repository"],
					"@Repository\npublic class OldDAO extends EgovAbstractDAO {\n}",
				),
				"/p/a/cmmn/OldBase.java": java(
					"a.cmmn",
					[`${EGOV3}.EgovAbstractDAO`],
					"public abstract class OldBase extends EgovAbstractDAO {\n}",
				),
				"/p/a/dao/ViaOldDAO.java": java(
					"a.dao",
					["a.cmmn.OldBase", "org.springframework.stereotype.Repository"],
					"@Repository\npublic class ViaOldDAO extends OldBase {\n}",
				),
				"/p/a/mapper/OldMapper.java": java(
					"a.mapper",
					[`${EGOV3}.mapper.Mapper`],
					'@Mapper("oldMapper")\npublic interface OldMapper {\n}',
				),
			},
			"3.x",
		)
		expect(r("OldDAO.java")).toMatchObject({ daoStyle: "ibatisDao", check3State: "pass", check3Detail: "3.x", result: "OK" })
		expect(r("ViaOldDAO.java")).toMatchObject({ inheritancePath: ["OldBase"], check3Detail: "3.x", result: "OK" })
		expect(r("OldMapper.java")).toMatchObject({
			check2Detail: "egov",
			check3State: "pass",
			check3Detail: "3.x",
			result: "OK",
		})
	})

	it("간접 상속: 중간 abstract 클래스에만 import가 있어도 종점 파일에서 출처를 읽고 경유 경로를 싣는다", () => {
		const { r, skippedOf } = setup(indirectFixture(), "5.x")
		expect(r("CmmUseDAO.java")).toMatchObject({ inheritancePath: ["EgovComAbstractDAO"], check3Detail: "5.x", result: "OK" })
		expect(r("DeepDAO.java")).toMatchObject({ inheritancePath: ["Mid", "EgovComAbstractDAO"], result: "OK" })
		expect(skippedOf("EgovComAbstractDAO.java")).toMatchObject({ reason: "abstract" })
	})

	it("S2·S3·S4·S5·S7: 설정 클래스, 비데이터 접근 Mapper, Spring Data, MapStruct, enum은 제외 목록으로 간다", () => {
		const { outcome, r, reasons } = setup(
			{
				"/p/a/config/EgovConfigMapper.java": java(
					"a.config",
					["org.springframework.context.annotation.Configuration"],
					"@Configuration\npublic class EgovConfigMapper {\n}",
				),
				"/p/a/batch/CustomerCreditRowMapper.java": java(
					"a.batch",
					["org.springframework.jdbc.core.RowMapper"],
					"public class CustomerCreditRowMapper implements RowMapper<CustomerCredit> {\n}",
				),
				"/p/a/order/OrderDao.java": java(
					"a.order",
					["org.springframework.data.jpa.repository.JpaRepository"],
					"public interface OrderDao extends JpaRepository<Order, Long> {\n}",
				),
				"/p/a/car/CarMapper.java": java("a.car", ["org.mapstruct.Mapper"], "@Mapper\npublic interface CarMapper {\n}"),
				"/p/a/status/StatusDao.java": java("a.status", [], "public enum StatusDao {\n\tON, OFF\n}"),
				"/p/a/foo/FooMapper.java": java(
					"a.foo",
					["org.springframework.stereotype.Component"],
					"@Component\npublic class FooMapper {\n}",
				),
			},
			"unknown",
		)
		expect(reasons).toEqual({
			"EgovConfigMapper.java": "configuration",
			"CustomerCreditRowMapper.java": "not-data-access",
			"OrderDao.java": "spring-data",
			"CarMapper.java": "mapstruct",
			"StatusDao.java": "not-a-class",
		})
		expect(r("FooMapper.java")).toMatchObject({
			check1: false,
			check1Detail: "no egov base",
			daoStyle: undefined,
			result: "NotFound",
		})
		expect(outcome.judgedTypeNames.has("CustomerCreditRowMapper")).toBe(false)
		expect(outcome.judgedTypeNames.has("FooMapper")).toBe(true)
	})

	it("S6: @Repository 없는 concrete 기반 클래스는 base-class로 제외하고, 그 자식은 2단계 경유로 OK", () => {
		const { r, skippedOf } = setup(
			{
				"/p/a/cmmn/EgovComAbstractDAO.java": EGOV_COM_ABSTRACT_DAO,
				"/p/a/cmmn/OrgManageLdapDAO.java": java(
					"a.cmmn",
					[],
					"public class OrgManageLdapDAO extends EgovComAbstractDAO {\n}",
				),
				"/p/a/dao/UserManageLdapDAO.java": java(
					"a.dao",
					["a.cmmn.OrgManageLdapDAO", "org.springframework.stereotype.Repository"],
					'@Repository("userManageLdapDAO")\npublic class UserManageLdapDAO extends OrgManageLdapDAO {\n}',
				),
				"/p/a/dao/DeptManageLdapDAO.java": java(
					"a.dao",
					["a.cmmn.OrgManageLdapDAO", "org.springframework.stereotype.Repository"],
					'@Repository("deptManageLdapDAO")\npublic class DeptManageLdapDAO extends OrgManageLdapDAO {\n}',
				),
			},
			"5.x",
		)
		expect(skippedOf("OrgManageLdapDAO.java")).toMatchObject({ reason: "base-class", detail: "base of 2 classes" })
		expect(r("UserManageLdapDAO.java")).toMatchObject({
			inheritancePath: ["OrgManageLdapDAO", "EgovComAbstractDAO"],
			result: "OK",
		})
		expect(r("OrgManageLdapDAO.java")).toBeUndefined()
	})

	it("check2 출처 해석: MyBatis @Mapper, 와일드카드 2개(세대 표로 확정/모호), 섀도잉, FQCN 어노테이션, 나뉜 import, 블록 주석 안 import", () => {
		const gen5 = setup(
			{
				"/p/a/mapper/Wild5Mapper.java": java(
					"a.mapper",
					["org.apache.ibatis.annotations.*", `${EGOV4}.mapper.*`],
					"@Mapper\npublic interface Wild5Mapper {\n}",
				),
				"/p/a/mapper/FqcnMapper.java": java(
					"a.mapper",
					[],
					`@${EGOV4}.mapper.EgovMapper("m")\npublic interface FqcnMapper {\n}`,
				),
				"/p/a/mapper/SplitMapper.java": `package a.mapper;\n\nimport\n  ${EGOV4}.mapper.EgovMapper;\n\n@EgovMapper\npublic interface SplitMapper {\n}\n`,
				"/p/a/copy/EgovAbstractMapper.java": java(
					"a.copy",
					["org.mybatis.spring.support.SqlSessionDaoSupport"],
					"public abstract class EgovAbstractMapper extends SqlSessionDaoSupport {\n}",
				),
				"/p/a/copy/WildCopyDAO.java": java(
					"a.copy",
					[`${EGOV4}.*`, "org.springframework.stereotype.Repository"],
					"@Repository\npublic class WildCopyDAO extends EgovAbstractMapper {\n}",
				),
			},
			"5.x",
		)
		expect(gen5.r("Wild5Mapper.java")).toMatchObject({ check2: false, check2Detail: "mybatis @Mapper", result: "NotFound" })
		expect(gen5.r("FqcnMapper.java")).toMatchObject({
			check2: true,
			check2Detail: "egov",
			check3State: "pass",
			check3Detail: "5.x",
		})
		expect(gen5.r("SplitMapper.java")).toMatchObject({ check2Detail: "egov", result: "OK" })
		expect(gen5.r("WildCopyDAO.java")).toMatchObject({
			check1: true,
			check2: false,
			check2Detail: "EgovAbstractMapper copied into project",
			check3State: "skipped",
			result: "NotFound",
		})

		const gen4 = setup(
			{
				"/p/a/mapper/MybatisMapper.java": java(
					"a.mapper",
					["org.apache.ibatis.annotations.Mapper"],
					"@Mapper\npublic interface MybatisMapper {\n}",
				),
				"/p/a/mapper/Wild4Mapper.java": java(
					"a.mapper",
					["org.apache.ibatis.annotations.*", `${EGOV4}.mapper.*`],
					"@Mapper\npublic interface Wild4Mapper {\n}",
				),
				"/p/a/mapper/ShadowMapper.java": java(
					"a.mapper",
					["org.apache.ibatis.annotations.Mapper", `${EGOV4}.mapper.*`],
					"@Mapper\npublic interface ShadowMapper {\n}",
				),
				"/p/a/mapper/CommentMapper.java": `package a.mapper;\n\n/* import org.apache.ibatis.annotations.Mapper; */\nimport ${EGOV4}.mapper.Mapper;\n\n@Mapper\npublic interface CommentMapper {\n}\n`,
				"/p/a/mapper/LoneMapper.java": java("a.mapper", [], "@Mapper\npublic interface LoneMapper {\n}"),
				"/p/a/custom/Mapper.java": java("a.custom", [], "public @interface Mapper {\n}"),
				"/p/a/custom/NoImportMapper.java": java("a.custom", [], "@Mapper\npublic interface NoImportMapper {\n}"),
			},
			"4.x",
		)
		expect(gen4.r("MybatisMapper.java")).toMatchObject({
			check2: false,
			check2Detail: "mybatis @Mapper",
			check3State: "skipped",
			check3Detail: "n/a",
			result: "NotFound",
		})
		expect(gen4.r("Wild4Mapper.java")).toMatchObject({ check2: false, check2Detail: "unresolved import" })
		expect(gen4.r("ShadowMapper.java")).toMatchObject({ check2: false, check2Detail: "mybatis @Mapper" })
		expect(gen4.r("CommentMapper.java")).toMatchObject({
			check2Detail: "egov",
			check3State: "pass",
			check3Detail: "4.x",
			result: "OK",
		})
		expect(gen4.r("NoImportMapper.java")).toMatchObject({ check2: false, check2Detail: "custom annotation" })
		expect(gen4.r("LoneMapper.java")).toMatchObject({ check2: false, check2Detail: "unresolved import" })
	})

	it("로컬 복사본·동명 부모·부모 없음·MapperScan", () => {
		const { r } = setup(
			{
				"/p/a/dao/EgovAbstractMapper.java": java(
					"a.dao",
					["org.mybatis.spring.support.SqlSessionDaoSupport"],
					"public abstract class EgovAbstractMapper extends SqlSessionDaoSupport {\n}",
				),
				"/p/a/dao/CopyDAO.java": java(
					"a.dao",
					["org.springframework.stereotype.Repository"],
					"@Repository\npublic class CopyDAO extends EgovAbstractMapper {\n}",
				),
				"/p/a/dao/BaseDAO.java": java(
					"a.dao",
					[`${EGOV4}.EgovAbstractDAO`],
					"public class BaseDAO extends EgovAbstractDAO {\n}",
				),
				"/p/b/dao/BaseDAO.java": java("b.dao", [], "public class BaseDAO {\n}"),
				"/p/a/dao/ViaBaseDAO.java": java(
					"a.dao",
					["org.springframework.stereotype.Repository"],
					"@Repository\npublic class ViaBaseDAO extends BaseDAO {\n}",
				),
				"/p/b/dao/OtherDAO.java": java(
					"b.dao",
					["org.springframework.stereotype.Repository"],
					"@Repository\npublic class OtherDAO extends BaseDAO {\n}",
				),
				"/p/a/dao/JarDAO.java": java(
					"a.dao",
					["org.springframework.stereotype.Repository"],
					"@Repository\npublic class JarDAO extends CommonDAO {\n}",
				),
				"/p/a/cfg/ScanMapper.java": java(
					"a.cfg",
					["org.mybatis.spring.annotation.MapperScan"],
					'@MapperScan("a")\npublic interface ScanMapper {\n}',
				),
			},
			"5.x",
		)
		expect(r("CopyDAO.java")).toMatchObject({
			check2: false,
			check2Detail: "EgovAbstractMapper copied into project",
			check3State: "skipped",
			check3Detail: "n/a",
		})
		expect(r("ViaBaseDAO.java")).toMatchObject({ inheritancePath: ["BaseDAO"], result: "OK" })
		expect(r("OtherDAO.java")).toMatchObject({ check1: false, check1Detail: "no egov base", result: "NotFound" })
		expect(r("JarDAO.java")).toMatchObject({ check1: false, check1Detail: "parent CommonDAO not found", result: "NotFound" })
		expect(r("ScanMapper.java")).toMatchObject({ check1: false, check1Detail: "no @Mapper/@EgovMapper", result: "NotFound" })
	})

	it("세대: unknown이면 check3 n/a로 두고 OK, 불일치는 실패", () => {
		const egov4Mapper = {
			"/p/a/mapper/GenMapper.java": java(
				"a.mapper",
				[`${EGOV4}.mapper.Mapper`],
				"@Mapper\npublic interface GenMapper {\n}",
			),
		}
		expect(setup(egov4Mapper, "unknown").r("GenMapper.java")).toMatchObject({
			check3State: "skipped",
			check3Detail: "n/a",
			check3: true,
			result: "OK",
		})
		expect(setup(egov4Mapper, "5.x").r("GenMapper.java")).toMatchObject({
			check3State: "fail",
			check3Detail: "@Mapper → 5.x requires @EgovMapper",
			check3: false,
			result: "NotFound",
		})

		const egovMapper = {
			"/p/a/mapper/NewMapper.java": java(
				"a.mapper",
				[`${EGOV4}.mapper.EgovMapper`],
				"@EgovMapper\npublic interface NewMapper {\n}",
			),
		}
		expect(setup(egovMapper, "4.x").r("NewMapper.java")).toMatchObject({
			check3State: "fail",
			check3Detail: "@EgovMapper in 4.x project",
			result: "NotFound",
		})

		const egov3Dao = {
			"/p/a/dao/Gen3DAO.java": java(
				"a.dao",
				[`${EGOV3}.EgovAbstractDAO`, "org.springframework.stereotype.Repository"],
				"@Repository\npublic class Gen3DAO extends EgovAbstractDAO {\n}",
			),
		}
		expect(setup(egov3Dao, "5.x").r("Gen3DAO.java")).toMatchObject({
			check3State: "fail",
			check3Detail: "egovframework.rte (3.x) in 5.x project",
			result: "NotFound",
		})

		const egov4Dao = {
			"/p/a/dao/Gen4DAO.java": java(
				"a.dao",
				[`${EGOV4}.EgovAbstractMapper`, "org.springframework.stereotype.Repository"],
				"@Repository\npublic class Gen4DAO extends EgovAbstractMapper {\n}",
			),
		}
		expect(setup(egov4Dao, "3.x").r("Gen4DAO.java")).toMatchObject({
			check3State: "fail",
			check3Detail: "org.egovframe.rte (4.x+) in 3.x project",
			result: "NotFound",
		})
	})

	it("읽을 수 없는 수집 파일은 unreadable로 제외하고 나머지는 그대로 판정한다", () => {
		const files = indirectFixture()
		files["/p/a/dao/BrokenDAO.java"] = "(unreadable)"
		const readFile: ReadFile = (p) => {
			if (p === "/p/a/dao/BrokenDAO.java") {
				throw new Error("EACCES: permission denied")
			}
			return files[p]
		}
		const index = buildJavaIndex(
			Object.keys(files).filter((p) => p !== "/p/a/dao/BrokenDAO.java"),
			readFile,
		)
		const daoPaths = ["/p/a/dao/CmmUseDAO.java", "/p/a/dao/BrokenDAO.java", "/p/a/dao/DeepDAO.java"]
		const outcome = checkDaoLayer(daoPaths, index, readFile, () => "5.x")
		expect(outcome.results.map((result) => [result.fileName, result.result])).toEqual([
			["CmmUseDAO.java", "OK"],
			["DeepDAO.java", "OK"],
		])
		expect(outcome.skipped).toEqual([
			{
				filePath: "/p/a/dao/BrokenDAO.java",
				fileName: "BrokenDAO.java",
				reason: "unreadable",
				detail: "EACCES: permission denied",
			},
		])
		expect([...outcome.judgedTypeNames].sort()).toEqual(["CmmUseDAO", "DeepDAO"])
	})

	it("체인 추적 중 부모 파일을 읽을 수 없으면 그 부모에서 체인이 끊겨 check1이 실패한다", () => {
		const files: Record<string, string> = {
			"/p/b/cmmn/Base.java": java(
				"b.cmmn",
				[`${EGOV4}.EgovAbstractMapper`],
				"public abstract class Base extends EgovAbstractMapper {\n}",
			),
			"/p/b/dao/ChildDAO.java": java(
				"b.dao",
				["b.cmmn.Base", "org.springframework.stereotype.Repository"],
				"@Repository\npublic class ChildDAO extends Base {\n}",
			),
		}
		const index = buildJavaIndex(Object.keys(files), (p) => files[p])
		const readFile: ReadFile = (p) => {
			if (p === "/p/b/cmmn/Base.java") {
				throw new Error("EIO: i/o error")
			}
			return files[p]
		}
		const outcome = checkDaoLayer(["/p/b/dao/ChildDAO.java"], index, readFile, () => "5.x")
		expect(outcome.skipped).toEqual([])
		expect(outcome.results[0]).toMatchObject({
			fileName: "ChildDAO.java",
			check1: false,
			check1Detail: "parent Base not found",
			result: "NotFound",
		})
	})

	it("파일마다 한 번만 읽는다 (색인 + 분류 + 체인 추적)", () => {
		const files = indirectFixture()
		const calls = new Map<string, number>()
		const counting: ReadFile = (p) => {
			calls.set(p, (calls.get(p) ?? 0) + 1)
			return files[p]
		}
		const cached = createCachedReader(counting)
		const daoPaths = Object.keys(files).filter((p) => /(DAO|Dao|Mapper)\.java$/.test(p))
		const idx = buildJavaIndex(Object.keys(files), cached)
		const outcome = checkDaoLayer(daoPaths, idx, cached, () => "5.x")
		expect(outcome.results.map((result) => result.result)).toEqual(["OK", "OK"])
		expect([...calls.keys()].sort()).toEqual(Object.keys(files).sort())
		expect([...calls.values()].every((n) => n === 1)).toBe(true)
	})
})
