import { describe, it, expect } from "vitest"
import { validateProjectConfig, categoriesFromProjectTemplates, getTemplatesByCategory } from "../projectUtils"
import type { ProjectTemplate } from "../projectUtils"

const makeTemplate = (overrides: Partial<ProjectTemplate> = {}): ProjectTemplate => ({
	displayName: "Sample Template",
	fileName: "sample.zip",
	pomFile: "pom.xml",
	...overrides,
})

describe("validateProjectConfig", () => {
	it("projectName이 없으면 오류를 반환한다", () => {
		const errors = validateProjectConfig({
			projectName: "",
			template: makeTemplate(),
			outputPath: "/tmp",
			groupId: "egovframework.com",
			artifactId: "my-project",
		})
		expect(errors).toContain("Project name is required")
	})

	it("projectName이 공백만이면 오류를 반환한다", () => {
		const errors = validateProjectConfig({
			projectName: "   ",
			template: makeTemplate(),
			outputPath: "/tmp",
			groupId: "egovframework.com",
			artifactId: "my-project",
		})
		expect(errors).toContain("Project name is required")
	})

	it("outputPath가 없으면 오류를 반환한다", () => {
		const errors = validateProjectConfig({
			projectName: "my-project",
			template: makeTemplate(),
			outputPath: "",
			groupId: "egovframework.com",
			artifactId: "my-project",
		})
		expect(errors).toContain("Output path is required")
	})

	it("template이 없으면 오류를 반환한다", () => {
		const errors = validateProjectConfig({
			projectName: "my-project",
			outputPath: "/tmp",
			groupId: "egovframework.com",
			artifactId: "my-project",
		})
		expect(errors).toContain("Template selection is required")
	})

	it("pomFile이 있는 템플릿에서 groupId가 없으면 오류를 반환한다", () => {
		const errors = validateProjectConfig({
			projectName: "my-project",
			template: makeTemplate({ pomFile: "pom.xml" }),
			outputPath: "/tmp",
			groupId: "",
			artifactId: "my-project",
		})
		expect(errors).toContain("Group ID is required for this template")
	})

	it("groupId가 유효하지 않은 형식이면 오류를 반환한다", () => {
		const errors = validateProjectConfig({
			projectName: "my-project",
			template: makeTemplate({ pomFile: "pom.xml" }),
			outputPath: "/tmp",
			groupId: "Invalid.Group",
			artifactId: "my-project",
		})
		expect(errors.some((e) => e.includes("Group ID must start"))).toBe(true)
	})

	it("groupId가 점으로 끝나면 오류를 반환한다", () => {
		const errors = validateProjectConfig({
			projectName: "my-project",
			template: makeTemplate({ pomFile: "pom.xml" }),
			outputPath: "/tmp",
			groupId: "egovframework.",
			artifactId: "my-project",
		})
		expect(errors.some((e) => e.includes("Group ID must start"))).toBe(true)
	})

	it("pomFile이 있는 템플릿에서 artifactId가 없으면 오류를 반환한다", () => {
		const errors = validateProjectConfig({
			projectName: "my-project",
			template: makeTemplate({ pomFile: "pom.xml" }),
			outputPath: "/tmp",
			groupId: "egovframework.com",
			artifactId: "",
		})
		expect(errors).toContain("Artifact ID is required for this template")
	})

	it("artifactId가 유효하지 않은 형식이면 오류를 반환한다", () => {
		const errors = validateProjectConfig({
			projectName: "my-project",
			template: makeTemplate({ pomFile: "pom.xml" }),
			outputPath: "/tmp",
			groupId: "egovframework.com",
			artifactId: "My_Project",
		})
		expect(errors.some((e) => e.includes("Artifact ID must start"))).toBe(true)
	})

	it("pomFile이 없는 템플릿에서는 groupId/artifactId를 검증하지 않는다", () => {
		const errors = validateProjectConfig({
			projectName: "my-project",
			template: makeTemplate({ pomFile: "" }),
			outputPath: "/tmp",
		})
		expect(errors).not.toContain("Group ID is required for this template")
		expect(errors).not.toContain("Artifact ID is required for this template")
	})

	it("모든 필드가 유효하면 빈 배열을 반환한다", () => {
		const errors = validateProjectConfig({
			projectName: "my-project",
			template: makeTemplate({ pomFile: "pom.xml" }),
			outputPath: "/tmp",
			groupId: "egovframework.com",
			artifactId: "my-project",
		})
		expect(errors).toHaveLength(0)
	})
})

describe("categoriesFromProjectTemplates", () => {
	it("빈 배열이면 'All'만 반환한다", () => {
		expect(categoriesFromProjectTemplates([])).toEqual(["All"])
	})

	it("카테고리가 없는 템플릿만 있으면 'All'만 반환한다", () => {
		const templates = [makeTemplate({ category: undefined }), makeTemplate({ category: undefined })]
		expect(categoriesFromProjectTemplates(templates)).toEqual(["All"])
	})

	it("카테고리를 중복 없이 반환한다", () => {
		const templates = [
			makeTemplate({ category: "Template" }),
			makeTemplate({ category: "Template" }),
			makeTemplate({ category: "Sample" }),
		]
		const categories = categoriesFromProjectTemplates(templates)
		expect(categories).toEqual(["All", "Template", "Sample"])
	})

	it("'All'은 항상 첫 번째로 반환된다", () => {
		const templates = [makeTemplate({ category: "Sample" })]
		const categories = categoriesFromProjectTemplates(templates)
		expect(categories[0]).toBe("All")
	})

	it("카테고리 등장 순서를 유지한다", () => {
		const templates = [makeTemplate({ category: "C" }), makeTemplate({ category: "A" }), makeTemplate({ category: "B" })]
		const categories = categoriesFromProjectTemplates(templates)
		expect(categories).toEqual(["All", "C", "A", "B"])
	})
})

describe("getTemplatesByCategory", () => {
	const templates: ProjectTemplate[] = [
		makeTemplate({ displayName: "T1", category: "Template" }),
		makeTemplate({ displayName: "T2", category: "Sample" }),
		makeTemplate({ displayName: "T3", category: "Template" }),
		makeTemplate({ displayName: "T4" }),
	]

	it("'All' 카테고리이면 전체 템플릿을 반환한다", () => {
		expect(getTemplatesByCategory(templates, "All")).toEqual(templates)
	})

	it("특정 카테고리에 해당하는 템플릿만 반환한다", () => {
		const result = getTemplatesByCategory(templates, "Template")
		expect(result).toHaveLength(2)
		expect(result.every((t) => t.category === "Template")).toBe(true)
	})

	it("해당하는 카테고리가 없으면 빈 배열을 반환한다", () => {
		expect(getTemplatesByCategory(templates, "NonExistent")).toHaveLength(0)
	})
})
