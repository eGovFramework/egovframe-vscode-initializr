/**
 * messageTypes.ts
 *
 * 익스텐션 → 웹뷰 응답 메시지 타입 (CodeView에서 사용).
 *
 * 웹뷰 → 익스텐션 요청 메시지 타입은 별도로 정의하지 않는다 —
 * 단일 계약인 @shared/WebviewMessage의 WebviewMessage 판별 유니온을 사용한다.
 */

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
