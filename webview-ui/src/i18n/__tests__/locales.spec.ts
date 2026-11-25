import { describe, expect, it } from "vitest"
import en from "../locales/en.json"
import ko from "../locales/ko.json"

/** 중첩 객체의 리프 키를 "a.b.c" 형태로 평탄화한다 */
function flattenKeys(value: unknown, prefix = ""): string[] {
	if (value === null || typeof value !== "object") {
		return [prefix]
	}
	return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
		flattenKeys(child, prefix ? `${prefix}.${key}` : key),
	)
}

describe("i18n locales", () => {
	it("en.json과 ko.json의 키 집합이 같다 (한쪽에만 문구를 추가하면 실패한다)", () => {
		expect(flattenKeys(ko).sort()).toEqual(flattenKeys(en).sort())
	})
})
