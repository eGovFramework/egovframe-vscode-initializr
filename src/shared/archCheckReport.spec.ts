import { describe, expect, it } from "vitest"
import type { BuildModuleCheck, ProjectCheckSummary } from "./archCheck"
import { projectReportRows } from "./archCheckReport"

const aggregateModule: BuildModuleCheck = {
	buildFile: "pom.xml",
	buildTool: "maven",
	aggregate: true,
	runtime: { generation: "unknown", source: "none", evidence: "no runtime evidence" },
	requiredLibraries: [],
	result: "Skipped",
}

const webModule: BuildModuleCheck = {
	buildFile: "web/pom.xml",
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
		{ name: "fdl-logging", status: "unknown", evidence: "may be transitive via com.ex:common-lib" },
		{ name: "psl-dataaccess", status: "missing", evidence: "not declared" },
	],
	result: "NotFound",
	notes: ["profiles ignored"],
}

const summary: ProjectCheckSummary = {
	generation: "5.x",
	version: "5.0.0",
	versionConsistency: { state: "pass", versions: ["5.0.0"], evidence: "managed by BOM egovframe-web-config-parent:5.0.0" },
	modules: [aggregateModule, webModule],
	result: "NotFound",
}

describe("projectReportRows", () => {
	it("집계 모듈은 runtime·result 행만, 일반 모듈은 runtime·4종·result 행, 끝에 일관성·종합 행을 둔다", () => {
		const rows = projectReportRows(summary)
		expect(rows).toEqual([
			{ module: "pom.xml", item: "runtime", status: "unknown (unknown)", evidence: "no runtime evidence" },
			{ module: "pom.xml", item: "result", status: "Skipped", evidence: "" },
			{
				module: "web/pom.xml",
				item: "runtime",
				status: "5.0.0 (5.x)",
				evidence: "bom egovframe-web-config-parent:5.0.0 (assumed = rte version)",
			},
			{
				module: "web/pom.xml",
				item: "ptl-mvc",
				status: "direct",
				evidence: "declared org.egovframe.rte:egovframe-rte-ptl-mvc",
			},
			{
				module: "web/pom.xml",
				item: "fdl-cmmn",
				status: "transitive",
				evidence: "via ptl-mvc > fdl-cmmn (static graph 5.0.x)",
			},
			{
				module: "web/pom.xml",
				item: "fdl-logging",
				status: "unknown",
				evidence: "may be transitive via com.ex:common-lib",
			},
			{ module: "web/pom.xml", item: "psl-dataaccess", status: "missing", evidence: "not declared" },
			{ module: "web/pom.xml", item: "result", status: "NotFound", evidence: "profiles ignored" },
			{
				module: "*",
				item: "version-consistency",
				status: "PASS",
				evidence: "managed by BOM egovframe-web-config-parent:5.0.0",
			},
			{ module: "*", item: "result", status: "NotFound", evidence: "5.x 5.0.0" },
		])
		expect(rows).toHaveLength(10)
	})

	it("일관성 fail → FAIL, skipped → n/a이고 버전이 없으면 종합 행 evidence는 세대만 남는다", () => {
		const failed = projectReportRows({
			...summary,
			versionConsistency: { state: "fail", versions: ["5.0.0", "5.0.2"], evidence: "5.0.0, 5.0.2" },
		})
		expect(failed.at(-2)).toEqual({ module: "*", item: "version-consistency", status: "FAIL", evidence: "5.0.0, 5.0.2" })

		const empty = projectReportRows({
			generation: "unknown",
			versionConsistency: { state: "skipped", versions: [], evidence: "no resolvable version" },
			modules: [],
			result: "Unknown",
		})
		expect(empty).toEqual([
			{ module: "*", item: "version-consistency", status: "n/a", evidence: "no resolvable version" },
			{ module: "*", item: "result", status: "Unknown", evidence: "unknown" },
		])
	})

	it("데이터 접근 설정 finding·경고·미분류 행을 모듈 행 뒤, version-consistency 행 앞에 둔다 (판정에는 영향 없음)", () => {
		const rows = projectReportRows({
			...summary,
			modules: [webModule],
			dataAccessConfig: {
				findings: [
					{
						kind: "mapperConfigurer",
						filePath: "/p/src/main/resources/context-mapper.xml",
						fileName: "context-mapper.xml",
						evidence: "basePackage=egovframework.example",
					},
					{
						kind: "mybatisStarter",
						filePath: "/p/pom.xml",
						fileName: "pom.xml",
						evidence: "mybatis-spring-boot-starter",
					},
				],
				warnings: ["iBatis DAOs exist but no SqlMapClientFactoryBean was found"],
			},
			unclassifiedDataAccessFiles: [
				{
					filePath: "/p/src/main/java/egov/repo/SampleRepository.java",
					fileName: "SampleRepository.java",
					relativePath: "src/main/java/egov/repo/SampleRepository.java",
					evidence: "JdbcTemplate",
				},
			],
		})
		expect(rows.slice(-6)).toEqual([
			{
				module: "*",
				item: "data-access-config",
				status: "mapperConfigurer",
				evidence: "context-mapper.xml: basePackage=egovframework.example",
			},
			{
				module: "*",
				item: "data-access-config",
				status: "mybatisStarter",
				evidence: "pom.xml: mybatis-spring-boot-starter",
			},
			{
				module: "*",
				item: "data-access-config",
				status: "warning",
				evidence: "iBatis DAOs exist but no SqlMapClientFactoryBean was found",
			},
			{
				module: "*",
				item: "unclassified",
				status: "info",
				evidence: "src/main/java/egov/repo/SampleRepository.java: JdbcTemplate",
			},
			{
				module: "*",
				item: "version-consistency",
				status: "PASS",
				evidence: "managed by BOM egovframe-web-config-parent:5.0.0",
			},
			{ module: "*", item: "result", status: "NotFound", evidence: "5.x 5.0.0" },
		])
		expect(rows.at(-7)).toEqual({ module: "web/pom.xml", item: "result", status: "NotFound", evidence: "profiles ignored" })
	})

	it("여러 notes는 '; '로 잇는다", () => {
		const rows = projectReportRows({
			...summary,
			modules: [{ ...webModule, notes: ["profiles ignored", "unparsed: apply from"] }],
		})
		expect(rows.find((r) => r.module === "web/pom.xml" && r.item === "result")?.evidence).toBe(
			"profiles ignored; unparsed: apply from",
		)
	})
})
