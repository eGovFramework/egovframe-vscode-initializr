import React, { useEffect, useState } from "react"
import Editor from "@monaco-editor/react"
import { useTranslation } from "react-i18next"

// CSS 애니메이션 스타일
const spinAnimation = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`

interface CodePreviewProps {
	previews: { [key: string]: string } | null
	selectedTemplate: string
	onTemplateChange: (template: string) => void
	isLoading: boolean
	error: string
	packageName: string
	onRequestPreview?: () => void
	isValid: boolean
	autoUpdatePreview?: boolean
	onAutoUpdateChange?: (enabled: boolean) => void
	monacoTheme?: "light" | "vs-dark"
	languages?: { [key: string]: string } | null
}

const CodePreview: React.FC<CodePreviewProps> = ({
	previews,
	selectedTemplate,
	onTemplateChange, //= setSelectedPreviewTemplate
	isLoading,
	error,
	packageName,
	onRequestPreview, //= handleRequestPreview
	isValid,
	autoUpdatePreview,
	onAutoUpdateChange, //= setAutoUpdatePreview
	monacoTheme,
	languages,
}) => {
	const { t } = useTranslation()
	// 미리보기 가시성 상태 (자동 업데이트가 켜져 있으면 기본 표시)
	const [isPreviewVisible, setIsPreviewVisible] = useState<boolean>(!!autoUpdatePreview)
	// Monaco Editor 포커스 상태
	const [isEditorFocused, setIsEditorFocused] = useState(false)

	// 자동 업데이트가 켜질 때는 항상 표시로 전환 (끄는 경우는 사용자 선택 유지)
	useEffect(() => {
		if (autoUpdatePreview) {
			setIsPreviewVisible(true)
		}
	}, [autoUpdatePreview])
	const templateOptions = [
		{ value: "vo", label: "VO Class" },
		{ value: "defaultVo", label: "Default VO Class" },
		{ value: "controller", label: "Controller Class" },
		{ value: "service", label: "Service Interface" },
		{ value: "serviceImpl", label: "ServiceImpl Class" },
		{ value: "mapperInterface", label: "Mapper Interface" },
		{ value: "mapper", label: "MyBatis Mapper XML" },
		{ value: "thymeleafList", label: "Thymeleaf List Page" },
		{ value: "thymeleafRegister", label: "Thymeleaf Register Page" },
		{ value: "jspList", label: "JSP List Page" },
		{ value: "jspRegister", label: "JSP Register Page" },
	]

	// 현재 미리보기 설정
	const currentPreview = (previews && previews[selectedTemplate]) || ""

	// 현재 미리보기의 언어 설정 : 서버에서 전달된 languages를 그대로 사용 (없으면 plaintext)
	const currentLanguage = (languages && languages[selectedTemplate]) || "plaintext"

	// 미리보기가 없고 유효한 DDL이 있는 경우 미리보기 요청 버튼 표시
	if (!previews && isValid) {
		return (
			<>
				<style>{spinAnimation}</style>
				<div
					style={{
						backgroundColor: "var(--vscode-editor-inactiveSelectionBackground)",
						padding: "15px",
						borderRadius: "4px",
						marginBottom: "20px",
					}}>
					<div style={{ marginBottom: "10px" }}>
						<h4 style={{ color: "var(--vscode-foreground)", marginBottom: "10px", marginTop: 0 }}>
							{t("code.previewTemplates")}
						</h4>

						{/* 자동 업데이트 옵션 */}
						{onAutoUpdateChange && (
							<div
								style={{
									marginBottom: "15px",
									display: "flex",
									alignItems: "center",
									gap: "8px",
								}}>
								<input
									type="checkbox"
									id="autoUpdatePreview"
									checked={autoUpdatePreview || false}
									onChange={(e) => onAutoUpdateChange(e.target.checked)}
									style={{
										margin: 0,
										cursor: "pointer",
									}}
								/>
								<label
									htmlFor="autoUpdatePreview"
									style={{
										fontSize: "12px",
										color: "var(--vscode-foreground)",
										cursor: "pointer",
										userSelect: "none",
									}}>
									{t("code.alwaysOpenPreview")}
								</label>
							</div>
						)}

						{/* 미리보기 열기 버튼 */}
						<button
							onClick={() => {
								setIsPreviewVisible(true)
								if (onRequestPreview) {
									onRequestPreview()
								}
							}}
							style={{
								backgroundColor: "var(--vscode-button-background)",
								color: "var(--vscode-button-foreground)",
								border: "1px solid var(--vscode-button-border)",
								borderRadius: "4px",
								padding: "8px 16px",
								cursor: "pointer",
								fontSize: "13px",
								outline: "none",
							}}
							onMouseOver={(e) => {
								;(e.target as HTMLButtonElement).style.backgroundColor = "var(--vscode-button-hoverBackground)"
							}}
							onMouseOut={(e) => {
								;(e.target as HTMLButtonElement).style.backgroundColor = "var(--vscode-button-background)"
							}}>
							{t("code.openPreview")}
						</button>
					</div>
				</div>
			</>
		)
	}

	if (!previews) {
		return null
	}

	return (
		<>
			<style>{spinAnimation}</style>
			<div
				style={{
					backgroundColor: "var(--vscode-editor-inactiveSelectionBackground)",
					padding: "15px",
					borderRadius: "4px",
					marginBottom: "20px",
				}}>
				<div style={{ marginBottom: "10px" }}>
					<h4 style={{ color: "var(--vscode-foreground)", marginBottom: "10px", marginTop: 0 }}>
						{t("code.previewTemplates")}
						{packageName && (
							<span
								style={{
									fontSize: "12px",
									color: "var(--vscode-descriptionForeground)",
									marginLeft: "10px",
									fontWeight: "normal",
								}}>
								{t("code.previewPackageName", { packageName })}
							</span>
						)}
					</h4>

					{/* 자동 업데이트 옵션 - 항상 표시 */}
					{onAutoUpdateChange && (
						<div
							style={{
								marginBottom: "10px",
								display: "flex",
								alignItems: "center",
								gap: "8px",
							}}>
							<input
								type="checkbox"
								id="autoUpdatePreview_always"
								checked={autoUpdatePreview || false}
								onChange={(e) => onAutoUpdateChange(e.target.checked)}
								style={{
									margin: 0,
									cursor: "pointer",
								}}
							/>
							<label
								htmlFor="autoUpdatePreview_always"
								style={{
									fontSize: "12px",
									color: "var(--vscode-foreground)",
									cursor: "pointer",
									userSelect: "none",
								}}>
								{t("code.alwaysOpenPreview")}
							</label>
						</div>
					)}

					{/* 자동 업데이트 미사용 시 열기/닫기 토글 버튼 */}
					{!autoUpdatePreview && (
						<div style={{ marginBottom: "10px" }}>
							{isPreviewVisible ? (
								<button
									style={{
										backgroundColor: "var(--vscode-button-secondaryBackground)",
										color: "var(--vscode-button-secondaryForeground)",
										border: "1px solid var(--vscode-button-border)",
										borderRadius: "4px",
										padding: "6px 12px",
										cursor: "pointer",
										fontSize: "12px",
										outline: "none",
									}}
									onClick={() => setIsPreviewVisible(false)}
									onMouseOver={(e) => {
										;(e.target as HTMLButtonElement).style.backgroundColor =
											"var(--vscode-button-secondaryHoverBackground)"
									}}
									onMouseOut={(e) => {
										;(e.target as HTMLButtonElement).style.backgroundColor =
											"var(--vscode-button-secondaryBackground)"
									}}>
									{t("code.closePreview")}
								</button>
							) : (
								<button
									style={{
										backgroundColor: "var(--vscode-button-background)",
										color: "var(--vscode-button-foreground)",
										border: "1px solid var(--vscode-button-border)",
										borderRadius: "4px",
										padding: "6px 12px",
										cursor: "pointer",
										fontSize: "12px",
										outline: "none",
									}}
									onClick={() => {
										setIsPreviewVisible(true)
										// 미리보기 데이터가 없거나 로딩 상태가 아니라면 새로 요청
										if (!previews && onRequestPreview) {
											onRequestPreview()
										}
									}}
									onMouseOver={(e) => {
										;(e.target as HTMLButtonElement).style.backgroundColor =
											"var(--vscode-button-hoverBackground)"
									}}
									onMouseOut={(e) => {
										;(e.target as HTMLButtonElement).style.backgroundColor = "var(--vscode-button-background)"
									}}>
									{t("code.openPreview")}
								</button>
							)}
						</div>
					)}

					{/* 미리보기 템플릿 선택 드롭다운 */}
					{isPreviewVisible && (
						<select
							value={selectedTemplate}
							onChange={(e) => onTemplateChange(e.target.value)}
							style={{
								width: "100%",
								padding: "8px 12px",
								backgroundColor: "var(--vscode-input-background)",
								color: "var(--vscode-input-foreground)",
								border: "1px solid var(--vscode-dropdown-border)",
								borderRadius: "4px",
								fontSize: "13px",
								outline: "none",
							}}
							onFocus={(e) => {
								e.target.style.border = "1px solid var(--vscode-focusBorder)"
							}}
							onBlur={(e) => {
								e.target.style.border = "1px solid var(--vscode-dropdown-border)"
							}}>
							{templateOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					)}
				</div>

				{isLoading && (
					<div
						style={{
							textAlign: "center",
							padding: "20px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						<div
							style={{
								display: "inline-block",
								width: "20px",
								height: "20px",
								border: "2px solid var(--vscode-descriptionForeground)",
								borderTop: "2px solid transparent",
								borderRadius: "50%",
								animation: "spin 1s linear infinite",
							}}></div>
						<div style={{ marginTop: "10px" }}>{t("code.generatingPreview")}</div>
					</div>
				)}

				{error && (
					<div
						style={{
							color: "var(--vscode-errorForeground)",
							fontSize: "12px",
							padding: "10px",
							backgroundColor: "var(--vscode-inputValidation-errorBackground)",
							border: "1px solid var(--vscode-errorBorder)",
							borderRadius: "4px",
							marginBottom: "10px",
						}}>
						{error}
					</div>
				)}

				{isPreviewVisible && !isLoading && currentPreview && (
					<div
						style={{
							backgroundColor: "var(--vscode-editor-background)",
							border: `1px solid var(${isEditorFocused ? "--vscode-focusBorder" : "--vscode-settings-textInputBorder"})`,
							borderRadius: "4px",
							overflow: "hidden",
							transition: "border-color 0.1s",
						}}>
						<Editor
							height="400px"
							language={currentLanguage}
							theme={monacoTheme || "vs-dark"}
							value={currentPreview}
							onMount={(editor) => {
								editor.onDidFocusEditorText(() => setIsEditorFocused(true))
								editor.onDidBlurEditorText(() => setIsEditorFocused(false))
							}}
							options={{
								readOnly: true,
								minimap: { enabled: false },
								scrollBeyondLastLine: false,
								wordWrap: "on",
								fontSize: 12,
								fontFamily: "Consolas, Monaco, 'Courier New', monospace",
								lineNumbers: "off",
								glyphMargin: false,
								folding: true,
								automaticLayout: true,
							}}
						/>
					</div>
				)}
			</div>
		</>
	)
}

export default CodePreview
