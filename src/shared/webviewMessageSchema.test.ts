import { describe, expect, it } from "vitest"
import { parseWebviewMessage } from "./webviewMessageSchema"
import type { WebviewMessage } from "./WebviewMessage"

function parseOk(raw: unknown): WebviewMessage {
	const result = parseWebviewMessage(raw)
	if (!result.success) {
		throw new Error(`메시지가 허용되어야 하는데 거부됨: ${result.error}`)
	}
	return result.message
}

function parseFail(raw: unknown): string {
	const result = parseWebviewMessage(raw)
	if (result.success) {
		throw new Error(`메시지가 거부되어야 하는데 허용됨: ${JSON.stringify(raw)}`)
	}
	return result.error
}

const validProjectConfig = {
	projectName: "my-project",
	artifactId: "my-artifact",
	groupId: "com.example",
	version: "1.0.0",
	url: "https://www.egovframe.go.kr",
	outputPath: "/Users/dev/workspace",
	template: {
		displayName: "eGovFrame Web Project",
		fileName: "egovframe-web.zip",
		pomFile: "egovframe-web-pom.xml",
	},
}

// templates-context-xml.json의 실제 항목과 같은 형태 (빈 문자열 = 변형 템플릿 없음)
const validConfigTemplate = {
	displayName: "Datasource > New Datasource",
	templateFolder: "datasource",
	templateFile: "datasource.hbs",
	webView: "datasource-form.tsx",
	fileNameProperty: "txtFileName",
	javaConfigTemplate: "datasource-java.hbs",
	yamlTemplate: "",
	propertiesTemplate: "",
	description: "Create a new datasource configuration",
}

const validFormData = {
	txtFileName: "context-datasource",
	generationType: "xml",
	txtDatasourceName: "dataSource",
	txtDriver: "org.h2.Driver",
}

const validColumn = {
	ccName: "userId",
	columnName: "USER_ID",
	isPrimaryKey: true,
	pcName: "UserId",
	dataType: "VARCHAR",
	javaType: "String",
	comment: "사용자 ID",
}

const validTemplateContext = {
	tableName: "User",
	dbTableName: "TB_USER",
	attributes: [validColumn],
	pkAttributes: [validColumn],
	packageName: "com.example.sample",
	className: "User",
	classNameFirstCharLower: "user",
	author: "author",
	date: "2026-07-06",
	version: "1.0.0",
}

