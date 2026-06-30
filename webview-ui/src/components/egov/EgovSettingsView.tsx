import { memo, useState, useEffect } from "react"
import { Button, TextField, useVSCodeTheme, ResponsiveMenuButton, LanguageSelector } from "../ui"
import { vscode } from "../../utils/vscode"
import { validateEgovSettings } from "../../utils/settingsUtils"
import i18n, { changeLanguage } from "../../i18n"
import { useTranslation } from "react-i18next"

interface EgovSettingsViewProps {
	onDone: () => void
}

type SettingsTab = "vscode-settings" | "about"

interface EgovSettings {
	defaultGroupId: string
	defaultArtifactId: string
	defaultPackageName: string
}

interface ExtensionInfo {
	displayName: string
	version: string
	description: string
	repository: string
	homepage: string
	author: string
	license: string
}

// 동작 흐름
// eGovFrame 버튼 클릭 → egovframe.egovButtonClicked 커맨드 실행
// Extension에서 웹뷰로 메시지 전송 → { type: "action", action: "egovButtonClicked" }
// ExtensionStateContext에서 메시지 수신 → showEgovSettingsScreen() 함수 실행
// EgovSettingsView 화면 표시 → eGovFrame 설정 화면과 Done 버튼 표시
// Done 버튼 클릭 → hideEgovSettingsScreen() 함수 실행
// 기존 EgovView 화면 복원 → 원래의 탭 화면으로 돌아감

