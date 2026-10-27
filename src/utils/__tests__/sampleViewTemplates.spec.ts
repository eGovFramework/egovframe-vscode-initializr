import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as path from "path"
import * as Handlebars from "handlebars"
import type * as vscode from "vscode"
import type * as fsExtra from "fs-extra"
import { generateCrudFromDDL } from "../codeGenerator"
import { renderTemplate } from "../codeGeneratorUtils"
import { parseDDL } from "../../shared/ddlParser"
import { getTemplateContext } from "../../shared/templateContext"

const { generatedFiles } = vi.hoisted(() => ({
	generatedFiles: new Map<string, string>(),
}))

// Keep the actual template reads and both production helper registrations. Only
// VS Code interaction and generated-file writes need replacing in a Node test.
vi.mock("vscode", () => ({
	window: {
		showQuickPick: vi.fn(async (items: unknown[]) => items),
		showTextDocument: vi.fn(),
		showInformationMessage: vi.fn(),
		showErrorMessage: vi.fn(),
	},
	workspace: { openTextDocument: vi.fn(async () => ({})) },
}))

vi.mock("fs-extra", async (importOriginal) => {
	const actual = await importOriginal<typeof fsExtra>()
	return {
		...actual,
		readFile: actual.readFile,
		outputFile: vi.fn(async (filePath: string, content: string) => {
			generatedFiles.set(filePath, content)
		}),
	}
})

const extensionPath = path.resolve(__dirname, "../../..")
const outputPath = path.join(extensionPath, "test-generated-output")
const extensionContext = { extensionPath } as vscode.ExtensionContext
const originalHelpers = { ...Handlebars.helpers }

const fixtures = [
	{
		name: "single primary key",
		ddl: "CREATE TABLE SAMPLE (SAMPLE_ID VARCHAR(20) PRIMARY KEY, SAMPLE_NAME VARCHAR(100), SAMPLE_DESC VARCHAR(200));",
		keyNames: ["sampleId"],
	},
	{
		name: "composite primary key",
		ddl: "CREATE TABLE SAMPLE (SAMPLE_ID VARCHAR(20), SAMPLE_SEQ INTEGER, SAMPLE_NAME VARCHAR(100), PRIMARY KEY (SAMPLE_ID, SAMPLE_SEQ));",
		keyNames: ["sampleId", "sampleSeq"],
	},
	{
		name: "no primary key",
		ddl: "CREATE TABLE SAMPLE (SAMPLE_NAME VARCHAR(100), SAMPLE_DESC VARCHAR(200));",
		keyNames: ["sampleName"],
	},
]

const templates = [
	{ name: "sample-thymeleaf-register.hbs", output: "sampleRegister.html", kind: "thymeleaf-register" },
	{ name: "sample-thymeleaf-list.hbs", output: "sampleList.html", kind: "thymeleaf-list" },
	{ name: "sample-jsp-register.hbs", output: "sampleRegister.jsp", kind: "jsp-register" },
	{ name: "sample-jsp-list.hbs", output: "sampleList.jsp", kind: "jsp-list" },
]

function restoreHelpers() {
	for (const name of Object.keys(Handlebars.helpers)) {
		Handlebars.unregisterHelper(name)
	}
	for (const [name, helper] of Object.entries(originalHelpers)) {
		Handlebars.registerHelper(name, helper)
	}
}

beforeEach(() => {
	restoreHelpers()
	generatedFiles.clear()
	vi.spyOn(console, "log").mockImplementation(() => {})
})

afterEach(() => {
	restoreHelpers()
	vi.restoreAllMocks()
})

function createContext(ddl: string) {
	const { tableName, dbTableName, attributes, pkAttributes } = parseDDL(ddl)
	return {
		...getTemplateContext(tableName, attributes, pkAttributes, "example.sample", dbTableName),
		author: "test-author",
		date: "2026-01-01",
		version: "1.0.0",
	}
}

