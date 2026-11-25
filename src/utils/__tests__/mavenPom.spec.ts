import { describe, expect, it } from "vitest"
import { parseMavenPom, resolvePlaceholders, stripXmlComments } from "../mavenPom"

const WEB_51_POM = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/maven-v4_0_0.xsd">
	<modelVersion>4.0.0</modelVersion>
	<parent>
		<groupId>org.egovframe.web</groupId>
		<artifactId>egovframe-web-config-parent</artifactId>
		<version>5.0.0</version>
	</parent>
	<groupId>egovframework.com</groupId>
	<artifactId>egovframe-common</artifactId>
	<version>5.1.0</version>
	<packaging>war</packaging>
	<properties>
		<org.egovframe.rte.version>5.0.0</org.egovframe.rte.version>
	</properties>
	<dependencies>
		<!--
		<dependency>
			<groupId>org.egovframe.rte</groupId>
			<artifactId>org.egovframe.rte.ptl.mvc</artifactId>
			<version>4.3.0</version>
		</dependency>
		<dependency>
			<groupId>org.egovframe.rte</groupId>
			<artifactId>org.egovframe.rte.psl.dataaccess</artifactId>
			<version>4.3.0</version>
		</dependency>
		-->
		<dependency>
			<groupId>org.egovframe.rte</groupId>
			<artifactId>egovframe-rte-ptl-mvc</artifactId>
		</dependency>
		<dependency>
			<groupId>org.egovframe.rte</groupId>
			<artifactId>egovframe-rte-fdl-crypto</artifactId>
			<optional>true</optional>
		</dependency>
		<dependency>
			<groupId>org.egovframe.rte</groupId>
			<artifactId>egovframe-rte-fdl-cmmn</artifactId>
			<version>\${org.egovframe.rte.version}</version>
			<exclusions>
				<exclusion>
					<groupId>org.egovframe.rte</groupId>
					<artifactId>egovframe-rte-fdl-logging</artifactId>
				</exclusion>
				<exclusion>
					<groupId>*</groupId>
					<artifactId>*</artifactId>
				</exclusion>
			</exclusions>
		</dependency>
		<dependency>
			<groupId>junit</groupId>
			<artifactId>junit</artifactId>
			<version>4.13.2</version>
			<scope>test</scope>
		</dependency>
	</dependencies>
</project>
`

const AGGREGATOR_POM = `<project>
	<modelVersion>4.0.0</modelVersion>
	<parent>
		<groupId>org.egovframe.web</groupId>
		<artifactId>egovframe-web-config-parent</artifactId>
		<version>5.0.0</version>
	</parent>
	<artifactId>sample-root</artifactId>
	<packaging>pom</packaging>
	<modules>
		<module>sample-api</module>
		<module>sample-web</module>
	</modules>
	<dependencyManagement>
		<dependencies>
			<dependency>
				<groupId>org.egovframe.boot</groupId>
				<artifactId>egovframe-boot-bom</artifactId>
				<version>5.0.0</version>
				<type>pom</type>
				<scope>import</scope>
			</dependency>
			<dependency>
				<groupId>org.mybatis</groupId>
				<artifactId>mybatis</artifactId>
				<version>3.5.16</version>
			</dependency>
		</dependencies>
	</dependencyManagement>
</project>
`

const PROFILE_POM = `<project>
	<groupId>com.example</groupId>
	<artifactId>profiled</artifactId>
	<version>1.0.0</version>
	<properties>
		<base>1</base>
	</properties>
	<dependencies>
		<dependency>
			<groupId>org.egovframe.rte</groupId>
			<artifactId>egovframe-rte-fdl-cmmn</artifactId>
			<version>5.0.0</version>
		</dependency>
	</dependencies>
	<build>
		<plugins>
			<plugin>
				<groupId>org.apache.maven.plugins</groupId>
				<artifactId>maven-compiler-plugin</artifactId>
				<dependencies>
					<dependency>
						<groupId>org.egovframe.rte</groupId>
						<artifactId>egovframe-rte-plugin-dep</artifactId>
						<version>5.0.0</version>
					</dependency>
				</dependencies>
			</plugin>
		</plugins>
	</build>
	<profiles>
		<profile>
			<id>dev</id>
			<activation>
				<activeByDefault>true</activeByDefault>
			</activation>
			<properties>
				<env>dev</env>
			</properties>
			<dependencies>
				<dependency>
					<groupId>org.egovframe.rte</groupId>
					<artifactId>egovframe-rte-profile-active</artifactId>
					<version>5.0.0</version>
				</dependency>
			</dependencies>
		</profile>
		<profile>
			<id>prod</id>
			<properties>
				<env>prod</env>
				<prodOnly>yes</prodOnly>
			</properties>
			<dependencies>
				<dependency>
					<groupId>org.egovframe.rte</groupId>
					<artifactId>egovframe-rte-profile-inactive</artifactId>
					<version>5.0.0</version>
				</dependency>
			</dependencies>
		</profile>
	</profiles>
