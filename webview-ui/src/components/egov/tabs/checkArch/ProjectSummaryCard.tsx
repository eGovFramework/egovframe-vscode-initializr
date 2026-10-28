/**
 * ProjectSummaryCard.tsx
 *
 * 아키텍처 점검 요약 영역 맨 위의 Project 카드 — 빌드 도구, 실행환경 세대·버전, 필수 라이브러리 4종 칩,
 * 버전 일관성, 종합 결과를 한눈에 보인다. 모듈별 상세는 상세 결과의 Project 행(ProjectReportTable)에 있다.
 */
import type { CheckState, ProjectCheckSummary, RequiredLibraryCheck, RequiredLibraryName } from "@shared/archCheck"
import { getStatusColor } from "./checkDisplay"

export interface ProjectSummaryCardProps {
	summary: ProjectCheckSummary
}

const LIBRARY_NAMES: readonly RequiredLibraryName[] = ["ptl-mvc", "fdl-cmmn", "fdl-logging", "psl-dataaccess"]

const CONSISTENCY_LABEL: Record<CheckState, string> = { pass: "PASS", fail: "FAIL", skipped: "n/a" }

// 칩에 올릴 "가장 나쁜 상태" 순위 — missing/excluded > unknown > transitive > direct
const STATUS_RANK: Record<RequiredLibraryCheck["status"], number> = {
	direct: 0,
	transitive: 1,
	unknown: 2,
	missing: 3,
	excluded: 3,
}

const STATUS_SYMBOL: Record<RequiredLibraryCheck["status"], string> = {
	direct: "✓",
	transitive: "✓",
	unknown: "?",
	missing: "✗",
	excluded: "✗",
}

const FIXED_NOTE =
	"Required-library rule is applied to every module (web MVC + MyBatis baseline). Transitive dependencies come from the static eGovFrame runtime graph; confirm with mvn dependency:tree or gradle dependencies."

/** 비집계 모듈들의 같은 이름 항목 중 가장 나쁜 판정 (먼저 나온 항목이 동순위를 이긴다) */
const worstLibrary = (libraries: RequiredLibraryCheck[]): RequiredLibraryCheck | undefined =>
	libraries.reduce<RequiredLibraryCheck | undefined>(
		(worst, lib) => (!worst || STATUS_RANK[lib.status] > STATUS_RANK[worst.status] ? lib : worst),
		undefined,
	)

const chipText = (name: RequiredLibraryName, lib: RequiredLibraryCheck | undefined): string => {
	if (!lib) {
		return `${name} n/a`
	}
	const via = lib.status === "transitive" && lib.via?.[0] ? ` via ${lib.via[0]}` : ""
	return `${name} ${lib.status} ${STATUS_SYMBOL[lib.status]}${via}`
}

export default function ProjectSummaryCard({ summary }: ProjectSummaryCardProps) {
	const checkedModules = summary.modules.filter((m) => !m.aggregate)
	const buildModules = checkedModules.length > 0 ? checkedModules : summary.modules
	const buildTools = [...new Set(buildModules.map((m) => m.buildTool))].join(", ")
	const runtimeEvidence = checkedModules[0]?.runtime.evidence
	const consistency = CONSISTENCY_LABEL[summary.versionConsistency.state]

	return (
		<section
			aria-label="Project summary"
			style={{
				backgroundColor: "var(--vscode-input-background)",
				padding: "10px",
				borderRadius: "3px",
				border: "1px solid var(--vscode-input-border)",
				marginBottom: "10px",
				fontSize: "11px",
			}}>
			<div style={{ fontWeight: "bold", marginBottom: "8px", fontSize: "13px" }}>Project</div>
			<div style={{ marginBottom: "4px" }}>Build: {buildTools || "n/a"}</div>
			<div style={{ marginBottom: "6px" }}>
				Runtime: {`${summary.generation} ${summary.version ?? ""}`.trim()}
				{runtimeEvidence && (
					<span style={{ color: "var(--vscode-descriptionForeground)" }}>{` — ${runtimeEvidence}`}</span>
				)}
			</div>
			<div style={{ display: "flex", gap: "6px", marginBottom: "6px", flexWrap: "wrap" }}>
				{LIBRARY_NAMES.map((name) => {
					const lib = worstLibrary(checkedModules.flatMap((m) => m.requiredLibraries.filter((l) => l.name === name)))
					return (
						<div
							key={name}
							title={lib?.evidence}
							style={{
								fontSize: "10px",
								padding: "3px 8px",
								borderRadius: "3px",
								backgroundColor: "var(--vscode-button-secondaryBackground)",
								color: lib ? getStatusColor(lib.status) : "var(--vscode-descriptionForeground)",
								whiteSpace: "nowrap",
							}}>
							{chipText(name, lib)}
						</div>
					)
				})}
			</div>
			<div style={{ marginBottom: "4px" }}>
				{`Version consistency: ${consistency} — ${summary.versionConsistency.evidence}`}
			</div>
			<div style={{ marginBottom: "6px" }}>
				Result: <span style={{ fontWeight: "bold", color: getStatusColor(summary.result) }}>{summary.result}</span>
			</div>
			<div style={{ color: "var(--vscode-descriptionForeground)" }}>{FIXED_NOTE}</div>
			{summary.modules.length > 1 && (
				<div style={{ marginTop: "4px" }}>{`Modules: ${summary.modules.length} (see the Project rows below)`}</div>
			)}
		</section>
	)
}
