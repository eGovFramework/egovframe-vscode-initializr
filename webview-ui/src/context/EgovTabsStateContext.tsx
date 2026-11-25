import React, { createContext, useContext, useState, ReactNode } from "react"
import { ParsedDDL } from "@shared/ddlParser"
import { ProjectTemplate, ProjectTemplatesManifest, TemplateVersion } from "../utils/projectUtils"
import { TemplateConfig } from "../components/egov/types/templates"

// CodeView 상태
interface CodeViewState {
	ddlContent: string
	parsedDDL: ParsedDDL | null
	isValid: boolean
	isLoading: boolean
	error: string
	validationErrors: string[]
	outputPath: string
	packageName: string
	defaultPackageName: string // VSCode 설정에서 가져온 기본값
	// 미리보기 관련 상태 추가
	previews: { [key: string]: string } | null
	previewLanguages?: { [key: string]: string } | null
	selectedPreviewTemplate: string
	isPreviewLoading: boolean
	previewError: string
	// 자동 미리보기 업데이트 옵션
	autoUpdatePreview: boolean
	// 샘플 DDL 목록
	sampleDDLs: { [key: string]: { name: string; dialect: string; ddl: string } } | null
}

// ProjectsView 상태
interface ProjectsViewState {
	selectedCategory: string
	selectedTemplate: ProjectTemplate | null // ProjectTemplate from utils/projectUtils
	projectName: string
	outputPath: string
	packageName: string
	groupId: string
	artifactId: string
	version: string
	url: string
	description: string
	generationMode: "form" | "command"
	// VSCode Configuration에서 가져온 기본값
	defaultGroupId: string
	defaultArtifactId: string
	defaultPackageName: string
	// Extension에서 가져온 프로젝트 템플릿 목록
	projectTemplates: ProjectTemplate[]
	isTemplatesLoading: boolean
	// 버전 관련 상태
	manifest: ProjectTemplatesManifest | null // 전체 매니페스트 데이터
	selectedVersion: string // 현재 선택된 버전
	availableVersions: TemplateVersion[] // 선택된 템플릿의 사용 가능한 버전 목록
}

// ConfigView 상태
interface ConfigViewState {
	selectedCategory: string
	selectedTemplate: TemplateConfig | null
	loading: boolean
	configTemplates: TemplateConfig[]
	isTemplatesLoading: boolean
}

// 전체 탭 상태
interface EgovTabsState {
	codeView: CodeViewState
	projectsView: ProjectsViewState
	configView: ConfigViewState
}

// Context 타입
interface EgovTabsStateContextType {
	state: EgovTabsState
	updateCodeViewState: (updates: Partial<CodeViewState>) => void
	updateProjectsViewState: (updates: Partial<ProjectsViewState>) => void
	updateConfigViewState: (updates: Partial<ConfigViewState>) => void
	resetCodeViewState: () => void
	resetProjectsViewState: () => void
	resetConfigViewState: () => void
}

// 초기 상태 - Code View
const initialCodeViewState: CodeViewState = {
	ddlContent: "",
	parsedDDL: null,
	isValid: false,
	isLoading: false,
	error: "",
	validationErrors: [],
	outputPath: "",
	packageName: "egovframework.example.sample", // VSCode 설정에서 가져온 값으로 곧 업데이트됨 (CodeView.tsx - useEffect - handleMessage - case "egovSettings")
	defaultPackageName: "egovframework.example.sample", // VSCode 설정에서 가져온 기본값 (CodeView.tsx - useEffect - handleMessage - case "egovSettings")
	// 미리보기 관련 초기 상태
	previews: null,
	previewLanguages: null,
	selectedPreviewTemplate: "vo",
	isPreviewLoading: false,
	previewError: "",
	// 자동 미리보기 업데이트 옵션 (기본값: false)
	autoUpdatePreview: false,
	// 샘플 DDL 목록
	sampleDDLs: null, // 초기값 설정은 다음 코드에서 set됨 CodeView.tsx - CodeView - useEffect - handleMessage - case "sampleDDLs"
}