</project>
`

describe("mavenPom", () => {
	it("주석 블록 안 선언을 무시하고 의존성·scope·optional·exclusions를 읽는다", () => {
		expect(stripXmlComments("<a><!-- <b/> --><c/></a>")).not.toContain("<b/>")

		const model = parseMavenPom(WEB_51_POM)
		const ids = model.dependencies.map((d) => d.artifactId)
		expect(ids).toEqual(["egovframe-rte-ptl-mvc", "egovframe-rte-fdl-crypto", "egovframe-rte-fdl-cmmn", "junit"])
		expect(ids).not.toContain("org.egovframe.rte.ptl.mvc")
		expect(ids).not.toContain("org.egovframe.rte.psl.dataaccess")

		const mvc = model.dependencies[0]
		expect(mvc).toEqual({
			groupId: "org.egovframe.rte",
			artifactId: "egovframe-rte-ptl-mvc",
			version: undefined,
			scope: "compile",
			optional: false,
			exclusions: [],
			type: undefined,
		})
		expect(model.dependencies[1].optional).toBe(true)
		expect(model.dependencies[1].scope).toBe("compile")

		const cmmn = model.dependencies[2]
		expect(cmmn.version).toBe("${org.egovframe.rte.version}")
		expect(cmmn.exclusions).toEqual([
			{ groupId: "org.egovframe.rte", artifactId: "egovframe-rte-fdl-logging" },
			{ groupId: "*", artifactId: "*" },
		])
		expect(model.dependencies[3].scope).toBe("test")

		expect(model.groupId).toBe("egovframework.com")
		expect(model.artifactId).toBe("egovframe-common")
		expect(model.version).toBe("5.1.0")
		expect(model.packaging).toBe("war")
		expect(model.properties).toEqual({ "org.egovframe.rte.version": "5.0.0" })
		expect(model.profilesIgnored).toBe(false)
	})

	it("parent·properties·packaging·modules·dependencyManagement import를 읽는다", () => {
		const model = parseMavenPom(AGGREGATOR_POM)
		expect(model.parent).toEqual({
			groupId: "org.egovframe.web",
			artifactId: "egovframe-web-config-parent",
			version: "5.0.0",
			relativePath: undefined,
		})
		expect(model.groupId).toBe("org.egovframe.web")
		expect(model.version).toBe("5.0.0")
		expect(model.artifactId).toBe("sample-root")
		expect(model.packaging).toBe("pom")
		expect(model.modules).toEqual(["sample-api", "sample-web"])
		expect(model.properties).toEqual({})
		expect(model.dependencies).toEqual([])
		expect(model.importedBoms).toEqual([
			{ groupId: "org.egovframe.boot", artifactId: "egovframe-boot-bom", version: "5.0.0" },
		])
		expect(model.managedDependencies).toHaveLength(1)
		expect(model.managedDependencies[0]).toMatchObject({
			groupId: "org.mybatis",
			artifactId: "mybatis",
			version: "3.5.16",
			scope: "compile",
		})

		const selfClosing = parseMavenPom(
			"<project><parent><groupId>g</groupId><artifactId>p</artifactId><version>1</version><relativePath/></parent><artifactId>c</artifactId></project>",
		)
		expect(selfClosing.parent?.relativePath).toBe("")
		expect(selfClosing.packaging).toBe("jar")
	})

	it("플러그인 아래 dependencies와 프로파일 아래 dependencies는 세지 않고, activeByDefault 프로파일의 properties만 합친다", () => {
		const model = parseMavenPom(PROFILE_POM)
		expect(model.profilesIgnored).toBe(true)
		expect(model.properties).toEqual({ base: "1", env: "dev" })
		expect(model.dependencies.map((d) => d.artifactId)).toEqual(["egovframe-rte-fdl-cmmn"])
	})

	it("네임스페이스 접두어와 CDATA", () => {
		const model = parseMavenPom(
			`<?xml version="1.0"?><m:project xmlns:m="http://maven.apache.org/POM/4.0.0"><m:artifactId><![CDATA[a]]></m:artifactId><m:version>1.0</m:version></m:project>`,
		)
		expect(model.artifactId).toBe("a")
		expect(model.version).toBe("1.0")
	})

	it("아주 깊게 중첩된 XML도 스택 오버플로 없이 읽는다", () => {
		const depth = 20000
		const xml = `<project><artifactId>deep</artifactId>${"<x>".repeat(depth)}leaf${"</x>".repeat(depth)}<version>1.0</version></project>`
		const model = parseMavenPom(xml)
		expect(model.artifactId).toBe("deep")
		expect(model.version).toBe("1.0")
	})

	it("resolvePlaceholders: 연쇄 치환, 자기 참조·순환은 끝난다, 모르는 키는 남긴다", () => {
		expect(resolvePlaceholders("${a}", { a: "${b}", b: "x" })).toBe("x")
		expect(resolvePlaceholders("v-${a}-${b}", { a: "1", b: "2" })).toBe("v-1-2")
		expect(resolvePlaceholders("${a}", { a: "${a}" })).toBe("${a}")
		const cyclic = resolvePlaceholders("${a}", { a: "${b}", b: "${a}" })
		expect(cyclic).toContain("${")
		expect(resolvePlaceholders("${project.version}", {})).toBe("${project.version}")
		expect(resolvePlaceholders("${a}", { a: "${b}", b: "${c}", c: "deep" }, 1)).toContain("${")
	})
})
