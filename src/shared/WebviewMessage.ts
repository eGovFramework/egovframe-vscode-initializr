/**
 * WebviewMessage.ts
 *
 * 익스텐션이 웹뷰로부터 수신하는 메시지 타입
 */

export interface WebviewMessage {
	type: string
	value?: any
	template?: any
	formData?: any
	outputFolder?: string
	ddl?: string
	context?: any
	packageName?: string
	outputPath?: string
	projectConfig?: any
	method?: string
	telemetrySetting?: string
	user?: any
	grpc_request?: any
	grpc_request_cancel?: any
	settings?: {
		defaultGroupId?: string
		defaultArtifactId?: string
		defaultPackageName?: string
		language?: string
	}
}
