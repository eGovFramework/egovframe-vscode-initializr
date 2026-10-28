import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
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
	fields: {
		check2: boolean
		check3?: boolean
		mappedMethodCount: number
		methodCount: number
		hasClassLevelMapping: boolean
	},
) => {
	const check3 = fields.check3 ?? true
	return {
		filePath: `/p/src/main/java/egov/web/${fileName}`,
		fileName,
		parentPath: "/p/src/main/java/egov/web",
		check1: true,
		result: fields.check2 && check3 ? "OK" : "NotFound",
		type: "Controller",
		...fields,
		check3,
	}
}

describe("CheckArchView Detailed Results", () => {
	it("Controller의 Mapping 칸(✗ / Class level / a/b / ✓)과 'DAO X' 칸(✓ / ✗)을 표시한다", async () => {
		render(<CheckArchView />)

		dispatch({
			type: "archCheckResult",
			scope: "archCheck",
			success: true,
			results: {
				Controller: {
					totalFiles: 5,
					passedFiles: 3,
					failedFiles: 2,
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
						controllerResult("DaoController.java", {
							check2: true,
							check3: false,
							mappedMethodCount: 3,
							methodCount: 3,
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
		// 표 머리글에 check3 이름이 보인다
		expect(screen.getByText("DAO X")).toBeInTheDocument()
		// ✓: @Controller 칸 5개 + Mapping 칸(Full, Dao) 2개 + DAO X 칸 4개
		expect(screen.getAllByText("✓")).toHaveLength(11)
		// ✗: NoMapping의 Mapping 칸 + Dao의 DAO X 칸
		expect(screen.getAllByText("✗")).toHaveLength(2)
		expect(screen.getAllByText("NotFound")).toHaveLength(2)
	})
})

const daoResult = (fileName: string, fields: Record<string, unknown>) => ({
	filePath: `/p/src/main/java/egov/dao/${fileName}`,
	fileName,
	parentPath: "/p/src/main/java/egov/dao",
	type: "DAO",
	check1: true,
	check2: true,
	check3: true,
	result: "OK",
	...fields,
})

describe("CheckArchView DAO / Mapper", () => {
	it("통합 레이어의 상세 문자열·n/a·Skipped 목록을 표시하고 제외 파일은 Total Files에 세지 않는다", async () => {
		render(<CheckArchView />)

		dispatch({
			type: "archCheckResult",
			scope: "archCheck",
			success: true,
			results: {
				DAO: {
					totalFiles: 2,
					passedFiles: 1,
					failedFiles: 1,
					results: [
						daoResult("CmmUseDAO.java", {
							daoStyle: "mybatisDao",
							check1Detail: "MyBatis DAO",
							inheritancePath: ["EgovComAbstractDAO"],
							check2Detail: "@Repository",
							check3State: "skipped",
							check3Detail: "n/a",
						}),
						daoResult("BoardMapper.java", {
							daoStyle: "mapperInterface",
							result: "NotFound",
							check1Detail: "Mapper IF",
							check2: false,
							check2Detail: "mybatis @Mapper",
							check3State: "skipped",
							check3Detail: "n/a",
						}),
					],
					skipped: [
						{ fileName: "EgovComAbstractDAO.java", reason: "abstract", filePath: "/p/EgovComAbstractDAO.java" },
					],
				},
			},
		})

		await waitFor(() => expect(screen.getByRole("option", { name: "DAO / Mapper" })).toBeInTheDocument())
		fireEvent.change(screen.getByRole("combobox"), { target: { value: "DAO" } })

		expect(screen.getByText("CmmUseDAO.java")).toBeInTheDocument()
		expect(screen.getByText("MyBatis DAO")).toBeInTheDocument()
		expect(screen.getByText("@Repository")).toBeInTheDocument()
		expect(screen.getByText("Mapper IF")).toBeInTheDocument()
		expect(screen.getAllByText("✗")).toHaveLength(1)
		expect(screen.getAllByText("n/a")).toHaveLength(2)
		// 머리글
		expect(screen.getByText("Base")).toBeInTheDocument()
		expect(screen.getByText("Bean")).toBeInTheDocument()
		expect(screen.getByText("Version")).toBeInTheDocument()

		// Skipped 목록은 접혀 있다가 토글로 펼친다
		expect(screen.queryByText("EgovComAbstractDAO.java")).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Skipped 1" }))
		expect(screen.getByText("EgovComAbstractDAO.java")).toBeInTheDocument()
		expect(screen.getByText("abstract")).toBeInTheDocument()

		// 제외 파일은 Total Files에 세지 않는다
		expect(screen.getByText("Total Files").previousElementSibling).toHaveTextContent(/^2$/)
	})
})
