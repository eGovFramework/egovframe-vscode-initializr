import { Button, TextArea, Link, ProgressRing, TextField } from "../../ui"
import { useState, useEffect, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { parseDDL, validateDDL, ParsedDDL } from "@shared/ddlParser"
import { parseErdModel } from "@shared/erdParser"
import { getTemplateContext } from "@shared/templateContext"
import { WebviewMessage, ExtensionResponse } from "../../../utils/messageTypes"
import { createSelectOutputPathMessage } from "../../../utils/egovUtils"
import { vscode } from "../../../utils/vscode"
import { validateCodeConfig, type CodeConfig } from "../../../utils/codeUtils"
import { useCodeViewState } from "../../../context/EgovTabsStateContext"
import CodePreview from "../CodePreview"
import ErdDiagram from "../ErdDiagram"
import Editor, { loader } from "@monaco-editor/react"
import * as monaco from "monaco-editor"

// Import SQL language contributions
import "monaco-sql-languages/esm/languages/mysql/mysql.contribution"
import "monaco-sql-languages/esm/languages/pgsql/pgsql.contribution"

// Import Workers as inline (Vite will bundle them as base64)
import MySQLWorker from "monaco-sql-languages/esm/languages/mysql/mysql.worker?worker&inline"
import PgSQLWorker from "monaco-sql-languages/esm/languages/pgsql/pgsql.worker?worker&inline"
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker&inline"

// Configure Monaco Editor loader
loader.config({ monaco })

// Configure Monaco Environment for SQL Language Workers
if (typeof window !== "undefined") {
	// 브라우저 환경인지 확인 (Node.js 환경에서는 window가 없없으므로 실행되지 않음)
	;(window as any).MonacoEnvironment = {
		// Monaco Editor가 참조하는 전역 설정 객체 (Worker를 어떻게 만들지 정의)
		getWorker(_: any, label: string) {
			// Monaco가 Worker가 필요할 때 호출하는 함수 (label을 통해 Monaco가 어떤 언어의 Worker가 필요한지 알려줌)
			// Use inline workers (bundled as base64 by Vite)
			// This solves CORS issues in VSCode webview environment
			if (label === "mysql") {
				return new MySQLWorker() // Base64로 번들링된 MySQL Worker 인스턴스 반환
			}
			if (label === "pgsql") {
				return new PgSQLWorker() // Base64로 번들링된 PostgreSQL Worker 인스턴스 반환
			}

			// Fallback to default Monaco editor worker
			return new EditorWorker()
		},
	}
}

const CodeView = () => {
	console.log("CodeView component rendering...")

	const { t } = useTranslation()
	const { state, updateState } = useCodeViewState()
	const {
		ddlContent,
		parsedDDL,
		isValid,
		isLoading,
		error,
		validationErrors,
		outputPath,
		packageName,
		defaultPackageName,
		// 미리보기 관련 상태
		previews,
		previewLanguages,
		selectedPreviewTemplate,
		isPreviewLoading,
		previewError,
		autoUpdatePreview,
		sampleDDLs,
	} = state
	// Monaco Editor 테마
	const [monacoTheme, setMonacoTheme] = useState<"light" | "vs-dark">("vs-dark")
	// Monaco Editor 포커스 상태
	const [isEditorFocused, setIsEditorFocused] = useState(false)
	// SQL 방언 선택 (MySQL or PostgreSQL or Generic)
	const [sqlDialect, setSqlDialect] = useState<"mysql" | "pgsql" | "generic">("mysql")
	// 현재 선택된 샘플 키 추적
	const [selectedSampleKey, setSelectedSampleKey] = useState<string>("")
	// Monaco Editor 인스턴스 참조
	const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
	const monacoRef = useRef<typeof monaco | null>(null)
	// DDL 검증 디바운스 타이머
	const ddlValidationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const erdModel = useMemo(() => {
		if (!isValid || !ddlContent.trim()) {
			return null
		}

		try {
			return parseErdModel(ddlContent)
		} catch (error) {
			console.warn("ERD parsing failed:", error)
			return null
		}
	}, [ddlContent, isValid])

	// Helper functions to update state
	const setDdlContent = (value: string) => updateState({ ddlContent: value })
	const setParsedDDL = (value: ParsedDDL | null) => updateState({ parsedDDL: value })
	const setIsValid = (value: boolean) => updateState({ isValid: value })
	const setIsLoading = (value: boolean) => updateState({ isLoading: value })
	const setError = (value: string) => updateState({ error: value })
	const setValidationErrors = (value: string[]) => updateState({ validationErrors: value })
	const setOutputPath = (value: string) => updateState({ outputPath: value })
	const setPackageName = (value: string) => updateState({ packageName: value })
	const setDefaultPackageName = (value: string) => updateState({ defaultPackageName: value })

	// 미리보기 관련 Helper functions
	const setPreviews = (value: { [key: string]: string } | null) => updateState({ previews: value })
	const setSelectedPreviewTemplate = (value: string) => updateState({ selectedPreviewTemplate: value })
	const setIsPreviewLoading = (value: boolean) => updateState({ isPreviewLoading: value })
	const setPreviewError = (value: string) => updateState({ previewError: value })
	const setAutoUpdatePreview = (value: boolean) => updateState({ autoUpdatePreview: value })
	const setSampleDDLs = (value: Extract<ExtensionResponse, { type: "sampleDDLs" }>["data"] | null) =>
		updateState({ sampleDDLs: value })
	const setPreviewLanguages = (value: { [key: string]: string } | null) => updateState({ previewLanguages: value })

	// DDL 검증 로직을 별도 함수로 분리 (이벤트 기반 실시간 검증) => 주의) 마커(오류 내용)가 변경될 경우에만 동작함
	const validateDDLWithMonaco = (currentDdlContent: string) => {
		try {
			const editor = editorRef.current
			const monacoInstance = monacoRef.current

			if (editor && monacoInstance) {
				const model = editor.getModel()
				if (model) {
					// Monaco Worker의 검증 결과 가져오기
					const markers = monacoInstance.editor.getModelMarkers({
						resource: model.uri,
					})

					// 에러만 필터링
					const errors = markers.filter((m) => m.severity === monacoInstance.MarkerSeverity.Error)
					const hasErrors = errors.length > 0

					console.log(`Monaco validation: ${errors.length} errors found`)

					// Monaco 검증 결과로 isValid 설정
					const isValidDDL = !hasErrors

					if (isValidDDL) {
						// Monaco 검증 통과 시 DDL 파싱 시도
						try {
							const parsed = parseDDL(currentDdlContent)
							setParsedDDL(parsed)
							setIsValid(true)
							setError("")

							// 빠른 검증만 요청 (미리보기는 나중에)
							vscode.postMessage({
								type: "validateDDLOnly",
								ddl: currentDdlContent,
								packageName: packageName,
							})
						} catch (parseError) {
							// 파싱 실패 시 isValid도 false로 설정
							setParsedDDL(null)
							setIsValid(false)
							setError(parseError instanceof Error ? parseError.message : "DDL parsing failed")
							setPreviews(null)
							setPreviewError("")
						}
					} else {
						setParsedDDL(null)
						setIsValid(false)
						// 첫 번째 에러 메시지 표시
						const firstError = errors[0]
						setError(
							`SQL Syntax Error (Line ${firstError.startLineNumber}, Col ${firstError.startColumn}): ${firstError.message}`,
						)
						setPreviews(null)
						setPreviewError("")
					}
					return
				}
			}

			// Monaco Editor가 없는 경우 fallback으로 기존 validateDDL 사용
			console.log("Monaco not available, using fallback validation")
			const isValidDDL = validateDDL(currentDdlContent)

			if (isValidDDL) {
				try {
					const parsed = parseDDL(currentDdlContent)
					setParsedDDL(parsed)
					setIsValid(true)
					setError("")

					vscode.postMessage({
						type: "validateDDLOnly",
						ddl: currentDdlContent,
						packageName: packageName,
					})
				} catch (parseError) {
					setParsedDDL(null)
					setIsValid(false)
					setError(parseError instanceof Error ? parseError.message : "DDL parsing failed")
					setPreviews(null)
				}
			} else {
				setParsedDDL(null)
				setIsValid(false)
				setError("Invalid DDL format")
				setPreviews(null)
				setPreviewError("")
			}
		} catch (err) {
			console.error("DDL parsing error:", err)
			setIsValid(false)
			setParsedDDL(null)
			setError(err instanceof Error ? err.message : "Parsing error")
			setPreviews(null)
			setPreviewError("")
		}
	}

	// DDL 내용 변경 시 기본 상태 처리 (빈 값 체크 및 미리보기 무효화)
	useEffect(() => {
		console.log("DDL content changed, length:", ddlContent.length)

		if (!ddlContent.trim()) {
			setIsValid(false)
			setParsedDDL(null)
			setError("")
			setPreviews(null)
			setPreviewError("")
			return
		}

		// DDL이 변경되면 기존 미리보기 및 에러 상태 초기화
		setPreviews(null)
		setPreviewError("")
		setError("") // 이전 에러 메시지 제거
		//setParsedDDL(null) // ddl 수정시 Package Name, Output Path 입력란이 사라지는 문제 해결
		// ↑ 이 useEffect에서 `parsedDDL = null`로 설정하고(이 때 입력란이 사라짐) 비동기로 처리하는 중에,
		// Monaco Worker 검증이 완료되어 validateDDLWithMonaco(currentContent)가 실행되어 `isValid = true`, `parsedDDL = (새로운 파싱 결과)` 설정이 되는데,
		// 계속 여기서 setParsedDDL(null)로 설정한 결과가 유지되어 두 입력란이 사라진 상태가 유지되는 문제 발생.

		// Monaco가 초기화되지 않은 경우에만 fallback 검증 (초기 로드 시)
		if (!editorRef.current || !monacoRef.current) {
			console.log("Monaco not ready yet, will validate on mount")
		}
	}, [ddlContent])

	// 자동 미리보기 업데이트 (DDL이 유효하고 자동 업데이트가 활성화된 경우)
	useEffect(() => {
		if (isValid && ddlContent.trim() && autoUpdatePreview && !previews) {
			console.log("Auto-updating preview due to DDL change...")
			handleRequestPreview()
		}
	}, [isValid, ddlContent, autoUpdatePreview, previews])

	// packageName 변경 시 프리뷰 업데이트
	useEffect(() => {
		if (isValid && ddlContent.trim() && autoUpdatePreview && previews && packageName.trim()) {
			// 자동 업데이트가 켜져있고, 유효한 DDL이 있고, 이미 프리뷰가 생성된 상태일 때만
			console.log("Auto-updating preview due to packageName change...")
			handleRequestPreview()
		} else if (!autoUpdatePreview) {
			// 자동 업데이트가 꺼져있을 때만 프리뷰 초기화
			setPreviews(null)
			setPreviewError("")
		}
	}, [packageName])

	// 컴포넌트 언마운트 시 디바운스 타이머 정리
	useEffect(() => {
		return () => {
			if (ddlValidationTimeoutRef.current) {
				clearTimeout(ddlValidationTimeoutRef.current)
			}
		}
	}, [])

	// 컴포넌트 마운트 시 초기 테마 요청 (VSCode 익스텐션으로부터 메시지 수신)
	useEffect(() => {
		console.log("Setting up message listener...")

		// Request current workspace path when component mounts
		try {
			vscode.postMessage({ type: "getWorkspacePath" })
			vscode.postMessage({ type: "getSampleDDLs" })
			vscode.postMessage({ type: "getCurrentTheme" })
			vscode.postMessage({ type: "getEgovSettings" })
		} catch (err) {
			console.error("Error sending message:", err)
		}

		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			console.log("Received message from extension:", message)
			setIsLoading(false)

			if (message && typeof message === "object" && "type" in message) {
				switch (message.type) {
					case "error":
						console.error("Extension error:", message.message)
						setError(message.message || "Unknown error occurred")
						break
					case "success":
						console.log("Extension success:", message.message)
						setError("")
						break
					case "sampleDDLs":
						const sampleList = message.data as Extract<ExtensionResponse, { type: "sampleDDLs" }>["data"]
						setSampleDDLs(sampleList || {})
						// default가 true인 샘플 찾기
						// const defaultSample = sampleList ? Object.values(sampleList).find(sample => sample.default) : null
						// setDdlContent(defaultSample?.ddl || "")
						break
					case "selectedOutputPath":
						if (message.text) {
							setOutputPath(message.text)
							setValidationErrors([]) // Clear validation errors
						}
						break
					case "currentWorkspacePath":
						if (message.text) {
							setOutputPath(message.text)
						}
						break
					case "transferDDLToCodeView":
						console.log("[CodeView] Received transferDDLToCodeView message:", message)
						if (message.ddl) {
							console.log("[CodeView] Setting DDL content:", message.ddl)
							setDdlContent(message.ddl)
							setError("")
							// Show a temporary success message
							setTimeout(() => {
								console.log("[CodeView] Showing success message")
								setError("✅ DDL successfully imported from chat!")
								setTimeout(() => {
									console.log("[CodeView] Clearing success message")
									setError("")
								}, 3000)
							}, 100)
						} else {
							console.warn("[CodeView] transferDDLToCodeView message has no DDL")
						}
						break
					case "validationResult":
						console.log("[CodeView] Received validationResult message:", message)
						setIsPreviewLoading(false)
						if (message.isValid) {
							setIsValid(true)
							if (message.previews) {
								setPreviews(message.previews)
								setPreviewLanguages(message.languages || null)
								setPreviewError("")
							}
							if (message.error && message.error.includes("⚠️ 경고:")) {
								setError(message.error)
							} else {
								setError("")
							}
						} else {
							setIsValid(false)
							setPreviews(null)
							if (message.error) {
								setPreviewError(message.error)
							}
						}
						break

					case "currentTheme":
						console.log("Received initial theme: ", message.theme)
						setMonacoTheme(message.theme || "vs-dark")
						break

					case "themeChanged":
						console.log("Monaco theme changed to: ", message.theme, "(before: " + monacoTheme + ")")
						setMonacoTheme(message.theme || "vs-dark")
						break

					case "egovSettings":
						if (message.settings && message.settings.defaultPackageName) {
							console.log("Received egovSettings, setting packageName to:", message.settings.defaultPackageName)
							setDefaultPackageName(message.settings.defaultPackageName)
							setPackageName(message.settings.defaultPackageName)
							setValidationErrors([]) // Clear validation errors
						}
						break

					default:
						console.log("Unhandled message type:", message.type)
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => {
			console.log("Cleaning up message listener...")
			window.removeEventListener("message", handleMessage)
		}
	}, [])

	const handleGenerateCode = () => {
		console.log("Generate code clicked")
		if (!isValid || !ddlContent.trim()) {
			return
		}

		// Validate configuration using validateCodeConfig
		const configValidation = validateCodeConfig({
			packageName: packageName.trim(),
			outputPath: outputPath.trim(),
		})

		if (configValidation.length > 0) {
			setValidationErrors(configValidation)
			return
		}

		setIsLoading(true)
		setValidationErrors([])
		setError("")
		try {
			vscode.postMessage({
				type: "generateCode",
				ddl: ddlContent,
				packageName: packageName.trim(),
				outputPath: outputPath.trim(),
			})
		} catch (err) {
			console.error("Error sending generateCode message:", err)
			setError("Failed to send message to extension")
			setIsLoading(false)
		}
	}

	const handleUploadTemplates = () => {
		console.log("Upload templates clicked")
		if (!isValid || !ddlContent.trim()) {
			return
		}

		setIsLoading(true)
		setValidationErrors([])
		setError("")
		try {
			vscode.postMessage({
				type: "uploadTemplates",
				ddl: ddlContent,
				packageName: packageName,
			})
		} catch (err) {
			console.error("Error sending uploadTemplates message:", err)
			setError("Failed to send message to extension")
			setIsLoading(false)
		}
	}

	const handleDownloadTemplateContext = () => {
		console.log("Download template context clicked")
		try {
			// State의 parsedDDL을 사용하지 않고 현재 DDL을 직접 파싱
			// (React state 업데이트는 비동기이므로 최신 상태가 아닐 수 있음)
			if (!isValid || !ddlContent.trim()) {
				setError("Please enter a valid DDL statement first")
				return
			}

			// 현재 DDL 내용을 직접 파싱
			const currentParsedDDL = parseDDL(ddlContent)
			const context = getTemplateContext(
				currentParsedDDL.tableName,
				currentParsedDDL.attributes,
				currentParsedDDL.pkAttributes,
				packageName,
				currentParsedDDL.dbTableName,
			)
			vscode.postMessage({
				type: "downloadTemplateContext",
				ddl: ddlContent,
				context: context,
			})
		} catch (err) {
			console.error("Error in downloadTemplateContext:", err)
			setError(err instanceof Error ? err.message : "Context generation error")
		}
	}

	const handleSelectOutputPath = () => {
		console.log("Select output path clicked")
		console.log("vscode object:", typeof vscode, vscode)

		try {
			if (typeof vscode === "undefined") {
				console.error("vscode object is undefined")
				setError("VSCode API not available")
				return
			}

			if (typeof vscode.postMessage !== "function") {
				console.error("vscode.postMessage is not a function")
				setError("VSCode postMessage not available")
				return
			}

			const message = createSelectOutputPathMessage()
			console.log("Sending message:", message)
			vscode.postMessage(message)
		} catch (err) {
			console.error("Error sending selectOutputPath message:", err)
			setError(`Failed to send message to extension: ${err instanceof Error ? err.message : String(err)}`)
		}
	}

	const handleResetToDefaultPackageName = () => {
		console.log("Reset to default package name clicked")
		if (defaultPackageName) {
			setPackageName(defaultPackageName)
			setValidationErrors([])
		}
	}

	// 미리보기 요청 함수
	const handleRequestPreview = () => {
		if (!isValid || !ddlContent.trim()) {
			return
		}

		setIsPreviewLoading(true)
		setPreviewError("")
		vscode.postMessage({
			type: "validateAndPreview",
			ddl: ddlContent,
			packageName: packageName,
		})
	}

	// 샘플 DDL 선택 함수 (SQL dialect와 독립적)
	const handleSampleDDLChange = (sampleKey: string) => {
		setSelectedSampleKey(sampleKey)

		if (sampleKey === "") {
			// "직접 입력" 선택 시 DDL 내용을 빈 문자열로 설정
			setDdlContent("")
			// 기존 미리보기 무효화
			setPreviews(null)
			setPreviewError("")
		} else if (sampleKey && sampleDDLs?.[sampleKey]) {
			const selectedSample = sampleDDLs[sampleKey]

			// 샘플 DDL만 로드 (SQL dialect는 변경하지 않음)
			setDdlContent(selectedSample.ddl)
			// 기존 미리보기 무효화
			setPreviews(null)
			setPreviewError("")

			// Monaco Worker가 검증을 완료할 때까지 짧은 지연 후 검증 실행
			setTimeout(() => {
				if (editorRef.current && monacoRef.current) {
					validateDDLWithMonaco(selectedSample.ddl)
				}
			}, 150)
		}
	}

	console.log("CodeView rendering with state:", {
		ddlContentLength: ddlContent.length,
		isValid,
		parsedDDL: !!parsedDDL,
		error,
		outputPath,
		packageName,
	})

	try {
		return (
			<div style={{ padding: "16px 20px" }}>
				<div
					style={{
						color: "var(--vscode-foreground)",
						fontSize: "13px",
						marginBottom: "16px",
						marginTop: "5px",
					}}>
					<h3 style={{ color: "var(--vscode-foreground)", marginTop: 0, marginBottom: "8px" }}>{t("code.title")}</h3>
					<p
						style={{
							fontSize: "12px",
							color: "var(--vscode-descriptionForeground)",
							margin: 0,
							marginTop: "5px",
						}}>
						{t("code.description")}{" "}
						<Link
							href="https://github.com/eGovFramework/egovframe-vscode-initializr"
							style={{ display: "inline", fontSize: "12px" }}>
							GitHub
						</Link>
					</p>
				</div>

				{/* DDL Input Section */}
				<div style={{ marginBottom: "20px" }}>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: "10px",
						}}>
						{/* 왼쪽: DDL Input 제목, SQL 방언 선택, 검증 상태 */}
						<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
							<h4 style={{ color: "var(--vscode-foreground)", margin: 0 }}>{t("code.ddlInput")}</h4>

							{/* SQL 방언 선택 */}
							<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
								<select
									id="sql-dialect-select"
									value={sqlDialect}
									onChange={(e) => {
										setSqlDialect(e.target.value as "mysql" | "pgsql" | "generic")
										setSelectedSampleKey("")
									}}
									style={{
										padding: "3px 6px",
										fontSize: "12px",
										backgroundColor: "var(--vscode-input-background)",
										color: "var(--vscode-input-foreground)",
										border: "1px solid var(--vscode-dropdown-border)",
										borderRadius: "3px",
										outline: "none",
										cursor: "pointer",
									}}
									onFocus={(e) => {
										e.target.style.border = "1px solid var(--vscode-focusBorder)"
									}}
									onBlur={(e) => {
										e.target.style.border = "1px solid var(--vscode-dropdown-border)"
									}}>
									<option value="mysql">MySQL</option>
									<option value="pgsql">PostgreSQL</option>
									<option value="generic">Generic</option>
								</select>
							</div>

							{/* 검증 상태 표시 */}
							{ddlContent.trim() && (
								<div
									style={{
										fontSize: "11px",
										fontWeight: "600",
										padding: "2px 8px",
										borderRadius: "3px",
										backgroundColor: isValid
											? "var(--vscode-testing-iconPassed)"
											: "var(--vscode-testing-iconFailed)",
										color: "white",
									}}>
									{isValid ? t("code.valid") : t("code.invalid")}
								</div>
							)}
						</div>

						{/* 오른쪽: 샘플 DDL 선택 */}
						<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<label
								htmlFor="sample-ddl-select"
								style={{
									fontSize: "12px",
									color: "var(--vscode-foreground)",
									userSelect: "none",
								}}>
								{t("code.sample")}:
							</label>
							<select
								id="sample-ddl-select"
								value={selectedSampleKey}
								onChange={(e) => handleSampleDDLChange(e.target.value)}
								style={{
									padding: "4px 8px",
									fontSize: "12px",
									backgroundColor: "var(--vscode-input-background)",
									color: "var(--vscode-input-foreground)",
									border: "1px solid var(--vscode-dropdown-border)",
									borderRadius: "4px",
									outline: "none",
									cursor: "pointer",
								}}
								onFocus={(e) => {
									e.target.style.border = "1px solid var(--vscode-focusBorder)"
								}}
								onBlur={(e) => {
									e.target.style.border = "1px solid var(--vscode-dropdown-border)"
								}}>
								<option value="">{t("code.enterDirectly")}</option>
								{sqlDialect !== "generic" &&
									sampleDDLs &&
									Object.entries(sampleDDLs)
										.filter(([key, sample]) => sample.dialect === sqlDialect)
										.map(([key, sample]) => (
											<option key={key} value={key}>
												{sample.name}
											</option>
										))}
							</select>
						</div>
					</div>
					{/*
				<textarea
					rows={15}
					style={{
						width: "calc(100% - 24px)",
						padding: "12px",
						fontFamily: "monospace",
						backgroundColor: "var(--vscode-input-background)",
						color: "var(--vscode-input-foreground)",
						border: `1px solid ${error ? "var(--vscode-errorBorder)" : "var(--vscode-dropdown-border)"}`,
						borderRadius: "4px",
						fontSize: "13px",
						resize: "vertical",
						outline: "none",
						minHeight: "200px",
					}}
					onFocus={(e) => {
						e.target.style.border = "1px solid var(--vscode-focusBorder)"
					}}
					onBlur={(e) => {
						e.target.style.border = "1px solid " + (error ? "var(--vscode-errorBorder)" : "var(--vscode-dropdown-border)")
					}}
					placeholder="Enter your DDL statements here..."
					value={ddlContent}
					onChange={(e: any) => setDdlContent(e.target.value)}
				/>
				*/}
					<div
						style={{
							border: `1px solid var(${error ? "--vscode-errorBorder" : isEditorFocused ? "--vscode-focusBorder" : "--vscode-settings-textInputBorder"})`,
							borderRadius: "4px",
							overflow: "hidden",
							transition: "border-color 0.1s",
						}}>
						<Editor // Monaco Editor -> SQL Syntax Highlighting with monaco-sql-languages
							height="300px"
							language={sqlDialect === "generic" ? "sql" : sqlDialect} // Use selected SQL dialect (mysql, pgsql, or generic sql)
							theme={monacoTheme} // 동적 테마 적용
							value={ddlContent}
							onChange={(value) => setDdlContent(value || "")}
							onMount={(editor, monacoInstance) => {
								// Editor와 Monaco 인스턴스 저장
								editorRef.current = editor
								monacoRef.current = monacoInstance

								// 포커스 이벤트 리스너
								editor.onDidFocusEditorText(() => setIsEditorFocused(true))
								editor.onDidBlurEditorText(() => setIsEditorFocused(false))

								// 실시간 검증: 모델 내용이 변경될 때마다 디바운스 후 검증 (테이블 이름 변경 등 모든 변경사항 감지)
								editor.onDidChangeModelContent(() => {
									const model = editor.getModel()
									if (model) {
										const currentContent = model.getValue()
										console.log("Model content changed, validating DDL...")

										// 디바운스 처리: 타이핑 중에는 0.5초 대기 후 검증
										if (ddlValidationTimeoutRef.current) {
											clearTimeout(ddlValidationTimeoutRef.current)
										}

										if (currentContent.trim()) {
											ddlValidationTimeoutRef.current = setTimeout(() => {
												validateDDLWithMonaco(currentContent)
											}, 500)
										} else {
											// 내용이 비어있으면 즉시 초기화
											setParsedDDL(null)
											setIsValid(false)
											setError("")
											setPreviews(null)
											setPreviewError("")
										}
									}
								})

								// 언어 변경 시 즉시 재검증 (SQL 방언 변경: MySQL ↔ PostgreSQL)
								editor.onDidChangeModelLanguage((e) => {
									const model = editor.getModel()
									if (model) {
										const currentContent = model.getValue()
										console.log(`Language changed to ${e.newLanguage}, re-validating DDL...`)

										// 언어 변경은 즉시 검증 (디바운스 없음)
										// 기존 디바운스 타이머가 있다면 취소
										if (ddlValidationTimeoutRef.current) {
											clearTimeout(ddlValidationTimeoutRef.current)
											ddlValidationTimeoutRef.current = null
										}

										if (currentContent.trim()) {
											// 새로운 SQL Worker가 적용되므로 즉시 검증
											validateDDLWithMonaco(currentContent)
										}
									}
								})

								// 실시간 검증: Monaco Worker가 마커(에러 내용)를 업데이트할 때마다 즉시 검증
								monacoInstance.editor.onDidChangeMarkers((uris) => {
									const model = editor.getModel()
									if (model && uris.some((uri) => uri.toString() === model.uri.toString())) {
										// Worker 완료 즉시 검증 실행 (딜레이 없음)
										console.log("Markers changed, validating DDL...")
										const currentContent = model.getValue()
										if (currentContent.trim()) {
											validateDDLWithMonaco(currentContent)
										}
									}
								})

								// 초기 마운트 시에도 검증 실행
								if (ddlContent.trim()) {
									console.log("Initial validation on mount")
									// Worker가 초기 분석을 완료할 때까지 짧은 지연
									setTimeout(() => validateDDLWithMonaco(ddlContent), 100)
								}
							}}
							options={{
								minimap: { enabled: false },
								scrollBeyondLastLine: false,
								fontSize: 13,
								fontFamily: "monospace",
								wordWrap: "on",
								folding: false,
								automaticLayout: true,
								lineNumbers: "on",
								lineNumbersMinChars: 2,
								glyphMargin: false,
								renderWhitespace: "selection",
								tabSize: 2,
								suggest: {
									showKeywords: true,
									showSnippets: true,
								},
							}}
						/>
					</div>
					{error && (
						<div
							style={{
								color: "var(--vscode-errorForeground)",
								fontSize: "12px",
								marginTop: "5px",
							}}>
							{error}
						</div>
					)}
					{sqlDialect === "generic" && (
						<div style={{ fontSize: "12px", color: "var(--vscode-foreground)", marginTop: "5px" }}>
							{t("code.genericSqlNotice")}
						</div>
					)}
				</div>

				{/* ERD Preview */}
				<ErdDiagram model={erdModel} />

				{/* Parsed DDL Preview */}
				{parsedDDL && (
					<div style={{ marginBottom: "20px" }}>
						<h4 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>
							{t("code.parsedTable")}: {parsedDDL.tableName}
						</h4>
						<div
							style={{
								backgroundColor: "var(--vscode-editor-inactiveSelectionBackground)",
								padding: "10px",
								borderRadius: "4px",
								fontSize: "12px",
							}}>
							<div style={{ marginBottom: "8px" }}>
								<strong>{t("code.columns", { count: parsedDDL.attributes.length })}:</strong>
							</div>
							{parsedDDL.attributes.map((col, index) => (
								<div key={index} style={{ marginLeft: "10px", marginBottom: "2px" }}>
									{col.columnName} ({col.dataType}) → {col.ccName} ({col.javaType})
									{col.isPrimaryKey && (
										<span style={{ color: "var(--vscode-terminal-ansiYellow)" }}> [PK]</span>
									)}
								</div>
							))}
						</div>
					</div>
				)}

				{/* Code Preview */}
				<CodePreview
					previews={previews}
					selectedTemplate={selectedPreviewTemplate}
					onTemplateChange={setSelectedPreviewTemplate}
					isLoading={isPreviewLoading}
					error={previewError}
					packageName={packageName}
					onRequestPreview={handleRequestPreview}
					isValid={isValid}
					autoUpdatePreview={autoUpdatePreview}
					onAutoUpdateChange={setAutoUpdatePreview}
					monacoTheme={monacoTheme}
					languages={previewLanguages || null}
				/>

				{/* Configuration Section */}
				{isValid && parsedDDL && (
					<div style={{ marginBottom: "20px" }}>
						<h4 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>{t("code.configuration")}</h4>

						{/* Package Name */}
						<div style={{ marginBottom: "15px" }}>
							<div style={{ display: "flex", gap: "10px", alignItems: "end" }}>
								<div style={{ flex: 1, marginRight: "10px" }}>
									<TextField
										label={t("code.packageName")}
										value={packageName}
										onChange={(e: any) => {
											setPackageName(e.target.value)
											setValidationErrors([]) // Clear validation errors
										}}
										placeholder="e.g., com.example.project"
										isRequired
									/>
								</div>
								<button
									style={{
										backgroundColor: "var(--vscode-button-secondaryBackground)",
										color: "var(--vscode-button-secondaryForeground)",
										border: "1px solid var(--vscode-button-border)",
										borderRadius: "4px",
										padding: "8px 12px",
										cursor: "pointer",
										display: "inline-flex",
										alignItems: "center",
										fontSize: "13px",
										fontFamily: "inherit",
										outline: "none",
									}}
									onMouseOver={(e) => {
										;(e.target as HTMLButtonElement).style.backgroundColor =
											"var(--vscode-button-secondaryHoverBackground)"
									}}
									onMouseOut={(e) => {
										;(e.target as HTMLButtonElement).style.backgroundColor =
											"var(--vscode-button-secondaryBackground)"
									}}
									onFocus={(e) => {
										;(e.target as HTMLButtonElement).style.outline = "1px solid var(--vscode-focusBorder)"
									}}
									onBlur={(e) => {
										;(e.target as HTMLButtonElement).style.outline = "none"
									}}
									onClick={handleResetToDefaultPackageName}>
									<span className="codicon codicon-settings-gear" style={{ marginRight: "6px" }}></span>
									{t("code.defaultButton")}
								</button>
							</div>
							<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
								{t("code.packageNameHint")}
							</div>
						</div>

						{/* Output Path */}
						<div style={{ marginBottom: "15px" }}>
							<div style={{ display: "flex", gap: "10px", alignItems: "end" }}>
								<div style={{ flex: 1, marginRight: "10px" }}>
									<TextField
										label={t("code.outputPath")}
										value={outputPath}
										onChange={(e: any) => {
											setOutputPath(e.target.value)
											setValidationErrors([]) // Clear validation errors
										}}
										placeholder="Select output directory"
										isRequired
									/>
								</div>
								<button
									style={{
										backgroundColor: "var(--vscode-button-secondaryBackground)",
										color: "var(--vscode-button-secondaryForeground)",
										border: "1px solid var(--vscode-button-border)",
										borderRadius: "4px",
										padding: "8px 12px",
										cursor: "pointer",
										display: "inline-flex",
										alignItems: "center",
										fontSize: "13px",
										fontFamily: "inherit",
										outline: "none",
									}}
									onMouseOver={(e) => {
										;(e.target as HTMLButtonElement).style.backgroundColor =
											"var(--vscode-button-secondaryHoverBackground)"
									}}
									onMouseOut={(e) => {
										;(e.target as HTMLButtonElement).style.backgroundColor =
											"var(--vscode-button-secondaryBackground)"
									}}
									onFocus={(e) => {
										;(e.target as HTMLButtonElement).style.outline = "1px solid var(--vscode-focusBorder)"
									}}
									onBlur={(e) => {
										;(e.target as HTMLButtonElement).style.outline = "none"
									}}
									onClick={handleSelectOutputPath}>
									<span className="codicon codicon-folder-opened" style={{ marginRight: "6px" }}></span>
									{t("common.browse")}
								</button>
							</div>
							<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
								{t("code.outputPathHint")} {outputPath || t("projects.notSelected")}
							</div>
						</div>
					</div>
				)}

				{/* Generation Options */}
				<div style={{ marginBottom: "20px" }}>
					<h4 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>{t("code.generateCode")}</h4>

					{/* Validation Errors */}
					{validationErrors.length > 0 && (
						<div style={{ marginBottom: "20px" }}>
							<div
								style={{
									backgroundColor: "var(--vscode-inputValidation-errorBackground)",
									border: "1px solid var(--vscode-inputValidation-errorBorder)",
									color: "var(--vscode-inputValidation-errorForeground)",
									padding: "10px",
									borderRadius: "3px",
								}}>
								<div style={{ fontWeight: "bold", marginBottom: "5px" }}>{t("projects.validationErrors")}</div>
								<ul style={{ margin: 0, paddingLeft: "20px" }}>
									{validationErrors.map((error, index) => (
										<li key={index} style={{ fontSize: "12px" }}>
											{error}
										</li>
									))}
								</ul>
							</div>
						</div>
					)}

					<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
						<button
							style={{
								width: "100%",
								backgroundColor: "var(--vscode-button-background)",
								color: "var(--vscode-button-foreground)",
								border: "1px solid var(--vscode-button-border)",
								borderRadius: "4px",
								padding: "12px 16px",
								cursor:
									!isValid || isLoading || !packageName.trim() || !outputPath.trim()
										? "not-allowed"
										: "pointer",
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								fontSize: "13px",
								fontFamily: "inherit",
								outline: "none",
								opacity: !isValid || isLoading || !packageName.trim() || !outputPath.trim() ? 0.5 : 1,
							}}
							onMouseOver={(e) => {
								if (!(!isValid || isLoading || !packageName.trim() || !outputPath.trim())) {
									;(e.target as HTMLButtonElement).style.backgroundColor =
										"var(--vscode-button-hoverBackground)"
								}
							}}
							onMouseOut={(e) => {
								if (!(!isValid || isLoading || !packageName.trim() || !outputPath.trim())) {
									;(e.target as HTMLButtonElement).style.backgroundColor = "var(--vscode-button-background)"
								}
							}}
							onFocus={(e) => {
								;(e.target as HTMLButtonElement).style.outline = "1px solid var(--vscode-focusBorder)"
							}}
							onBlur={(e) => {
								;(e.target as HTMLButtonElement).style.outline = "none"
							}}
							onClick={handleGenerateCode}
							disabled={!isValid || isLoading || !packageName.trim() || !outputPath.trim()}>
							{isLoading ? (
								<>
									<ProgressRing className="mr-2 w-4 h-4" />
									{t("common.generating")}
								</>
							) : (
								<>
									<span className="codicon codicon-gear" style={{ marginRight: "6px" }}></span>
									{t("code.generateCrudCode")}
								</>
							)}
						</button>

						<button
							style={{
								width: "100%",
								backgroundColor: "var(--vscode-button-secondaryBackground)",
								color: "var(--vscode-button-secondaryForeground)",
								border: "1px solid var(--vscode-button-border)",
								borderRadius: "4px",
								padding: "12px 16px",
								cursor: !isValid || isLoading ? "not-allowed" : "pointer",
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								fontSize: "13px",
								fontFamily: "inherit",
								outline: "none",
								opacity: !isValid || isLoading ? 0.5 : 1,
							}}
							onMouseOver={(e) => {
								if (!(!isValid || isLoading)) {
									;(e.target as HTMLButtonElement).style.backgroundColor =
										"var(--vscode-button-secondaryHoverBackground)"
								}
							}}
							onMouseOut={(e) => {
								if (!(!isValid || isLoading)) {
									;(e.target as HTMLButtonElement).style.backgroundColor =
										"var(--vscode-button-secondaryBackground)"
								}
							}}
							onFocus={(e) => {
								;(e.target as HTMLButtonElement).style.outline = "1px solid var(--vscode-focusBorder)"
							}}
							onBlur={(e) => {
								;(e.target as HTMLButtonElement).style.outline = "none"
							}}
							onClick={handleUploadTemplates}
							disabled={!isValid || isLoading}>
							<span className="codicon codicon-file-code" style={{ marginRight: "6px" }}></span>
							{t("code.generateWithCustomTemplates")}
						</button>

						<button
							style={{
								width: "100%",
								backgroundColor: "var(--vscode-button-secondaryBackground)",
								color: "var(--vscode-button-secondaryForeground)",
								border: "1px solid var(--vscode-button-border)",
								borderRadius: "4px",
								padding: "12px 16px",
								cursor: !isValid || isLoading ? "not-allowed" : "pointer",
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								fontSize: "13px",
								fontFamily: "inherit",
								outline: "none",
								opacity: !isValid || isLoading ? 0.5 : 1,
							}}
							onMouseOver={(e) => {
								if (!(!isValid || isLoading)) {
									;(e.target as HTMLButtonElement).style.backgroundColor =
										"var(--vscode-button-secondaryHoverBackground)"
								}
							}}
							onMouseOut={(e) => {
								if (!(!isValid || isLoading)) {
									;(e.target as HTMLButtonElement).style.backgroundColor =
										"var(--vscode-button-secondaryBackground)"
								}
							}}
							onFocus={(e) => {
								;(e.target as HTMLButtonElement).style.outline = "1px solid var(--vscode-focusBorder)"
							}}
							onBlur={(e) => {
								;(e.target as HTMLButtonElement).style.outline = "none"
							}}
							onClick={handleDownloadTemplateContext}
							disabled={!isValid || isLoading}>
							<span className="codicon codicon-json" style={{ marginRight: "6px" }}></span>
							{t("code.downloadTemplateContext")}
						</button>
					</div>

					<div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)", marginTop: "10px" }}>
						<div>
							• <strong>{t("code.generateCrudCode")}:</strong> {t("code.generateCrudCodeDesc")}
						</div>
						<div>
							• <strong>{t("code.generateWithCustomTemplates")}:</strong> {t("code.customTemplatesDesc")}
						</div>
						<div>
							• <strong>{t("code.downloadTemplateContext")}:</strong> {t("code.templateContextDesc")}
						</div>
					</div>
				</div>

				{/* Generated Code Types */}
				<div
					style={{
						backgroundColor: "var(--vscode-editor-inactiveSelectionBackground)",
						padding: "15px",
						borderRadius: "4px",
						marginTop: "20px",
					}}>
					<h4 style={{ color: "var(--vscode-foreground)", marginBottom: "10px", marginTop: 0 }}>
						{t("code.generatedCodeIncludes")}
					</h4>

					{/* Java Files */}
					<div style={{ marginBottom: "12px" }}>
						<strong style={{ fontSize: "13px", color: "var(--vscode-foreground)" }}>{t("code.javaFiles")}:</strong>
						<ul
							style={{
								fontSize: "12px",
								color: "var(--vscode-foreground)",
								margin: "5px 0 0 0",
								paddingLeft: "20px",
							}}>
							<li>
								<strong>VO (Value Object):</strong> {parsedDDL?.tableName || "Table"}VO.java, DefaultVO.java
							</li>
							<li>
								<strong>Service Layer:</strong> {parsedDDL?.tableName || "Table"}Service.java,{" "}
								{parsedDDL?.tableName || "Table"}ServiceImpl.java
							</li>
							<li>
								<strong>Controller:</strong> {parsedDDL?.tableName || "Table"}Controller.java
							</li>
							<li>
								<strong>Mapper Interface:</strong> {parsedDDL?.tableName || "Table"}Mapper.java
							</li>
						</ul>
					</div>

					{/* Configuration Files */}
					<div style={{ marginBottom: "12px" }}>
						<strong style={{ fontSize: "13px", color: "var(--vscode-foreground)" }}>{t("code.configFiles")}:</strong>
						<ul
							style={{
								fontSize: "12px",
								color: "var(--vscode-foreground)",
								margin: "5px 0 0 0",
								paddingLeft: "20px",
							}}>
							<li>
								<strong>MyBatis SQL Mapping:</strong> {parsedDDL?.tableName || "Table"}_SQL.xml
							</li>
						</ul>
					</div>

					{/* View Files */}
					<div style={{ marginBottom: "12px" }}>
						<strong style={{ fontSize: "13px", color: "var(--vscode-foreground)" }}>
							{t("code.viewTemplates")}:
						</strong>
						<ul
							style={{
								fontSize: "12px",
								color: "var(--vscode-foreground)",
								margin: "5px 0 0 0",
								paddingLeft: "20px",
							}}>
							<li>
								<strong>Thymeleaf Views:</strong> {parsedDDL?.tableName || "Table"}List.html,{" "}
								{parsedDDL?.tableName || "Table"}Regist.html
							</li>
							<li>
								<strong>JSP Views:</strong> {parsedDDL?.tableName || "Table"}List.jsp,{" "}
								{parsedDDL?.tableName || "Table"}Regist.jsp
							</li>
						</ul>
					</div>

					{/* Directory Structure */}
					{parsedDDL && (
						<div style={{ marginBottom: "12px" }}>
							<strong style={{ fontSize: "13px", color: "var(--vscode-foreground)" }}>
								{t("code.directoryStructure")}:
							</strong>
							<div
								style={{
									fontSize: "11px",
									color: "var(--vscode-descriptionForeground)",
									margin: "5px 0 0 0",
									paddingLeft: "10px",
									fontFamily: "monospace",
								}}>
								<div>src/main/java/{packageName.replace(/\./g, "/")}/</div>
								<div style={{ paddingLeft: "10px" }}>
									├── service/impl/ - <b>ServiceImpl & MapperInterface</b>
								</div>
								<div style={{ paddingLeft: "10px" }}>
									├── service/ - <b>Service & VOs</b>
								</div>
								<div style={{ paddingLeft: "10px" }}>
									└── web/ - <b>Controller</b>
								</div>
								<div>src/main/resources/</div>
								<div style={{ paddingLeft: "10px" }}>
									├── mapper/ - <b>MyBatis XML</b>
								</div>
								<div style={{ paddingLeft: "10px" }}>
									└── templates/thymeleaf/{parsedDDL?.tableName[0].toLowerCase()}
									{parsedDDL?.tableName.slice(1)}/ - <b>Thymeleaf</b>
								</div>
								<div>src/main/webapp/WEB-INF/jsp/</div>
								<div style={{ paddingLeft: "10px" }}>
									└── {packageName.replace(/\./g, "/")}/ - <b>JSP</b>
								</div>
							</div>
						</div>
					)}

					<div style={{ marginTop: "12px", fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>
						{t("code.handlebarsEngineDesc")}
					</div>
				</div>
			</div>
		)
	} catch (renderError) {
		console.error("CodeView render error:", renderError)
		return (
			<div style={{ padding: "20px", color: "var(--vscode-errorForeground)" }}>
				<h3>Error rendering CodeView</h3>
				<p>An error occurred while rendering the component:</p>
				<pre>{String(renderError)}</pre>
			</div>
		)
	}
}

export default CodeView
