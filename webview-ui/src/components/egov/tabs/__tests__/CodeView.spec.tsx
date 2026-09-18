import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { type ParsedDDL, parseDDL } from "@shared/ddlParser"
import "../../../../i18n"
import { EgovTabsStateProvider, useCodeViewState } from "../../../../context/EgovTabsStateContext"

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

const DDL = "CREATE TABLE sample (id VARCHAR(20) NOT NULL, name VARCHAR(50), PRIMARY KEY (id));"

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

describe("CodeView 기본 설정 수신", () => {
	// Package Name 입력란은 DDL이 유효할 때만 렌더링되므로 파싱 결과를 채워 그 상태를 만든다
	let updateCodeView: ((updates: { ddlContent: string; parsedDDL: ParsedDDL; isValid: boolean }) => void) | null = null
	const StateBridge = () => {
		updateCodeView = useCodeViewState().updateState
		return null
	}

	const renderWithValidDDL = () => {
		render(
			<EgovTabsStateProvider>
				<StateBridge />
				<CodeView />
			</EgovTabsStateProvider>,
		)
		act(() => {
			updateCodeView?.({ ddlContent: DDL, parsedDDL: parseDDL(DDL), isValid: true })
		})
	}

	it("사용자가 고쳐 넣은 Package Name은 기본 설정을 다시 받아도 유지된다", async () => {
		renderWithValidDDL()

		const packageNameField = await screen.findByLabelText(/Package Name/)
		await userEvent.clear(packageNameField)
		await userEvent.type(packageNameField, "com.acme.foo")

		dispatch({ type: "egovSettings", settings: { defaultPackageName: "egovframework.example.sample" } })

		await waitFor(() => expect(packageNameField).toHaveValue("com.acme.foo"))
	})

	it("사용자가 손대지 않은 Package Name은 기본 설정 값으로 채운다", async () => {
		renderWithValidDDL()

		const packageNameField = await screen.findByLabelText(/Package Name/)

		dispatch({ type: "egovSettings", settings: { defaultPackageName: "com.example.custom" } })

		await waitFor(() => expect(packageNameField).toHaveValue("com.example.custom"))
	})
})
