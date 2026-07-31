/**
 * webviewMessageSchema.ts
 *
 * 웹뷰 → 익스텐션 메시지의 런타임 검증 스키마 (zod).
 *
 * 웹뷰는 익스텐션 호스트와 다른 프로세스에서 실행되는 신뢰 경계 밖 입력원이므로
 * (예: 웹뷰 번들 공급망이 변조된 경우), postMessage로 넘어온 값은 이 스키마를
 * 통과한 경우에만 처리한다. 파일 시스템 경로 구성에 쓰이는 필드는 경로 구분자와
 * 상위 디렉터리 참조가 불가능한 문자 집합으로 제한한다 (CWE-22).
 *
 * 이 모듈은 익스텐션 호스트 전용이다. 웹뷰(webview-ui)는 순수 타입인
 * WebviewMessage.ts만 import 하고 이 파일은 import 하지 않는다.
 */

import { z } from "zod"
import { PROJECT_NAME_PATTERN } from "../utils/pathSafety"
import type { WebviewMessage } from "./WebviewMessage"

// 단일 경로 컴포넌트로만 쓸 수 있는 파일명: 경로 구분자(/, \)가 없고, 점으로 시작하거나 연속된 점(..)을 포함할 수 없다
const SAFE_ZIP_FILE_PATTERN = /^(?!\.)(?!.*\.\.)[A-Za-z0-9._-]+\.zip$/
const SAFE_XML_FILE_PATTERN = /^(?!\.)(?!.*\.\.)[A-Za-z0-9._-]+\.xml$/
const SAFE_HBS_FILE_PATTERN = /^(?!\.)(?!.*\.\.)[A-Za-z0-9._-]+\.hbs$/
const TEMPLATE_FOLDER_PATTERN = /^[A-Za-z0-9_-]+$/
// 웹뷰 validateCodeConfig와 동일한 Java 패키지명 규칙 — 패키지 경로(디렉터리) 생성에 쓰이므로 엄격하게 검증한다
const JAVA_PACKAGE_PATTERN = /^[a-z]([a-z0-9.]*[a-z0-9])?$/

// templates-context-xml.json은 "변형 템플릿 없음"을 빈 문자열로 표기하므로 빈 문자열도 허용한다
const optionalHbsFileSchema = z.literal("").or(z.string().regex(SAFE_HBS_FILE_PATTERN)).optional()

const projectTemplateSchema = z.object({
	displayName: z.string(),
	fileName: z.string().regex(SAFE_ZIP_FILE_PATTERN),
	pomFile: z.literal("").or(z.string().regex(SAFE_XML_FILE_PATTERN)),
})

const projectConfigSchema = z.object({
	// 단일 디렉터리 컴포넌트 규칙 — utils/pathSafety.ts의 assertSafeProjectName과 동일한 패턴
	projectName: z.string().regex(PROJECT_NAME_PATTERN),
	artifactId: z.string(),
	groupId: z.string(),
	version: z.string().optional(),
	url: z.string().optional(),
	outputPath: z.string(),
	template: projectTemplateSchema,
})

const configTemplateSchema = z.object({
	displayName: z.string(),
	templateFolder: z.string().regex(TEMPLATE_FOLDER_PATTERN),
	templateFile: z.string().regex(SAFE_HBS_FILE_PATTERN),
	webView: z.string(),
	fileNameProperty: z.string(),
	javaConfigTemplate: optionalHbsFileSchema,
	yamlTemplate: optionalHbsFileSchema,
	propertiesTemplate: optionalHbsFileSchema,
	description: z.string().optional(),
})

// 템플릿별 폼 필드가 제각각이라 공통 필수 필드만 검증하고 나머지 키는 통과시킨다.
// 출력 파일명(txtFileName 등)은 이후 configGenerator의 sanitizeFileName이 한 번 더 정리한다.
const configFormDataSchema = z.looseObject({
	txtFileName: z.string(),
	generationType: z.enum(["xml", "javaConfig", "yaml", "properties", "json"]),
	outputFolder: z.string().optional(),
})

const columnSchema = z.object({
	ccName: z.string(),
	columnName: z.string(),
	isPrimaryKey: z.boolean(),
	pcName: z.string(),
	dataType: z.string(),
	javaType: z.string(),
	comment: z.string(),
})

const templateContextSchema = z.object({
	tableName: z.string(),
	dbTableName: z.string(),
	attributes: z.array(columnSchema),
	pkAttributes: z.array(columnSchema),
	packageName: z.string(),
	className: z.string(),
	classNameFirstCharLower: z.string(),
	author: z.string(),
	date: z.string(),
	version: z.string(),
})

