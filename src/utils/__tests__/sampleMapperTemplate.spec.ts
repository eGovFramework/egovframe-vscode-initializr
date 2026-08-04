import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import * as Handlebars from "handlebars"

interface Attribute {
	columnName: string
	ccName: string
	isPrimaryKey: boolean
}

interface TemplateContext {
	tableName: string
	dbTableName: string
	attributes: Attribute[]
	pkAttributes: Attribute[]
	packageName: string
	className: string
	classNameFirstCharLower: string
}

interface Fixture {
	name: string
	context: TemplateContext
	branches: {
		0: string
		1?: string
	}
}

const bindSearchPattern = `<bind name="searchPattern" value="'%' + searchKeyword + '%'"/>`

// Mirrors the subset of registerHandlebarsHelpers in codeGeneratorUtils.ts used by this template.
// unless는 Handlebars 내장 헬퍼라 등록하지 않는다(프로덕션도 오버라이드하지 않음).
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

function createContext(attributes: Attribute[]): TemplateContext {
	return {
		tableName: "sample",
		dbTableName: "SAMPLE",
		attributes,
		pkAttributes: attributes.filter((attribute) => attribute.isPrimaryKey),
		packageName: "egovframework.example.sample",
		className: "Sample",
		classNameFirstCharLower: "sample",
	}
}

function renderTemplate(context: TemplateContext): string {
	registerTemplateHelpers()

	const templatePath = path.resolve(__dirname, "../../../templates/code/sample-mapper-template.hbs")
	const templateContent = fs.readFileSync(templatePath, "utf8")
	const template = Handlebars.compile(templateContent)

	return template(context)
}

function countOccurrences(value: string, search: string): number {
	return value.split(search).length - 1
}

function getSelectStatement(sql: string, id: string): string {
	const match = sql.match(new RegExp(`<select id="${id}"[\\s\\S]*?<\\/select>`))
	expect(match).not.toBeNull()

	return match?.[0] ?? ""
}

function getSearchConditionBlock(statement: string, searchCondition: 0 | 1): string {
	const match = statement.match(new RegExp(`<when test="searchCondition == ${searchCondition}">([\\s\\S]*?)<\\/when>`))
	expect(match).not.toBeNull()

	return match?.[1] ?? ""
}

function expectSearchBranch(statement: string, searchCondition: 0 | 1, columnName?: string) {
	const block = getSearchConditionBlock(statement, searchCondition)

	if (columnName) {
		expect(block).toMatch(new RegExp(`${columnName}\\s+LIKE\\s+#\\{searchPattern\\}`))
		expect(countOccurrences(block, "LIKE")).toBe(1)
	} else {
		expect(block).not.toContain("LIKE")
	}
}

const fixtures: Fixture[] = [
	{
		name: "single primary key with non-primary columns",
		context: createContext([
			{ columnName: "SAMPLE_ID", ccName: "sampleId", isPrimaryKey: true },
			{ columnName: "SAMPLE_NAME", ccName: "sampleName", isPrimaryKey: false },
			{ columnName: "SAMPLE_DESC", ccName: "sampleDesc", isPrimaryKey: false },
		]),
		branches: {
			0: "SAMPLE_ID",
			1: "SAMPLE_NAME",
		},
	},
	{
		name: "composite primary key",
		context: createContext([
			{ columnName: "SAMPLE_ID", ccName: "sampleId", isPrimaryKey: true },
			{ columnName: "SAMPLE_SEQ", ccName: "sampleSeq", isPrimaryKey: true },
			{ columnName: "SAMPLE_NAME", ccName: "sampleName", isPrimaryKey: false },
		]),
		branches: {
			0: "SAMPLE_ID",
			1: "SAMPLE_SEQ",
		},
	},
	{
		name: "no primary key with two columns",
		context: createContext([
			{ columnName: "SAMPLE_NAME", ccName: "sampleName", isPrimaryKey: false },
			{ columnName: "SAMPLE_DESC", ccName: "sampleDesc", isPrimaryKey: false },
		]),
		branches: {
			0: "SAMPLE_NAME",
			1: "SAMPLE_DESC",
		},
	},
	{
		name: "no primary key with one column",
		context: createContext([{ columnName: "SAMPLE_NAME", ccName: "sampleName", isPrimaryKey: false }]),
		branches: {
			0: "SAMPLE_NAME",
		},
	},
]

describe("sample mapper template", () => {
	it.each(fixtures)(
		"renders LIKE search for $name without || because MySQL treats it as logical OR",
		({ context, branches }) => {
			const rendered = renderTemplate(context)
			const listStatement = getSelectStatement(rendered, "selectSampleList")
			const countStatement = getSelectStatement(rendered, "selectSampleListTotCnt")

			expect(rendered).not.toContain("||")
			expect(countOccurrences(rendered, bindSearchPattern)).toBe(2)
			expect(countOccurrences(listStatement, bindSearchPattern)).toBe(1)
			expect(countOccurrences(countStatement, bindSearchPattern)).toBe(1)

			expect([...rendered.matchAll(/LIKE\s+([^\s<]+)/g)].map((match) => match[1])).toEqual(
				Array(countOccurrences(rendered, "LIKE")).fill("#{searchPattern}"),
			)
			expect(rendered).not.toMatch(/LIKE\s+'%'/)
			expect(rendered).not.toContain("LIKE #{searchKeyword}")

			expect(listStatement.indexOf(bindSearchPattern)).toBeLessThan(listStatement.indexOf("LIKE"))
			expect(countStatement.indexOf(bindSearchPattern)).toBeLessThan(countStatement.indexOf("LIKE"))

			for (const statement of [listStatement, countStatement]) {
				expectSearchBranch(statement, 0, branches[0])
				expectSearchBranch(statement, 1, branches[1])
			}

			expect(rendered).toContain("LIMIT #{recordCountPerPage} OFFSET #{firstIndex}")
			expect(rendered).toContain("ORDER BY")
			expect(rendered).toContain("SELECT COUNT(*) totcnt")
			expect(rendered).toContain(`<if test="searchKeyword != null and searchKeyword != ''">`)
		},
	)
})
