import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs-extra"
import { parseDDL, validateDDL } from "../shared/ddlParser"
import { renderTemplate } from "./codeGeneratorUtils"
import { getTemplateContext } from "../shared/templateContext"

// 검증 결과 인터페이스
export interface ValidationResult {
	isValid: boolean
	error?: string
	previews?: { [key: string]: string }
	languages?: { [key: string]: string }
	packageName?: string
	tableName?: string
	hasWarnings?: boolean
	warningCount?: number
}

/**
 * DDL을 검증하는 함수 (빠른 검증만 수행)
 *
 * @param ddl - 검증할 DDL 문자열
 * @param context - VSCode 확장 컨텍스트
 * @param packageName - 패키지명 (선택사항)
 * @returns 검증 결과 (미리보기는 포함하지 않음)
 */
export async function validateDDLOnly(
	ddl: string,
	context: vscode.ExtensionContext,
	packageName?: string,
): Promise<ValidationResult> {
	try {
		// 1. DDL 검증만 수행 (빠른 검증)
		const isValid = validateDDL(ddl)

		// 2. 검증에 실패하면 에러 반환
		if (!isValid) {
			return {
				isValid: false,
				error: "Invalid DDL format",
			}
		}

		// 3. 검증 성공시 기본 정보만 반환 (미리보기는 나중에 요청시 생성)
		const { tableName } = parseDDL(ddl)
		const finalPackageName =
			packageName ||
			vscode.workspace
				.getConfiguration("egovframeInitializr")
				.get<string>("defaultPackageName", "egovframework.example.sample")

		return {
			isValid: true,
			packageName: finalPackageName,
			tableName: tableName,
		}
	} catch (error) {
		return {
			isValid: false,
			error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
		}
	}
}

/**
 * DDL을 검증하고 모든 템플릿의 미리보기를 생성하는 함수 (전체 미리보기)
 *
 * @param ddl - 검증할 DDL 문자열
 * @param context - VSCode 확장 컨텍스트
 * @param packageName - 패키지명 (선택사항)
 * @returns 검증 결과 및 미리보기 데이터
 */
export async function validateDDLAndGeneratePreviews(
	ddl: string,
	context: vscode.ExtensionContext,
	packageName?: string,
): Promise<ValidationResult> {
	try {
		// 1. 먼저 DDL 검증 수행
		const validationResult = validateDDL(ddl)

		// 2. 검증에 실패하면 미리보기 없이 반환
		if (!validationResult) {
			return {
				isValid: false,
				error: "Invalid DDL format",
			}
		}

		// 3. 검증에 성공하면 미리보기 생성
		const { previews, languages, packageName: finalPackageName } = await generatePreviews(ddl, context, packageName)

		// 4. 성공 결과 반환
		return {
			isValid: true,
			previews: previews,
			packageName: finalPackageName,
			languages,
		}
	} catch (error) {
		return {
			isValid: false,
			error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
		}
	}
}

/**
 * DDL로부터 미리보기를 생성하는 함수
 *
 * @param ddl - 파싱할 DDL 문자열
 * @param context - VSCode 확장 컨텍스트
 * @param packageName - 패키지명 (선택사항)
 * @returns 미리보기 데이터와 패키지명
 */