describe("parseWebviewMessage", () => {
	it("페이로드 없는 단순 메시지를 모두 허용한다", () => {
		const simpleTypes = [
			"webviewDidLaunch",
			"selectOutputPath",
			"generateProjectByCommand",
			"getWorkspacePath",
			"getDefaultSettings",
			"openPackageSettings",
			"getSampleDDLs",
			"getCurrentTheme",
			"selectConfigFilePath",
			"getEgovSettings",
			"getExtensionInfo",
			"getProjectTemplates",
			"getConfigTemplates",
		]
		for (const type of simpleTypes) {
			expect(parseOk({ type }).type).toBe(type)
		}
	})

	it("페이로드가 있는 모든 메시지의 정상 형태를 허용한다", () => {
		parseOk({ type: "generateProject", projectConfig: validProjectConfig, method: "form" })
		parseOk({ type: "generateCode", ddl: "CREATE TABLE t (id INT)", packageName: "com.example", outputPath: "/tmp/out" })
		parseOk({ type: "uploadTemplates", ddl: "CREATE TABLE t (id INT)", packageName: "com.example" })
		parseOk({ type: "downloadTemplateContext", ddl: "CREATE TABLE t (id INT)", context: validTemplateContext })
		parseOk({ type: "validateDDLOnly", ddl: "CREATE TABLE t (id INT)" })
		parseOk({ type: "validateAndPreview", ddl: "CREATE TABLE t (id INT)", packageName: "com.example" })
		parseOk({ type: "generateConfig", template: validConfigTemplate, formData: validFormData })
		parseOk({ type: "selectOutputFolder", formData: validFormData })
		parseOk({ type: "showError", value: "something failed" })
		parseOk({ type: "showWarning", value: "be careful" })
		parseOk({ type: "updateEgovSettings", settings: { language: "ko" } })
	})

	describe("비정상 입력 거부", () => {
		it("객체가 아닌 값을 거부한다", () => {
			expect(parseFail(null)).toContain("object")
			parseFail("generateProject")
			parseFail(42)
			parseFail(undefined)
			parseFail([{ type: "webviewDidLaunch" }])
		})

		it("type이 없거나 알 수 없는 type을 거부한다", () => {
			parseFail({})
			parseFail({ type: 123 })
			parseFail({ type: "notARealMessageType" })
		})

		it("거부 사유에 수신한 type과 문제 필드가 담긴다", () => {
			const error = parseFail({ type: "generateProject" })
			expect(error).toContain("generateProject")
			expect(error).toContain("projectConfig")
		})
	})

	describe("경로 조작 차단 (CWE-22)", () => {
		it("projectName의 경로 탈출 시도를 거부한다", () => {
			for (const projectName of ["..", "../evil", "a/b", "a\\b", "a..b..", ".hidden"]) {
				parseFail({
					type: "generateProject",
					projectConfig: { ...validProjectConfig, projectName },
					method: "form",
				})
			}
		})

		it("template.fileName은 경로 구분자 없는 .zip 파일명만 허용한다", () => {
			for (const fileName of ["../../../etc/passwd", "evil/x.zip", "..\\x.zip", "x.txt", "..zip", ""]) {
				parseFail({
					type: "generateProject",
					projectConfig: { ...validProjectConfig, template: { ...validProjectConfig.template, fileName } },
					method: "form",
				})
			}
		})

		it("template.pomFile은 빈 문자열 또는 경로 구분자 없는 .xml 파일명만 허용한다", () => {
			parseOk({
				type: "generateProject",
				projectConfig: { ...validProjectConfig, template: { ...validProjectConfig.template, pomFile: "" } },
				method: "form",
			})
			for (const pomFile of ["../x.xml", "a/b.xml", "x.hbs"]) {
				parseFail({
					type: "generateProject",
					projectConfig: { ...validProjectConfig, template: { ...validProjectConfig.template, pomFile } },
					method: "form",
				})
			}
		})

		it("templateFolder와 템플릿 파일명의 탈출 시도를 거부한다", () => {
			parseFail({
				type: "generateConfig",
				template: { ...validConfigTemplate, templateFolder: "../../secret" },
				formData: validFormData,
			})
			parseFail({
				type: "generateConfig",
				template: { ...validConfigTemplate, templateFile: "../datasource.hbs" },
				formData: validFormData,
			})
			parseFail({
				type: "generateConfig",
				template: { ...validConfigTemplate, templateFile: "datasource.xml" },
				formData: validFormData,
			})
			parseFail({
				type: "generateConfig",
				template: { ...validConfigTemplate, javaConfigTemplate: "sub/dir.hbs" },
				formData: validFormData,
			})
		})

		it("generateCode의 packageName은 Java 패키지 규칙을 강제한다", () => {
			const base = { type: "generateCode", ddl: "CREATE TABLE t (id INT)", outputPath: "/tmp/out" }
			parseOk({ ...base, packageName: "com.example.sample" })
			parseOk(base) // packageName 생략 가능
			// 웹뷰 validateCodeConfig와 동일한 패턴이라 연속된 점은 통과하지만,
			// codeGenerator의 createPackagePath가 점을 모두 슬래시로 바꾸므로 ..으로는 디렉터리 탈출이 불가능하다
			parseOk({ ...base, packageName: "com..example" })
			for (const packageName of ["../etc", "Com.Bad", "com.", ".com", "com/example"]) {
				parseFail({ ...base, packageName })
			}
		})
	})

	it("미리보기 전용 경로는 타이핑 도중의 패키지명도 허용한다", () => {
		// validateDDLOnly는 debounce로 입력 중에도 전송되므로 "com." 같은 미완성 값을 거부하면 안 된다
		parseOk({ type: "validateDDLOnly", ddl: "CREATE TABLE t (id INT)", packageName: "com." })
		parseOk({ type: "validateAndPreview", ddl: "CREATE TABLE t (id INT)", packageName: "" })
	})

	describe("알 수 없는 키 처리", () => {
		it("메시지 최상위의 선언되지 않은 키를 제거한다", () => {
			const raw = JSON.parse('{"type":"generateCode","ddl":"CREATE TABLE t (id INT)","extra":"boom"}')
			const message = parseOk(raw)
			expect("extra" in message).toBe(false)
		})

		it("template 객체의 선언되지 않은 키를 제거한다", () => {
			const message = parseOk({
				type: "generateConfig",
				template: { ...validConfigTemplate, injected: "x" },
				formData: validFormData,
			})
			if (message.type !== "generateConfig") {
				throw new Error("unexpected message type")
			}
			expect("injected" in message.template).toBe(false)
		})

		it("formData는 템플릿별 자유 필드를 보존한다", () => {
			const message = parseOk({ type: "generateConfig", template: validConfigTemplate, formData: validFormData })
			if (message.type !== "generateConfig") {
				throw new Error("unexpected message type")
			}
			expect(message.formData.txtDatasourceName).toBe("dataSource")
			expect(message.formData.txtDriver).toBe("org.h2.Driver")
		})
	})

	describe("formData 공통 필드 검증", () => {
		it("txtFileName 누락을 거부한다", () => {
			parseFail({ type: "selectOutputFolder", formData: { generationType: "xml" } })
		})

		it("generationType은 허용된 값만 받는다", () => {
			for (const generationType of ["xml", "javaConfig", "yaml", "properties", "json"]) {
				parseOk({ type: "selectOutputFolder", formData: { txtFileName: "f", generationType } })
			}
			parseFail({ type: "selectOutputFolder", formData: { txtFileName: "f", generationType: "exe" } })
			parseFail({ type: "selectOutputFolder", formData: { txtFileName: "f", generationType: 1 } })
		})
	})

	it("updateEgovSettings는 부분 설정을 허용하되 settings 자체는 필수다", () => {
		parseOk({ type: "updateEgovSettings", settings: {} })
		parseOk({ type: "updateEgovSettings", settings: { defaultGroupId: "com.example" } })
		parseFail({ type: "updateEgovSettings" })
		parseFail({ type: "updateEgovSettings", settings: { language: 3 } })
	})

	it("showError/showWarning의 value는 문자열이어야 한다", () => {
		parseFail({ type: "showError" })
		parseFail({ type: "showWarning", value: { nested: "object" } })
	})
})
