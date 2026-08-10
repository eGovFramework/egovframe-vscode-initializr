import { act, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import CheckArchView from "../CheckArchView"

vi.mock("../../../../utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

const dispatch = (data: unknown) => {
	act(() => {
		window.dispatchEvent(new MessageEvent("message", { data }))
	})
}

describe("CheckArchView 메시지 스코프", () => {
	it("archCheck 스코프 error는 사유를 그대로 표시한다", async () => {
		render(<CheckArchView />)

		dispatch({ type: "error", scope: "archCheck", text: "No project path provided for architecture check" })

		await waitFor(() => expect(screen.getByText("No project path provided for architecture check")).toBeInTheDocument())
		expect(screen.queryByText("An unknown error occurred.")).not.toBeInTheDocument()
	})

	it("다른 탭의 error는 표시하지 않는다", () => {
		render(<CheckArchView />)

		dispatch({ type: "error", scope: "code", text: "DDL 파싱 실패" })

		expect(screen.queryByText("DDL 파싱 실패")).not.toBeInTheDocument()
		// 스코프 가드가 없으면 사유를 읽지 못한 채 기본 오류 문구가 뜬다
		expect(screen.queryByText("An unknown error occurred.")).not.toBeInTheDocument()
	})

	it("다른 탭의 경로 응답은 무시하고 archCheck 스코프·브로드캐스트만 Project Path에 반영한다", async () => {
		render(<CheckArchView />)

		const input = screen.getByLabelText(/Project Path/)
		expect(input).toHaveValue("")

		// Code 탭 몫의 워크스페이스 경로 응답은 무시한다
		dispatch({ type: "currentWorkspacePath", scope: "code", text: "/code/ws" })
		expect(input).toHaveValue("")

		// 스코프 없는 브로드캐스트는 종전대로 수신한다
		dispatch({ type: "currentWorkspacePath", text: "/broadcast/ws" })
		await waitFor(() => expect(input).toHaveValue("/broadcast/ws"))

		dispatch({ type: "selectedProjectPath", scope: "archCheck", text: "/arch/project" })
		await waitFor(() => expect(input).toHaveValue("/arch/project"))
	})
})
