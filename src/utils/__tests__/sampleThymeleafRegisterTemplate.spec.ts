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

// Mirrors the subset of registerHandlebarsHelpers in codeGeneratorUtils.ts used by this template.
function registerTemplateHelpers() {
	Handlebars.registerHelper("concat", function (...args: any[]) {
		return args.slice(0, -1).join("")
	})

	Handlebars.registerHelper("setVar", function (varName: any, varValue: any, options: any) {
		options.data.root[varName] = varValue
	})
}

function renderTemplate(attributes: Attribute[]): string {
	registerTemplateHelpers()

	const templatePath = path.resolve(__dirname, "../../../templates/code/sample-thymeleaf-register.hbs")
	const templateContent = fs.readFileSync(templatePath, "utf8")
	const template = Handlebars.compile(templateContent)

	return template({
		tableName: "sample",
		dbTableName: "SAMPLE",
		attributes,
		pkAttributes: attributes.filter((attribute) => attribute.isPrimaryKey),
		packageName: "egovframework.example.sample",
		className: "Sample",
		classNameFirstCharLower: "sample",
	})
}

const attributes: Attribute[] = [
	{ columnName: "SAMPLE_ID", ccName: "sampleId", pcName: "SampleId", isPrimaryKey: true },
	{ columnName: "SAMPLE_NAME", ccName: "sampleName", pcName: "SampleName", isPrimaryKey: false },
]

describe("sample thymeleaf register template", () => {
	// ${} 없이 쓴 registerFlag 는 변수가 아니라 리터럴 토큰이라 'create'/'modify' 와 절대 같아지지 않는다.
	it("wraps every registerFlag condition in ${} so both titles survive Thymeleaf rendering", () => {
		const rendered = renderTemplate(attributes)

		const conditions = [...rendered.matchAll(/th:if="([^"]*registerFlag[^"]*)"/g)].map((match) => match[1])
		expect(conditions.length).toBeGreaterThan(0)
		expect(conditions.filter((condition) => !condition.startsWith("${"))).toEqual([])

		const titles = [...rendered.matchAll(/<title th:if="([^"]*)">([^<]*)<\/title>/g)]
		expect(titles.map((match) => [match[1], match[2]])).toEqual([
			["${registerFlag == 'modify'}", "Sample Update"],
			["${registerFlag == 'create'}", "Sample Regist"],
		])
	})
})
