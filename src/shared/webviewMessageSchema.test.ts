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
	// 웹뷰는 선택한 템플릿의 식별자와 버전만 보낸다 — 파일명·다운로드 경로는 호스트가 manifest에서 조회한다
	template: {
		displayName: "eGovFrame Web Project",
		templateId: "web-project",
		version: "5.1.0-beta.1",
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

	it("scope를 선택적으로 받는 요청 메시지를 허용한다", () => {
		expect(parseOk({ type: "selectOutputPath", scope: "code" })).toEqual({ type: "selectOutputPath", scope: "code" })
		expect(parseOk({ type: "getWorkspacePath", scope: "projects" })).toEqual({
			type: "getWorkspacePath",
			scope: "projects",
		})
		expect(parseOk({ type: "getEgovSettings", scope: "settings" })).toEqual({ type: "getEgovSettings", scope: "settings" })
		expect(parseOk({ type: "selectProjectPath", scope: "archCheck" })).toEqual({
			type: "selectProjectPath",
			scope: "archCheck",
		})
		expect(parseOk({ type: "selectOutputPath" })).toEqual({ type: "selectOutputPath" })
		parseFail({ type: "selectOutputPath", scope: "unknown" })
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

		it("template에는 templateId와 version이 모두 필요하다", () => {
			const { templateId, version, ...withoutIds } = validProjectConfig.template
			parseFail({ type: "generateProject", projectConfig: { ...validProjectConfig, template: withoutIds }, method: "form" })
			parseFail({
				type: "generateProject",
				projectConfig: { ...validProjectConfig, template: { ...withoutIds, templateId } },
				method: "form",
			})
			parseFail({
				type: "generateProject",
				projectConfig: { ...validProjectConfig, template: { ...withoutIds, version } },
				method: "form",
			})
			parseFail({
				type: "generateProject",
				projectConfig: { ...validProjectConfig, template: { ...validProjectConfig.template, version: 431 } },
				method: "form",
			})
		})

		it("웹뷰가 보낸 파일명·다운로드 필드는 수신 시 제거된다 (호스트가 manifest에서 다시 조회한다)", () => {
			const message = parseOk({
				type: "generateProject",
				projectConfig: {
					...validProjectConfig,
					template: {
						...validProjectConfig.template,
						fileName: "../../evil.zip",
						pomFile: "../evil-pom.xml",
						included: false,
						downloadUrl: "https://evil.example/payload.zip",
						pomDownloadUrl: "http://evil.example/pom.xml",
					},
				},
				method: "form",
			})
			if (message.type !== "generateProject") {
				throw new Error("unexpected message type")
			}
			expect(message.projectConfig.template).toEqual(validProjectConfig.template)
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
			// 웹뷰 validateCodeConfig와 동일하게 연속된 점과 숫자로 시작하는 세그먼트를 거부한다
			for (const packageName of ["../etc", "Com.Bad", "com.", ".com", "com/example", "com..example", "com.1example"]) {
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

	it("exportArchResults의 DAO 상세 필드와 skipped 목록은 strip되지 않고 보존된다", () => {
		const dao = {
			filePath: "/p/src/main/java/a/UserDAO.java",
			fileName: "UserDAO.java",
			parentPath: "/p/src/main/java/a",
			check1: true,
			check2: true,
			check3: true,
			result: "OK",
			type: "DAO",
			daoStyle: "mybatisDao",
			check1Detail: "MyBatis DAO",
			check2Detail: "@Repository",
			check3State: "skipped",
			check3Detail: "n/a",
			inheritancePath: ["EgovComAbstractDAO"],
			annotationText: '@EgovMapper("m")',
		}
		const skipped = {
			filePath: "/p/src/main/java/a/EgovComAbstractDAO.java",
			fileName: "EgovComAbstractDAO.java",
			reason: "abstract",
		}
		const parsed = parseOk({
			type: "exportArchResults",
			projectPath: "/p",
			results: { DAO: { totalFiles: 1, passedFiles: 1, failedFiles: 0, results: [dao], skipped: [skipped] } },
		})
		expect(parsed).toMatchObject({ results: { DAO: { results: [dao], skipped: [skipped] } } })
	})

	it("exportArchResults는 type Mapper와 알 수 없는 check3State를 거부한다", () => {
		const base = {
			filePath: "/p/A.java",
			fileName: "A.java",
			parentPath: "/p",
			check1: true,
			check2: false,
			check3: false,
			result: "NotFound",
		}
		const summary = (r: object) => ({ totalFiles: 1, passedFiles: 0, failedFiles: 1, results: [r] })
		expect(
			parseFail({ type: "exportArchResults", projectPath: "/p", results: { DAO: summary({ ...base, type: "Mapper" }) } }),
		).toContain("type")
		expect(
			parseFail({
				type: "exportArchResults",
				projectPath: "/p",
				results: { DAO: summary({ ...base, type: "DAO", check3State: "maybe" }) },
			}),
		).toContain("check3State")
	})
})
