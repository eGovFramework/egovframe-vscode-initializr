import { describe, expect, it } from "vitest"
import type { BuildModuleCheck, ProjectCheckSummary, RequiredLibraryName, RuntimeGeneration } from "../../shared/archCheck"
import { checkProjectBuild, generationForFile, generationOfVersion, moduleForFile } from "../buildFileCheck"

const projectPath = "/p"

function run(files: Record<string, string>, manualGeneration?: RuntimeGeneration): ProjectCheckSummary {
	return checkProjectBuild({ projectPath, files: Object.keys(files), readFile: (p) => files[p], manualGeneration })
}

function moduleOf(summary: ProjectCheckSummary, buildFile: string): BuildModuleCheck {
	const module = summary.modules.find((m) => m.buildFile === buildFile)
	if (!module) {
		throw new Error(`no module ${buildFile}: ${summary.modules.map((m) => m.buildFile).join(", ")}`)
	}
	return module
}

function lib(module: BuildModuleCheck, name: RequiredLibraryName) {
	return module.requiredLibraries.find((l) => l.name === name)
}

function statuses(module: BuildModuleCheck): string[] {
	return module.requiredLibraries.map((l) => `${l.name}:${l.status}`)
}

const pom = (body: string) =>
	`<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0">\n<modelVersion>4.0.0</modelVersion>\n${body}\n</project>\n`
const dep = (groupId: string, artifactId: string, version?: string, extra = "") =>
	`<dependency><groupId>${groupId}</groupId><artifactId>${artifactId}</artifactId>${version ? `<version>${version}</version>` : ""}${extra}</dependency>`
const deps = (...items: string[]) => `<dependencies>\n${items.join("\n")}\n</dependencies>`
const parent = (groupId: string, artifactId: string, version: string, extra = "") =>
	`<parent><groupId>${groupId}</groupId><artifactId>${artifactId}</artifactId><version>${version}</version>${extra}</parent>`
const props = (entries: Record<string, string>) =>
	`<properties>${Object.entries(entries)
		.map(([k, v]) => `<${k}>${v}</${k}>`)
		.join("")}</properties>`
const rte5 = (name: string, version?: string) => dep("org.egovframe.rte", `egovframe-rte-${name}`, version)
const rte4 = (name: string, version?: string, extra = "") => dep("org.egovframe.rte", `org.egovframe.rte.${name}`, version, extra)
const rte3 = (name: string, version?: string) => dep("egovframework.rte", `egovframework.rte.${name}`, version)

const web51Pom = pom(`
${parent("org.egovframe.web", "egovframe-web-config-parent", "5.0.0")}
<groupId>egovframework</groupId><artifactId>web</artifactId><version>1.0.0</version><packaging>war</packaging>
${deps(rte5("ptl-mvc"), rte5("psl-dataaccess"), rte5("fdl-idgnr"), rte5("fdl-property"))}
`)

const multiRootPom = (extraModules: string[] = []) =>
	pom(`
<groupId>com.ex</groupId><artifactId>root</artifactId><version>1.0</version><packaging>pom</packaging>
<modules><module>a</module><module>b</module>${extraModules.map((m) => `<module>${m}</module>`).join("")}</modules>
${props({ "egovframe.rte.version": "5.0.0" })}
${deps(rte5("ptl-mvc", "${egovframe.rte.version}"))}
`)
const childPom = (artifactId: string, body = "") =>
	pom(`${parent("com.ex", "root", "1.0")}<artifactId>${artifactId}</artifactId>${body}`)

describe("generationOfVersion", () => {
	it("major 3/4/5만 세대로 본다", () => {
		expect(generationOfVersion("3.10.0")).toBe("3.x")
		expect(generationOfVersion("4.3.0")).toBe("4.x")
		expect(generationOfVersion("5.0.2")).toBe("5.x")
		expect(generationOfVersion("2.7.18")).toBe("unknown")
		expect(generationOfVersion("abc")).toBe("unknown")
	})
})

