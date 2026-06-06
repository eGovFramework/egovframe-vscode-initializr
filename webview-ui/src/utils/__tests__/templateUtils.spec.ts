import { describe, it, expect } from "vitest"
import { groupTemplates } from "../templateUtils"
import type { TemplateConfig } from "@components/egov/types/templates"

const makeTemplateConfig = (displayName: string, overrides: Partial<TemplateConfig> = {}): TemplateConfig => ({
	displayName,
	templateFolder: "folder",
	templateFile: "template.xml",
	webView: "view",
	fileNameProperty: "fileName",
	javaConfigTemplate: "javaConfig.java",
	yamlTemplate: "template.yaml",
	propertiesTemplate: "template.properties",
	description: "설명",
	...overrides,
})

describe("groupTemplates", () => {
	it("빈 배열이면 빈 객체를 반환한다", () => {
		expect(groupTemplates([])).toEqual({})
	})

	it("'카테고리 > 서브카테고리' 형식으로 그룹화한다", () => {
		const templates = [
			makeTemplateConfig("Datasource > MySQL"),
			makeTemplateConfig("Datasource > PostgreSQL"),
			makeTemplateConfig("Logging > Log4j"),
		]
		const grouped = groupTemplates(templates)

		expect(Object.keys(grouped)).toEqual(["Datasource", "Logging"])
		expect(Object.keys(grouped["Datasource"])).toEqual(["MySQL", "PostgreSQL"])
		expect(Object.keys(grouped["Logging"])).toEqual(["Log4j"])
	})

	it("그룹화된 값은 원본 TemplateConfig 객체다", () => {
		const template = makeTemplateConfig("Datasource > MySQL")
		const grouped = groupTemplates([template])

		expect(grouped["Datasource"]["MySQL"]).toBe(template)
	})

	it("구분자('>')가 없는 displayName은 무시한다", () => {
		const templates = [makeTemplateConfig("InvalidDisplayName"), makeTemplateConfig("Datasource > MySQL")]
		const grouped = groupTemplates(templates)

		expect(Object.keys(grouped)).not.toContain("InvalidDisplayName")
		expect(grouped["Datasource"]["MySQL"]).toBeDefined()
	})

	it("같은 서브카테고리가 여러 번 등장하면 마지막 값으로 덮어쓴다", () => {
		const first = makeTemplateConfig("Datasource > MySQL", { description: "첫 번째" })
		const second = makeTemplateConfig("Datasource > MySQL", { description: "두 번째" })
		const grouped = groupTemplates([first, second])

		expect(grouped["Datasource"]["MySQL"].description).toBe("두 번째")
	})

	it("displayName에 구분자가 2개 이상이면 첫 두 부분으로만 그룹화한다", () => {
		const template = makeTemplateConfig("Category > Subcategory > Detail")
		const grouped = groupTemplates([template])

		expect(grouped["Category"]["Subcategory"]).toBe(template)
	})

	it("여러 카테고리와 서브카테고리를 올바르게 처리한다", () => {
		const templates = [
			makeTemplateConfig("Cache > EhCache"),
			makeTemplateConfig("Cache > Hazelcast"),
			makeTemplateConfig("Transaction > JPA"),
			makeTemplateConfig("Transaction > JDBC"),
			makeTemplateConfig("Scheduling > Quartz"),
		]
		const grouped = groupTemplates(templates)

		expect(Object.keys(grouped)).toHaveLength(3)
		expect(Object.keys(grouped["Cache"])).toHaveLength(2)
		expect(Object.keys(grouped["Transaction"])).toHaveLength(2)
		expect(Object.keys(grouped["Scheduling"])).toHaveLength(1)
	})
})
