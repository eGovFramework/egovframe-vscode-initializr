/**
 * WebviewMessage.ts
 *
 * 익스텐션이 웹뷰로부터 수신하는 메시지 타입.
 *
 * 웹뷰 → 익스텐션 방향의 모든 메시지는 이 판별 유니온(discriminated union)으로 확정된다.
 * 수신 시점의 런타임 검증은 webviewMessageSchema.ts의 zod 스키마가 수행하며,
 * 두 파일이 어긋나면 webviewMessageSchema.ts 하단의 컴파일 타임 검증이 실패한다.
 *
 * 이 파일은 웹뷰(webview-ui)에서도 import 하므로 순수 타입만 두고 런타임 의존성(zod 등)을 두지 않는다.
 */

import type { ArchCheckResults } from "./archCheck"
import type { TemplateContext } from "./templateContext"

// ---------------------------------------------------------------------------
// 페이로드 타입
// ---------------------------------------------------------------------------

/** 프로젝트 생성 템플릿 정보 (templates/templates-projects.json 항목 중 생성에 필요한 부분집합) */
export interface ProjectTemplatePayload {
	displayName: string
	/** templates/projects/examples/ 아래의 ZIP 파일명 */
	fileName: string
	/** templates/projects/pom/ 아래의 POM 템플릿 파일명. POM이 없는 템플릿은 빈 문자열 */
	pomFile: string
	/** templates-projects.json manifest의 템플릿 식별자 */
	templateId?: string
	/** 선택한 템플릿 버전 (예: "4.3.1") */
	version?: string
	/** true면 확장에 ZIP이 포함됨, false면 downloadUrl로 내려받아야 함 */
	included?: boolean
	/** included가 false일 때의 ZIP 다운로드 URL (절대 URL 또는 manifest baseUrl 기준 상대 경로) */
	downloadUrl?: string
	/** included가 false일 때의 POM 템플릿 다운로드 URL */
	pomDownloadUrl?: string
}

/** 프로젝트 생성 폼 입력 값 */
export interface ProjectConfigPayload {
	projectName: string
	artifactId: string
	groupId: string
	version?: string
	url?: string
	outputPath: string
	template: ProjectTemplatePayload
}

/** 설정 파일 생성 템플릿 정보 (templates/templates-context-xml.json 항목) */
export interface ConfigTemplatePayload {
	displayName: string
	/** templates/config/ 아래의 카테고리 폴더명 */
	templateFolder: string
	/** XML 생성용 .hbs 템플릿 파일명 */
	templateFile: string
	webView: string
	/** 출력 파일명이 들어 있는 formData 프로퍼티 이름 */
	fileNameProperty: string
	javaConfigTemplate?: string
	yamlTemplate?: string
	propertiesTemplate?: string
	description?: string
}

/** 설정 파일 생성 폼 데이터. 템플릿별 필드가 제각각이라 공통 필수 필드 외에는 개방형으로 둔다 */
export interface ConfigFormDataPayload {
	[key: string]: unknown
	txtFileName: string
	generationType: string
	outputFolder?: string
}

/** egovframeInitializr.* 설정 값 갱신 페이로드 */
export interface EgovSettingsPayload {
	defaultGroupId?: string
	defaultArtifactId?: string
	defaultPackageName?: string
	language?: string
}

// ---------------------------------------------------------------------------
// 메시지 타입 (type 필드로 판별)
// ---------------------------------------------------------------------------

/** 웹뷰 탭별 메시지 발신 스코프 */
export type WebviewScope = "projects" | "code" | "config" | "settings"

/** 페이로드 없이 type만으로 동작하는 단순 요청 메시지 */
export interface SimpleWebviewMessage {
	type:
		| "webviewDidLaunch"
		| "generateProjectByCommand"
		| "getDefaultSettings"
		| "openPackageSettings"
		| "getSampleDDLs"
		| "getCurrentTheme"
		| "selectConfigFilePath"
		| "getExtensionInfo"
		| "getProjectTemplates"
		| "getConfigTemplates"
		| "selectProjectPath"
}

/** 탭 스코프를 선택적으로 포함하는 요청 메시지 */
export interface ScopedRequestMessage {
	type: "selectOutputPath" | "getWorkspacePath" | "getEgovSettings"
	scope?: WebviewScope
}

export interface GenerateProjectMessage {
	type: "generateProject"
	projectConfig: ProjectConfigPayload
	method: "form" | "command"
}

export interface GenerateCodeMessage {
	type: "generateCode"
	ddl: string
	packageName?: string
	outputPath?: string
}

export interface UploadTemplatesMessage {
	type: "uploadTemplates"
	ddl: string
	packageName?: string
}

export interface DownloadTemplateContextMessage {
	type: "downloadTemplateContext"
	ddl: string
	context: TemplateContext
}

export interface ValidateDDLOnlyMessage {
	type: "validateDDLOnly"
	ddl: string
	packageName?: string
}

export interface ValidateAndPreviewMessage {
	type: "validateAndPreview"
	ddl: string
	packageName?: string
}

export interface GenerateConfigMessage {
	type: "generateConfig"
	template: ConfigTemplatePayload
	formData: ConfigFormDataPayload
}

export interface SelectOutputFolderMessage {
	type: "selectOutputFolder"
	formData: ConfigFormDataPayload
}

export interface ShowErrorMessage {
	type: "showError"
	value: string
}

export interface ShowWarningMessage {
	type: "showWarning"
	value: string
}

export interface UpdateEgovSettingsMessage {
	type: "updateEgovSettings"
	settings: EgovSettingsPayload
}

/** 아키텍처 점검 시작 — projectPath는 사용자가 다이얼로그로 선택한 프로젝트 루트 */
export interface StartArchCheckMessage {
	type: "startArchCheck"
	projectPath: string
}

/** 아키텍처 점검 결과를 프로젝트 폴더에 파일로 내보내기 */
export interface ExportArchResultsMessage {
	type: "exportArchResults"
	results: ArchCheckResults
	projectPath: string
}

/** 점검 결과 목록에서 클릭한 파일을 에디터로 열기 */
export interface OpenFileMessage {
	type: "openFile"
	filePath: string
}

export type WebviewMessage =
	| SimpleWebviewMessage
	| ScopedRequestMessage
	| GenerateProjectMessage
	| GenerateCodeMessage
	| UploadTemplatesMessage
	| DownloadTemplateContextMessage
	| ValidateDDLOnlyMessage
	| ValidateAndPreviewMessage
	| GenerateConfigMessage
	| SelectOutputFolderMessage
	| ShowErrorMessage
	| ShowWarningMessage
	| UpdateEgovSettingsMessage
	| StartArchCheckMessage
	| ExportArchResultsMessage
	| OpenFileMessage
