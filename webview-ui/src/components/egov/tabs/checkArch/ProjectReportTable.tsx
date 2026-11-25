/**
 * ProjectReportTable.tsx
 *
 * 상세 결과에서 Project를 골랐을 때의 긴 형식 테이블 — projectReportRows가 펼친 행을
 * Module / Item / Status / Evidence 네 칸으로 보인다(CSV 내보내기와 같은 행 규칙).
 */
import type { ProjectCheckSummary } from "@shared/archCheck"
import { projectReportRows } from "@shared/archCheckReport"
import { getStatusColor } from "./checkDisplay"

export interface ProjectReportTableProps {
	summary: ProjectCheckSummary
}

const GRID_COLUMNS = "1.5fr 1fr 1fr 2fr"

const ellipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const

export default function ProjectReportTable({ summary }: ProjectReportTableProps) {
	const rows = projectReportRows(summary)

	return (
		<div
			style={{
				border: "1px solid var(--vscode-input-border)",
				borderRadius: "4px",
				overflow: "hidden",
			}}>
			<div
				style={{
					backgroundColor: "var(--vscode-editor-background)",
					padding: "10px",
					borderBottom: "1px solid var(--vscode-input-border)",
					display: "grid",
					gridTemplateColumns: GRID_COLUMNS,
					gap: "10px",
					fontSize: "12px",
					fontWeight: "bold",
				}}>
				<div>Module</div>
				<div>Item</div>
				<div>Status</div>
				<div>Evidence</div>
			</div>
			<div style={{ maxHeight: "400px", overflowY: "auto" }}>
				{rows.map((row, index) => (
					<div
						key={`${row.module}:${row.item}:${index}`}
						style={{
							padding: "8px 10px",
							borderBottom: index < rows.length - 1 ? "1px solid var(--vscode-input-border)" : "none",
							display: "grid",
							gridTemplateColumns: GRID_COLUMNS,
							gap: "10px",
							fontSize: "11px",
						}}>
						<div style={ellipsis} title={row.module}>
							{row.module}
						</div>
						<div>{row.item}</div>
						<div style={{ color: getStatusColor(row.status), fontWeight: "bold" }}>{row.status}</div>
						<div style={ellipsis} title={row.evidence}>
							{row.evidence}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
