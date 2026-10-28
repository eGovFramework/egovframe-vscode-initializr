/**
 * archCheckReport.ts
 *
 * 프로젝트 빌드 점검 결과(ProjectCheckSummary)를 보고용 행으로 펼치는 순수 함수.
 * 확장 호스트(CSV 내보내기)와 웹뷰(Project 카드)가 같은 행 규칙을 쓰도록 공유하므로
 * `vscode`나 Node 전용 모듈을 import하지 않는다.
 */

import type { CheckState, ProjectCheckSummary } from "./archCheck"

/** 보고 행 1개 — CSV의 Module,Item,Status,Evidence 열과 같다 */
export interface ProjectReportRow {
	/** 빌드 파일 상대 경로, 프로젝트 종합 행은 "*" */
	module: string
	/** "runtime" · 필수 라이브러리 이름 · "result" · "data-access-config" · "unclassified" · "version-consistency" */
	item: string
	status: string
	evidence: string
}

const CONSISTENCY_STATUS: Record<CheckState, string> = {
	pass: "PASS",
	fail: "FAIL",
	skipped: "n/a",
}

/**
 * 모듈마다 runtime 행 → 필수 라이브러리 4종 행 → result 행(집계 모듈은 runtime·result 행만),
 * 그 뒤 데이터 접근 설정 행(finding·warning)과 미분류 파일 행, 끝에 프로젝트 전체의 version-consistency 행과 result 행을 둔다.
 */
export function projectReportRows(summary: ProjectCheckSummary): ProjectReportRow[] {
	const rows: ProjectReportRow[] = []
	for (const module of summary.modules) {
		const { buildFile, runtime } = module
		rows.push({
			module: buildFile,
			item: "runtime",
			status: `${runtime.version ?? "unknown"} (${runtime.generation})`,
			evidence: runtime.evidence,
		})
		if (!module.aggregate) {
			for (const library of module.requiredLibraries) {
				rows.push({ module: buildFile, item: library.name, status: library.status, evidence: library.evidence })
			}
		}
		rows.push({ module: buildFile, item: "result", status: module.result, evidence: (module.notes ?? []).join("; ") })
	}
	// 데이터 접근 설정 정보(판정에 영향 없음) — finding → 경고 → 미분류 파일
	for (const finding of summary.dataAccessConfig?.findings ?? []) {
		rows.push({
			module: "*",
			item: "data-access-config",
			status: finding.kind,
			evidence: `${finding.fileName}: ${finding.evidence}`,
		})
	}
	for (const warning of summary.dataAccessConfig?.warnings ?? []) {
		rows.push({ module: "*", item: "data-access-config", status: "warning", evidence: warning })
	}
	for (const file of summary.unclassifiedDataAccessFiles ?? []) {
		rows.push({ module: "*", item: "unclassified", status: "info", evidence: `${file.relativePath}: ${file.evidence}` })
	}
	rows.push({
		module: "*",
		item: "version-consistency",
		status: CONSISTENCY_STATUS[summary.versionConsistency.state],
		evidence: summary.versionConsistency.evidence,
	})
	rows.push({
		module: "*",
		item: "result",
		status: summary.result,
		evidence: `${summary.generation} ${summary.version ?? ""}`.trim(),
	})
	return rows
}