describe("checkProjectBuild", () => {
	it("5.1 web형: BOM parent와 버전 없는 4개 의존성", () => {
		const summary = run({ "/p/pom.xml": web51Pom })
		const module = moduleOf(summary, "pom.xml")
		expect(module.buildTool).toBe("maven")
		expect(module.aggregate).toBe(false)
		expect(module.runtime).toEqual({
			generation: "5.x",
			version: "5.0.0",
			source: "bom",
			evidence: "bom egovframe-web-config-parent:5.0.0 (assumed = rte version)",
		})
		expect(module.requiredLibraries).toEqual([
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
			{ name: "psl-dataaccess", status: "direct", evidence: "declared org.egovframe.rte:egovframe-rte-psl-dataaccess" },
		])
		expect(lib(module, "ptl-mvc")?.via).toBeUndefined()
		expect(module.result).toBe("OK")
		expect(module.notes).toBeUndefined()
		expect(summary.versionConsistency).toEqual({
			state: "pass",
			versions: ["5.0.0"],
			evidence: "managed by BOM egovframe-web-config-parent:5.0.0",
		})
		expect(summary).toMatchObject({ generation: "5.x", version: "5.0.0", result: "OK" })
	})

	it("4.3.1형은 속성으로 4.x, 3.10형은 3.x", () => {
		const summary43 = run({
			"/p/pom.xml": pom(`
${parent("org.springframework.boot", "spring-boot-starter-parent", "2.7.18")}
<groupId>egovframework</groupId><artifactId>boot</artifactId><version>1.0.0</version>
${props({ "org.egovframe.rte.version": "4.3.0" })}
${deps(
	rte4("ptl.mvc", "${org.egovframe.rte.version}"),
	rte4("psl.dataaccess", "${org.egovframe.rte.version}"),
	rte4("fdl.idgnr", "${org.egovframe.rte.version}"),
	rte4("fdl.property", "${org.egovframe.rte.version}"),
	dep("org.projectlombok", "lombok"),
)}
`),
		})
		const module43 = moduleOf(summary43, "pom.xml")
		expect(module43.runtime).toEqual({
			generation: "4.x",
			version: "4.3.0",
			source: "property",
			evidence: "property org.egovframe.rte.version=4.3.0",
		})
		expect(lib(module43, "ptl-mvc")?.evidence).toBe("declared org.egovframe.rte:org.egovframe.rte.ptl.mvc:4.3.0")
		expect(lib(module43, "fdl-cmmn")?.evidence).toBe("via ptl-mvc > fdl-cmmn (static graph 4.3.x)")
		expect(module43.result).toBe("OK")
		expect(summary43).toMatchObject({ generation: "4.x", version: "4.3.0", result: "OK" })
		expect(summary43.versionConsistency).toEqual({ state: "pass", versions: ["4.3.0"], evidence: "4.3.0" })

		const summary310 = run({
			"/p/pom.xml": pom(`
<groupId>egovframework</groupId><artifactId>legacy</artifactId><version>1.0.0</version>
${props({ "egovframework.rte.version": "3.10.0" })}
${deps(rte3("ptl.mvc", "${egovframework.rte.version}"), rte3("psl.dataaccess", "${egovframework.rte.version}"))}
`),
		})
		const module310 = moduleOf(summary310, "pom.xml")
		expect(module310.runtime).toEqual({
			generation: "3.x",
			version: "3.10.0",
			source: "property",
			evidence: "property egovframework.rte.version=3.10.0",
		})
		expect(lib(module310, "fdl-logging")?.evidence).toBe("via psl-dataaccess > fdl-logging (static graph 3.10.x)")
		expect(summary310).toMatchObject({ generation: "3.x", version: "3.10.0", result: "OK" })
	})

	it("배치 5.x는 ptl-mvc가 없어 NotFound (엄격 적용)", () => {
		const summary = run({
			"/p/pom.xml": pom(`
${parent("org.egovframe.boot", "egovframe-boot-starter-parent", "5.0.0")}
<groupId>egovframework</groupId><artifactId>batch</artifactId><version>1.0.0</version>
${deps(rte5("bat-core"), rte5("psl-dataaccess"), rte5("fdl-idgnr"), rte5("fdl-property"))}
`),
		})
		const module = moduleOf(summary, "pom.xml")
		expect(lib(module, "ptl-mvc")).toEqual({ name: "ptl-mvc", status: "missing", evidence: "not declared" })
		expect(lib(module, "fdl-cmmn")).toEqual({
			name: "fdl-cmmn",
			status: "transitive",
			via: ["bat-core", "fdl-cmmn"],
			evidence: "via bat-core > fdl-cmmn (static graph 5.0.x)",
		})
		expect(module.result).toBe("NotFound")
		expect(summary.result).toBe("NotFound")
	})

	it("주석 블록 안 4.x 선언은 세지 않는다", () => {
		const summary = run({
			"/p/pom.xml": pom(`
${parent("org.egovframe.web", "egovframe-web-config-parent", "5.0.0")}
<artifactId>cmmn</artifactId>
<dependencies>
${rte5("ptl-mvc")}
${rte5("psl-dataaccess")}
<!--
${rte4("ptl.mvc", "4.3.0")}
${rte4("psl.dataaccess", "4.3.0")}
-->
</dependencies>
`),
		})
		const module = moduleOf(summary, "pom.xml")
		expect(module.runtime.generation).toBe("5.x")
		expect(module.notes).toBeUndefined()
		expect(summary.versionConsistency.state).toBe("pass")
	})

	it("exclusion: ptl.mvc에서 fdl.cmmn을 제외하면 fdl-cmmn·fdl-logging이 excluded", () => {
		const exclusion =
			"<exclusions><exclusion><groupId>org.egovframe.rte</groupId><artifactId>org.egovframe.rte.fdl.cmmn</artifactId></exclusion></exclusions>"
		const summary = run({
			"/p/pom.xml": pom(`
<artifactId>ex</artifactId>
${props({ "org.egovframe.rte.version": "4.3.0" })}
${deps(rte4("ptl.mvc", "${org.egovframe.rte.version}", exclusion))}
`),
		})
		const module = moduleOf(summary, "pom.xml")
		expect(lib(module, "ptl-mvc")?.status).toBe("direct")
		expect(lib(module, "fdl-cmmn")).toEqual({
			name: "fdl-cmmn",
			status: "excluded",
			via: ["ptl-mvc", "fdl-cmmn"],
			evidence: "excluded on ptl-mvc > fdl-cmmn (static graph 4.3.x)",
		})
		expect(lib(module, "fdl-logging")).toEqual({
			name: "fdl-logging",
			status: "excluded",
			via: ["ptl-mvc", "fdl-cmmn", "fdl-logging"],
			evidence: "excluded on ptl-mvc > fdl-cmmn > fdl-logging (static graph 4.3.x)",
		})
		expect(module.result).toBe("NotFound")
	})

	it("msa Gradle: ext 버전 + mavenBom + exclude + cloud 모듈", () => {
		const summary = run({
			"/p/build.gradle": `
plugins {
	id 'org.springframework.boot' version '3.2.0'
}
ext {
	set('egovframeBootParentVersion', '5.0.0')
}
dependencyManagement {
	imports {
		mavenBom "org.egovframe.boot:egovframe-boot-starter-parent:\${egovframeBootParentVersion}"
	}
}
dependencies {
	implementation("org.egovframe.rte:egovframe-rte-fdl-cmmn:\${egovframeBootParentVersion}") {
		exclude group: 'org.egovframe.rte', module: 'egovframe-rte-fdl-logging'
	}
	implementation 'org.egovframe.cloud:egovframe-cloud-module-common:1.0.0'
}
`,
		})
		const module = moduleOf(summary, "build.gradle")
		expect(module.buildTool).toBe("gradle")
		expect(module.runtime).toEqual({
			generation: "5.x",
			version: "5.0.0",
			source: "bom",
			evidence: "bom egovframe-boot-starter-parent:5.0.0 (assumed = rte version)",
		})
		const unknown = {
			status: "unknown",
			evidence: "may be transitive via org.egovframe.cloud:egovframe-cloud-module-common",
		}
		expect(module.requiredLibraries).toEqual([
			{ name: "ptl-mvc", ...unknown },
			{ name: "fdl-cmmn", status: "direct", evidence: "declared org.egovframe.rte:egovframe-rte-fdl-cmmn:5.0.0" },
			{ name: "fdl-logging", ...unknown },
			{ name: "psl-dataaccess", ...unknown },
		])
		expect(module.result).toBe("Unknown")
		expect(summary.result).toBe("Unknown")
	})

	it("egovframe-boot-starter-* 선언은 실행환경 모듈을 끌어오지 않으므로 누락을 unknown으로 낮추지 않는다", () => {
		// 5.0.0 starter(access·crypto·security)의 pom에는 org.egovframe.rte 의존성이 없다 (소스 jar의 META-INF/maven pom으로 확인)
		const summary = run({
			"/p/pom.xml": pom(`
${parent("org.egovframe.boot", "egovframe-boot-starter-parent", "5.0.0")}
<groupId>egovframework</groupId><artifactId>boot</artifactId><version>1.0.0</version>
${deps(
	rte5("ptl-mvc"),
	dep("org.egovframe.boot", "egovframe-boot-starter-security", "${egovframe.boot.starter.version}"),
	dep("org.egovframe.boot", "egovframe-boot-starter-crypto", "${egovframe.boot.starter.version}"),
)}
`),
		})
		const module = moduleOf(summary, "pom.xml")
		expect(module.runtime).toMatchObject({ generation: "5.x", version: "5.0.0", source: "bom" })
		expect(statuses(module)).toEqual([
			"ptl-mvc:direct",
			"fdl-cmmn:transitive",
			"fdl-logging:transitive",
			"psl-dataaccess:missing",
		])
		expect(lib(module, "psl-dataaccess")).toEqual({ name: "psl-dataaccess", status: "missing", evidence: "not declared" })
		expect(module.result).toBe("NotFound")
		expect(summary.result).toBe("NotFound")
	})

	it("멀티 모듈 Maven: 집계 pom Skipped, 자식은 parent 의존성을 물려받고 moduleForFile은 세그먼트로 비교", () => {
		const summary = run({
			"/p/pom.xml": multiRootPom(),
			"/p/a/pom.xml": childPom("a", deps(rte5("psl-dataaccess", "${egovframe.rte.version}"))),
			"/p/b/pom.xml": childPom("b"),
		})
		expect(summary.modules.map((m) => m.buildFile)).toEqual(["pom.xml", "a/pom.xml", "b/pom.xml"])
		const root = moduleOf(summary, "pom.xml")
		expect(root).toMatchObject({ aggregate: true, result: "Skipped", requiredLibraries: [], notes: ["aggregate pom"] })
		expect(root.runtime.generation).toBe("5.x")
		const a = moduleOf(summary, "a/pom.xml")
		expect(a.result).toBe("OK")
		expect(a.runtime).toMatchObject({ generation: "5.x", version: "5.0.0", source: "property" })
		expect(lib(a, "ptl-mvc")?.evidence).toBe("declared org.egovframe.rte:egovframe-rte-ptl-mvc:5.0.0")
		const b = moduleOf(summary, "b/pom.xml")
		expect(lib(b, "ptl-mvc")?.status).toBe("direct")
		expect(lib(b, "psl-dataaccess")).toEqual({ name: "psl-dataaccess", status: "missing", evidence: "not declared" })
		expect(b.result).toBe("NotFound")
		expect(summary.result).toBe("NotFound")

		expect(moduleForFile("/p/a/src/main/java/X.java", summary, "/p")?.buildFile).toBe("a/pom.xml")
		expect(moduleForFile("C:\\p\\a\\src\\main\\java\\X.java", summary, "C:\\p")?.buildFile).toBe("a/pom.xml")
		expect(moduleForFile("/p/other/X.java", summary, "/p")).toBeUndefined()
	})

	it("내부 모듈 의존: 다른 모듈 좌표를 선언하면 그 모듈의 직접 선언을 합친다", () => {
		const summary = run({
			"/p/pom.xml": multiRootPom(["c"]),
			"/p/a/pom.xml": childPom("a", deps(rte5("psl-dataaccess", "${egovframe.rte.version}"))),
			"/p/b/pom.xml": childPom("b"),
			"/p/c/pom.xml": childPom("c", deps(dep("com.ex", "a", "1.0"))),
		})
		const c = moduleOf(summary, "c/pom.xml")
		expect(lib(c, "psl-dataaccess")).toEqual({ name: "psl-dataaccess", status: "direct", evidence: "via module a" })
		expect(lib(c, "ptl-mvc")?.evidence).toBe("declared org.egovframe.rte:egovframe-rte-ptl-mvc:5.0.0")
		expect(c.result).toBe("OK")
	})

	it("Maven 내장 속성: ${project.groupId}로 형제 모듈을 잇고 ${revision}으로 버전을 푼다", () => {
		const summary = run({
			"/p/pom.xml": pom(`
<groupId>com.ex</groupId><artifactId>root</artifactId><version>1.0</version><packaging>pom</packaging>
<modules><module>a</module><module>c</module></modules>
${props({ revision: "5.0.2" })}
`),
			"/p/a/pom.xml": childPom("a", deps(rte5("psl-dataaccess", "${revision}"))),
			"/p/c/pom.xml": childPom(
				"c",
				deps(dep("${project.groupId}", "a", "${project.version}"), rte5("ptl-mvc", "${revision}")),
			),
		})
		const c = moduleOf(summary, "c/pom.xml")
		expect(lib(c, "psl-dataaccess")).toEqual({ name: "psl-dataaccess", status: "direct", evidence: "via module a" })
		expect(c.runtime).toEqual({
			generation: "5.x",
			version: "5.0.2",
			source: "dependency-version",
			evidence: "dependency org.egovframe.rte:egovframe-rte-ptl-mvc:5.0.2",
		})
		expect(c.notes).toBeUndefined()
		expect(c.result).toBe("OK")
		expect(summary.versionConsistency).toEqual({ state: "pass", versions: ["5.0.2"], evidence: "5.0.2" })
	})

	it("모듈 간 버전 혼재와 세대 혼재는 일관성 실패", () => {
		const modulePom = (artifactId: string, body: string) =>
			pom(`${parent("com.ex", "root", "1.0")}<artifactId>${artifactId}</artifactId>${body}`)
		const rootPom = pom(
			`<groupId>com.ex</groupId><artifactId>root</artifactId><version>1.0</version><packaging>pom</packaging><modules><module>a</module><module>b</module></modules>`,
		)
		const versions = run({
			"/p/pom.xml": rootPom,
			"/p/a/pom.xml": modulePom(
				"a",
				props({ "egovframe.rte.version": "5.0.0" }) +
					deps(rte5("ptl-mvc", "${egovframe.rte.version}"), rte5("psl-dataaccess", "${egovframe.rte.version}")),
			),
			"/p/b/pom.xml": modulePom(
				"b",
				props({ "egovframe.rte.version": "5.0.2" }) +
					deps(rte5("ptl-mvc", "${egovframe.rte.version}"), rte5("psl-dataaccess", "${egovframe.rte.version}")),
			),
		})
		expect(versions.versionConsistency).toEqual({ state: "fail", versions: ["5.0.0", "5.0.2"], evidence: "5.0.0, 5.0.2" })
		expect(moduleOf(versions, "a/pom.xml").result).toBe("OK")
		expect(versions.result).toBe("NotFound")
		expect(versions.version).toBeUndefined()

		const generations = run({
			"/p/pom.xml": rootPom,
			"/p/a/pom.xml": modulePom("a", deps(rte4("ptl.mvc", "4.3.0"), rte4("psl.dataaccess", "4.3.0"))),
			"/p/b/pom.xml": modulePom("b", deps(rte5("ptl-mvc", "5.0.0"), rte5("psl-dataaccess", "5.0.0"))),
		})
		expect(moduleOf(generations, "a/pom.xml").runtime.generation).toBe("4.x")
		expect(moduleOf(generations, "b/pom.xml").runtime.generation).toBe("5.x")
		expect(generations.generation).toBe("unknown")
		expect(generations.versionConsistency).toMatchObject({ state: "fail", evidence: "mixed generations" })
		expect(generations.result).toBe("NotFound")
	})

	it("dependencyManagement import BOM은 ${egovframe.rte.version}을 경고 없이 푼다", () => {
		const summary = run({
			"/p/pom.xml": pom(`
${parent("org.springframework.boot", "spring-boot-starter-parent", "3.4.1")}
<artifactId>simple</artifactId>
<dependencyManagement><dependencies>
${dep("org.egovframe.boot", "egovframe-boot-starter-parent", "5.0.0", "<type>pom</type><scope>import</scope>")}
</dependencies></dependencyManagement>
${deps(rte5("ptl-mvc", "${egovframe.rte.version}"), rte5("psl-dataaccess", "${egovframe.rte.version}"))}
`),
		})
		const module = moduleOf(summary, "pom.xml")
		expect(module.runtime).toEqual({
			generation: "5.x",
			version: "5.0.0",
			source: "bom",
			evidence: "bom egovframe-boot-starter-parent:5.0.0 (assumed = rte version)",
		})
		expect(module.notes).toBeUndefined()
		expect(lib(module, "ptl-mvc")?.evidence).toBe("declared org.egovframe.rte:egovframe-rte-ptl-mvc:5.0.0")
		expect(summary.versionConsistency).toEqual({ state: "pass", versions: ["5.0.0"], evidence: "5.0.0" })
		expect(summary.result).toBe("OK")
	})

	it("프로파일: activeByDefault 속성으로 버전이 풀리고 비활성 프로파일은 note를 남긴다", () => {
		const summary = run({
			"/p/pom.xml": pom(`
<artifactId>profiled</artifactId>
<profiles>
<profile><id>dev</id><activation><activeByDefault>true</activeByDefault></activation>${props({ "egovframe.rte.version": "5.0.0" })}</profile>
<profile><id>prod</id>${props({ "egovframe.rte.version": "5.0.2" })}</profile>
</profiles>
${deps(rte5("ptl-mvc", "${egovframe.rte.version}"), rte5("psl-dataaccess", "${egovframe.rte.version}"))}
`),
		})
		const module = moduleOf(summary, "pom.xml")
		expect(module.runtime).toMatchObject({ generation: "5.x", version: "5.0.0", source: "property" })
		expect(module.notes).toEqual(["profiles ignored"])
		expect(summary.versionConsistency).toEqual({ state: "pass", versions: ["5.0.0"], evidence: "5.0.0" })
	})

	it("빌드 파일이 없으면 Unknown", () => {
		const summary = run({ "/p/gradle.properties": "foo=bar\n" })
		expect(summary).toEqual({
			generation: "unknown",
			versionConsistency: { state: "skipped", versions: [], evidence: "no resolvable version" },
			modules: [],
			result: "Unknown",
		})
	})

	it("generationForFile: 모듈 안 파일은 그 모듈 세대(unknown 그대로), 모듈 밖은 프로젝트 세대", () => {
		const summary = run({
			"/p/pom.xml": pom(
				`<groupId>com.ex</groupId><artifactId>root</artifactId><version>1.0</version><packaging>pom</packaging><modules><module>a</module><module>b</module></modules>`,
			),
			"/p/a/pom.xml": childPom("a", deps(rte5("ptl-mvc", "5.0.0"), rte5("psl-dataaccess", "5.0.0"))),
			"/p/b/pom.xml": childPom("b", deps(dep("org.apache.commons", "commons-lang3", "3.14.0"))),
		})
		expect(moduleOf(summary, "b/pom.xml").runtime.generation).toBe("unknown")
		expect(summary.generation).toBe("5.x")
		expect(generationForFile("/p/a/src/main/java/A.java", summary, projectPath)).toBe("5.x")
		expect(generationForFile("/p/b/src/main/java/B.java", summary, projectPath)).toBe("unknown")
		expect(generationForFile("/p/other/X.java", summary, projectPath)).toBe("5.x")
	})

	it("Gradle kts + 버전 카탈로그 참조", () => {
		const summary = run({
			"/p/build.gradle.kts": `
dependencies {
	implementation(libs.egov.ptl.mvc)
}
`,
			"/p/gradle/libs.versions.toml": `
[versions]
egov = "5.0.0"

[libraries]
egov-ptl-mvc = { module = "org.egovframe.rte:egovframe-rte-ptl-mvc", version.ref = "egov" }
`,
		})
		const module = moduleOf(summary, "build.gradle.kts")
		expect(module.buildTool).toBe("gradle-kts")
		expect(lib(module, "ptl-mvc")).toEqual({
			name: "ptl-mvc",
			status: "direct",
			evidence: "declared org.egovframe.rte:egovframe-rte-ptl-mvc:5.0.0",
		})
		expect(module.runtime).toEqual({
			generation: "5.x",
			version: "5.0.0",
			source: "dependency-version",
			evidence: "dependency org.egovframe.rte:egovframe-rte-ptl-mvc:5.0.0",
		})
	})

	it("libs.bundles만 쓰면 runtime none, 4종 모두 unknown", () => {
		const summary = run({
			"/p/build.gradle": `
dependencies {
	implementation libs.bundles.egov
}
`,
		})
		const module = moduleOf(summary, "build.gradle")
		expect(module.runtime).toMatchObject({ generation: "unknown", source: "none" })
		expect(module.runtime.version).toBeUndefined()
		for (const library of module.requiredLibraries) {
			expect(library).toEqual({ name: library.name, status: "unknown", evidence: "unparsed: bundle libs.bundles.egov" })
		}
		expect(module.requiredLibraries).toHaveLength(4)
		expect(module.notes).toEqual(["bundle libs.bundles.egov"])
		expect(module.result).toBe("Unknown")
		expect(summary.result).toBe("Unknown")
	})

	it("직접 선언 + 번들: 풀린 항목은 유지하고 나머지만 unknown", () => {
		const summary = run({
			"/p/build.gradle": `
dependencies {
	implementation 'org.egovframe.rte:egovframe-rte-ptl-mvc:5.0.0'
	implementation libs.bundles.egov
}
`,
		})
		const module = moduleOf(summary, "build.gradle")
		expect(statuses(module)).toEqual([
			"ptl-mvc:direct",
			"fdl-cmmn:transitive",
			"fdl-logging:transitive",
			"psl-dataaccess:unknown",
		])
		expect(lib(module, "psl-dataaccess")?.evidence).toBe("unparsed: bundle libs.bundles.egov")
		expect(module.result).toBe("Unknown")
	})

	it("apply from 스크립트는 수집돼 있으면 합치고, 없으면 note를 남긴다", () => {
		const build = `
apply from: 'gradle/dependencies.gradle'
`
		const script = `
dependencies {
	implementation 'org.egovframe.rte:egovframe-rte-ptl-mvc:5.0.0'
	implementation 'org.egovframe.rte:egovframe-rte-psl-dataaccess:5.0.0'
}
`
		const found = moduleOf(run({ "/p/build.gradle": build, "/p/gradle/dependencies.gradle": script }), "build.gradle")
		expect(lib(found, "ptl-mvc")?.status).toBe("direct")
		expect(found.result).toBe("OK")
		expect(found.notes).toBeUndefined()

		const missing = moduleOf(run({ "/p/build.gradle": build }), "build.gradle")
		expect(lib(missing, "ptl-mvc")).toEqual({
			name: "ptl-mvc",
			status: "unknown",
			evidence: "unparsed: apply from not found: gradle/dependencies.gradle",
		})
		expect(statuses(missing)).toEqual([
			"ptl-mvc:unknown",
			"fdl-cmmn:unknown",
			"fdl-logging:unknown",
			"psl-dataaccess:unknown",
		])
		expect(missing.notes).toEqual(["apply from not found: gradle/dependencies.gradle"])
		expect(missing.result).toBe("Unknown")
	})

	it("같은 모듈 안 버전 혼재는 일관성 실패", () => {
		const summary = run({
			"/p/pom.xml": pom(`<artifactId>mixed</artifactId>${deps(rte5("ptl-mvc", "5.0.0"), rte5("psl-dataaccess", "5.0.2"))}`),
		})
		const module = moduleOf(summary, "pom.xml")
		expect(module.runtime).toEqual({
			generation: "5.x",
			version: "5.0.0",
			source: "dependency-version",
			evidence: "dependency org.egovframe.rte:egovframe-rte-ptl-mvc:5.0.0",
		})
		expect(module.result).toBe("OK")
		expect(summary.versionConsistency).toEqual({ state: "fail", versions: ["5.0.0", "5.0.2"], evidence: "5.0.0, 5.0.2" })
		expect(summary.result).toBe("NotFound")
	})

	it("단일 모듈 세대 혼재와 버전 major 불일치는 mixed generations", () => {
		const coordinates = run({
			"/p/pom.xml": pom(`<artifactId>mixed</artifactId>${deps(rte4("ptl.mvc"), rte5("psl-dataaccess"))}`),
		})
		const module = moduleOf(coordinates, "pom.xml")
		expect(module.runtime.generation).toBe("unknown")
		expect(module.notes).toEqual(["mixed generations"])
		expect(lib(module, "fdl-cmmn")?.evidence).toBe("transitive? via ptl-mvc > fdl-cmmn (union graph)")
		expect(lib(module, "fdl-cmmn")?.status).toBe("transitive")
		expect(coordinates.versionConsistency).toMatchObject({ state: "fail", evidence: "mixed generations" })
		expect(coordinates.generation).toBe("unknown")
		expect(coordinates.result).toBe("NotFound")

		const major = run({
			"/p/pom.xml": pom(`
<artifactId>major</artifactId>
${props({ "org.egovframe.rte.version": "5.0.0" })}
${deps(rte4("ptl.mvc", "${org.egovframe.rte.version}"), rte4("psl.dataaccess", "${org.egovframe.rte.version}"))}
`),
		})
		const majorModule = moduleOf(major, "pom.xml")
		expect(majorModule.runtime).toMatchObject({ generation: "unknown", version: "5.0.0", source: "property" })
		expect(majorModule.notes).toEqual(["mixed generations"])
		expect(major.versionConsistency).toMatchObject({ state: "fail", evidence: "mixed generations" })
		expect(major.result).toBe("NotFound")
	})

	it("좌표 패턴만 있으면 artifact-pattern, 버전 없음, 일관성 skipped", () => {
		const summary = run({ "/p/pom.xml": pom(`<artifactId>pattern</artifactId>${deps(rte4("ptl.mvc"))}`) })
		const module = moduleOf(summary, "pom.xml")
		expect(module.runtime).toMatchObject({ generation: "4.x", source: "artifact-pattern" })
		expect(module.runtime.version).toBeUndefined()
		expect(lib(module, "fdl-cmmn")?.evidence).toBe("via ptl-mvc > fdl-cmmn (static graph 4.3.x)")
		expect(summary.versionConsistency).toEqual({ state: "skipped", versions: [], evidence: "no resolvable version" })
	})

	it("Maven 직접 <version>만 있으면 dependency-version", () => {
		const summary = run({ "/p/pom.xml": pom(`<artifactId>direct</artifactId>${deps(rte5("ptl-mvc", "5.0.2"))}`) })
		const module = moduleOf(summary, "pom.xml")
		expect(module.runtime).toEqual({
			generation: "5.x",
			version: "5.0.2",
			source: "dependency-version",
			evidence: "dependency org.egovframe.rte:egovframe-rte-ptl-mvc:5.0.2",
		})
		expect(lib(module, "fdl-cmmn")?.evidence).toBe("via ptl-mvc > fdl-cmmn (static graph 5.0.x)")
		expect(summary.versionConsistency).toEqual({ state: "pass", versions: ["5.0.2"], evidence: "5.0.2" })
	})

	it("멀티 모듈 Gradle: 루트 subprojects 의존성을 하위 모듈이 물려받는다", () => {
		const summary = run({
			"/p/settings.gradle": "include ':a', ':b'\n",
			"/p/build.gradle": `
subprojects {
	dependencies {
		implementation 'org.egovframe.rte:egovframe-rte-ptl-mvc:5.0.0'
	}
}
`,
			"/p/a/build.gradle": `
dependencies {
	implementation 'org.egovframe.rte:egovframe-rte-psl-dataaccess:5.0.0'
}
`,
			"/p/b/build.gradle": `
plugins {
	id 'java'
}
`,
		})
		expect(moduleOf(summary, "build.gradle")).toMatchObject({
			aggregate: true,
			result: "Skipped",
			requiredLibraries: [],
			notes: ["aggregate build (settings include)"],
		})
		const a = moduleOf(summary, "a/build.gradle")
		expect(a.result).toBe("OK")
		expect(lib(a, "ptl-mvc")?.evidence).toBe("declared org.egovframe.rte:egovframe-rte-ptl-mvc:5.0.0")
		const b = moduleOf(summary, "b/build.gradle")
		expect(lib(b, "ptl-mvc")?.status).toBe("direct")
		expect(lib(b, "psl-dataaccess")).toEqual({ name: "psl-dataaccess", status: "missing", evidence: "not declared" })
		expect(b.result).toBe("NotFound")
		expect(summary.result).toBe("NotFound")
		expect(moduleForFile("/p/a/src/main/java/X.java", summary, projectPath)?.buildFile).toBe("a/build.gradle")
		expect(moduleForFile("/p/other/X.java", summary, projectPath)).toBeUndefined()
	})

	it("멀티 모듈 Gradle: 루트 subprojects 안의 번들 신호는 하위 모듈의 missing을 unknown으로 낮춘다", () => {
		const summary = run({
			"/p/settings.gradle": "include ':a'\n",
			"/p/build.gradle": `
subprojects {
	dependencies {
		implementation libs.bundles.egov
	}
}
`,
			"/p/a/build.gradle": `
dependencies {
	implementation 'org.egovframe.rte:egovframe-rte-psl-dataaccess:5.0.0'
}
`,
		})
		expect(moduleOf(summary, "build.gradle")).toMatchObject({ aggregate: true, result: "Skipped" })
		const a = moduleOf(summary, "a/build.gradle")
		expect(statuses(a)).toEqual(["ptl-mvc:unknown", "fdl-cmmn:unknown", "fdl-logging:transitive", "psl-dataaccess:direct"])
		expect(lib(a, "ptl-mvc")?.evidence).toBe("unparsed: bundle libs.bundles.egov")
		expect(a.notes).toEqual(["bundle libs.bundles.egov"])
		expect(a.result).toBe("Unknown")
		expect(summary.result).toBe("Unknown")
	})

	it("buildSrc 빌드 파일은 빌드 로직이라 Skipped로 두고 프로젝트 판정에 넣지 않는다", () => {
		const summary = run({
			"/p/settings.gradle.kts": 'include(":app")\n',
			"/p/buildSrc/build.gradle.kts": `
plugins {
	\`kotlin-dsl\`
}
dependencies {
	implementation("org.egovframe.rte:org.egovframe.rte.ptl.mvc:4.3.0")
}
`,
			"/p/app/build.gradle.kts": `
dependencies {
	implementation("org.egovframe.rte:egovframe-rte-ptl-mvc:5.0.0")
	implementation("org.egovframe.rte:egovframe-rte-psl-dataaccess:5.0.0")
	implementation("org.egovframe.rte:egovframe-rte-fdl-idgnr:5.0.0")
	implementation("org.egovframe.rte:egovframe-rte-fdl-property:5.0.0")
}
`,
		})
		const buildSrc = moduleOf(summary, "buildSrc/build.gradle.kts")
		expect(buildSrc).toMatchObject({
			aggregate: true,
			result: "Skipped",
			requiredLibraries: [],
			notes: ["build logic (buildSrc)"],
		})
		expect(moduleOf(summary, "app/build.gradle.kts").result).toBe("OK")
		expect(summary.versionConsistency.state).toBe("pass")
		expect(summary.result).toBe("OK")
		expect(moduleForFile("/p/buildSrc/src/main/kotlin/X.kt", summary, projectPath)).toBeUndefined()
	})

	it("packaging pom은 modules가 없어도(parent/BOM 전용) Skipped이고 자식의 상속 원천으로는 남는다", () => {
		const summary = run({
			"/p/pom.xml": pom(`
<groupId>com.ex</groupId><artifactId>root</artifactId><version>1.0</version><packaging>pom</packaging>
<modules><module>parent</module><module>app</module></modules>
`),
			"/p/parent/pom.xml": pom(`
<groupId>com.ex</groupId><artifactId>ex-parent</artifactId><version>1.0</version><packaging>pom</packaging>
${props({ "egovframe.rte.version": "5.0.0" })}
<dependencyManagement>
${deps(rte5("ptl-mvc", "${egovframe.rte.version}"), rte5("psl-dataaccess", "${egovframe.rte.version}"), rte5("fdl-idgnr", "${egovframe.rte.version}"), rte5("fdl-property", "${egovframe.rte.version}"))}
</dependencyManagement>
`),
			"/p/app/pom.xml": pom(`
${parent("com.ex", "ex-parent", "1.0", "<relativePath>../parent/pom.xml</relativePath>")}
<artifactId>app</artifactId>
${deps(rte5("ptl-mvc"), rte5("psl-dataaccess"), rte5("fdl-idgnr"), rte5("fdl-property"))}
`),
		})
		expect(moduleOf(summary, "pom.xml")).toMatchObject({ aggregate: true, result: "Skipped", notes: ["aggregate pom"] })
		expect(moduleOf(summary, "parent/pom.xml")).toMatchObject({
			aggregate: true,
			result: "Skipped",
			requiredLibraries: [],
			notes: ["packaging pom"],
		})
		const app = moduleOf(summary, "app/pom.xml")
		expect(app.result).toBe("OK")
		expect(app.runtime).toMatchObject({ generation: "5.x", version: "5.0.0" })
		expect(summary.result).toBe("OK")
	})

	it("manualGeneration은 세대만 덮어쓰고 버전 추출·일관성은 그대로", () => {
		const summary = run({ "/p/pom.xml": web51Pom }, "4.x")
		const module = moduleOf(summary, "pom.xml")
		expect(module.runtime).toEqual({
			generation: "4.x",
			version: "5.0.0",
			source: "manual",
			evidence: "manual (detected: bom 5.0.0)",
		})
		expect(lib(module, "fdl-cmmn")?.evidence).toBe("via ptl-mvc > fdl-cmmn (static graph 4.3.x)")
		expect(summary.versionConsistency).toEqual({
			state: "pass",
			versions: ["5.0.0"],
			evidence: "managed by BOM egovframe-web-config-parent:5.0.0",
		})
		expect(summary.generation).toBe("4.x")
	})
})
