import React from "react"
import type { ErdModel } from "@shared/erdParser"

interface ErdDiagramProps {
	model: ErdModel | null
}

const tableWidth = 260
const tableGapX = 70
const tableGapY = 42
const headerHeight = 36
const columnHeight = 28
const relationPadding = 8

function getRelationPoints(
	from: { x: number; y: number; height: number },
	to: { x: number; y: number; height: number },
): {
	startX: number
	startY: number
	endX: number
	endY: number
	startLabelX: number
	startLabelY: number
	endLabelX: number
	endLabelY: number
	controlX1: number
	controlY1: number
	controlX2: number
	controlY2: number
} {
	const fromCenterX = from.x + tableWidth / 2
	const fromCenterY = from.y + from.height / 2
	const toCenterX = to.x + tableWidth / 2
	const toCenterY = to.y + to.height / 2
	const horizontalDistance = Math.abs(toCenterX - fromCenterX)
	const verticalDistance = Math.abs(toCenterY - fromCenterY)

	if (horizontalDistance >= verticalDistance) {
		const fromIsLeft = fromCenterX <= toCenterX
		const startX = fromIsLeft ? from.x + tableWidth : from.x
		const endX = fromIsLeft ? to.x : to.x + tableWidth
		const startY = fromCenterY
		const endY = toCenterY
		const controlOffset = Math.max(44, horizontalDistance / 2)
		const direction = fromIsLeft ? 1 : -1

		return {
			startX,
			startY,
			endX,
			endY,
			startLabelX: startX + direction * relationPadding,
			startLabelY: startY - relationPadding,
			endLabelX: endX - direction * (relationPadding + 4),
			endLabelY: endY - relationPadding,
			controlX1: startX + direction * controlOffset,
			controlY1: startY,
			controlX2: endX - direction * controlOffset,
			controlY2: endY,
		}
	}

	const fromIsAbove = fromCenterY <= toCenterY
	const startX = fromCenterX
	const endX = toCenterX
	const startY = fromIsAbove ? from.y + from.height : from.y
	const endY = fromIsAbove ? to.y : to.y + to.height
	const controlOffset = Math.max(34, verticalDistance / 2)
	const direction = fromIsAbove ? 1 : -1

	return {
		startX,
		startY,
		endX,
		endY,
		startLabelX: startX + relationPadding,
		startLabelY: startY + direction * 18,
		endLabelX: endX + relationPadding,
		endLabelY: endY - direction * relationPadding,
		controlX1: startX,
		controlY1: startY + direction * controlOffset,
		controlX2: endX,
		controlY2: endY - direction * controlOffset,
	}
}

