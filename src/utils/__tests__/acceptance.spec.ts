import * as fs from "fs"
import * as path from "path"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { checkEgovArchitecture, type ArchCheckResults } from "../archChecker"
import { resolveRipgrepPath } from "../ripgrepPath"

/**
 * 공식 템플릿 6종 인수 검증 (스펙 8.1).
 * EGOV_ACCEPTANCE_DIR 아래에 템플릿 ZIP을 템플릿 이름의 디렉터리로 풀어 둔 경우에만 돈다.
 *   EGOV_ACCEPTANCE_DIR=/path/to/dir npx vitest run src/utils/__tests__/acceptance.spec.ts
 */
const ACCEPTANCE_DIR = process.env.EGOV_ACCEPTANCE_DIR ?? ""

/** 저장소 node_modules에 npm이 설치한 @vscode/ripgrep 플랫폼 패키지의 rg가 있으면 ripgrep으로 돈다 */
const bundledRg = resolveRipgrepPath({ extensionPath: path.resolve(__dirname, "../../..") })

const TIMEOUT = 120_000

function projectDir(relative: string): string {
	return path.join(ACCEPTANCE_DIR, relative)
}

async function run(relative: string): Promise<ArchCheckResults> {
	return checkEgovArchitecture(projectDir(relative), undefined, { rgPath: bundledRg ?? undefined })
}

function summarize(name: string, results: ArchCheckResults): void {
	const lines: string[] = [`[acceptance] ${name} (${bundledRg ? "ripgrep" : "fs"})`]
	for (const layer of ["Controller", "Service", "DAO"] as const) {
		const s = results[layer]
		if (s) {
			lines.push(
				`  ${layer}: total=${s.totalFiles} passed=${s.passedFiles} failed=${s.failedFiles} skipped=${s.skipped?.length ?? 0}`,
			)
		}
	}
	const skipped = results.DAO?.skipped ?? []
	if (skipped.length > 0) {
		lines.push(`  DAO skipped: ${skipped.map((s) => `${s.fileName}(${s.reason})`).join(", ")}`)
	}
	const notFound = (results.DAO?.results ?? []).filter((r) => r.result === "NotFound")
	if (notFound.length > 0) {
		lines.push(`  DAO NotFound: ${notFound.map((r) => r.fileName).join(", ")}`)
	}
	const failedControllers = (results.Controller?.results ?? []).filter((r) => !r.check3)
	if (failedControllers.length > 0) {
		lines.push(`  Controller check3=false: ${failedControllers.map((r) => r.fileName).join(", ")}`)
	}
	const p = results.project
	if (p) {
		lines.push(
			`  project: result=${p.result} generation=${p.generation} version=${p.version ?? "-"} consistency=${p.versionConsistency.state}`,
		)
		for (const m of p.modules) {
			lines.push(
				`    ${m.buildFile} [${m.result}] ${m.requiredLibraries.map((l) => `${l.name}=${l.status}`).join(" ") || "(aggregate)"}`,
			)
		}
	}
	console.info(lines.join("\n"))
}

function daoResult(results: ArchCheckResults, fileName: string) {
	const found = results.DAO?.results.find((r) => r.fileName === fileName)
	if (!found) {
		throw new Error(`${fileName} not in DAO results`)
	}
	return found
}

function skippedOf(results: ArchCheckResults, fileName: string) {
	return results.DAO?.skipped?.find((s) => s.fileName === fileName)
}

