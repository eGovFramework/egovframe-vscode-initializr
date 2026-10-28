import { describe, expect, it } from "vitest"
import {
	findUnclassifiedDataAccessFiles,
	isDataAccessConfigPath,
	scanDataAccessConfig,
	type DataAccessScanInput,
} from "../dataAccessConfigScan"

const P = "/p"
const RES = `${P}/src/main/resources`
const JAVA = `${P}/src/main/java/egov/sample`

const WARN_NO_SCAN = "Mapper interfaces exist but no MapperConfigurer, @MapperScan or mybatis-spring-boot-starter was found"
const WARN_NO_SQLMAP = "iBatis DAOs exist but no SqlMapClientFactoryBean was found"
const WARN_SPRING_IBATIS = "SqlMapClientFactoryBean is taken from org.springframework.orm.ibatis; eGovFrame 3.5+ provides its own"
const WARN_STARTER_ONLY =
	"Only mybatis-spring-boot-starter is configured; eGovFrame @Mapper/@EgovMapper interfaces are not auto-scanned without MapperConfigurer or @MapperScan"
const WARN_SCAN_ALL = "@MapperScan without annotationClass registers every interface under basePackages"

/** files 맵의 경로를 종류별로 나눠 입력을 만든다 (in-memory) */
function scan(files: Record<string, string>, overrides: Partial<DataAccessScanInput> = {}) {
	const paths = Object.keys(files)
	const isBuild = (p: string) => /\/(pom\.xml|build\.gradle|build\.gradle\.kts)$/.test(p)
	const input: DataAccessScanInput = {
		projectPath: P,
		configFiles: paths.filter((p) => !isBuild(p) && /\.(xml|ya?ml|properties)$/.test(p)),
		javaFiles: paths.filter((p) => p.endsWith(".java")),
		buildFiles: paths.filter(isBuild).map((filePath) => ({ filePath, text: files[filePath] })),
		readFile: (p) => {
			if (!(p in files)) {
				throw new Error(`ENOENT ${p}`)
			}
			return files[p]
		},
		generation: "unknown",
		hasMapperInterfaces: false,
		hasIbatisDaos: false,
		...overrides,
	}
	return scanDataAccessConfig(input)
}

const contextMapperXml = `<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans">
	<!-- <bean class="org.springframework.orm.ibatis.SqlMapClientFactoryBean"/> -->
	<bean id="sqlSession"
		class="org.mybatis.spring.SqlSessionFactoryBean">
		<property name="dataSource" ref="dataSource"/>
	</bean>
	<bean
		class="org.egovframe.rte.psl.dataaccess.mapper.MapperConfigurer">
		<property name="basePackage" value="egovframework.example.**.service.impl"/>
	</bean>
</beans>
`

const sqlMapXml = (pkg: string) => `<beans>
	<bean id="sqlMapClient" class="${pkg}.SqlMapClientFactoryBean">
		<property name="configLocations" value="classpath:/sqlmap/sql-map-config.xml"/>
	</bean>
</beans>
`

const mapperScanConfig = `package egov.sample.config;

import org.mybatis.spring.SqlSessionFactoryBean;
import org.mybatis.spring.annotation.MapperScan;

@Configuration
@MapperScan(basePackages = "x")
public class EgovConfigMapper {
	@Bean
	public SqlSessionFactoryBean sqlSession() {
		return new SqlSessionFactoryBean();
	}
}
`

const starterPom = `<project><dependencies>
<dependency><groupId>org.mybatis.spring.boot</groupId><artifactId>mybatis-spring-boot-starter</artifactId></dependency>
</dependencies></project>
`

describe("isDataAccessConfigPath", () => {
	it("src/main/resources·src/main/webapp/WEB-INF 아래의 설정 파일만 받는다 (구분자 무관)", () => {
		expect(isDataAccessConfigPath("/p/src/main/resources/egovframework/spring/context-mapper.xml")).toBe(true)
		expect(isDataAccessConfigPath("/p/src/main/webapp/WEB-INF/config/egovframework/springmvc/dispatcher.xml")).toBe(true)
		expect(isDataAccessConfigPath("C:\\p\\src\\main\\resources\\application.yml")).toBe(true)
		expect(isDataAccessConfigPath("/p/pom.xml")).toBe(false)
		expect(isDataAccessConfigPath("/p/src/test/resources/context.xml")).toBe(false)
	})
})

