import { useState, useEffect, memo } from "react"
import { useTranslation } from "react-i18next"
import { EgovViewTab } from "../../shared/egovframe"
import { Button, useVSCodeTheme, LanguageSelector } from "../ui"
import ProjectsView from "./tabs/ProjectsView"
import CodeView from "./tabs/CodeView"
import ConfigView from "./tabs/ConfigView"

interface EgovViewProps {
	onDone: () => void
	initialTab?: EgovViewTab
}

const EgovView = memo(({ onDone, initialTab }: EgovViewProps) => {
	const [activeTab, setActiveTab] = useState<EgovViewTab>(initialTab || "projects")
	const theme = useVSCodeTheme()
	const { t } = useTranslation()

	const handleTabChange = (tab: EgovViewTab) => {
		setActiveTab(tab)
	}

	useEffect(() => {
		// 탭 전환 메시지 리스너 추가
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "switchEgovTab" && message.text) {
				const tabName = message.text
				if (tabName === "projects" || tabName === "code" || tabName === "config") {
					setActiveTab(tabName as EgovViewTab)
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				display: "flex",
				flexDirection: "column",
			}}>
			<div style={{ flex: 1, overflow: "auto" }}>
				{/* Tabs container */}
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						padding: "0 20px 0 20px",
						borderBottom: `1px solid ${theme.colors.panelBorder}`,
					}}>
					<div style={{ display: "flex", gap: "1px" }}>
						<TabButton isActive={activeTab === "projects"} onClick={() => handleTabChange("projects")}>
							{t("tabs.projects")}
						</TabButton>
						<TabButton isActive={activeTab === "code"} onClick={() => handleTabChange("code")}>
							{t("tabs.codeGenerator")}
						</TabButton>
						<TabButton isActive={activeTab === "config"} onClick={() => handleTabChange("config")}>
							{t("tabs.configuration")}
						</TabButton>
					</div>
					<LanguageSelector />
				</div>

				{/* Content container */}
				<div style={{ width: "100%" }}>
					<div style={{ display: activeTab === "projects" ? "block" : "none" }}>
						<ProjectsView />
					</div>
					<div style={{ display: activeTab === "code" ? "block" : "none" }}>
						<CodeView />
					</div>
					<div style={{ display: activeTab === "config" ? "block" : "none" }}>
						<ConfigView />
					</div>
				</div>
			</div>
		</div>
	)
})

export const TabButton = ({
	children,
	isActive,
	onClick,
}: {
	children: React.ReactNode
	isActive: boolean
	onClick: () => void
}) => {
	const theme = useVSCodeTheme()

	return (
		<button
			onClick={onClick}
			style={{
				background: "none",
				border: "none",
				borderBottom: `2px solid ${isActive ? theme.colors.foreground : "transparent"}`,
				color: isActive ? theme.colors.foreground : theme.colors.descriptionForeground,
				padding: "8px 16px",
				cursor: "pointer",
				fontSize: theme.fontSize.sm,
				marginBottom: "-1px",
				fontFamily: "inherit",
				transition: "color 0.2s ease",
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.color = theme.colors.foreground
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.color = isActive ? theme.colors.foreground : theme.colors.descriptionForeground
			}}>
			{children}
		</button>
	)
}

EgovView.displayName = "EgovView"

export default EgovView
