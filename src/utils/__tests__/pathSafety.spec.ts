import { describe, it, expect } from "vitest"
import * as path from "path"
import { isValidProjectName, assertSafeProjectName, sanitizeFileName, resolveWithinBase } from "../pathSafety"

describe("isValidProjectName", () => {
	it("accepts letters, numbers, hyphens and underscores", () => {
		expect(isValidProjectName("myProject")).toBe(true)
		expect(isValidProjectName("my_project-1")).toBe(true)
		expect(isValidProjectName("ABC123")).toBe(true)
	})

	it("rejects traversal and separator characters", () => {
		expect(isValidProjectName("../evil")).toBe(false)
		expect(isValidProjectName("..")).toBe(false)
		expect(isValidProjectName("a/b")).toBe(false)
		expect(isValidProjectName("a\\b")).toBe(false)
		expect(isValidProjectName("a.b")).toBe(false)
		expect(isValidProjectName("a b")).toBe(false)
		expect(isValidProjectName("")).toBe(false)
	})
})

describe("assertSafeProjectName", () => {
	it("does not throw for a valid name", () => {
		expect(() => assertSafeProjectName("valid_name-1")).not.toThrow()
	})

	it("throws for traversal input", () => {
		expect(() => assertSafeProjectName("../../etc")).toThrow()
		expect(() => assertSafeProjectName("..")).toThrow()
		expect(() => assertSafeProjectName("a/b")).toThrow()
	})
})

describe("sanitizeFileName", () => {
	it("returns a plain file name unchanged", () => {
		expect(sanitizeFileName("context.xml")).toBe("context.xml")
		expect(sanitizeFileName("application")).toBe("application")
	})

	it("strips directory segments to the base name", () => {
		expect(sanitizeFileName("../../evil.xml")).toBe("evil.xml")
		expect(sanitizeFileName("sub/dir/file.xml")).toBe("file.xml")
		expect(sanitizeFileName("  spaced.xml  ")).toBe("spaced.xml")
	})

	it("rejects names that resolve to a traversal or empty value", () => {
		expect(() => sanitizeFileName("")).toThrow()
		expect(() => sanitizeFileName("   ")).toThrow()
		expect(() => sanitizeFileName(".")).toThrow()
		expect(() => sanitizeFileName("..")).toThrow()
	})
})

describe("resolveWithinBase", () => {
	const base = path.resolve("/tmp/egov-output")

	it("returns the resolved path for a child inside the base", () => {
		expect(resolveWithinBase(base, "project")).toBe(path.join(base, "project"))
		expect(resolveWithinBase(base, "nested/file.xml")).toBe(path.join(base, "nested", "file.xml"))
	})

	it("throws when the resolved path escapes the base", () => {
		expect(() => resolveWithinBase(base, "../escape")).toThrow()
		expect(() => resolveWithinBase(base, "../../etc/passwd")).toThrow()
		expect(() => resolveWithinBase(base, path.resolve("/etc/passwd"))).toThrow()
	})

	it("throws when the child resolves to the base itself", () => {
		expect(() => resolveWithinBase(base, ".")).toThrow()
	})
})