describe("scanDataAccessConfig: XML", () => {
	it("<bean>과 class=가 다른 줄이어도 찾고, 주석 안 SqlMapClientFactoryBean은 무시하며 MapperConfigurer의 basePackage를 읽는다", () => {
		const info = scan({ [`${RES}/egovframework/spring/context-mapper.xml`]: contextMapperXml })
		expect(info.findings).toEqual([
			{
				kind: "sqlSessionFactoryBean",
				filePath: `${RES}/egovframework/spring/context-mapper.xml`,
				fileName: "context-mapper.xml",
				evidence: "org.mybatis.spring.SqlSessionFactoryBean",
			},
			{
				kind: "mapperConfigurer",
				filePath: `${RES}/egovframework/spring/context-mapper.xml`,
				fileName: "context-mapper.xml",
				evidence: "basePackage=egovframework.example.**.service.impl",
			},
		])
		expect(info.warnings).toEqual([])
	})

	it("basePackage property가 없거나 self-closing bean이면 basePackage=?", () => {
		const info = scan({
			[`${RES}/a.xml`]: `<beans><bean class="egovframework.rte.psl.dataaccess.mapper.MapperConfigurer"/></beans>`,
		})
		expect(info.findings.map((f) => f.evidence)).toEqual(["basePackage=?"])
	})

	it("SqlMapClientFactoryBean은 패키지 접두어를 evidence로 둔다", () => {
		for (const pkg of [
			"org.springframework.orm.ibatis",
			"egovframework.rte.psl.orm.ibatis",
			"org.egovframe.rte.psl.orm.ibatis",
		]) {
			const info = scan({ [`${P}/src/main/webapp/WEB-INF/config/egovframework/springmvc/sqlmap.xml`]: sqlMapXml(pkg) })
			expect(info.findings).toEqual([
				{
					kind: "sqlMapClientFactoryBean",
					filePath: `${P}/src/main/webapp/WEB-INF/config/egovframework/springmvc/sqlmap.xml`,
					fileName: "sqlmap.xml",
					evidence: pkg,
				},
			])
		}
	})

	it("같은 파일·같은 kind는 한 번만", () => {
		const xml = `<beans>
<bean id="a" class="org.mybatis.spring.SqlSessionFactoryBean"/>
<bean id="b" class="org.mybatis.spring.SqlSessionFactoryBean"/>
</beans>`
		expect(scan({ [`${RES}/a.xml`]: xml }).findings).toHaveLength(1)
		expect(scan({ [`${RES}/a.xml`]: xml, [`${RES}/b.xml`]: xml }).findings).toHaveLength(2)
	})

	it("수집 범위 밖의 설정 파일은 보지 않는다", () => {
		expect(scan({ [`${P}/src/test/resources/a.xml`]: contextMapperXml }).findings).toEqual([])
	})
})

