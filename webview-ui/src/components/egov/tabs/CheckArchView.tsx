import { useState, useEffect } from "react"
import { Button, TextField, Select, ProgressRing, Link } from "../../ui"
import { getMessageText, isMessageForScope } from "@shared/webviewMessageRouting"
import { vscode } from "../../../utils/vscode"
import type { ArchCheckResults, ArchCheckSummary } from "@shared/archCheck"
import { FILE_LAYER_KEYS, LAYER_LABELS, getCellDisplay, getCheckDescriptions, getUsedChecks } from "./checkArch/checkDisplay"

const CheckArchView = () => {
	const [projectPath, setProjectPath] = useState<string>("")
	const [isChecking, setIsChecking] = useState<boolean>(false)
	const [checkResults, setCheckResults] = useState<ArchCheckResults>({})
	const [selectedResultType, setSelectedResultType] = useState<string>("Controller")
	const [error, setError] = useState<string>("")
	const [checkProgress, setCheckProgress] = useState<string>("")
	const [showSkipped, setShowSkipped] = useState<boolean>(false)

	// 결과가 있는 파일 레이어 키 — 요약 카드·Select·합계·Export 판정은 이 키만 본다
	const layerKeys = FILE_LAYER_KEYS.filter((k) => checkResults[k])
	const hasResults = layerKeys.length > 0
	// 선택한 레이어가 결과에 없으면 첫 번째 있는 레이어로 보정한다
	const activeResultType: string = (layerKeys as readonly string[]).includes(selectedResultType)
		? selectedResultType
		: (layerKeys[0] ?? selectedResultType)
	const skippedFiles = checkResults.DAO?.skipped ?? []

	// 컴포넌트 마운트 시 현재 워크스페이스 경로 요청
	useEffect(() => {
		vscode.postMessage({ type: "getWorkspacePath", scope: "archCheck" })

		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			switch (message.type) {
				case "currentWorkspacePath":
					if (!isMessageForScope(message, "archCheck")) {
						break
					}
					if (message.text) {
						setProjectPath(message.text)
					}
					break
				case "selectedProjectPath":
					if (!isMessageForScope(message, "archCheck")) {
						break
					}
					if (message.text) {
						setProjectPath(message.text)
					}
					break
				case "archCheckProgress":
					if (!isMessageForScope(message, "archCheck")) {
						break
					}
					setCheckProgress(message.text || "")
					break
				case "archCheckResult":
					if (!isMessageForScope(message, "archCheck")) {
						break
					}
					setIsChecking(false)
					if (message.success) {
						setCheckResults(message.results || {})
						setError("")
						setCheckProgress("✅ Architecture check completed successfully.")
					} else {
						setError(message.error || "An error occurred during architecture check.")
						setCheckProgress("")
					}
					break
				case "error":
					if (!isMessageForScope(message, "archCheck")) {
						break
					}
					setIsChecking(false)
					setError(getMessageText(message) || "An unknown error occurred.")
					setCheckProgress("")
					break
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const handleSelectProjectPath = () => {
		vscode.postMessage({ type: "selectProjectPath", scope: "archCheck" })
	}

	const handleStartArchCheck = () => {
		if (!projectPath.trim()) {
			setError("Please select a project path.")
			return
		}

		setIsChecking(true)
		setError("")
		setCheckProgress("🔍 Starting architecture check...")
		setCheckResults({})

		vscode.postMessage({
			type: "startArchCheck",
			projectPath: projectPath.trim(),
		})
	}

	const handleExportResults = () => {
		if (!hasResults) {
			setError("No results to export. Please run architecture check first.")
			return
		}

		vscode.postMessage({
			type: "exportArchResults",
			results: checkResults,
			projectPath: projectPath,
		})
	}

	const handleFileClick = (filePath: string) => {
		vscode.postMessage({
			type: "openFile",
			filePath: filePath,
		})
	}

	const getCurrentResults = (): ArchCheckSummary | null => {
		const key = FILE_LAYER_KEYS.find((k) => k === activeResultType)
		return key ? (checkResults[key] ?? null) : null
	}

	const layerSummaries = layerKeys.flatMap((k) => {
		const summary = checkResults[k]
		return summary ? [[k, summary] as const] : []
	})

	const getTotalSummary = () => {
		let totalFiles = 0
		let totalPassed = 0
		let totalFailed = 0

		layerSummaries.forEach(([, summary]) => {
			totalFiles += summary.totalFiles
			totalPassed += summary.passedFiles
			totalFailed += summary.failedFiles
		})

		return { totalFiles, totalPassed, totalFailed }
	}

	const currentResults = getCurrentResults()
	const totalSummary = getTotalSummary()

	return (
		<div style={{ padding: "20px" }}>
			{/* Header */}
			<div style={{ marginBottom: "20px" }}>
				<h3 style={{ color: "var(--vscode-foreground)", marginTop: 0, marginBottom: "8px" }}>
					eGovFrame Architecture Check
				</h3>
				<p
					style={{
						fontSize: "12px",
						color: "var(--vscode-descriptionForeground)",
						margin: 0,
						marginTop: "5px",
					}}>
					Automatically check compliance with eGovFrame architecture guidelines. Verify annotations and inheritance
					rules for Controller, Service, and DAO / Mapper layers. Learn more at{" "}
					<Link href="https://github.com/eGovFramework/egovframe-vscode-initializr" style={{ display: "inline" }}>
						GitHub
					</Link>
				</p>
			</div>

			{/* Progress Status */}
			{checkProgress && (
				<div style={{ marginBottom: "20px" }}>
					<div
						style={{
							backgroundColor: checkProgress.startsWith("❌")
								? "var(--vscode-inputValidation-errorBackground)"
								: checkProgress.startsWith("✅")
									? "var(--vscode-inputValidation-infoBackground)"
									: "var(--vscode-inputValidation-warningBackground)",
							border: `1px solid ${
								checkProgress.startsWith("❌")
									? "var(--vscode-inputValidation-errorBorder)"
									: checkProgress.startsWith("✅")
										? "var(--vscode-inputValidation-infoBorder)"
										: "var(--vscode-inputValidation-warningBorder)"
							}`,
							color: checkProgress.startsWith("❌")
								? "var(--vscode-inputValidation-errorForeground)"
								: checkProgress.startsWith("✅")
									? "var(--vscode-inputValidation-infoForeground)"
									: "var(--vscode-inputValidation-warningForeground)",
							padding: "10px",
							borderRadius: "3px",
							fontSize: "12px",
						}}>
						{checkProgress}
					</div>
				</div>
			)}

			{/* Error Display */}
			{error && (
				<div style={{ marginBottom: "20px" }}>
					<div
						style={{
							backgroundColor: "var(--vscode-inputValidation-errorBackground)",
							border: "1px solid var(--vscode-inputValidation-errorBorder)",
							color: "var(--vscode-inputValidation-errorForeground)",
							padding: "10px",
							borderRadius: "3px",
							fontSize: "12px",
						}}>
						{error}
					</div>
				</div>
			)}

			{/* Project Path Selection */}
			<div style={{ marginBottom: "20px" }}>
				<div style={{ display: "flex", gap: "10px", alignItems: "end" }}>
					<div style={{ flex: 1, marginRight: "10px" }}>
						<TextField
							label="Project Path"
							value={projectPath}
							onChange={(e: any) => setProjectPath(e.target.value)}
							placeholder="Select eGovFrame project root directory"
							isRequired
						/>
					</div>
					<Button onClick={handleSelectProjectPath} variant="secondary" size="md">
						<span className="codicon codicon-folder-opened" style={{ marginRight: "6px" }}></span>
						Browse
					</Button>
				</div>
				<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
					Selected path: {projectPath || "No path selected"}
				</div>
			</div>

			{/* Check Actions */}
			<div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
				<Button
					onClick={handleStartArchCheck}
					disabled={isChecking || !projectPath.trim()}
					variant="primary"
					size="md"
					style={{
						backgroundColor: "var(--vscode-button-background)",
						color: "var(--vscode-button-foreground)",
						border: "1px solid var(--vscode-button-border)",
						borderRadius: "4px",
						padding: "12px 16px",
						cursor: "pointer",
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: "13px",
						fontFamily: "inherit",
						outline: "none",
					}}>
					{isChecking ? (
						<>
							<ProgressRing />
							Checking...
						</>
					) : (
						<>
							<span className="codicon codicon-search" style={{ marginRight: "6px" }}></span>
							Start Architecture Check
						</>
					)}
				</Button>
				<Button onClick={handleExportResults} disabled={!hasResults} variant="secondary" size="md">
					<span className="codicon codicon-export" style={{ marginRight: "6px" }}></span>
					Export Results
				</Button>
			</div>

			{/* Results Summary */}
			{hasResults && (
				<div style={{ marginBottom: "20px" }}>
					<h4 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>Check Results Summary</h4>
					<div
						style={{
							backgroundColor: "var(--vscode-editor-inactiveSelectionBackground)",
							padding: "15px",
							borderRadius: "4px",
							marginBottom: "15px",
						}}>
						<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
							<div style={{ textAlign: "center" }}>
								<div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--vscode-foreground)" }}>
									{totalSummary.totalFiles}
								</div>
								<div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>Total Files</div>
							</div>
							<div style={{ textAlign: "center" }}>
								<div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--vscode-terminal-ansiGreen)" }}>
									{totalSummary.totalPassed}
								</div>
								<div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>Passed</div>
							</div>
							<div style={{ textAlign: "center" }}>
								<div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--vscode-errorForeground)" }}>
									{totalSummary.totalFailed}
								</div>
								<div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>Failed</div>
							</div>
							<div style={{ textAlign: "center" }}>
								<div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--vscode-foreground)" }}>
									{totalSummary.totalFiles > 0
										? Math.round((totalSummary.totalPassed / totalSummary.totalFiles) * 100)
										: 0}
									%
								</div>
								<div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>
									Compliance Rate
								</div>
							</div>
						</div>

						{/* Layer-wise Summary - 뱃지 스타일로 개선 */}
						<div
							style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
							{layerSummaries.map(([type, summary]) => (
								<div
									key={type}
									style={{
										backgroundColor: "var(--vscode-input-background)",
										padding: "10px",
										borderRadius: "3px",
										border: "1px solid var(--vscode-input-border)",
									}}>
									<div style={{ fontWeight: "bold", marginBottom: "8px", fontSize: "13px" }}>
										{LAYER_LABELS[type]}
									</div>

									{/* Stats Grid - 뱃지 스타일 */}
									<div
										style={{
											display: "flex",
											gap: "6px",
											marginBottom: "8px",
											flexWrap: "wrap",
										}}>
										<div
											style={{
												fontSize: "10px",
												padding: "3px 8px",
												borderRadius: "3px",
												backgroundColor: "var(--vscode-button-secondaryBackground)",
												color: "var(--vscode-button-secondaryForeground)",
												whiteSpace: "nowrap",
											}}>
											Total: {summary.totalFiles}
										</div>
										<div
											style={{
												fontSize: "10px",
												padding: "3px 8px",
												borderRadius: "3px",
												backgroundColor: "#16825D",
												color: "#ffffff",
												whiteSpace: "nowrap",
												fontWeight: "500",
											}}>
											✓ {summary.passedFiles}
										</div>
										<div
											style={{
												fontSize: "10px",
												padding: "3px 8px",
												borderRadius: "3px",
												backgroundColor:
													summary.failedFiles > 0
														? "var(--vscode-errorForeground)"
														: "var(--vscode-button-secondaryBackground)",
												color: "var(--vscode-button-foreground)",
												whiteSpace: "nowrap",
											}}>
											✗ {summary.failedFiles}
										</div>
									</div>

									{/* Compliance Rate */}
									<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)" }}>
										Compliance:{" "}
										<span style={{ fontWeight: "bold" }}>
											{summary.totalFiles > 0
												? Math.round((summary.passedFiles / summary.totalFiles) * 100)
												: 0}
											%
										</span>
									</div>
								</div>
							))}
						</div>

						{/* Skipped Files - 점검 대상에서 제외된 파일 */}
						{skippedFiles.length > 0 && (
							<div style={{ marginTop: "10px" }}>
								<Button
									onClick={() => setShowSkipped(!showSkipped)}
									variant="secondary"
									size="md"
									aria-expanded={showSkipped}>
									{`Skipped ${skippedFiles.length}`}
								</Button>
								{showSkipped && (
									<div
										style={{
											marginTop: "8px",
											border: "1px solid var(--vscode-input-border)",
											borderRadius: "3px",
											backgroundColor: "var(--vscode-input-background)",
										}}>
										{skippedFiles.map((file, index) => (
											<div
												key={file.filePath}
												style={{
													display: "grid",
													gridTemplateColumns: "1fr 140px 2fr",
													gap: "10px",
													padding: "6px 10px",
													fontSize: "11px",
													borderBottom:
														index < skippedFiles.length - 1
															? "1px solid var(--vscode-input-border)"
															: "none",
												}}>
												<div
													style={{
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
														cursor: "pointer",
														color: "var(--vscode-textLink-foreground)",
														textDecoration: "underline",
													}}
													onClick={() => handleFileClick(file.filePath)}
													title={file.filePath}>
													{file.fileName}
												</div>
												<div>{file.reason}</div>
												<div style={{ color: "var(--vscode-descriptionForeground)" }}>
													{file.detail ?? ""}
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			)}

			{/* Detailed Results */}
			{hasResults && (
				<div style={{ marginBottom: "20px" }}>
					<h4 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>Detailed Results</h4>

					{/* Result Type Selector */}
					<div style={{ marginBottom: "15px" }}>
						<Select
							value={activeResultType}
							onChange={(e: any) => setSelectedResultType(e.target.value)}
							options={layerKeys.map((k) => ({ value: k, label: LAYER_LABELS[k] }))}
						/>
					</div>

					{/* Detailed Results Table */}
					{currentResults && (
						<div
							style={{
								border: "1px solid var(--vscode-input-border)",
								borderRadius: "4px",
								overflow: "hidden",
							}}>
							{/* Table Header */}
							<div
								style={{
									backgroundColor: "var(--vscode-editor-background)",
									padding: "10px",
									borderBottom: "1px solid var(--vscode-input-border)",
									display: "grid",
									gridTemplateColumns: "2fr 1fr 110px 110px 110px 80px",
									gap: "10px",
									fontSize: "12px",
									fontWeight: "bold",
								}}>
								<div>File Path</div>
								<div>File Name</div>
								<div title={getCheckDescriptions(activeResultType).check1.full}>
									{getCheckDescriptions(activeResultType).check1.short}
								</div>
								<div title={getCheckDescriptions(activeResultType).check2.full}>
									{getCheckDescriptions(activeResultType).check2.short}
								</div>
								<div title={getCheckDescriptions(activeResultType).check3.full}>
									{getCheckDescriptions(activeResultType).check3.short}
								</div>
								<div>Result</div>
							</div>

							{/* Table Body */}
							<div style={{ maxHeight: "400px", overflowY: "auto" }}>
								{currentResults.results.map((result, index) => {
									const usedChecks = getUsedChecks(result.type)
									const check1Display = getCellDisplay(result, 1)
									const check2Display = getCellDisplay(result, 2)
									const check3Display = getCellDisplay(result, 3)

									return (
										<div
											key={index}
											style={{
												padding: "8px 10px",
												borderBottom:
													index < currentResults.results.length - 1
														? "1px solid var(--vscode-input-border)"
														: "none",
												display: "grid",
												gridTemplateColumns: "2fr 1fr 110px 110px 110px 80px",
												gap: "10px",
												fontSize: "11px",
												backgroundColor:
													result.result === "OK"
														? "var(--vscode-inputValidation-infoBackground)"
														: "var(--vscode-inputValidation-errorBackground)",
											}}>
											<div
												style={{
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}}
												title={result.filePath}>
												{result.filePath}
											</div>
											<div
												style={{
													fontWeight: "bold",
													cursor: "pointer",
													color: "var(--vscode-textLink-foreground)",
													textDecoration: "underline",
													transition: "color 0.2s ease",
												}}
												onClick={() => handleFileClick(result.filePath)}
												onMouseEnter={(e) => {
													e.currentTarget.style.color = "var(--vscode-textLink-activeForeground)"
												}}
												onMouseLeave={(e) => {
													e.currentTarget.style.color = "var(--vscode-textLink-foreground)"
												}}
												title="Click to open file in editor">
												{result.fileName}
											</div>
											<div
												style={{
													color: check1Display.color,
													textAlign: "center",
												}}
												title={
													check1Display.title ??
													(usedChecks.check1
														? undefined
														: "이 체크는 해당 레이어에서 사용되지 않습니다")
												}>
												{check1Display.symbol}
											</div>
											<div
												style={{
													color: check2Display.color,
													textAlign: "center",
												}}
												title={
													check2Display.title ??
													(usedChecks.check2
														? undefined
														: "이 체크는 해당 레이어에서 사용되지 않습니다")
												}>
												{check2Display.symbol}
											</div>
											<div
												style={{
													color: check3Display.color,
													textAlign: "center",
												}}
												title={
													check3Display.title ??
													(usedChecks.check3
														? undefined
														: "이 체크는 해당 레이어에서 사용되지 않습니다")
												}>
												{check3Display.symbol}
											</div>
											<div
												style={{
													color:
														result.result === "OK"
															? "var(--vscode-terminal-ansiGreen)"
															: "var(--vscode-errorForeground)",
													fontWeight: "bold",
													textAlign: "center",
												}}>
												{result.result}
											</div>
										</div>
									)
								})}
							</div>
						</div>
					)}
				</div>
			)}

			{/* Architecture Guidelines */}
			<div
				style={{
					backgroundColor: "var(--vscode-editor-background)",
					border: "1px solid var(--vscode-panel-border)",
					borderRadius: "3px",
					padding: "15px",
					marginTop: "20px",
				}}>
				<h4 style={{ color: "var(--vscode-foreground)", marginBottom: "10px", marginTop: 0 }}>
					eGovFrame Architecture Guidelines
				</h4>
				<div style={{ fontSize: "12px", color: "var(--vscode-foreground)" }}>
					<div style={{ marginBottom: "12px" }}>
						<strong>Controller Layer:</strong>
						<ul style={{ fontSize: "11px", margin: "5px 0 0 0", paddingLeft: "20px" }}>
							<li>File name must follow *Controller.java pattern</li>
							<li>Must have @Controller annotation</li>
							<li>Must have mapping annotation (@RequestMapping, @GetMapping, @PostMapping, etc.)</li>
							<li>Must not inject DAO/Dao/Mapper types (DAO belongs in ServiceImpl)</li>
						</ul>
					</div>
					<div style={{ marginBottom: "12px" }}>
						<strong>Service Layer:</strong>
						<ul style={{ fontSize: "11px", margin: "5px 0 0 0", paddingLeft: "20px" }}>
							<li>File name must follow *ServiceImpl.java pattern</li>
							<li>Must extend EgovAbstractServiceImpl</li>
							<li>Must have @Service annotation</li>
							<li>Must implement Service interface</li>
						</ul>
					</div>
					<div style={{ marginBottom: "12px" }}>
						<strong>DAO / Mapper Layer:</strong>
						<ul style={{ fontSize: "11px", margin: "5px 0 0 0", paddingLeft: "20px" }}>
							<li>
								File name must follow *DAO.java, *Dao.java or *Mapper.java pattern (the style is detected from the
								file content)
							</li>
							<li>iBatis DAO: @Repository and extends EgovAbstractDAO</li>
							<li>MyBatis DAO: @Repository and extends EgovAbstractMapper</li>
							<li>
								Mapper interface: @Mapper (4.3 and below) or @EgovMapper (5.0 and above) imported from the
								eGovFrame package
							</li>
							<li>
								Version: the base class package or the annotation must match the project's runtime generation (n/a
								when unknown)
							</li>
							<li>
								Abstract classes, @Configuration classes, RowMapper-like helpers, Spring Data repositories,
								MapStruct mappers and plain base classes are listed under Skipped
							</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	)
}

export default CheckArchView