// 초기 상태 - Projects View
const initialProjectsViewState: ProjectsViewState = {
	selectedCategory: "All",
	selectedTemplate: null,
	projectName: "",
	outputPath: "",
	packageName: "",
	groupId: "",
	artifactId: "",
	version: "",
	url: "",
	description: "",
	generationMode: "form",
	// VSCode Configuration에서 가져온 기본값 (초기값은 package.json의 default와 동일)
	defaultGroupId: "",
	defaultArtifactId: "",
	defaultPackageName: "",
	// Extension에서 가져온 프로젝트 템플릿 목록
	projectTemplates: [],
	isTemplatesLoading: true,
	// 버전 관련 초기 상태
	manifest: null,
	selectedVersion: "",
	availableVersions: [],
}

// 초기 상태 - Config View
const initialConfigViewState: ConfigViewState = {
	selectedCategory: "",
	selectedTemplate: null,
	loading: false,
	configTemplates: [],
	isTemplatesLoading: true,
}

// 초기 상태 - 전체
const initialState: EgovTabsState = {
	codeView: initialCodeViewState,
	projectsView: initialProjectsViewState,
	configView: initialConfigViewState,
}

// Context 생성
const EgovTabsStateContext = createContext<EgovTabsStateContextType | undefined>(undefined)

// Provider 컴포넌트
export const EgovTabsStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	const [state, setState] = useState<EgovTabsState>(initialState)

	const updateCodeViewState = (updates: Partial<CodeViewState>) => {
		setState((prev) => ({
			...prev,
			codeView: { ...prev.codeView, ...updates },
		}))
	}

	const updateProjectsViewState = (updates: Partial<ProjectsViewState>) => {
		setState((prev) => ({
			...prev,
			projectsView: { ...prev.projectsView, ...updates },
		}))
	}

	const updateConfigViewState = (updates: Partial<ConfigViewState>) => {
		setState((prev) => ({
			...prev,
			configView: { ...prev.configView, ...updates },
		}))
	}

	const resetCodeViewState = () => {
		setState((prev) => ({
			...prev,
			codeView: initialCodeViewState,
		}))
	}

	const resetProjectsViewState = () => {
		setState((prev) => ({
			...prev,
			projectsView: initialProjectsViewState,
		}))
	}

	const resetConfigViewState = () => {
		setState((prev) => ({
			...prev,
			configView: initialConfigViewState,
		}))
	}

	const contextValue: EgovTabsStateContextType = {
		state,
		updateCodeViewState,
		updateProjectsViewState,
		updateConfigViewState,
		resetCodeViewState,
		resetProjectsViewState,
		resetConfigViewState,
	}

	return <EgovTabsStateContext.Provider value={contextValue}>{children}</EgovTabsStateContext.Provider>
}

// Hook
export const useEgovTabsState = () => {
	const context = useContext(EgovTabsStateContext)
	if (context === undefined) {
		throw new Error("useEgovTabsState must be used within an EgovTabsStateProvider")
	}
	return context
}

// 개별 탭별 훅들
export const useCodeViewState = () => {
	const { state, updateCodeViewState, resetCodeViewState } = useEgovTabsState()
	return {
		state: state.codeView,
		updateState: updateCodeViewState,
		resetState: resetCodeViewState,
	}
}

export const useProjectsViewState = () => {
	const { state, updateProjectsViewState, resetProjectsViewState } = useEgovTabsState()
	return {
		state: state.projectsView,
		updateState: updateProjectsViewState,
		resetState: resetProjectsViewState,
	}
}

export const useConfigViewState = () => {
	const { state, updateConfigViewState, resetConfigViewState } = useEgovTabsState()
	return {
		state: state.configView,
		updateState: updateConfigViewState,
		resetState: resetConfigViewState,
	}
}