describe("scanDataAccessConfig: Java", () => {
	it("@MapperScan(basePackages = ...)과 @Bean SqlSessionFactoryBean을 찾고 annotationClass가 없으면 경고 5", () => {
		const info = scan({ [`${JAVA}/config/EgovConfigMapper.java`]: mapperScanConfig }, { hasMapperInterfaces: true })
		expect(info.findings).toEqual([
			{
				kind: "sqlSessionFactoryBean",
				filePath: `${JAVA}/config/EgovConfigMapper.java`,
				fileName: "EgovConfigMapper.java",
				evidence: "java",
			},
			{
				kind: "mapperScan",
				filePath: `${JAVA}/config/EgovConfigMapper.java`,
				fileName: "EgovConfigMapper.java",
				evidence: "basePackages",
			},
		])
		expect(info.warnings).toEqual([WARN_SCAN_ALL])
	})

	it("@MapperScan 속성 이름을 정해진 순서로 쉼표로 잇고, 값만 있거나 value=이면 basePackages", () => {
		const evidenceOf = (annotation: string) =>
			scan({ [`${JAVA}/C.java`]: `${annotation}\npublic class C {}\n` }).findings.find((f) => f.kind === "mapperScan")
				?.evidence
		expect(
			evidenceOf(
				`@MapperScan(sqlSessionFactoryRef = "s", annotationClass = EgovMapper.class, basePackages = {"a=b", "c"})`,
			),
		).toBe("basePackages,annotationClass,sqlSessionFactoryRef")
		expect(evidenceOf(`@MapperScan("x")`)).toBe("basePackages")
		expect(evidenceOf(`@MapperScan(value = "x", annotationClass = Mapper.class)`)).toBe("basePackages,annotationClass")
		expect(evidenceOf(`@org.mybatis.spring.annotation.MapperScans({ @MapperScan(basePackages = "x") })`)).toBe("basePackages")
		// annotationClass가 있으면 경고 5 없음
		const info = scan({
			[`${JAVA}/C.java`]: `@MapperScan(basePackages = "x", annotationClass = EgovMapper.class)\nclass C {}`,
		})
		expect(info.warnings).toEqual([])
	})

	it("SqlMapClientFactoryBean은 import 패키지를, MapperConfigurer·MapperScannerConfigurer는 토큰 이름을 evidence로 둔다", () => {
		const info = scan({
			[`${JAVA}/IbatisConfig.java`]: `import egovframework.rte.psl.orm.ibatis.SqlMapClientFactoryBean;\nclass IbatisConfig { SqlMapClientFactoryBean f; }\n`,
			[`${JAVA}/ScanConfig.java`]: `import org.mybatis.spring.mapper.MapperScannerConfigurer;\nclass ScanConfig { MapperScannerConfigurer c; }\n`,
		})
		expect(info.findings.map((f) => [f.fileName, f.kind, f.evidence])).toEqual([
			["IbatisConfig.java", "sqlMapClientFactoryBean", "egovframework.rte.psl.orm.ibatis"],
			["ScanConfig.java", "mapperConfigurer", "MapperScannerConfigurer"],
		])
	})

	it("주석 안의 토큰과 src/main/java 밖의 파일은 무시한다", () => {
		const info = scan({
			[`${JAVA}/Commented.java`]: `// @MapperScan(basePackages = "x")\n/* SqlSessionFactoryBean */\nclass Commented {}\n`,
			[`${P}/src/main/kotlin/K.java`]: `@MapperScan("x")\nclass K {}\n`,
		})
		expect(info.findings).toEqual([])
	})
})

describe("scanDataAccessConfig: yml / properties / 빌드 파일", () => {
	it("application.yml의 mybatis: 아래 mapper-locations 값을 evidence로 둔다", () => {
		const info = scan({
			[`${RES}/application.yml`]:
				"spring:\n  datasource:\n    url: x\nmybatis:\n  mapper-locations: classpath:/mappers/*.xml\n",
		})
		expect(info.findings).toEqual([
			{
				kind: "mapperLocations",
				filePath: `${RES}/application.yml`,
				fileName: "application.yml",
				evidence: "classpath:/mappers/*.xml",
			},
		])
	})

	it("mybatis 블록 밖의 mapper-locations는 보지 않는다", () => {
		const info = scan({
			[`${RES}/application.yaml`]: "other:\n  mapper-locations: classpath:/x/*.xml\nmybatis:\n  type-aliases-package: a\n",
		})
		expect(info.findings).toEqual([])
	})

	it("properties의 mybatis.mapper-locations를 찾는다", () => {
		const info = scan({
			[`${RES}/application.properties`]:
				"# mybatis.mapper-locations=no\nmybatis.mapper-locations=classpath:mapper/**/*.xml\n",
		})
		expect(info.findings.map((f) => [f.kind, f.evidence])).toEqual([["mapperLocations", "classpath:mapper/**/*.xml"]])
	})

	it("pom 본문의 mybatis-spring-boot-starter를 그 빌드 파일의 finding으로 둔다", () => {
		const info = scan({ [`${P}/pom.xml`]: starterPom })
		expect(info.findings).toEqual([
			{ kind: "mybatisStarter", filePath: `${P}/pom.xml`, fileName: "pom.xml", evidence: "mybatis-spring-boot-starter" },
		])
	})
})

