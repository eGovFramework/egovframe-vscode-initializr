import { describe, it, expect } from "vitest"
import { validateCodeConfig, validatePackageName } from "../codeUtils"

describe("validateCodeConfig", () => {
	const validConfig = {
		packageName: "egovframework.example",
		outputPath: "/tmp/out",
	}

	it("패키지명이 점으로 구분된 Java 패키지 규칙을 지키면 통과한다", () => {
		for (const packageName of ["egovframework.example", "com.egov.app", "com", "egovframework.example.sample", "a1.b2c3"]) {
			const errors = validateCodeConfig({ ...validConfig, packageName })
			expect(errors, `expected no packageName error for "${packageName}"`).toHaveLength(0)
		}
	})

	it("연속된 점과 숫자로 시작하는 세그먼트는 거부한다", () => {
		for (const packageName of ["com..example", "com.1example"]) {
			const errors = validateCodeConfig({ ...validConfig, packageName })
			expect(errors).toContain(
				"Package name must start with a lowercase letter and consist of dot-separated segments, where each segment starts with a lowercase letter and contains only lowercase letters or numbers",
			)
		}
	})

	it("기존에 잘못된 패키지명도 계속 거부한다", () => {
		for (const packageName of ["com.", ".com", "Com.Example"]) {
			const errors = validateCodeConfig({ ...validConfig, packageName })
			expect(errors).toContain(
				"Package name must start with a lowercase letter and consist of dot-separated segments, where each segment starts with a lowercase letter and contains only lowercase letters or numbers",
			)
		}
	})

	it("패키지명이 없거나 공백이면 필수 오류를 반환한다", () => {
		for (const packageName of ["", "   "]) {
			const errors = validateCodeConfig({ ...validConfig, packageName })
			expect(errors).toContain("Package name is required")
		}
	})

	it("outputPath가 없으면 필수 오류를 반환한다", () => {
		const errors = validateCodeConfig({ packageName: "com.example" })
		expect(errors).toContain("Output path is required")
	})
})

describe("validatePackageName", () => {
	it("패키지명이 점으로 구분된 Java 패키지 규칙을 지키면 null을 반환한다", () => {
		for (const packageName of ["egovframework.example", "com.egov.app", "com", "egovframework.example.sample", "a1.b2c3"]) {
			expect(validatePackageName(packageName), `expected no packageName error for "${packageName}"`).toBeNull()
		}
	})

	it("연속된 점과 숫자로 시작하는 세그먼트는 거부한다", () => {
		for (const packageName of ["com..example", "com.1example"]) {
			expect(validatePackageName(packageName)).toBe(
				"Package name must start with a lowercase letter and consist of dot-separated segments, where each segment starts with a lowercase letter and contains only lowercase letters or numbers",
			)
		}
	})

	it("기존에 잘못된 패키지명도 계속 거부한다", () => {
		for (const packageName of ["com.", ".com", "Com.Example"]) {
			expect(validatePackageName(packageName)).toBe(
				"Package name must start with a lowercase letter and consist of dot-separated segments, where each segment starts with a lowercase letter and contains only lowercase letters or numbers",
			)
		}
	})

	it("패키지명이 없거나 공백이면 필수 오류를 반환한다", () => {
		for (const packageName of ["", "   "]) {
			expect(validatePackageName(packageName)).toBe("Package name is required")
		}
	})
})
