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

const controllerResult = (
	fileName: string,
	fields: { check2: boolean; mappedMethodCount: number; methodCount: number; hasClassLevelMapping: boolean },
) => ({
	filePath: `/p/src/main/java/egov/web/${fileName}`,
	fileName,
	parentPath: "/p/src/main/java/egov/web",
	check1: true,
	check3: false,
	result: fields.check2 ? "OK" : "NotFound",
	type: "Controller",
	...fields,
})

describe("CheckArchView Detailed Results", () => {
	it("Controller의 Mapping 칸: 실패 ✗, 클래스 레벨 매핑은 'Class level', 일부 메서드만 매핑되면 a/b, 전부 매핑되면 ✓", async () => {
		render(<CheckArchView />)

		dispatch({
			type: "archCheckResult",
			scope: "archCheck",
			success: true,
			results: {
				Controller: {
					totalFiles: 4,
					passedFiles: 3,
					failedFiles: 1,
					results: [
						controllerResult("PartialController.java", {
							check2: true,
							mappedMethodCount: 2,
							methodCount: 3,
							hasClassLevelMapping: false,
						}),
						controllerResult("FullController.java", {
							check2: true,
							mappedMethodCount: 3,
							methodCount: 3,
							hasClassLevelMapping: false,
						}),
						controllerResult("ClassLevelController.java", {
							check2: true,
							mappedMethodCount: 0,
							methodCount: 1,
							hasClassLevelMapping: true,
						}),
						controllerResult("NoMappingController.java", {
							check2: false,
							mappedMethodCount: 0,
							methodCount: 1,
							hasClassLevelMapping: false,
						}),
					],
				},
			},
		})

		await waitFor(() => expect(screen.getByText("PartialController.java")).toBeInTheDocument())
		expect(screen.getByText("2/3")).toBeInTheDocument()
		expect(screen.queryByText("3/3")).not.toBeInTheDocument()
		expect(screen.getByText("Class level")).toBeInTheDocument()
		expect(screen.queryByText("0/1")).not.toBeInTheDocument()
		// ✓: @Controller 칸 4개 + FullController의 Mapping 칸 1개
		expect(screen.getAllByText("✓")).toHaveLength(5)
		expect(screen.getAllByText("✗")).toHaveLength(1)
	})
})