describe("scanDataAccessConfig: 경고 1~4", () => {
	it("경고 1: Mapper 인터페이스가 있는데 스캔 설정이 하나도 없을 때만", () => {
		expect(scan({}, { hasMapperInterfaces: true }).warnings).toEqual([WARN_NO_SCAN])
		expect(scan({ [`${RES}/context-mapper.xml`]: contextMapperXml }, { hasMapperInterfaces: true }).warnings).toEqual([])
		expect(scan({}, { hasMapperInterfaces: false }).warnings).toEqual([])
	})

	it("경고 2: iBatis DAO가 있는데 SqlMapClientFactoryBean이 없을 때만", () => {
		expect(scan({}, { hasIbatisDaos: true }).warnings).toEqual([WARN_NO_SQLMAP])
		expect(
			scan({ [`${RES}/sqlmap.xml`]: sqlMapXml("egovframework.rte.psl.orm.ibatis") }, { hasIbatisDaos: true }).warnings,
		).toEqual([])
	})

	it("경고 3: org.springframework.orm.ibatis 접두어 + (4.x·5.x 또는 3.5 이상의 3.x)일 때만", () => {
		const files = { [`${RES}/sqlmap.xml`]: sqlMapXml("org.springframework.orm.ibatis") }
		expect(scan(files, { generation: "4.x" }).warnings).toEqual([WARN_SPRING_IBATIS])
		expect(scan(files, { generation: "5.x" }).warnings).toEqual([WARN_SPRING_IBATIS])
		expect(scan(files, { generation: "3.x", version: "3.5.0" }).warnings).toEqual([WARN_SPRING_IBATIS])
		expect(scan(files, { generation: "3.x", version: "3.10.0" }).warnings).toEqual([WARN_SPRING_IBATIS])
		expect(scan(files, { generation: "3.x", version: "3.2.0" }).warnings).toEqual([])
		expect(scan(files, { generation: "3.x" }).warnings).toEqual([])
		expect(scan(files, { generation: "unknown" }).warnings).toEqual([])
		expect(
			scan({ [`${RES}/sqlmap.xml`]: sqlMapXml("org.egovframe.rte.psl.orm.ibatis") }, { generation: "4.x" }).warnings,
		).toEqual([])
	})

	it("경고 4: starter만 있고 MapperConfigurer·@MapperScan 없이 Mapper 인터페이스가 있을 때만", () => {
		expect(scan({ [`${P}/pom.xml`]: starterPom }, { hasMapperInterfaces: true }).warnings).toEqual([WARN_STARTER_ONLY])
		expect(scan({ [`${P}/pom.xml`]: starterPom }, { hasMapperInterfaces: false }).warnings).toEqual([])
		expect(
			scan(
				{
					[`${P}/pom.xml`]: starterPom,
					[`${JAVA}/C.java`]: `@MapperScan(basePackages = "x", annotationClass = EgovMapper.class)\nclass C {}`,
				},
				{ hasMapperInterfaces: true },
			).warnings,
		).toEqual([])
	})

	it("여러 경고는 정해진 순서로", () => {
		const info = scan(
			{
				[`${RES}/sqlmap.xml`]: sqlMapXml("org.springframework.orm.ibatis"),
				[`${JAVA}/C.java`]: `@MapperScan("x")\nclass C {}`,
			},
			{ generation: "5.x", hasIbatisDaos: true, hasMapperInterfaces: true },
		)
		expect(info.warnings).toEqual([WARN_SPRING_IBATIS, WARN_SCAN_ALL])
	})
})

describe("findUnclassifiedDataAccessFiles", () => {
	it("DAO 집합 밖에서 데이터 접근 타입을 직접 쓰는 파일만 상대 경로와 함께 모은다", () => {
		const files: Record<string, string> = {
			[`${JAVA}/repo/SampleRepository.java`]: `import org.springframework.jdbc.core.JdbcTemplate;\nclass SampleRepository { JdbcTemplate jdbc; }\n`,
			[`${JAVA}/web/SampleController.java`]: `@Controller\nclass SampleController {}\n`,
			[`${JAVA}/dao/SampleDAO.java`]: `class SampleDAO { SqlMapClient c; }\n`,
			[`${JAVA}/dao/OtherMapper.java`]: `class OtherMapper { SqlSessionTemplate t; }\n`,
			[`${JAVA}/Commented.java`]: `// EntityManager em;\nclass Commented {}\n`,
		}
		const result = findUnclassifiedDataAccessFiles(
			Object.keys(files),
			new Set([`${JAVA}/dao/SampleDAO.java`]),
			(p) => files[p],
			P,
		)
		expect(result).toEqual([
			{
				filePath: `${JAVA}/repo/SampleRepository.java`,
				fileName: "SampleRepository.java",
				relativePath: "src/main/java/egov/sample/repo/SampleRepository.java",
				evidence: "JdbcTemplate",
			},
		])
	})
})