function getGeneratedFile(fileName: string): string {
	const matches = [...generatedFiles.entries()].filter(([filePath]) => path.basename(filePath) === fileName)
	expect(matches).toHaveLength(1)
	return matches[0][1]
}

function expectBalancedDivs(rendered: string) {
	// Do not parse as browser HTML: recovery can silently close the extra div
	// from #40, and JSP tag attributes contain nested markup such as c:out.
	const markup = rendered.replace(/<!--[\s\S]*?-->/g, "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
	const tags = [...markup.matchAll(/<\/?div\b[^>]*>/gi)].map(([tag]) => tag)
	expect(tags.length).toBeGreaterThan(0)
	let depth = 0
	for (const tag of tags) {
		depth += /^<\/div/i.test(tag) ? -1 : 1
		expect(depth, `unmatched closing div: ${tag}`).toBeGreaterThanOrEqual(0)
	}
	expect(depth, "every opening div must have a closing div (#40)").toBe(0)
}

function expectTitles(rendered: string, kind: string) {
	const titles = [...rendered.matchAll(/<title\b([^>]*)>([\s\S]*?)<\/title>/g)]
	expect(titles.length).toBeGreaterThan(0)
	if (kind === "thymeleaf-register") {
		// A literal th:if passes a mere <title> presence check but hides both
		// titles at runtime (#41). Require the SpringEL delimiters as well.
		expect(titles.map(([, attributes, text]) => [attributes.trim(), text.trim()])).toEqual([
			["th:if=\"${registerFlag == 'modify'}\"", "Sample Update"],
			["th:if=\"${registerFlag == 'create'}\"", "Sample Regist"],
		])
	} else if (kind === "jsp-register") {
		expect(titles).toHaveLength(1)
		expect(titles[0][2]).toContain("Sample")
		for (const [flag, label] of [
			["create", "Regist"],
			["modify", "Update"],
		]) {
			expect(titles[0][2]).toContain(`<c:if test="\${registerFlag == '${flag}'}">${label}</c:if>`)
		}
	} else {
		expect(titles).toHaveLength(1)
		expect(titles[0][2]).toBe("List")
	}
}

function expectEscapedRequestFields(rendered: string, kind: string) {
	const fields = kind.endsWith("register") ? ["searchCondition", "searchKeyword", "pageIndex"] : ["searchKeyword"]
	for (const field of fields) {
		const expression = `\${sampleVO.${field}}`
		if (kind.startsWith("jsp")) {
			// c:out escapes XML by default. Pin its placement inside the input's
			// value, not merely its presence elsewhere in the document (#39).
			expect(rendered).toContain(`name="${field}" value="<c:out value='${expression}'/>"`)
			expect(rendered).not.toContain(`name="${field}" value="${expression}"`)
		} else {
			const nameAttribute = kind === "thymeleaf-register" ? "th:name" : "name"
			expect(rendered).toContain(`${nameAttribute}="${field}" th:value="${expression}"`)
		}
	}
}

describe.each(fixtures)("view templates: $name", ({ ddl, keyNames }) => {
	it.each(templates)("renders $name through both production paths", async ({ name, output, kind }) => {
		await generateCrudFromDDL(ddl, extensionContext, "example.sample", outputPath)
		const generated = getGeneratedFile(output)

		// compileTemplate overrides the shared Handlebars unless helper. Reset
		// it before testing renderTemplate so call order cannot conceal a drift.
		restoreHelpers()
		const rendered = await renderTemplate(path.join(extensionPath, "templates/code", name), createContext(ddl))
		expect(rendered).toBe(generated)
		for (const content of [generated, rendered]) {
			expect(content).not.toContain("{{")
			expectTitles(content, kind)
			expectBalancedDivs(content)
			expectEscapedRequestFields(content, kind)
			if (kind.endsWith("list")) {
				expect(content).toContain(`function fn_egov_select(${keyNames.join(", ")})`)
			} else {
				expect(content).toContain(`sampleVO.${keyNames[0]}`)
			}
		}
	})
})
