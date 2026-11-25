import { describe, expect, it } from "vitest"
import {
	parseGradleBuild,
	parseGradleProperties,
	parseGradleSettings,
	parseVersionCatalog,
	resolveCatalogReference,
	stripGradleComments,
} from "../gradleBuild"

describe("gradleBuild", () => {
	it("문자열 좌표·맵 표기·Kotlin 명명 인자·exclude 두 형태", () => {
		const groovy = `
dependencies {
	implementation("org.egovframe.rte:egovframe-rte-fdl-cmmn:\${egovframeBootParentVersion}") {
		exclude group: 'org.egovframe.rte', module: 'egovframe-rte-fdl-logging'
	}
	implementation 'org.egovframe.rte:egovframe-rte-ptl-mvc:4.3.0'
	api group: 'org.egovframe.rte', name: 'egovframe-rte-psl-dataaccess', version: egovVersion
	compileOnly "org.projectlombok:lombok:$lombokVersion"
	compile('org.egovframe.rte:egovframe-rte-fdl-idgnr:3.10.0') { exclude module: 'commons-logging' }
}
`
		const model = parseGradleBuild(groovy, "gradle")
		expect(model.dependencies).toEqual([
			{
				configuration: "implementation",
				group: "org.egovframe.rte",
				name: "egovframe-rte-fdl-cmmn",
				version: "${egovframeBootParentVersion}",
				exclusions: [{ group: "org.egovframe.rte", module: "egovframe-rte-fdl-logging" }],
				evidence: 'implementation("org.egovframe.rte:egovframe-rte-fdl-cmmn:${egovframeBootParentVersion}")',
			},
			{
				configuration: "implementation",
				group: "org.egovframe.rte",
				name: "egovframe-rte-ptl-mvc",
				version: "4.3.0",
				exclusions: [],
				evidence: "implementation 'org.egovframe.rte:egovframe-rte-ptl-mvc:4.3.0'",
			},
			{
				configuration: "api",
				group: "org.egovframe.rte",
				name: "egovframe-rte-psl-dataaccess",
				version: "${egovVersion}",
				exclusions: [],
				evidence: "api group: 'org.egovframe.rte', name: 'egovframe-rte-psl-dataaccess', version: egovVersion",
			},
			{
				configuration: "compileOnly",
				group: "org.projectlombok",
				name: "lombok",
				version: "${lombokVersion}",
				exclusions: [],
				evidence: 'compileOnly "org.projectlombok:lombok:$lombokVersion"',
			},
			{
				configuration: "compile",
				group: "org.egovframe.rte",
				name: "egovframe-rte-fdl-idgnr",
				version: "3.10.0",
				exclusions: [{ module: "commons-logging" }],
				evidence: "compile('org.egovframe.rte:egovframe-rte-fdl-idgnr:3.10.0')",
			},
		])
		expect(model.unresolvedSignals).toEqual([])

		const kts = `
dependencies {
	implementation(group = "org.egovframe.rte", name = "egovframe-rte-fdl-property", version = egovVersion)
	implementation("org.egovframe.rte:egovframe-rte-fdl-string:4.3.0") {
		exclude(group = "commons-logging", module = "commons-logging")
	}
	runtimeOnly(libs.egov.ptl.mvc)
}
`
		const ktsModel = parseGradleBuild(kts, "gradle-kts")
		expect(ktsModel.dependencies).toEqual([
			{
				configuration: "implementation",
				group: "org.egovframe.rte",
				name: "egovframe-rte-fdl-property",
				version: "${egovVersion}",
				exclusions: [],
				evidence:
					'implementation(group = "org.egovframe.rte", name = "egovframe-rte-fdl-property", version = egovVersion)',
			},
			{
				configuration: "implementation",
				group: "org.egovframe.rte",
				name: "egovframe-rte-fdl-string",
				version: "4.3.0",
				exclusions: [{ group: "commons-logging", module: "commons-logging" }],
				evidence: 'implementation("org.egovframe.rte:egovframe-rte-fdl-string:4.3.0")',
			},
			{
				configuration: "runtimeOnly",
				group: "",
				name: "libs.egov.ptl.mvc",
				exclusions: [],
				evidence: "runtimeOnly(libs.egov.ptl.mvc)",
			},
		])
		expect(ktsModel.unresolvedSignals).toEqual([])
	})

	it("test 구성은 버리고 platform·mavenBom·project()는 따로 모은다", () => {
		const text = `
dependencyManagement {
	imports {
		mavenBom "org.egovframe.boot:egovframe-boot-starter-parent:\${egovframeBootParentVersion}"
	}
}
dependencies {
	implementation platform("org.egovframe.boot:egovframe-boot-starter-parent:5.0.0")
	api(enforcedPlatform("org.springframework.boot:spring-boot-dependencies:3.4.1"))
	implementation project(':common')
	implementation(project(":core"))
	testImplementation 'org.egovframe.rte:egovframe-rte-fdl-cmmn:5.0.0'
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
	testImplementation platform('org.junit:junit-bom:5.10.0')
	annotationProcessor 'org.projectlombok:lombok'
	runtimeOnly 'com.h2database:h2'
}
`
		const model = parseGradleBuild(text, "gradle")
		expect(model.dependencies).toEqual([
			{
				configuration: "runtimeOnly",
				group: "com.h2database",
				name: "h2",
				exclusions: [],
				evidence: "runtimeOnly 'com.h2database:h2'",
			},
		])
		expect(model.platforms).toEqual([
			{
				groupId: "org.egovframe.boot",
				artifactId: "egovframe-boot-starter-parent",
				version: "${egovframeBootParentVersion}",
			},
			{ groupId: "org.egovframe.boot", artifactId: "egovframe-boot-starter-parent", version: "5.0.0" },
			{ groupId: "org.springframework.boot", artifactId: "spring-boot-dependencies", version: "3.4.1" },
		])
		expect(model.projectDependencies).toEqual([":common", ":core"])
		expect(model.inheritedDependencies).toEqual([])
		expect(model.unresolvedSignals).toEqual([])
	})

	it("ext 네 형태와 gradle.properties", () => {
		const groovy = `
ext {
	set('egovframeBootParentVersion', '5.0.0')
	springVersion = "6.2.1"
}
ext { set("lombokVersion", "1.18.30") }
ext.egovframeRteVersion = '4.3.0'
def h2Version = '2.2.224'
`
		expect(parseGradleBuild(groovy, "gradle").properties).toEqual({
			egovframeBootParentVersion: "5.0.0",
			springVersion: "6.2.1",
			lombokVersion: "1.18.30",
			egovframeRteVersion: "4.3.0",
			h2Version: "2.2.224",
		})

		const kts = `
val egovVersion by extra("5.0.0")
val bootVersion: String by extra("3.4.1")
val notAProperty = "1.0"
`
		expect(parseGradleBuild(kts, "gradle-kts").properties).toEqual({ egovVersion: "5.0.0", bootVersion: "3.4.1" })

		const properties = `
# comment
! another comment
egovframe.rte.version=4.3.0
org.gradle.jvmargs = -Xmx2g -Dfile.encoding=UTF-8
kotlin.code.style: official
`
		expect(parseGradleProperties(properties)).toEqual({
			"egovframe.rte.version": "4.3.0",
			"org.gradle.jvmargs": "-Xmx2g -Dfile.encoding=UTF-8",
			"kotlin.code.style": "official",
		})
	})

	it("subprojects 블록의 dependencies는 inheritedDependencies", () => {
		const text = `
allprojects {
	repositories { mavenCentral() }
}
subprojects {
	apply plugin: 'java'
	dependencies {
		implementation 'org.egovframe.rte:egovframe-rte-fdl-cmmn:4.3.0'
		testImplementation 'junit:junit:4.13.2'
	}
}
allprojects {
	dependencies { compileOnly 'org.projectlombok:lombok:1.18.30' }
}
dependencies {
	implementation project(':common')
	implementation 'org.egovframe.rte:egovframe-rte-ptl-mvc:4.3.0'
}
`
		const model = parseGradleBuild(text, "gradle")
		expect(model.inheritedDependencies).toEqual([
			{
				configuration: "implementation",
				group: "org.egovframe.rte",
				name: "egovframe-rte-fdl-cmmn",
				version: "4.3.0",
				exclusions: [],
				evidence: "implementation 'org.egovframe.rte:egovframe-rte-fdl-cmmn:4.3.0'",
			},
			{
				configuration: "compileOnly",
				group: "org.projectlombok",
				name: "lombok",
				version: "1.18.30",
				exclusions: [],
				evidence: "compileOnly 'org.projectlombok:lombok:1.18.30'",
			},
		])
		expect(model.dependencies).toEqual([
			{
				configuration: "implementation",
				group: "org.egovframe.rte",
				name: "egovframe-rte-ptl-mvc",
				version: "4.3.0",
				exclusions: [],
				evidence: "implementation 'org.egovframe.rte:egovframe-rte-ptl-mvc:4.3.0'",
			},
		])
		expect(model.projectDependencies).toEqual([":common"])
	})

	it("settings include 세 형태", () => {
		const groovy = `
rootProject.name = 'egov-msa'
include ':common', ':portal'
include(":board")
include("admin")
include 'gateway',
	'discovery'
includeBuild 'build-logic'
// include ':commented'
`
		expect(parseGradleSettings(groovy)).toEqual({
			includes: [":common", ":portal", ":board", ":admin", ":gateway", ":discovery"],
		})

		const kts = `
include(
	":api",
	"batch",
)
`
		expect(parseGradleSettings(kts)).toEqual({ includes: [":api", ":batch"] })
	})

	it("카탈로그 TOML 세 표기와 version.ref 해석", () => {
		const toml = `
[versions]
egov = "4.3.0"
spring = "6.2.1" # trailing comment

[libraries]
egov-ptl-mvc = { module = "org.egovframe.rte:egovframe-rte-ptl-mvc", version.ref = "egov" }
egov-fdl-cmmn = { group = "org.egovframe.rte", name = "egovframe-rte-fdl-cmmn", version = "4.3.0" }
h2 = "com.h2database:h2:2.2.224"
"egov.psl.dataaccess" = "org.egovframe.rte:egovframe-rte-psl-dataaccess:4.3.0"

[bundles]
egov = ["egov-ptl-mvc", "egov-fdl-cmmn"]

[plugins]
spring-boot = { id = "org.springframework.boot", version = "3.4.1" }
`
		const catalog = parseVersionCatalog(toml)
		expect(catalog).toEqual({
			versions: { egov: "4.3.0", spring: "6.2.1" },
			libraries: {
				"egov-ptl-mvc": { groupId: "org.egovframe.rte", artifactId: "egovframe-rte-ptl-mvc", versionRef: "egov" },
				"egov-fdl-cmmn": { groupId: "org.egovframe.rte", artifactId: "egovframe-rte-fdl-cmmn", version: "4.3.0" },
				h2: { groupId: "com.h2database", artifactId: "h2", version: "2.2.224" },
				"egov.psl.dataaccess": {
					groupId: "org.egovframe.rte",
					artifactId: "egovframe-rte-psl-dataaccess",
					version: "4.3.0",
				},
			},
		})
		expect(resolveCatalogReference("libs.egov.ptl.mvc", catalog)).toEqual({
			groupId: "org.egovframe.rte",
			artifactId: "egovframe-rte-ptl-mvc",
			version: "4.3.0",
		})
		expect(resolveCatalogReference("libs.egov.fdl.cmmn", catalog)).toEqual({
			groupId: "org.egovframe.rte",
			artifactId: "egovframe-rte-fdl-cmmn",
			version: "4.3.0",
		})
		expect(resolveCatalogReference("libs.egov.psl.dataaccess", catalog)).toEqual({
			groupId: "org.egovframe.rte",
			artifactId: "egovframe-rte-psl-dataaccess",
			version: "4.3.0",
		})
		expect(resolveCatalogReference("libs.h2", catalog)).toEqual({
			groupId: "com.h2database",
			artifactId: "h2",
			version: "2.2.224",
		})
		expect(resolveCatalogReference("libs.missing", catalog)).toBeNull()
		expect(resolveCatalogReference("egov.ptl.mvc", catalog)).toBeNull()
	})

	it("주석 제거는 문자열 안의 // 를 남긴다", () => {
		expect(stripGradleComments(`maven { url "https://maven.egovframe.go.kr/maven/" }`)).toBe(
			`maven { url "https://maven.egovframe.go.kr/maven/" }`,
		)
		const text = [
			"// implementation 'org.egovframe.rte:egovframe-rte-ptl-mvc:3.10.0'",
			"implementation 'a:b:1' // trailing",
			"/* block",
			"implementation 'c:d:2' */ api 'e:f:3'",
			"url '/* not a comment */'",
			'def s = """multi // line"""',
		].join("\n")
		expect(stripGradleComments(text)).toBe(
			["", "implementation 'a:b:1' ", "", " api 'e:f:3'", "url '/* not a comment */'", 'def s = """multi // line"""'].join(
				"\n",
			),
		)
		const commented = `
dependencies {
	// implementation 'org.egovframe.rte:egovframe-rte-ptl-mvc:3.10.0'
	/* implementation 'org.egovframe.rte:egovframe-rte-psl-dataaccess:3.10.0' */
}
`
		expect(parseGradleBuild(commented, "gradle").dependencies).toEqual([])
	})

	it("bundles·each·$it·헬퍼 함수·conventions 플러그인은 unresolvedSignals, apply from은 appliedScripts", () => {
		const groovy = `
plugins {
	id 'java'
	id 'egov-java-conventions'
}
apply from: 'gradle/dependencies.gradle'
def egovLibs() {
	return ['org.egovframe.rte:egovframe-rte-ptl-mvc:4.3.0']
}
dependencies {
	implementation libs.bundles.egov
	['egovframe-rte-fdl-cmmn', 'egovframe-rte-ptl-mvc'].each {
		implementation "org.egovframe.rte:$it:4.3.0"
	}
	egovLibs()
	implementation egovLibsList()
	implementation someOtherList()
}
`
		const model = parseGradleBuild(groovy, "gradle")
		expect(model.unresolvedSignals).toEqual([
			"convention plugin egov-java-conventions",
			"bundle libs.bundles.egov",
			"loop",
			"helper function egovLibs",
			"unparsed: implementation egovLibsList()",
		])
		expect(model.appliedScripts).toEqual(["gradle/dependencies.gradle"])
		expect(model.dependencies).toEqual([])

		const kts = `
plugins {
	id("egov.common-conventions")
}
apply(from = "gradle/egov.gradle.kts")
dependencies {
	implementation(libs.bundles.egov.web)
	listOf("egovframe-rte-fdl-cmmn").forEach { implementation("org.egovframe.rte:$it:4.3.0") }
}
`
		const ktsModel = parseGradleBuild(kts, "gradle-kts")
		expect(ktsModel.unresolvedSignals).toEqual([
			"convention plugin egov.common-conventions",
			"bundle libs.bundles.egov.web",
			"loop",
		])
		expect(ktsModel.appliedScripts).toEqual(["gradle/egov.gradle.kts"])
		expect(ktsModel.dependencies).toEqual([])
	})

	it("def 헬퍼를 의존성 인자로 호출하면 helper function 신호", () => {
		const text = `
def rte(String m) { "org.egovframe.rte:egovframe-rte-\${m}:4.3.0" }
def egovLib(name) {
	return "org.egovframe.rte:egovframe-rte-\${name}:4.3.0"
}
dependencies {
	implementation rte('ptl-mvc')
	api(rte("fdl-cmmn"))
	implementation egovLib('psl-dataaccess')
}
`
		const model = parseGradleBuild(text, "gradle")
		expect(model.dependencies).toEqual([])
		expect(model.unresolvedSignals).toEqual(["helper function rte", "helper function egovLib"])
	})

	it("dependencies 안 내부 블록의 egov 선언은 unparsed 신호, constraints는 조용히 넘긴다", () => {
		const text = `
dependencies {
	if (useDb) {
		implementation("org.egovframe.rte:egovframe-rte-psl-dataaccess:4.3.0")
		runtimeOnly 'com.h2database:h2'
	}
	constraints {
		implementation 'org.egovframe.rte:egovframe-rte-ptl-mvc:4.3.0'
	}
	implementation('org.egovframe.rte:egovframe-rte-fdl-cmmn:4.3.0') {
		exclude group: 'org.egovframe.rte', module: 'egovframe-rte-fdl-logging'
	}
}
`
		const model = parseGradleBuild(text, "gradle")
		expect(model.dependencies).toEqual([
			{
				configuration: "implementation",
				group: "org.egovframe.rte",
				name: "egovframe-rte-fdl-cmmn",
				version: "4.3.0",
				exclusions: [{ group: "org.egovframe.rte", module: "egovframe-rte-fdl-logging" }],
				evidence: "implementation('org.egovframe.rte:egovframe-rte-fdl-cmmn:4.3.0')",
			},
		])
		expect(model.unresolvedSignals).toEqual([
			'unparsed: implementation("org.egovframe.rte:egovframe-rte-psl-dataaccess:4.3.0")',
		])
	})
})
