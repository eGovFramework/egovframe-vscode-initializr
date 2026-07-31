import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "../../../../i18n"
import { EgovTabsStateProvider } from "../../../../context/EgovTabsStateContext"
import { ProjectsView } from "../ProjectsView"

vi.mock("../../../../utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

const projectTemplates = [
	{
		displayName: "Sample Project",
		fileName: "sample-project.zip",
		pomFile: "",
		description: "Sample project template",
		category: "Sample",
		projectName: "sample-project",
	},
]

const renderProjectsView = () =>
	render(
		<EgovTabsStateProvider>
			<ProjectsView />
		</EgovTabsStateProvider>,
	)

describe("ProjectsView 메시지 스코프", () => {
	it("다른 탭의 selectedOutputPath는 무시하고 projects 스코프만 Output Path에 반영한다", async () => {
		renderProjectsView()

		act(() => {
			window.dispatchEvent(new MessageEvent("message", { data: { type: "projectTemplates", templates: projectTemplates } }))
		})

		await waitFor(() => expect(screen.getByText("Sample Project")).toBeInTheDocument())
		fireEvent.click(screen.getByText("Sample Project"))

		const outputPathInput = await screen.findByLabelText(/Output Path/)
		expect(outputPathInput).toHaveValue("")

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", { data: { type: "selectedOutputPath", scope: "code", text: "/code/out" } }),
			)
		})

		expect(outputPathInput).toHaveValue("")

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", { data: { type: "selectedOutputPath", scope: "projects", text: "/projects/out" } }),
			)
		})

		await waitFor(() => expect(outputPathInput).toHaveValue("/projects/out"))
	})
	it("projects 스코프 error는 템플릿 로딩을 끝내고 사유를 표시한다", async () => {
		renderProjectsView()

		expect(screen.getByText("Loading templates...")).toBeInTheDocument()

		act(() => {
			window.dispatchEvent(new MessageEvent("message", { data: { type: "error", scope: "code", text: "DDL 파싱 실패" } }))
		})

		expect(screen.getByText("Loading templates...")).toBeInTheDocument()

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "error", scope: "projects", text: "Failed to load project templates" },
				}),
			)
		})

		await waitFor(() => expect(screen.getByText("Failed to load project templates")).toBeInTheDocument())
		expect(screen.queryByText("Loading templates...")).not.toBeInTheDocument()
	})
})