describe.skipIf(!ACCEPTANCE_DIR)("아키텍처 점검 인수 검증 (공식 템플릿 6종)", () => {
	beforeAll(() => {
		// 엔진은 파일마다 console.log/console.error를 남기므로 숨기고, 요약용 console.info는 둔다
		vi.spyOn(console, "log").mockImplementation(() => {})
		vi.spyOn(console, "error").mockImplementation(() => {})
	})
	afterAll(() => {
		vi.restoreAllMocks()
	})

	for (const name of ["egovframe-web", "egovframe-boot-web"]) {
		it.skipIf(!fs.existsSync(projectDir(name)))(
			`${name}: SampleMapper OK, project OK`,
			async () => {
				const results = await run(name)
				summarize(name, results)

				const sample = daoResult(results, "SampleMapper.java")
				expect(sample.result).toBe("OK")
				expect(sample.daoStyle).toBe("mapperInterface")
				expect(sample.check2Detail).toBe("egov")
				expect(sample.check3Detail).toBe("5.x")
				expect(results.project?.result).toBe("OK")
				if (name === "egovframe-boot-web") {
					expect(skippedOf(results, "EgovConfigMapper.java")?.reason).toBe("configuration")
				}
			},
			TIMEOUT,
		)
	}

	it.skipIf(!fs.existsSync(projectDir("egovframe-template-common-components")))(
		"egovframe-template-common-components: DAO 152 (OK 151, NotFound 1), skipped 3, project OK",
		async () => {
			const name = "egovframe-template-common-components"
			const results = await run(name)
			summarize(name, results)

			const dao = results.DAO
			expect(dao?.totalFiles).toBe(152)
			expect(dao?.passedFiles).toBe(151)
			expect(dao?.failedFiles).toBe(1)
			expect(dao?.results.filter((r) => r.result === "NotFound").map((r) => r.fileName)).toEqual(["SmsBasicDAO.java"])

			expect(dao?.skipped).toHaveLength(3)
			expect(skippedOf(results, "EgovComAbstractDAO.java")?.reason).toBe("abstract")
			expect(skippedOf(results, "OrgManageLdapDAO.java")?.reason).toBe("base-class")
			expect(skippedOf(results, "ObjectMapper.java")?.reason).toBe("not-data-access")

			expect(results.project?.result).toBe("OK")
			// ObjectMapper 주입 때문에 실패하는 Controller가 없어야 한다 (check3 false 목록은 요약에 출력)
			const failedControllers = (results.Controller?.results ?? []).filter((r) => !r.check3)
			expect(failedControllers.filter((r) => r.fileName.includes("ObjectMapper"))).toEqual([])
		},
		TIMEOUT,
	)

	it.skipIf(!fs.existsSync(projectDir("egovframe-boot-simple-backend")))(
		"egovframe-boot-simple-backend: DAO 12개 OK, EgovConfigAppMapper skipped, 일관성 pass",
		async () => {
			const name = "egovframe-boot-simple-backend"
			const results = await run(name)
			summarize(name, results)

			expect(results.DAO?.totalFiles).toBe(12)
			expect(results.DAO?.passedFiles).toBe(12)
			expect(results.DAO?.failedFiles).toBe(0)
			expect(skippedOf(results, "EgovConfigAppMapper.java")).toBeDefined()
			expect(results.project?.versionConsistency.state).toBe("pass")
		},
		TIMEOUT,
	)

	it.skipIf(!fs.existsSync(projectDir("egovframe-boot-batch-db-web")))(
		"egovframe-boot-batch-db-web: DAO 0, skipped 2, project NotFound(ptl-mvc missing)",
		async () => {
			const name = "egovframe-boot-batch-db-web"
			const results = await run(name)
			summarize(name, results)

			expect(results.DAO?.totalFiles ?? 0).toBe(0)
			expect(results.DAO?.skipped).toHaveLength(2)
			expect(skippedOf(results, "EgovConfigMapper.java")?.reason).toBe("configuration")
			expect(skippedOf(results, "CustomerCreditRowMapper.java")?.reason).toBe("not-data-access")
			expect(results.project?.result).toBe("NotFound")
			const libs = results.project?.modules.flatMap((m) => m.requiredLibraries) ?? []
			expect(libs.find((l) => l.name === "ptl-mvc")?.status).toBe("missing")
		},
		TIMEOUT,
	)

	it.skipIf(!fs.existsSync(projectDir("egovframe-msa-portal-backend/msa-board-service")))(
		"egovframe-msa-portal-backend/msa-board-service: project Unknown, fdl-logging unknown",
		async () => {
			const name = "egovframe-msa-portal-backend/msa-board-service"
			const results = await run(name)
			summarize(name, results)

			expect(results.project?.result).toBe("Unknown")
			const libs = results.project?.modules.flatMap((m) => m.requiredLibraries) ?? []
			expect(libs.find((l) => l.name === "fdl-cmmn")?.status).toBe("direct")
			const logging = libs.find((l) => l.name === "fdl-logging")
			expect(logging?.status).toBe("unknown")
			expect(logging?.evidence).toContain("may be transitive via org.egovframe.cloud:egovframe-cloud-module-common")
		},
		TIMEOUT,
	)
})
