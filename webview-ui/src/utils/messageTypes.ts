import { TemplateContext } from "@shared/templateContext"

export interface GenerateCodeMessage {
	type: "generateCode"
	ddl: string
	packageName?: string
	outputPath?: string
}

export interface UploadTemplatesMessage {
	type: "uploadTemplates"
	ddl: string
}

export interface DownloadTemplateContextMessage {
	type: "downloadTemplateContext"
	ddl: string
	context: TemplateContext
}

export interface InsertSampleDDLMessage {
	type: "insertSampleDDL"
}

export interface GetWorkspacePathMessage {
	type: "getWorkspacePath"
}

export interface SelectOutputPathMessage {
	type: "selectOutputPath"
}

export interface ValidateAndPreviewMessage {
	type: "validateAndPreview"
	ddl: string
	packageName?: string
}

export interface ValidateDDLOnlyMessage {
	type: "validateDDLOnly"
	ddl: string
	packageName?: string
}

export interface GetCurrentThemeMessage {
	type: "getCurrentTheme"
}

export interface GetSampleDDLsMessage {
	type: "getSampleDDLs"
}

export interface GetEgovSettingsMessage {
	type: "getEgovSettings"
}

export interface UpdateEgovSettingsMessage {
	type: "updateEgovSettings"
	settings: {
		defaultGroupId?: string
		defaultArtifactId?: string
		defaultPackageName?: string
	}
}

export interface GetExtensionInfoMessage {
	type: "getExtensionInfo"
}

export type WebviewMessage =
	| GenerateCodeMessage
	| UploadTemplatesMessage
	| DownloadTemplateContextMessage
	| InsertSampleDDLMessage
	| GetWorkspacePathMessage
	| SelectOutputPathMessage
	| ValidateAndPreviewMessage
	| ValidateDDLOnlyMessage
	| GetSampleDDLsMessage
	| GetCurrentThemeMessage
	| GetEgovSettingsMessage
	| UpdateEgovSettingsMessage
	| GetExtensionInfoMessage

export interface ErrorResponse {
	type: "error"
	message: string
}

export interface SuccessResponse {
	type: "success"
	message: string
}

export interface SampleDDLResponse {
	type: "sampleDDL"
	ddl: string
}

export interface SelectedOutputPathResponse {
	type: "selectedOutputPath"
	text: string
}

export interface CurrentWorkspacePathResponse {
	type: "currentWorkspacePath"
	text: string
}

export interface ValidationResultResponse {
	type: "validationResult"
	isValid: boolean
	previews?: { [key: string]: string }
	languages?: { [key: string]: string }
	packageName?: string
	error?: string
}

export interface SampleDDLsResponse {
	type: "sampleDDLs"
	data: { [key: string]: { name: string; ddl: string; dialect: string } }
}

export interface CurrentThemeResponse {
	type: "currentTheme"
	theme: "light" | "vs-dark"
}

export interface ThemeChangedResponse {
	type: "themeChanged"
	theme: "light" | "vs-dark"
}

export interface EgovSettingsResponse {
	type: "egovSettings"
	settings: {
		defaultGroupId: string
		defaultArtifactId: string
		defaultPackageName: string
	}
}

export interface ExtensionInfoResponse {
	type: "extensionInfo"
	info: {
		displayName: string
		version: string
		description: string
		repository: string
		homepage: string
		author: string
		license: string
	}
}

export type ExtensionResponse =
	| ErrorResponse
	| SuccessResponse
	| SampleDDLResponse
	| SelectedOutputPathResponse
	| CurrentWorkspacePathResponse
	| ValidationResultResponse
	| SampleDDLsResponse
	| CurrentThemeResponse
	| ThemeChangedResponse
	| EgovSettingsResponse
	| ExtensionInfoResponse