const egovSettingsSchema = z.object({
	defaultGroupId: z.string().optional(),
	defaultArtifactId: z.string().optional(),
	defaultPackageName: z.string().optional(),
	language: z.string().optional(),
})

const webviewScopeSchema = z.enum(["projects", "code", "config", "settings"])

/** 페이로드 없이 type만 전달하는 단순 요청 메시지 */
const simpleMessage = <T extends string>(type: T) => z.object({ type: z.literal(type) })
const scopedRequest = <T extends string>(type: T) => z.object({ type: z.literal(type), scope: webviewScopeSchema.optional() })

export const webviewMessageSchema = z.discriminatedUnion("type", [
	simpleMessage("webviewDidLaunch"),
	scopedRequest("selectOutputPath"),
	simpleMessage("generateProjectByCommand"),
	scopedRequest("getWorkspacePath"),
	simpleMessage("getDefaultSettings"),
	simpleMessage("openPackageSettings"),
	simpleMessage("getSampleDDLs"),
	simpleMessage("getCurrentTheme"),
	simpleMessage("selectConfigFilePath"),
	scopedRequest("getEgovSettings"),
	simpleMessage("getExtensionInfo"),
	simpleMessage("getProjectTemplates"),
	simpleMessage("getConfigTemplates"),
	z.object({
		type: z.literal("generateProject"),
		projectConfig: projectConfigSchema,
		method: z.enum(["form", "command"]),
	}),
	z.object({
		type: z.literal("generateCode"),
		ddl: z.string(),
		// 파일 생성 직전에만 전송되고 웹뷰(validateCodeConfig)가 같은 패턴으로 선검증하므로
		// 엄격 규칙을 적용해도 정상 사용 흐름을 막지 않는다
		packageName: z.string().regex(JAVA_PACKAGE_PATTERN).optional(),
		outputPath: z.string().optional(),
	}),
	z.object({
		type: z.literal("uploadTemplates"),
		ddl: z.string(),
		packageName: z.string().optional(),
	}),
	z.object({
		type: z.literal("downloadTemplateContext"),
		ddl: z.string(),
		context: templateContextSchema,
	}),
	// validateDDLOnly / validateAndPreview는 타이핑 도중(debounce)에도 전송되므로
	// packageName에 패턴 검증을 걸지 않는다 — 파일을 쓰지 않는 미리보기 전용 경로다.
	z.object({
		type: z.literal("validateDDLOnly"),
		ddl: z.string(),
		packageName: z.string().optional(),
	}),
	z.object({
		type: z.literal("validateAndPreview"),
		ddl: z.string(),
		packageName: z.string().optional(),
	}),
	z.object({
		type: z.literal("generateConfig"),
		template: configTemplateSchema,
		formData: configFormDataSchema,
	}),
	z.object({
		type: z.literal("selectOutputFolder"),
		formData: configFormDataSchema,
	}),
	z.object({
		type: z.literal("showError"),
		value: z.string(),
	}),
	z.object({
		type: z.literal("showWarning"),
		value: z.string(),
	}),
	z.object({
		type: z.literal("updateEgovSettings"),
		settings: egovSettingsSchema,
	}),
])

type ParsedWebviewMessage = z.output<typeof webviewMessageSchema>

// ---------------------------------------------------------------------------
// 컴파일 타임 계약 동기화 검증 — 아래 두 상수가 컴파일되지 않으면
// WebviewMessage 타입과 zod 스키마가 어긋난 것이다.
// ---------------------------------------------------------------------------

type Extends<A, B> = [A] extends [B] ? true : false

// 스키마가 통과시킨 값은 항상 WebviewMessage여야 한다
const _schemaOutputIsWebviewMessage: Extends<ParsedWebviewMessage, WebviewMessage> = true
// WebviewMessage의 모든 type 판별자는 스키마에 대응 항목이 있어야 한다
const _everyMessageTypeHasSchema: Extends<WebviewMessage["type"], ParsedWebviewMessage["type"]> = true

export type WebviewMessageParseResult = { success: true; message: WebviewMessage } | { success: false; error: string }

/**
 * postMessage로 수신한 원시 값을 검증한다.
 * 실패 시 예외를 던지지 않고 사유 문자열을 반환한다.
 */
export function parseWebviewMessage(rawMessage: unknown): WebviewMessageParseResult {
	const result = webviewMessageSchema.safeParse(rawMessage)
	if (result.success) {
		return { success: true, message: result.data }
	}

	const receivedType =
		rawMessage !== null && typeof rawMessage === "object" && "type" in rawMessage
			? String((rawMessage as { type: unknown }).type)
			: typeof rawMessage
	const issues = result.error.issues
		.slice(0, 5)
		.map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
		.join("; ")
	return { success: false, error: `type "${receivedType}": ${issues}` }
}
