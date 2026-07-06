import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs-extra"
import * as Handlebars from "handlebars"
import { sanitizeFileName, resolveWithinBase } from "./pathSafety"

// Template configuration interface
export interface TemplateConfig {
	displayName: string
	templateFolder: string
	templateFile: string
	webView: string
	fileNameProperty: string
	javaConfigTemplate?: string
	yamlTemplate?: string
	propertiesTemplate?: string
	description?: string
}

// Form data interface
export interface ConfigFormData {
	[key: string]: any
	txtFileName: string
	generationType: string
}

// Register basic Handlebars helpers
Handlebars.registerHelper("eq", function (a: any, b: any) {
	return a === b
})

Handlebars.registerHelper("ne", function (a: any, b: any) {
	return a !== b
})

Handlebars.registerHelper("capitalize", function (str: string) {
	if (!str) {
		return ""
	}
	return str.charAt(0).toUpperCase() + str.slice(1)
})

Handlebars.registerHelper("trim", (v) => String(v ?? "").trim())

Handlebars.registerHelper("or", function () {
	const args = Array.from(arguments)
	const opts = args.pop() // 마지막 인자 = options
	return args.some((v) => !!v) // 하나라도 truthy면 true
})

/**
 * 설정 파일 경로를 처리하여 적절한 형태로 변환
 * src/main/resources 이후 경로만 추출하거나, 그런 구조가 없으면 전체 경로 반환
 */
export function processConfigPath(fullPath: string): string {
	// 경로를 정규화 (백슬래시를 슬래시로 변환)
	const normalizedPath = fullPath.replace(/\\/g, "/")

	// src/main/resources 패턴을 찾기
	const resourcesPattern = /.*\/src\/main\/resources(\/.*)?$/
	const match = normalizedPath.match(resourcesPattern)

	if (match && match[1]) {
		// src/main/resources 이후 경로가 있으면 그것만 반환 (앞의 / 제거)
		return match[1].startsWith("/") ? match[1].substring(1) : match[1]
	} else if (match) {
		// src/main/resources까지만 있으면 빈 문자열 반환
		return ""
	} else {
		/*
		// src/main/resources 구조가 없으면 전체 경로 반환
		const fileName = normalizedPath.split('/').pop() || normalizedPath
		return fileName
		*/
		return normalizedPath
	}
}

/**
 * check file existence
 * @param selectedOutputFolderPath - selected output folder path
 * @param formData - any
 * @returns boolean
 */
export async function checkFileExistence(selectedOutputFolderPath: string, formData: ConfigFormData): Promise<boolean> {
	const generationType: string = formData.generationType

	// 파일 확장자 결정
	const getFileExtension = (generationType: string) => {
		switch (generationType) {
			case "xml":
				return ".xml"
			case "javaConfig":
				return ".java"
			case "yaml":
				return ".yaml"
			case "json":
				return ".json"
			case "properties":
				return ".properties"
			default:
				return ".xml"
		}
	}

	const extension = getFileExtension(generationType)
	const fileName = formData.txtFileName.includes(".") ? formData.txtFileName : `${formData.txtFileName}${extension}`
	const filePath = path.join(selectedOutputFolderPath, fileName)

	console.log("Checking file existence:", filePath)

	return await fs.pathExists(filePath)
}

/**
 * Render template with context data
 */
export async function renderTemplate(templateFilePath: string, context: any): Promise<string> {
	// Get default package name from settings
	const defaultPackageName = vscode.workspace
		.getConfiguration("egovframe")
		.get<string>("defaultPackageName", "egovframework.example.sample")

	// Enrich context with default values
	const enrichedContext = {
		...context,
		defaultPackageName,
	}

	try {
		let template = await fs.readFile(templateFilePath, "utf-8")

		// Handle #parse directives (simple include mechanism)
		const parseRegex = /#parse\("(.+)"\)/g
		let match
		while ((match = parseRegex.exec(template)) !== null) {
			const includeFilePath = path.join(path.dirname(templateFilePath), match[1])
			if (await fs.pathExists(includeFilePath)) {
				const includeTemplate = await fs.readFile(includeFilePath, "utf-8")
				template = template.replace(match[0], includeTemplate)
			}
		}

		const compiledTemplate = Handlebars.compile(template)
		return compiledTemplate(enrichedContext)
	} catch (error) {
		console.error("Error rendering template:", error)
		throw new Error(`Failed to render template: ${error instanceof Error ? error.message : String(error)}`)
	}
}

/**
 * Generate configuration file
 */
