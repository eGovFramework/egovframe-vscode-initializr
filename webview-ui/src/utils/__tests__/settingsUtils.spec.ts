import { describe, it, expect } from "vitest"
import { validateEgovSettings } from "../settingsUtils"

describe("validateEgovSettings", () => {
	it("모든 필드가 유효하면 빈 배열을 반환한다", () => {
		const errors = validateEgovSettings({
			defaultGroupId: "egovframework.com",
			defaultArtifactId: "my-project",
			defaultPackageName: "egovframework.example.sample",
		})
		expect(errors).toHaveLength(0)
	})

	it("defaultGroupId가 없으면 오류를 반환한다", () => {
		const errors = validateEgovSettings({
			defaultGroupId: "",
			defaultArtifactId: "my-project",
			defaultPackageName: "egovframework.example",
		})
		expect(errors).toContain("Default Group ID is required")
	})

	it("defaultGroupId가 공백만이면 오류를 반환한다", () => {
		const errors = validateEgovSettings({
			defaultGroupId: "   ",
			defaultArtifactId: "my-project",
			defaultPackageName: "egovframework.example",
		})
		expect(errors).toContain("Default Group ID is required")
	})

	it("defaultGroupId가 대문자를 포함하면 오류를 반환한다", () => {
		const errors = validateEgovSettings({
			defaultGroupId: "EgovFramework.com",
			defaultArtifactId: "my-project",
			defaultPackageName: "egovframework.example",
		})
		expect(errors.some((e) => e.includes("Default Group ID must start"))).toBe(true)
	})

	it("defaultGroupId가 점으로 끝나면 오류를 반환한다", () => {
		const errors = validateEgovSettings({
			defaultGroupId: "egovframework.",
			defaultArtifactId: "my-project",
			defaultPackageName: "egovframework.example",
		})
		expect(errors.some((e) => e.includes("Default Group ID must start"))).toBe(true)
	})

	it("defaultGroupId가 숫자로 시작하면 오류를 반환한다", () => {
		const errors = validateEgovSettings({
			defaultGroupId: "1egovframework",
			defaultArtifactId: "my-project",
			defaultPackageName: "egovframework.example",
		})
		expect(errors.some((e) => e.includes("Default Group ID must start"))).toBe(true)
	})

	it("defaultArtifactId가 없으면 오류를 반환한다", () => {
		const errors = validateEgovSettings({
			defaultGroupId: "egovframework.com",
			defaultArtifactId: "",
			defaultPackageName: "egovframework.example",
		})
		expect(errors).toContain("Default Artifact ID is required")
	})

	it("defaultArtifactId에 언더스코어가 포함되면 오류를 반환한다", () => {
		const errors = validateEgovSettings({
			defaultGroupId: "egovframework.com",
			defaultArtifactId: "my_project",
			defaultPackageName: "egovframework.example",
		})
		expect(errors.some((e) => e.includes("Default Artifact ID must start"))).toBe(true)
	})

	it("defaultArtifactId가 대문자를 포함하면 오류를 반환한다", () => {
		const errors = validateEgovSettings({
			defaultGroupId: "egovframework.com",
			defaultArtifactId: "MyProject",
			defaultPackageName: "egovframework.example",
		})
		expect(errors.some((e) => e.includes("Default Artifact ID must start"))).toBe(true)
	})

	it("defaultPackageName이 없으면 오류를 반환한다", () => {
		const errors = validateEgovSettings({
			defaultGroupId: "egovframework.com",
			defaultArtifactId: "my-project",
			defaultPackageName: "",
		})
		expect(errors).toContain("Default Package Name is required")
	})

	it("defaultPackageName이 점으로 끝나면 오류를 반환한다", () => {
		const errors = validateEgovSettings({
			defaultGroupId: "egovframework.com",
			defaultArtifactId: "my-project",
			defaultPackageName: "egovframework.example.",
		})
		expect(errors.some((e) => e.includes("Default Package Name must start"))).toBe(true)
	})

	it("여러 필드가 동시에 잘못되면 모든 오류를 반환한다", () => {
		const errors = validateEgovSettings({
			defaultGroupId: "",
			defaultArtifactId: "",
			defaultPackageName: "",
		})
		expect(errors).toContain("Default Group ID is required")
		expect(errors).toContain("Default Artifact ID is required")
		expect(errors).toContain("Default Package Name is required")
		expect(errors).toHaveLength(3)
	})

	it("필드가 undefined이면 오류를 반환한다", () => {
		const errors = validateEgovSettings({})
		expect(errors).toContain("Default Group ID is required")
		expect(errors).toContain("Default Artifact ID is required")
		expect(errors).toContain("Default Package Name is required")
	})
})
