import { act, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "../../../../i18n"
import { EgovTabsStateProvider } from "../../../../context/EgovTabsStateContext"

// Monaco 에디터는 이 테스트의 관심사(메시지 라우팅)와 무관하고 jsdom에서 로드할 수 없어 최소 스텁으로 대체한다
vi.mock("@monaco-editor/react", () => ({
	default: () => <div data-testid="monaco-editor" />,
	loader: { config: vi.fn() },
}))
vi.mock("monaco-sql-languages/esm/languages/mysql/mysql.contribution", () => ({}))
vi.mock("monaco-sql-languages/esm/languages/pgsql/pgsql.contribution", () => ({}))
vi.mock("monaco-sql-languages/esm/languages/mysql/mysql.worker?worker&inline", () => ({ default: class {} }))
vi.mock("monaco-sql-languages/esm/languages/pgsql/pgsql.worker?worker&inline", () => ({ default: class {} }))
vi.mock("monaco-editor/esm/vs/editor/editor.worker?worker&inline", () => ({ default: class {} }))

vi.mock("../../../../utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

const CodeView = (await import("../CodeView")).default

const renderCodeView = () =>
	render(
		<EgovTabsStateProvider>
			<CodeView />
		</EgovTabsStateProvider>,
	)

const dispatch = (data: unknown) => {
	act(() => {
		window.dispatchEvent(new MessageEvent("message", { data }))
	})
}

describe("CodeView 메시지 스코프", () => {
	it("code 스코프 error는 사유를 그대로 표시한다", async () => {
		renderCodeView()

		dispatch({ type: "error", scope: "code", text: "DDL 파싱 실패: 3번째 컬럼" })

		await waitFor(() => expect(screen.getByText("DDL 파싱 실패: 3번째 컬럼")).toBeInTheDocument())
		expect(screen.queryByText("Unknown error occurred.")).not.toBeInTheDocument()
	})

	it("다른 탭의 error는 표시하지 않는다", async () => {
		renderCodeView()

		dispatch({ type: "error", scope: "config", text: "템플릿 JSON 파싱 실패" })

		await waitFor(() => expect(screen.getByTestId("monaco-editor")).toBeInTheDocument())
		expect(screen.queryByText("템플릿 JSON 파싱 실패")).not.toBeInTheDocument()
		// 스코프 가드가 없으면 사유를 읽지 못한 채 "알 수 없는 오류" 배너가 뜬다
		expect(screen.queryByText("Unknown error occurred.")).not.toBeInTheDocument()
	})
})
