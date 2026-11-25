/**
 * checkDisplay.ts
 *
 * 아키텍처 점검 상세 테이블의 순수 표시 규칙 — 레이어 라벨, 칸 사용 여부, 칸 설명, 셀 기호·색·툴팁.
 * React에 의존하지 않으므로 렌더링 없이 단위 테스트한다.
 */
import type { ArchCheckResult } from "@shared/archCheck"

/** 결과 키 → 화면 라벨 (DAO 키는 DAO와 Mapper 인터페이스를 함께 담는 통합 레이어, project는 빌드 파일 점검) */
export const LAYER_LABELS: Record<string, string> = {
	Controller: "Controller",
	Service: "Service",
	DAO: "DAO / Mapper",
	project: "Project",
}

/** 파일 단위 결과를 담는 레이어 키 — 레이어 요약 카드·합계는 이 키만 돈다 */
export const FILE_LAYER_KEYS = ["Controller", "Service", "DAO"] as const

/** 상세 결과 Select에 오르는 결과 키 — 파일 레이어 뒤에 Project */
export const SELECT_KEYS = ["Controller", "Service", "DAO", "project"] as const

const PASS_COLOR = "var(--vscode-terminal-ansiGreen)"
const FAIL_COLOR = "var(--vscode-errorForeground)"
const MUTED_COLOR = "var(--vscode-descriptionForeground)"

const PASS_STATUSES = new Set(["OK", "PASS", "direct", "transitive"])
const FAIL_STATUSES = new Set(["NotFound", "FAIL", "missing", "excluded"])

/** Project 카드·행의 상태 문자열 색 — 통과는 초록, 실패는 빨강, 그 밖(Unknown·unknown·n/a·Skipped 등)은 흐린 색 */
export function getStatusColor(status: string): string {
	if (PASS_STATUSES.has(status)) {
		return PASS_COLOR
	}
	if (FAIL_STATUSES.has(status)) {
		return FAIL_COLOR
	}
	return MUTED_COLOR
}

/** 레이어별 사용하는 Check 정의 — Controller·Service·DAO 모두 check1~3을 쓴다(DAO의 check3는 Version) */
export function getUsedChecks(_layerType: string): { check1: boolean; check2: boolean; check3: boolean } {
	return { check1: true, check2: true, check3: true }
}

/** 레이어별 Check 설명 정의 */
export function getCheckDescriptions(layerType: string): Record<"check1" | "check2" | "check3", { short: string; full: string }> {
	switch (layerType) {
		case "Controller":
			return {
				check1: { short: "@Controller", full: "Must have @Controller annotation" },
				check2: { short: "Mapping", full: "Must have @RequestMapping or mapping annotation" },
				check3: { short: "DAO X", full: "Must not inject DAO/Dao/Mapper types (DAO belongs in ServiceImpl)" },
			}
		case "Service":
			return {
				check1: { short: "Extends", full: "Must extend EgovAbstractServiceImpl" },
				check2: { short: "@Service", full: "Must have @Service annotation" },
				check3: { short: "Implements", full: "Must implement Service interface" },
			}
		case "DAO":
			return {
				check1: {
					short: "Base",
					full: "iBatis DAO: extends EgovAbstractDAO / MyBatis DAO: extends EgovAbstractMapper (intermediate classes allowed) / Mapper interface: @Mapper or @EgovMapper",
				},
				check2: {
					short: "Bean",
					full: "DAO classes: @Repository on the concrete class / Mapper interfaces: annotation imported from the eGovFrame package (not org.apache.ibatis)",
				},
				check3: {
					short: "Version",
					full: "Base class package or Mapper annotation matches the project's runtime generation (3.x egovframework.rte, 4.x @Mapper, 5.x @EgovMapper); n/a when the generation is unknown",
				},
			}
		default:
			return {
				check1: { short: "Check1", full: "Check1" },
				check2: { short: "Check2", full: "Check2" },
				check3: { short: "Check3", full: "Check3" },
			}
	}
}

/** 상세 테이블 한 칸의 표시 */
export interface CellDisplay {
	symbol: string
	color: string
	title?: string
}

// 종전 ✓/✗/- 규칙 — 미사용 칸은 '-', 통과는 detail ?? ✓, 실패는 ✗
const renderCheckResult = (checkValue: boolean, isUsed: boolean, detail?: string): CellDisplay => {
	if (!isUsed) {
		return { symbol: "-", color: MUTED_COLOR }
	}
	return {
		symbol: checkValue ? (detail ?? "✓") : "✗",
		color: checkValue ? PASS_COLOR : FAIL_COLOR,
	}
}

// Controller의 Mapping(check2) 통과 시 상세 표시:
// 클래스 레벨 @RequestMapping으로 통과하면 'Class level', 일부 메서드만 매핑되면 '매핑된 수/점검 대상 수', 전부 매핑되면 ✓
const getMappingDetail = (result: ArchCheckResult): string | undefined => {
	if (result.type !== "Controller") {
		return undefined
	}
	if (result.hasClassLevelMapping) {
		return "Class level"
	}
	if (result.mappedMethodCount === undefined || result.methodCount === undefined) {
		return undefined
	}
	return result.mappedMethodCount < result.methodCount ? `${result.mappedMethodCount}/${result.methodCount}` : undefined
}

// DAO 칸: 통과면 상세 문자열(없으면 ✓)·초록, 실패면 ✗·빨강에 상세를 툴팁으로
const daoPassFail = (passed: boolean, detail: string | undefined, passTitle?: string): CellDisplay =>
	passed ? { symbol: detail ?? "✓", color: PASS_COLOR, title: passTitle } : { symbol: "✗", color: FAIL_COLOR, title: detail }

const getDaoCellDisplay = (result: ArchCheckResult, which: 1 | 2 | 3): CellDisplay => {
	if (which === 1) {
		const path = result.inheritancePath ?? []
		const passTitle = path.length > 0 ? "via " + path.join(" > ") : result.annotationText
		return daoPassFail(result.check1, result.check1Detail, passTitle)
	}
	if (which === 2) {
		return daoPassFail(result.check2, result.check2Detail)
	}
	switch (result.check3State) {
		case "skipped":
			return { symbol: "n/a", color: MUTED_COLOR, title: "Runtime generation unknown" }
		case "pass":
			return daoPassFail(true, result.check3Detail)
		case "fail":
			return daoPassFail(false, result.check3Detail)
		default:
			return renderCheckResult(result.check3, getUsedChecks(result.type).check3)
	}
}

/** 결과 한 행의 check1~3 칸 표시 */
export function getCellDisplay(result: ArchCheckResult, which: 1 | 2 | 3): CellDisplay {
	if (result.type === "DAO") {
		return getDaoCellDisplay(result, which)
	}
	const used = getUsedChecks(result.type)
	switch (which) {
		case 1:
			return renderCheckResult(result.check1, used.check1)
		case 2:
			return renderCheckResult(result.check2, used.check2, getMappingDetail(result))
		case 3:
			return renderCheckResult(result.check3, used.check3)
	}
}
