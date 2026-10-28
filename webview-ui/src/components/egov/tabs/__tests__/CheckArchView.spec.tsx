import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import CheckArchView from "../CheckArchView"
import { vscode } from "../../../../utils/vscode"

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

// 상세 결과의 레이어 Select — Runtime 드롭다운이 아닌 combobox
const layerSelect = () => {
	const runtime = screen.getByLabelText("Runtime")
	const select = screen.getAllByRole("combobox").find((el) => el !== runtime)
	if (!select) {
		throw new Error("layer select not found")
	}
	return select
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
		fireEvent.change(layerSelect(), { target: { value: "DAO" } })

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

const projectSummary = {
	generation: "5.x",
	version: "5.0.0",
	versionConsistency: { state: "pass", versions: ["5.0.0"], evidence: "managed by BOM egovframe-web-config-parent:5.0.0" },
	modules: [
		{
			buildFile: "pom.xml",
			buildTool: "maven",
			aggregate: false,
			runtime: {
				generation: "5.x",
				version: "5.0.0",
				source: "bom",
				evidence: "bom egovframe-web-config-parent:5.0.0 (assumed = rte version)",
			},
			requiredLibraries: [
				{ name: "ptl-mvc", status: "direct", evidence: "declared org.egovframe.rte:egovframe-rte-ptl-mvc" },
				{
					name: "fdl-cmmn",
					status: "transitive",
					via: ["ptl-mvc", "fdl-cmmn"],
					evidence: "via ptl-mvc > fdl-cmmn (static graph 5.0.x)",
				},
				{
					name: "fdl-logging",
					status: "transitive",
					via: ["ptl-mvc", "fdl-cmmn", "fdl-logging"],
					evidence: "via ptl-mvc > fdl-cmmn > fdl-logging (static graph 5.0.x)",
				},
				{ name: "psl-dataaccess", status: "direct", evidence: "declared org.egovframe.rte:egovframe-rte-psl-dataaccess" },
			],
			result: "OK",
		},
	],
	result: "OK",
}

const dispatchProjectResult = () =>
	dispatch({
		type: "archCheckResult",
		scope: "archCheck",
		success: true,
		results: {
			Controller: {
				totalFiles: 1,
				passedFiles: 1,
				failedFiles: 0,
				results: [
					controllerResult("FullController.java", {
						check2: true,
						mappedMethodCount: 1,
						methodCount: 1,
						hasClassLevelMapping: false,
					}),
				],
			},
			project: projectSummary,
		},
	})

describe("CheckArchView Project", () => {
	it("Project 카드를 보이고 Total Files는 파일 레이어만 센다", async () => {
		render(<CheckArchView />)
		dispatchProjectResult()

		await waitFor(() => expect(screen.getByRole("option", { name: "Project" })).toBeInTheDocument())
		const card = screen.getByRole("region", { name: "Project summary" })
		expect(within(card).getByText("Build: maven")).toBeInTheDocument()
		expect(within(card).getByText(/5\.x 5\.0\.0/)).toBeInTheDocument()
		expect(within(card).getByText("OK")).toBeInTheDocument()
		expect(within(card).getByText("ptl-mvc direct ✓")).toBeInTheDocument()
		expect(within(card).getByText("fdl-cmmn transitive ✓ via ptl-mvc")).toBeInTheDocument()
		expect(within(card).getByText(/^Version consistency: PASS — managed by BOM/)).toBeInTheDocument()
		expect(within(card).getByText(/^Required-library rule is applied to every module/)).toBeInTheDocument()
		// 모듈이 하나면 Modules 줄은 없다
		expect(within(card).queryByText(/^Modules:/)).not.toBeInTheDocument()

		// Total Files는 파일 레이어(Controller 1개)만 센다
		expect(screen.getByText("Total Files").previousElementSibling).toHaveTextContent(/^1$/)
	})

	it("Select를 Project로 바꾸면 Module / Item / Status / Evidence 행을 보인다", async () => {
		render(<CheckArchView />)
		dispatchProjectResult()

		await waitFor(() => expect(screen.getByRole("option", { name: "Project" })).toBeInTheDocument())
		expect(screen.getByText("FullController.java")).toBeInTheDocument()
		fireEvent.change(layerSelect(), { target: { value: "project" } })

		expect(screen.queryByText("FullController.java")).not.toBeInTheDocument()
		for (const header of ["Module", "Item", "Status", "Evidence"]) {
			expect(screen.getByText(header)).toBeInTheDocument()
		}
		expect(screen.getByText("ptl-mvc")).toBeInTheDocument()
		expect(screen.getAllByText("direct")).toHaveLength(2)
		expect(screen.getByText("fdl-cmmn")).toBeInTheDocument()
		const evidence = screen.getByText("via ptl-mvc > fdl-cmmn (static graph 5.0.x)")
		expect(evidence).toHaveAttribute("title", "via ptl-mvc > fdl-cmmn (static graph 5.0.x)")
		expect(screen.getByText("version-consistency")).toBeInTheDocument()
	})

	it("안내 박스에 Project 절이 있다", () => {
		render(<CheckArchView />)

		expect(screen.getByText("Project:")).toBeInTheDocument()
		expect(screen.getByText(/^Required libraries: ptl-mvc, fdl-cmmn, fdl-logging, psl-dataaccess/)).toBeInTheDocument()
	})

	it("Runtime을 고르면 startArchCheck에 runtimeGeneration을 싣고 Auto면 싣지 않는다", async () => {
		const postMessage = vi.mocked(vscode.postMessage)
		render(<CheckArchView />)
		dispatch({ type: "selectedProjectPath", scope: "archCheck", text: "/p" })
		await waitFor(() => expect(screen.getByLabelText(/Project Path/)).toHaveValue("/p"))

		const start = screen.getByRole("button", { name: /Start Architecture Check/ })
		postMessage.mockClear()
		fireEvent.click(start)
		expect(postMessage).toHaveBeenCalledWith({ type: "startArchCheck", projectPath: "/p" })
		expect(postMessage).toHaveBeenCalledWith(expect.not.objectContaining({ runtimeGeneration: expect.anything() }))

		// 점검 중 상태를 풀어 다시 시작할 수 있게 한다
		dispatch({ type: "archCheckResult", scope: "archCheck", success: false, error: "stop" })
		fireEvent.change(screen.getByLabelText("Runtime"), { target: { value: "5.x" } })
		postMessage.mockClear()
		fireEvent.click(screen.getByRole("button", { name: /Start Architecture Check/ }))
		expect(postMessage).toHaveBeenCalledWith({ type: "startArchCheck", projectPath: "/p", runtimeGeneration: "5.x" })
	})
})