export async function generatePreviews(
	ddl: string,
	context: vscode.ExtensionContext,
	packageName?: string,
): Promise<{ previews: { [key: string]: string }; languages: { [key: string]: string }; packageName: string }> {
	// DDL 파싱
	const { tableName, dbTableName, attributes, pkAttributes } = parseDDL(ddl)

	// 기본 패키지명 가져오기
	const finalPackageName =
		packageName ||
		vscode.workspace.getConfiguration("egovframeInitializr").get<string>("defaultPackageName", "egovframework.example.sample")

	// 템플릿 컨텍스트 생성
	const templateContext = getTemplateContext(tableName, attributes, pkAttributes, finalPackageName, dbTableName)
	templateContext.packageName = finalPackageName

	// 모든 템플릿 파일 경로들
	const templateFilePaths = getTemplateFilePaths(context)

	// 모든 템플릿을 병렬로 렌더링 (성능 최적화)
	const templatePromises = [
		{
			key: "vo",
			lang: "java",
			promise: renderTemplateForPreview(templateFilePaths.voTemplateFilePath, templateContext),
		},
		{
			key: "defaultVo",
			lang: "java",
			promise: renderTemplateForPreview(templateFilePaths.defaultVoTemplateFilePath, templateContext),
		},
		{
			key: "controller",
			lang: "java",
			promise: renderTemplateForPreview(templateFilePaths.controllerTemplateFilePath, templateContext),
		},
		{
			key: "service",
			lang: "java",
			promise: renderTemplateForPreview(templateFilePaths.serviceTemplateFilePath, templateContext),
		},
		{
			key: "serviceImpl",
			lang: "java",
			promise: renderTemplateForPreview(templateFilePaths.serviceImplTemplateFilePath, templateContext),
		},
		{
			key: "mapperInterface",
			lang: "java",
			promise: renderTemplateForPreview(templateFilePaths.mapperInterfaceTemplateFilePath, templateContext),
		},
		{
			key: "mapper",
			lang: "xml",
			promise: renderTemplateForPreview(templateFilePaths.mapperTemplateFilePath, templateContext),
		},
		{
			key: "thymeleafList",
			lang: "html",
			promise: renderTemplateForPreview(templateFilePaths.thymeleafListTemplateFilePath, templateContext),
		},
		{
			key: "thymeleafRegister",
			lang: "html",
			promise: renderTemplateForPreview(templateFilePaths.thymeleafRegisterTemplateFilePath, templateContext),
		},
		{
			key: "jspList",
			lang: "html",
			promise: renderTemplateForPreview(templateFilePaths.jspListTemplateFilePath, templateContext),
		},
		{
			key: "jspRegister",
			lang: "html",
			promise: renderTemplateForPreview(templateFilePaths.jspRegisterTemplateFilePath, templateContext),
		},
	]

	// 병렬로 실행하고 결과를 객체로 변환
	const results = await Promise.all(
		templatePromises.map(async ({ key, lang, promise }) => {
			try {
				const result = await promise
				return { key, lang, result }
			} catch (error) {
				return {
					key,
					lang,
					result: `// Error rendering ${key}: ${error instanceof Error ? error.message : "Unknown error"}`,
				}
			}
		}),
	)

	const previews = results.reduce(
		(acc, { key, result }) => {
			acc[key] = result
			return acc
		},
		{} as { [key: string]: string },
	)

	const languages = results.reduce(
		(acc, { key, lang }) => {
			acc[key] = lang
			return acc
		},
		{} as { [key: string]: string },
	)

	return { previews, languages, packageName: finalPackageName }
}

/**
 * 템플릿 파일 경로들을 가져오는 함수
 */
function getTemplateFilePaths(context: vscode.ExtensionContext) {
	const templatesPath = path.join(context.extensionPath, "templates", "code")

	return {
		voTemplateFilePath: path.join(templatesPath, "sample-vo-template.hbs"),
		defaultVoTemplateFilePath: path.join(templatesPath, "sample-default-vo-template.hbs"),
		controllerTemplateFilePath: path.join(templatesPath, "sample-controller-template.hbs"),
		serviceTemplateFilePath: path.join(templatesPath, "sample-service-template.hbs"),
		serviceImplTemplateFilePath: path.join(templatesPath, "sample-service-impl-template.hbs"),
		mapperInterfaceTemplateFilePath: path.join(templatesPath, "sample-mapper-interface-template.hbs"),
		mapperTemplateFilePath: path.join(templatesPath, "sample-mapper-template.hbs"),
		thymeleafListTemplateFilePath: path.join(templatesPath, "sample-thymeleaf-list.hbs"),
		thymeleafRegisterTemplateFilePath: path.join(templatesPath, "sample-thymeleaf-register.hbs"),
		jspListTemplateFilePath: path.join(templatesPath, "sample-jsp-list.hbs"),
		jspRegisterTemplateFilePath: path.join(templatesPath, "sample-jsp-register.hbs"),
	}
}

/**
 * 템플릿을 렌더링하는 함수 (Handlebars 사용)
 */
async function renderTemplateForPreview(templateFilePath: string, context: any): Promise<string> {
	try {
		// 템플릿 파일이 존재하는지 확인
		if (!(await fs.pathExists(templateFilePath))) {
			return `// Template file not found: ${path.basename(templateFilePath)}`
		}

		// 실제 Handlebars 렌더링 사용
		return await renderTemplate(templateFilePath, context)
	} catch (error) {
		return `// Error rendering template: ${error instanceof Error ? error.message : "Unknown error"}`
	}
}
