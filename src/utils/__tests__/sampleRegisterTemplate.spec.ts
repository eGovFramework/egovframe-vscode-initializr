import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import * as Handlebars from "handlebars"

interface Attribute {
	ccName: string
	pcName: string
	isPrimaryKey: boolean
}

interface TemplateContext {
	attributes: Attribute[]
	pkAttributes: Attribute[]
	className: string
	classNameFirstCharLower: string
}

// Mirrors the subset of registerHandlebarsHelpers in codeGeneratorUtils.ts used by these templates.
function registerTemplateHelpers() {
	Handlebars.registerHelper("concat", function (...args: any[]) {
		return args.slice(0, -1).join("")
	})

	Handlebars.registerHelper("setVar", function (varName: any, varValue: any, options: any) {
		options.data.root[varName] = varValue
	})
}

function createContext(attributes: Attribute[]): TemplateContext {
	return {
		attributes,
		pkAttributes: attributes.filter((attribute) => attribute.isPrimaryKey),
		className: "Sample",
		classNameFirstCharLower: "sample",
	}
}

function renderTemplate(templateFile: string, context: TemplateContext): string {
	registerTemplateHelpers()

	const templatePath = path.resolve(__dirname, "../../../templates/code", templateFile)
	const template = Handlebars.compile(fs.readFileSync(templatePath, "utf8"))

	return template(context)
}

function countOccurrences(value: string, search: string): number {
	return value.split(search).length - 1
}

const templateFiles = ["sample-thymeleaf-register.hbs", "sample-jsp-register.hbs"]

const fixtures = [
	{
		name: "single primary key",
		context: createContext([
			{ ccName: "sampleId", pcName: "SampleId", isPrimaryKey: true },
			{ ccName: "sampleName", pcName: "SampleName", isPrimaryKey: false },
		]),
	},
	{
		name: "composite primary key",
		context: createContext([
			{ ccName: "sampleId", pcName: "SampleId", isPrimaryKey: true },
			{ ccName: "sampleSeq", pcName: "SampleSeq", isPrimaryKey: true },
			{ ccName: "sampleName", pcName: "SampleName", isPrimaryKey: false },
		]),
	},
	{
		name: "no primary key",
		context: createContext([{ ccName: "sampleName", pcName: "SampleName", isPrimaryKey: false }]),
	},
]

describe.each(templateFiles)("%s", (templateFile) => {
	it.each(fixtures)("closes every div it opens for $name", ({ context }) => {
		const rendered = renderTemplate(templateFile, context)

		expect(countOccurrences(rendered, "<div")).toBe(countOccurrences(rendered, "</div>"))
	})
})
