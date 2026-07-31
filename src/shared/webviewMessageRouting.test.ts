import { describe, expect, it } from "vitest"
import { getMessageText, isMessageForScope } from "./webviewMessageRouting"

describe("webviewMessageRouting", () => {
	describe("getMessageText", () => {
		it("text 필드의 실패 사유를 보존한다", () => {
			expect(getMessageText({ type: "error", text: "DDL 파싱 실패" })).toBe("DDL 파싱 실패")
		})

		it("message 필드만 있는 경우도 읽는다", () => {
			expect(getMessageText({ type: "error", message: "기존 실패 사유" })).toBe("기존 실패 사유")
		})

		it("text와 message가 없거나 빈 문자열이면 undefined를 반환한다", () => {
			expect(getMessageText({ type: "error" })).toBeUndefined()
			expect(getMessageText({ type: "error", text: "", message: "   " })).toBeUndefined()
		})
	})

	describe("isMessageForScope", () => {
		it("code 스코프 error는 config 뷰에서 거부하고 code 뷰에서 허용한다", () => {
			const message = { type: "error", scope: "code" as const, text: "Code failed" }

			expect(isMessageForScope(message, "config")).toBe(false)
			expect(isMessageForScope(message, "code")).toBe(true)
		})

		it("projects 스코프 selectedOutputPath는 code 뷰에서 거부한다", () => {
			expect(isMessageForScope({ type: "selectedOutputPath", scope: "projects", text: "/tmp/out" }, "code")).toBe(false)
		})

		it("scope가 없는 메시지는 모든 뷰에서 허용한다", () => {
			const message = { type: "selectedOutputPath", text: "/tmp/out" }

			expect(isMessageForScope(message, "projects")).toBe(true)
			expect(isMessageForScope(message, "code")).toBe(true)
			expect(isMessageForScope(message, "config")).toBe(true)
			expect(isMessageForScope(message, "settings")).toBe(true)
		})
	})
})
