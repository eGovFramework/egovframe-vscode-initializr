import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import * as Handlebars from "handlebars"

interface Attribute {
	columnName: string
	ccName: string
	pcName: string
	isPrimaryKey: boolean
}

// codeGeneratorUtils.ts가 등록하는 헬퍼 중 이 템플릿이 쓰는 것만 재현한다.
function registerTemplateHelpers() {
	Handlebars.registerHelper("eq", function (a: any, b: any) {
		return a === b
	})

	Handlebars.registerHelper("concat", function (...args: any[]) {
		return args.slice(0, -1).join("")
	})

	Handlebars.registerHelper("setVar", function (varName: any, varValue: any, options: any) {
		options.data.root[varName] = varValue
	})
}

const attributes: Attribute[] = [
	{ columnName: "ID", ccName: "id", pcName: "Id", isPrimaryKey: true },
	{ columnName: "NAME", ccName: "name", pcName: "Name", isPrimaryKey: false },
]

function render(templateName: string): string {
	registerTemplateHelpers()

	const templatePath = path.resolve(__dirname, `../../../templates/code/${templateName}`)
	const templateContent = fs.readFileSync(templatePath, "utf8")

	return Handlebars.compile(templateContent)({
		tableName: "sample",
		dbTableName: "SAMPLE",
		attributes,
		pkAttributes: attributes.filter((attribute) => attribute.isPrimaryKey),
		packageName: "egovframework.example.sample",
		className: "Sample",
		classNameFirstCharLower: "sample",
	})
}

/** 검색 조건을 실어 나르는 hidden 필드. 요청 파라미터가 그대로 담긴다. */
const carriedFields = ["searchCondition", "searchKeyword", "pageIndex"]

function hiddenInputLine(jsp: string, fieldName: string): string {
	const match = jsp.match(new RegExp(`<input type="hidden" id="${fieldName}"[^\\n]*`))
	expect(match, `${fieldName} hidden 필드를 찾지 못했다`).not.toBeNull()

	return match?.[0] ?? ""
}

describe("sample-jsp-register.hbs", () => {
	const jsp = render("sample-jsp-register.hbs")

	it("검색 조건 hidden 필드는 EL 값을 c:out으로 감싼다", () => {
		for (const field of carriedFields) {
			const line = hiddenInputLine(jsp, field)
			expect(line, `${field}가 이스케이프되지 않았다`).toContain(`<c:out value='\${sampleVO.${field}}'/>`)
		}
	})

	it("hidden 필드에 이스케이프 없는 EL이 남지 않는다", () => {
		for (const field of carriedFields) {
			const line = hiddenInputLine(jsp, field)
			// value="${...}" 형태로 EL이 직접 노출되면 속성 밖으로 탈출할 수 있다
			expect(line).not.toMatch(new RegExp(`value="\\$\\{sampleVO\\.${field}\\}"`))
		}
	})

	it("JSTL core 태그를 선언한다", () => {
		expect(jsp).toContain('<%@ taglib prefix="c"')
	})
})

describe("sample-thymeleaf-register.hbs", () => {
	it("th:value는 자동 이스케이프되므로 그대로 둔다", () => {
		const html = render("sample-thymeleaf-register.hbs")

		for (const field of carriedFields) {
			expect(html).toContain(`th:value="\${sampleVO.${field}}"`)
		}
	})
})
