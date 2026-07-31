import { act, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "../../../../i18n"
import { EgovTabsStateProvider } from "../../../../context/EgovTabsStateContext"
import ConfigView from "../ConfigView"

vi.mock("../../../../utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

const configTemplates = [
	{
		displayName: "Datasource > New Datasource",
		templateFolder: "datasource",
		templateFile: "datasource.hbs",
		webView: "datasource-form.tsx",
		fileNameProperty: "txtFileName",
		javaConfigTemplate: "datasource-java.hbs",
		yamlTemplate: "",
		propertiesTemplate: "",
	},
]

const renderConfigView = () =>
	render(
		<EgovTabsStateProvider>
			<ConfigView />
		</EgovTabsStateProvider>,
	)

describe("ConfigView 메시지 스코프", () => {
	it("code 스코프 error는 템플릿 로드 오류 화면으로 전환하지 않는다", async () => {
		renderConfigView()

		act(() => {
			window.dispatchEvent(new MessageEvent("message", { data: { type: "configTemplates", templates: configTemplates } }))
		})
		await waitFor(() => expect(screen.getByText("Generate eGovFrame Configurations")).toBeInTheDocument())

		act(() => {
			window.dispatchEvent(new MessageEvent("message", { data: { type: "error", scope: "code", text: "DDL 파싱 실패" } }))
		})

		expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument()
		expect(screen.queryByText("DDL 파싱 실패")).not.toBeInTheDocument()
	})

	it("config 스코프 error는 실제 사유를 표시하는 오류 화면으로 전환한다", async () => {
		renderConfigView()

		act(() => {
			window.dispatchEvent(new MessageEvent("message", { data: { type: "configTemplates", templates: configTemplates } }))
		})
		await waitFor(() => expect(screen.getByText("Generate eGovFrame Configurations")).toBeInTheDocument())

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", { data: { type: "error", scope: "config", text: "템플릿 JSON 파싱 실패" } }),
			)
		})

		await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument())
		expect(screen.getByText("템플릿 JSON 파싱 실패")).toBeInTheDocument()
	})
})
