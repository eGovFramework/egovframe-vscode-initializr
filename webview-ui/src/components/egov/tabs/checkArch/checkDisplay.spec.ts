import { describe, expect, it } from "vitest"
import type { ArchCheckResult } from "@shared/archCheck"
import { getCellDisplay, getCheckDescriptions, getUsedChecks, LAYER_LABELS } from "./checkDisplay"

const dao = (f: Partial<ArchCheckResult>): ArchCheckResult => ({
	filePath: "/p/A.java",
	fileName: "A.java",
	parentPath: "/p",
	type: "DAO",
	check1: true,
	check2: true,
	check3: true,
	result: "OK",
	...f,
})

describe("checkDisplay", () => {
	it("DAO 칸은 상세 문자열·경유 툴팁·n/a를 보인다", () => {
		expect(getCellDisplay(dao({ check1Detail: "MyBatis DAO", inheritancePath: ["EgovComAbstractDAO"] }), 1)).toMatchObject({
			symbol: "MyBatis DAO",
			title: "via EgovComAbstractDAO",
		})
		expect(getCellDisplay(dao({ check1Detail: "Mapper IF", annotationText: '@EgovMapper("m")' }), 1)).toMatchObject({
			symbol: "Mapper IF",
			title: '@EgovMapper("m")',
		})
		expect(getCellDisplay(dao({ check2: false, check2Detail: "mybatis @Mapper" }), 2)).toMatchObject({
			symbol: "✗",
			title: "mybatis @Mapper",
			color: "var(--vscode-errorForeground)",
		})
		expect(getCellDisplay(dao({ check3State: "skipped", check3Detail: "n/a" }), 3)).toMatchObject({
			symbol: "n/a",
			color: "var(--vscode-descriptionForeground)",
		})
		expect(getCellDisplay(dao({ check3State: "pass", check3Detail: "5.x" }), 3)).toMatchObject({
			symbol: "5.x",
			color: "var(--vscode-terminal-ansiGreen)",
		})
	})

	it("Controller 칸은 종전 규칙을 유지한다", () => {
		const c: ArchCheckResult = {
			...dao({}),
			type: "Controller",
			mappedMethodCount: 2,
			methodCount: 3,
			hasClassLevelMapping: false,
		}
		expect(getCellDisplay(c, 2).symbol).toBe("2/3")
		expect(getCellDisplay({ ...c, hasClassLevelMapping: true }, 2).symbol).toBe("Class level")
		expect(getCellDisplay(c, 1).symbol).toBe("✓")
	})

	it("레이어 라벨과 사용 칸", () => {
		expect(LAYER_LABELS.DAO).toBe("DAO / Mapper")
		expect(getUsedChecks("DAO")).toEqual({ check1: true, check2: true, check3: true })
		expect(getCheckDescriptions("DAO").check3.short).toBe("Version")
	})
})
