import { describe, it, expect } from "vitest"
import { getTemplateFilesConfig } from "../codeTemplateFiles"

function outputPathOf(templateFile: string, packagePath = "egovframework/example/sample"): string {
	const config = getTemplateFilesConfig({ tableName: "Board", packagePath })
	const entry = config.find((item) => item.templateFile === templateFile)
	expect(entry).toBeDefined()

	return entry?.outputPath ?? ""
}

describe("getTemplateFilesConfig", () => {
	it("returns the 11 CRUD templates", () => {
		expect(getTemplateFilesConfig({ tableName: "Board", packagePath: "egovframework/example/sample" })).toHaveLength(11)
	})

	// egovframe-web / egovframe-boot-web 템플릿은 classpath:/egovframework/sqlmap/example/mappers/*.xml 만 읽는다.
	it("writes the mapper XML where the web templates scan for mappers", () => {
		expect(outputPathOf("sample-mapper-template.hbs")).toBe(
			"src/main/resources/egovframework/sqlmap/example/mappers/Board_SQL.xml",
		)
	})

	// egovframe-web 의 뷰 리졸버 접두어는 /WEB-INF/jsp/egovframework/example/ 이고, 컨트롤러는 "board/boardList" 를 반환한다.
	it("writes the JSP views where the view resolver looks them up", () => {
		expect(outputPathOf("sample-jsp-list.hbs")).toBe("src/main/webapp/WEB-INF/jsp/egovframework/example/board/boardList.jsp")
		expect(outputPathOf("sample-jsp-register.hbs")).toBe(
			"src/main/webapp/WEB-INF/jsp/egovframework/example/board/boardRegister.jsp",
		)
	})

	it("keeps the mapper XML and JSP locations independent of the package name", () => {
		const packagePath = "com/acme/shop"

		expect(outputPathOf("sample-mapper-template.hbs", packagePath)).toBe(
			"src/main/resources/egovframework/sqlmap/example/mappers/Board_SQL.xml",
		)
		expect(outputPathOf("sample-jsp-list.hbs", packagePath)).toBe(
			"src/main/webapp/WEB-INF/jsp/egovframework/example/board/boardList.jsp",
		)
	})

	it("keeps the Java sources under the package path", () => {
		expect(outputPathOf("sample-controller-template.hbs", "com/acme/shop")).toBe(
			"src/main/java/com/acme/shop/web/BoardController.java",
		)
	})

	it("keeps the Thymeleaf views under templates/thymeleaf/<table>", () => {
		expect(outputPathOf("sample-thymeleaf-list.hbs")).toBe("src/main/resources/templates/thymeleaf/board/boardList.html")
		expect(outputPathOf("sample-thymeleaf-register.hbs")).toBe(
			"src/main/resources/templates/thymeleaf/board/boardRegister.html",
		)
	})
})