const EgovSettingsView = memo(({ onDone }: EgovSettingsViewProps) => {
	const { t } = useTranslation()
	const theme = useVSCodeTheme()
	const [activeTab, setActiveTab] = useState<SettingsTab>("vscode-settings")
	const [settings, setSettings] = useState<EgovSettings>({
		defaultGroupId: "",
		defaultArtifactId: "",
		defaultPackageName: "",
	})
	const [extensionInfo, setExtensionInfo] = useState<ExtensionInfo | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isCompact, setIsCompact] = useState(false)
	const [saveStatus, setSaveStatus] = useState<{
		isSaving: boolean
		message: string
		type: "success" | "error" | null
	}>({
		isSaving: false,
		message: "",
		type: null,
	})
	const [validationErrors, setValidationErrors] = useState<string[]>([])
	const [pendingLanguage, setPendingLanguage] = useState<string>(() => i18n.language)

	// 화면 크기 감지 및 컴팩트 모드 설정
	useEffect(() => {
		const handleResize = () => {
			// 전체 컨테이너 넓이가 600px 이하일 때 컴팩트 모드 활성화
			const shouldBeCompact = window.innerWidth < 600
			setIsCompact(shouldBeCompact)
		}

		window.addEventListener("resize", handleResize)
		handleResize() // 초기 실행

		return () => window.removeEventListener("resize", handleResize)
	}, [])

	// 설정 및 확장 정보 불러오기
	useEffect(() => {
		let settingsLoaded = false
		let extensionInfoLoaded = false

		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "egovSettings") {
				setSettings(message.settings)
				if (message.settings.language) {
					setPendingLanguage(message.settings.language)
				}
				settingsLoaded = true
				if (extensionInfoLoaded) {
					setIsLoading(false)
				}
			}
			if (message.type === "extensionInfo") {
				setExtensionInfo(message.info)
				extensionInfoLoaded = true
				if (settingsLoaded) {
					setIsLoading(false)
				}
			}
			if (message.type === "success") {
				setSaveStatus({
					isSaving: false,
					message: message.message || t("common.settingsSaved"),
					type: "success",
				})
				// 3초 후 메시지 숨기기
				setTimeout(() => {
					setSaveStatus({
						isSaving: false,
						message: "",
						type: null,
					})
				}, 3000)
			}
			if (message.type === "error") {
				setSaveStatus({
					isSaving: false,
					message: message.message || t("common.settingsSaveFailed"),
					type: "error",
				})
				// 5초 후 에러 메시지 숨기기
				setTimeout(() => {
					setSaveStatus({
						isSaving: false,
						message: "",
						type: null,
					})
				}, 5000)
			}
		}

		window.addEventListener("message", handleMessage)

		// 설정 및 확장 정보 요청
		vscode.postMessage({ type: "getEgovSettings" })
		vscode.postMessage({ type: "getExtensionInfo" })

		return () => window.removeEventListener("message", handleMessage)
	}, [])

	// 설정 저장
	const handleSaveSettings = () => {
		// Validate settings before saving
		const validation = validateEgovSettings(settings)
		if (validation.length > 0) {
			setValidationErrors(validation)
			return
		}

		setValidationErrors([])
		setSaveStatus({
			isSaving: true,
			message: "",
			type: null,
		})

		// 선택된 언어 적용
		changeLanguage(pendingLanguage)

		vscode.postMessage({
			type: "updateEgovSettings",
			settings: {
				...settings,
				language: pendingLanguage,
			},
		})
	}

	// 설정 값 변경 핸들러
	const handleSettingChange = (key: keyof EgovSettings, value: string) => {
		setSettings((prev) => ({ ...prev, [key]: value }))
		setValidationErrors([]) // Clear validation errors when any setting changes
	}

	const renderVSCodeSettings = () => (
		<div style={{ padding: "20px", maxWidth: "600px" }}>
			{/* VSCode Settings Header */}
			<div style={{ marginBottom: "24px" }}>
				<h3
					style={{
						color: theme.colors.foreground,
						margin: "0 0 24px 0",
						fontSize: theme.fontSize.lg,
						fontWeight: "700",
						display: "flex",
						alignItems: "center",
						gap: "8px",
					}}>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						style={{ color: theme.colors.foreground }}>
						<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
					</svg>
					{t("settings.vscodeSettings")}
				</h3>
			</div>

			{/* Language Settings */}
			<div style={{ marginBottom: "32px" }}>
				<h4
					style={{
						color: theme.colors.foreground,
						margin: "0 0 16px 0",
						fontSize: theme.fontSize.md,
						fontWeight: "600",
					}}>
					{t("settings.languageSettings")}
				</h4>
				<LanguageSelector value={pendingLanguage} onChange={setPendingLanguage} />
				<p className="text-sm" style={{ color: theme.colors.descriptionForeground }}>
					{t("settings.languageSettingsDesc")}
				</p>
			</div>

			{/* Generate Projects Settings */}
			<div style={{ marginBottom: "32px" }}>
				<h4
					style={{
						color: theme.colors.foreground,
						margin: "0 0 16px 0",
						fontSize: theme.fontSize.md,
						fontWeight: "600",
					}}>
					{t("settings.generateProjectsSettings")}
				</h4>

				<div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
					<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
						<TextField
							label={t("projects.groupId")}
							value={settings.defaultGroupId}
							onChange={(e) => handleSettingChange("defaultGroupId", e.target.value)}
							placeholder="egovframework.com"
							hint={t("projects.groupIdHint")}
						/>
					</div>

					<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
						<TextField
							label={t("projects.artifactId")}
							value={settings.defaultArtifactId}
							onChange={(e) => handleSettingChange("defaultArtifactId", e.target.value)}
							placeholder="egovframe-project"
							hint={t("projects.artifactIdHint")}
						/>
					</div>
				</div>
			</div>

			{/* Generate Code Settings */}
			<div style={{ marginBottom: "32px" }}>
				<h4
					style={{
						color: theme.colors.foreground,
						margin: "0 0 16px 0",
						fontSize: theme.fontSize.md,
						fontWeight: "600",
					}}>
					{t("settings.generateCrudCodeSettings")}
				</h4>

				<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
					<TextField
						label={t("code.packageName")}
						value={settings.defaultPackageName}
						onChange={(e) => handleSettingChange("defaultPackageName", e.target.value)}
						placeholder="egovframework.example.sample"
						hint={t("code.packageNameHint")}
					/>
				</div>
			</div>

			{/* Validation Errors */}
			{validationErrors.length > 0 && (
				<div style={{ marginTop: "20px", marginBottom: "20px" }}>
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

			{/* 저장 버튼 및 상태 메시지 */}
			<div style={{ marginTop: "24px" }}>
				<Button onClick={handleSaveSettings} variant="primary" disabled={saveStatus.isSaving}>
					{saveStatus.isSaving ? t("common.saving") : t("common.saveSettings")}
				</Button>

				{/* 저장 상태 메시지 */}
				{saveStatus.message && (
					<div
						style={{
							marginTop: "12px",
							padding: "10px",
							borderRadius: "3px",
							fontSize: "12px",
							backgroundColor:
								saveStatus.type === "success"
									? "var(--vscode-inputValidation-infoBackground)"
									: "var(--vscode-inputValidation-errorBackground)",
							border: `1px solid ${
								saveStatus.type === "success"
									? "var(--vscode-inputValidation-infoBorder)"
									: "var(--vscode-inputValidation-errorBorder)"
							}`,
							color:
								saveStatus.type === "success"
									? "var(--vscode-inputValidation-infoForeground)"
									: "var(--vscode-inputValidation-errorForeground)",
						}}>
						{saveStatus.message}
					</div>
				)}
			</div>
		</div>
	)

	const renderAbout = () => {
		if (!extensionInfo) {
			return (
				<div style={{ padding: "20px", maxWidth: "600px" }}>
					<div
						style={{
							color: theme.colors.descriptionForeground,
							fontSize: theme.fontSize.sm,
						}}>
						{t("settings.loadingExtensionInfo")}
					</div>
				</div>
			)
		}

		const linkStyle = {
			color: "#007ACC",
			textDecoration: "none",
			borderBottom: "1px solid transparent",
		}

		const linkHoverStyle = {
			borderBottom: "1px solid #007ACC",
		}

		const sectionStyle = {
			marginBottom: "24px",
		}

		const sectionTitleStyle = {
			color: theme.colors.foreground,
			fontSize: theme.fontSize.md,
			fontWeight: "600",
			marginBottom: "8px",
			display: "block",
		}

		const itemStyle = {
			marginBottom: "6px",
			fontSize: theme.fontSize.sm,
			color: theme.colors.descriptionForeground,
		}

		return (
			<div style={{ padding: "20px", maxWidth: "700px" }}>
				{/* About Header */}
				<div style={sectionStyle}>
					<h3
						style={{
							color: theme.colors.foreground,
							margin: "0 0 24px 0",
							fontSize: theme.fontSize.lg,
							fontWeight: "700",
							display: "flex",
							alignItems: "center",
							gap: "8px",
						}}>
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							style={{ color: theme.colors.foreground }}>
							<circle cx="12" cy="12" r="10" />
							<path d="M12 16v-4" />
							<path d="M12 8h.01" />
						</svg>
						{t("common.about")}
					</h3>
					<div
						style={{
							fontSize: theme.fontSize.md,
							fontWeight: "600",
							color: theme.colors.foreground,
							marginBottom: "8px",
						}}>
						{extensionInfo.displayName} v{extensionInfo.version}
					</div>
					<div
						style={{
							fontSize: theme.fontSize.sm,
							color: theme.colors.descriptionForeground,
							lineHeight: "1.5",
						}}>
						{extensionInfo.description}
					</div>
				</div>

				{/* Github Section */}
				<div style={sectionStyle}>
					<span style={sectionTitleStyle}>Github</span>
					<div style={itemStyle}>
						<a
							href={extensionInfo.repository}
							style={linkStyle}
							target="_blank"
							rel="noopener noreferrer"
							onMouseEnter={(e) => Object.assign(e.currentTarget.style, linkHoverStyle)}
							onMouseLeave={(e) => (e.currentTarget.style.borderBottom = "1px solid transparent")}>
							{t("settings.repository")}
						</a>
						{" • "}
						<a
							href={`${extensionInfo.repository}/pulls`}
							style={linkStyle}
							target="_blank"
							rel="noopener noreferrer"
							onMouseEnter={(e) => Object.assign(e.currentTarget.style, linkHoverStyle)}
							onMouseLeave={(e) => (e.currentTarget.style.borderBottom = "1px solid transparent")}>
							{t("settings.pullRequests")}
						</a>
						{" • "}
						<a
							href={`${extensionInfo.repository}/issues`}
							style={linkStyle}
							target="_blank"
							rel="noopener noreferrer"
							onMouseEnter={(e) => Object.assign(e.currentTarget.style, linkHoverStyle)}
							onMouseLeave={(e) => (e.currentTarget.style.borderBottom = "1px solid transparent")}>
							{t("settings.issues")}
						</a>
					</div>
				</div>

				{/* Homepage Section */}
				<div style={sectionStyle}>
					<span style={sectionTitleStyle}>Homepage</span>
					<div style={itemStyle}>
						<a
							href={extensionInfo.homepage}
							style={linkStyle}
							target="_blank"
							rel="noopener noreferrer"
							onMouseEnter={(e) => Object.assign(e.currentTarget.style, linkHoverStyle)}
							onMouseLeave={(e) => (e.currentTarget.style.borderBottom = "1px solid transparent")}>
							{t("settings.portal")}
						</a>
					</div>
				</div>

				{/* Guide Section */}
				<div style={sectionStyle}>
					<span style={sectionTitleStyle}>Guide</span>
					<div style={itemStyle}>
						<a
							href="https://www.egovframe.go.kr/docs/5.0/"
							style={linkStyle}
							target="_blank"
							rel="noopener noreferrer"
							onMouseEnter={(e) => Object.assign(e.currentTarget.style, linkHoverStyle)}
							onMouseLeave={(e) => (e.currentTarget.style.borderBottom = "1px solid transparent")}>
							{t("settings.egovDocs")}
						</a>
					</div>
					<div style={itemStyle}>
						<a
							href="https://www.egovframe.go.kr/docs/5.0/egovframe-development/vscode-implementation-tool/"
							style={linkStyle}
							target="_blank"
							rel="noopener noreferrer"
							onMouseEnter={(e) => Object.assign(e.currentTarget.style, linkHoverStyle)}
							onMouseLeave={(e) => (e.currentTarget.style.borderBottom = "1px solid transparent")}>
							{t("settings.extensionManual")}
						</a>
					</div>
					<div style={itemStyle}>
						<a
							href="https://www.egovframe.go.kr/docs/5.0/egovframe-development/development-etcdevtool-guide/vscode-usage/"
							style={linkStyle}
							target="_blank"
							rel="noopener noreferrer"
							onMouseEnter={(e) => Object.assign(e.currentTarget.style, linkHoverStyle)}
							onMouseLeave={(e) => (e.currentTarget.style.borderBottom = "1px solid transparent")}>
							{t("settings.vscodeUsageGuide")}
						</a>
					</div>
				</div>

				{/* Additional Info */}
				{extensionInfo.author && (
					<div style={sectionStyle}>
						<span style={sectionTitleStyle}>{t("settings.author")}</span>
						<div style={itemStyle}>{extensionInfo.author}</div>
					</div>
				)}

				{extensionInfo.license && (
					<div style={sectionStyle}>
						<span style={sectionTitleStyle}>{t("settings.license")}</span>
						<div style={itemStyle}>{extensionInfo.license}</div>
					</div>
				)}
			</div>
		)
	}

	if (isLoading) {
		return (
			<div
				style={{
					position: "fixed",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: theme.colors.descriptionForeground,
				}}>
				{t("common.loadingSettings")}
			</div>
		)
	}

	return (
		<div
			className={isCompact ? "narrow" : ""}
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				display: "flex",
				flexDirection: "column",
			}}>
			{/* Header */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					padding: "10px 17px 5px 20px",
					borderBottom: `1px solid ${theme.colors.panelBorder}`,
				}}>
				<h3 style={{ color: theme.colors.foreground, margin: 0 }}>eGovFrame {t("settings.title")}</h3>
				<Button onClick={onDone} variant="secondary" size="sm">
					{t("common.done")}
				</Button>
			</div>

			{/* Main Content */}
			<div
				className={`flex flex-1 overflow-hidden ${isCompact ? "narrow" : ""}`}
				style={{
					flex: 1,
					display: "flex",
					minWidth: 0, // flex 아이템이 축소될 수 있도록
				}}>
				{/* Sidebar */}
				<div
					style={{
						width: isCompact ? "48px" : "192px", // w-48 = 192px, compact = 48px
						flexShrink: 0,
						display: "flex",
						flexDirection: "column",
						overflowY: "auto",
						overflowX: "hidden",
						borderRight: `1px solid ${theme.colors.panelBorder}`,
						backgroundColor: theme.colors.sidebarBackground,
						transition: "width 0.3s ease",
					}}
					role="tablist"
					data-compact={isCompact}>
					<ResponsiveMenuButton
						active={activeTab === "vscode-settings"}
						onClick={() => setActiveTab("vscode-settings")}
						icon="edit"
						title={`eGovFrame ${t("settings.vscodeSettings")}`}
						isCompact={isCompact}
						dataValue="vscode-settings">
						{t("settings.vscodeSettings")}
					</ResponsiveMenuButton>
					<ResponsiveMenuButton
						active={activeTab === "about"}
						onClick={() => setActiveTab("about")}
						icon="info"
						title={t("settings.aboutTitle")}
						isCompact={isCompact}
						dataValue="about">
						{t("common.about")}
					</ResponsiveMenuButton>
				</div>

				{/* Content Area */}
				<div
					style={{
						flex: 1,
						//minWidth: "300px", // Content Area의 최소 넓이 보장
						overflow: "auto",
					}}>
					{activeTab === "vscode-settings" && renderVSCodeSettings()}
					{activeTab === "about" && renderAbout()}
				</div>
			</div>
		</div>
	)
})

EgovSettingsView.displayName = "EgovSettingsView"

export default EgovSettingsView
