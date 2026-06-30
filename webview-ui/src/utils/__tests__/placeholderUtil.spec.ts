import { describe, it, expect } from "vitest"
import { replacePlaceholders } from "@shared/placeholderUtil"

describe("replacePlaceholders", () => {
	it("should replace placeholders with values", () => {
		const result = replacePlaceholders("<name>###NAME###</name>", { "###NAME###": "MyApp" })
		expect(result).toBe("<name>MyApp</name>")
	})

	it("should replace all occurrences of a placeholder", () => {
		const result = replacePlaceholders("###X######X###", { "###X###": "a" })
		expect(result).toBe("aa")
	})

	it("should handle multiple placeholders", () => {
		const result = replacePlaceholders("###A###-###B###", { "###A###": "1", "###B###": "2" })
		expect(result).toBe("1-2")
	})

	it("should insert values containing '$' literally", () => {
		// String.replace의 문자열 replacement는 $&, $1, $$를 특수 처리한다.
		// 함수형 replacement로 값을 문자 그대로 삽입해야 한다.
		expect(replacePlaceholders("<n>###NAME###</n>", { "###NAME###": "My$&App" })).toBe("<n>My$&App</n>")
		expect(replacePlaceholders("<n>###NAME###</n>", { "###NAME###": "a$$b" })).toBe("<n>a$$b</n>")
		expect(replacePlaceholders("<n>###NAME###</n>", { "###NAME###": "$1$2" })).toBe("<n>$1$2</n>")
	})

	it("should treat undefined values as empty string", () => {
		const result = replacePlaceholders("###A###", { "###A###": undefined as unknown as string })
		expect(result).toBe("")
	})
})