const ErdDiagram: React.FC<ErdDiagramProps> = ({ model }) => {
	if (!model || model.tables.length === 0) {
		return null
	}

	const columnsPerRow = Math.min(3, Math.max(1, model.tables.length))
	const tableHeights = model.tables.map((table) => headerHeight + table.columns.length * columnHeight)
	const rowHeights = Array.from({ length: Math.ceil(model.tables.length / columnsPerRow) }, (_, rowIndex) =>
		Math.max(...tableHeights.slice(rowIndex * columnsPerRow, rowIndex * columnsPerRow + columnsPerRow)),
	)
	const positions = model.tables.reduce<Record<string, { x: number; y: number; height: number }>>((acc, table, index) => {
		const row = Math.floor(index / columnsPerRow)
		const column = index % columnsPerRow
		const height = tableHeights[index]
		const y = rowHeights.slice(0, row).reduce((sum, rowHeight) => sum + rowHeight + tableGapY, 0)

		acc[table.name] = {
			x: column * (tableWidth + tableGapX),
			y,
			height,
		}
		return acc
	}, {})

	const maxRows = Math.ceil(model.tables.length / columnsPerRow)
	const diagramWidth = columnsPerRow * tableWidth + (columnsPerRow - 1) * tableGapX
	const diagramHeight =
		maxRows === 0
			? 0
			: Math.max(
					...model.tables.map((table) => {
						const position = positions[table.name]
						return position.y + position.height
					}),
				)

	return (
		<div style={{ marginBottom: "20px" }}>
			<h4 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>ERD Preview</h4>
			<div
				style={{
					backgroundColor: "var(--vscode-editor-inactiveSelectionBackground)",
					border: "1px solid var(--vscode-settings-textInputBorder)",
					borderRadius: "4px",
					overflowX: "auto",
					padding: "14px",
				}}>
				<div style={{ position: "relative", width: diagramWidth, minHeight: diagramHeight }}>
					<svg
						width={diagramWidth}
						height={diagramHeight}
						style={{
							position: "absolute",
							left: 0,
							top: 0,
							pointerEvents: "none",
						}}>
						<defs>
							<marker
								id="erd-arrow"
								markerWidth="10"
								markerHeight="10"
								refX="9"
								refY="3"
								orient="auto"
								markerUnits="strokeWidth">
								<path d="M0,0 L0,6 L9,3 z" fill="currentColor" />
							</marker>
						</defs>
						{model.relationships.map((relationship, index) => {
							const from = positions[relationship.fromTable]
							const to = positions[relationship.toTable]
							if (!from || !to) {
								return null
							}

							const relationPoints = getRelationPoints(from, to)

							return (
								<g
									key={`${relationship.fromTable}-${relationship.fromColumn}-${relationship.toTable}-${relationship.toColumn}-${index}`}
									style={{ color: "var(--vscode-charts-blue)" }}>
									<path
										d={`M ${relationPoints.startX} ${relationPoints.startY} C ${relationPoints.controlX1} ${relationPoints.controlY1}, ${relationPoints.controlX2} ${relationPoints.controlY2}, ${relationPoints.endX} ${relationPoints.endY}`}
										stroke="currentColor"
										strokeWidth="1.7"
										fill="none"
										markerEnd="url(#erd-arrow)"
									/>
									<text
										x={relationPoints.startLabelX}
										y={relationPoints.startLabelY}
										fill="currentColor"
										fontSize="11"
										fontWeight="700">
										N
									</text>
									<text
										x={relationPoints.endLabelX}
										y={relationPoints.endLabelY}
										fill="currentColor"
										fontSize="11"
										fontWeight="700">
										1
									</text>
								</g>
							)
						})}
					</svg>

					{model.tables.map((table) => {
						const position = positions[table.name]
						return (
							<div
								key={table.name}
								style={{
									position: "absolute",
									left: position.x,
									top: position.y,
									width: tableWidth,
									backgroundColor: "var(--vscode-editor-background)",
									border: "1px solid var(--vscode-panel-border)",
									borderRadius: "4px",
									overflow: "hidden",
									boxShadow: "0 1px 3px rgba(0, 0, 0, 0.18)",
								}}>
								<div
									style={{
										height: headerHeight,
										display: "flex",
										alignItems: "center",
										padding: "0 10px",
										backgroundColor: "var(--vscode-sideBarSectionHeader-background)",
										borderBottom: "1px solid var(--vscode-panel-border)",
										color: "var(--vscode-foreground)",
										fontSize: "13px",
										fontWeight: 700,
									}}>
									{table.name}
								</div>
								{table.columns.map((column) => (
									<div
										key={column.name}
										style={{
											height: columnHeight,
											display: "grid",
											gridTemplateColumns: "auto 1fr auto",
											alignItems: "center",
											gap: "7px",
											padding: "0 10px",
											borderBottom: "1px solid var(--vscode-panel-border)",
											color: "var(--vscode-foreground)",
											fontSize: "12px",
										}}>
										<span
											style={{
												minWidth: "22px",
												color: column.isPrimaryKey
													? "var(--vscode-terminal-ansiYellow)"
													: column.isForeignKey
														? "var(--vscode-charts-blue)"
														: "var(--vscode-descriptionForeground)",
												fontSize: "10px",
												fontWeight: 700,
											}}>
											{column.isPrimaryKey ? "PK" : column.isForeignKey ? "FK" : ""}
										</span>
										<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
											{column.name}
										</span>
										<span style={{ color: "var(--vscode-descriptionForeground)", fontSize: "11px" }}>
											{column.dataType}
										</span>
									</div>
								))}
							</div>
						)
					})}
				</div>
				{model.relationships.length === 0 && (
					<div
						style={{
							marginTop: "12px",
							color: "var(--vscode-descriptionForeground)",
							fontSize: "12px",
						}}>
						No foreign key relationships found.
					</div>
				)}
			</div>
		</div>
	)
}

export default ErdDiagram