export async function generateFile(
	data: ConfigFormData,
	context: vscode.ExtensionContext,
	templateFolder: string,
	templateFile: string,
	outputFolderPath: string,
	fileNameProperty: string,
	fileExtension: string,
): Promise<void> {
	try {
		console.log("generateFile called with:")
		console.log("- templateFolder:", templateFolder)
		console.log("- templateFile:", templateFile)
		console.log("- fileNameProperty:", fileNameProperty)
		console.log("- data:", data)

		// Build template path - use only templates path
		const templatePath = path.join(context.extensionPath, "templates", "config", templateFolder, templateFile)

		console.log("- using templates path:", templatePath)
		console.log("- templates path exists:", await fs.pathExists(templatePath))

		if (!(await fs.pathExists(templatePath))) {
			console.error("Template file not found")
			throw new Error(`Template file not found: ${templateFile} in folder ${templateFolder}`)
		}

		console.log("- using template path:", templatePath)

		const content = await renderTemplate(templatePath, data)
		console.log("- template rendered, content length:", content.length)

		// Reduce the user-supplied name to a plain file name to block path traversal (CWE-22)
		let fileName = sanitizeFileName(data[fileNameProperty] || "default_filename")
		if (!fileName.endsWith(`.${fileExtension}`)) {
			fileName += `.${fileExtension}`
		}

		// Defense in depth: ensure the resolved path stays inside the output folder
		const outputPath = resolveWithinBase(outputFolderPath, fileName)
		console.log("- output path:", outputPath)

		// Ensure output directory exists
		await fs.ensureDir(path.dirname(outputPath))

		await fs.writeFile(outputPath, content, "utf-8")
		console.log("- file written successfully")

		vscode.window.showInformationMessage(`${fileExtension.toUpperCase()} file created: ${outputPath}`)

		// Open the generated file
		try {
			const document = await vscode.workspace.openTextDocument(outputPath)
			await vscode.window.showTextDocument(document)
			console.log("- file opened in editor")
		} catch (error) {
			console.warn("Could not open generated file:", error)
		}
	} catch (error) {
		console.error("Error generating file:", error)
		throw error
	}
}

/**
 * Get output folder path
 */
async function getOutputPath(): Promise<string> {
	// Try to get current workspace folder
	const workspaceFolders = vscode.workspace.workspaceFolders
	if (workspaceFolders && workspaceFolders.length > 0) {
		return workspaceFolders[0].uri.fsPath
	}

	// If no workspace, prompt user to select folder
	const folderUri = await vscode.window.showOpenDialog({
		canSelectFolders: true,
		canSelectFiles: false,
		canSelectMany: false,
		openLabel: "Select folder to generate config files",
	})

	if (!folderUri || folderUri.length === 0) {
		throw new Error("No output folder selected")
	}

	return folderUri[0].fsPath
}

/**
 * Main function to generate configuration file
 */
export async function generateConfigFile(
	template: TemplateConfig,
	formData: ConfigFormData,
	context: vscode.ExtensionContext,
	outputFolderPath?: string,
): Promise<void> {
	try {
		console.log("generateConfigFile called with:")
		console.log("- template:", template)
		console.log("- formData:", formData)
		console.log("- context.extensionPath:", context.extensionPath)
		console.log("- outputFolderPath:", outputFolderPath)

		const finalOutputPath = outputFolderPath || (await getOutputPath())
		console.log("- finalOutputPath:", finalOutputPath)

		// Determine which template and extension to use based on generation type
		let templateFile: string
		let fileExtension: string

		console.log("- generationType:", formData.generationType)

		switch (formData.generationType) {
			case "xml":
				templateFile = template.templateFile
				fileExtension = "xml"
				break
			case "javaConfig":
				if (!template.javaConfigTemplate) {
					throw new Error("Java config template not available for this configuration type")
				}
				templateFile = template.javaConfigTemplate
				fileExtension = "java"
				break
			case "yaml":
				if (!template.yamlTemplate) {
					throw new Error("YAML template not available for this configuration type")
				}
				templateFile = template.yamlTemplate
				fileExtension = "yaml"
				break
			case "properties":
				if (!template.propertiesTemplate) {
					throw new Error("Properties template not available for this configuration type")
				}
				templateFile = template.propertiesTemplate
				fileExtension = "properties"
				break
			default:
				templateFile = template.templateFile
				fileExtension = "xml"
		}

		console.log("- templateFile:", templateFile)
		console.log("- fileExtension:", fileExtension)

		await generateFile(
			formData,
			context,
			template.templateFolder,
			templateFile,
			finalOutputPath,
			template.fileNameProperty,
			fileExtension,
		)
	} catch (error) {
		console.error("Config generation failed:", error)
		throw error
	}
}
