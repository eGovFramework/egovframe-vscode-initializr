import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs-extra"
import * as fsPromises from "fs/promises"
import { parseDDL } from "../shared/ddlParser"
import { renderTemplate, showFileList, getFilePathForOutput } from "./codeGeneratorUtils"
import { getTemplateContext } from "../shared/templateContext"

// Template file mapping
interface TemplateFileInfo {
	templateFile: string
	outputPath: string
	fileName: string
	// 미리보기/에디터를 위한 추천 언어 정보 (Monaco Editor language id)
	language?: string
}

// Get template files configuration
// 고정된 값이 아니어서 다른 기능들의 환경설정 파일과 달리 templates 폴더 안에 json 파일로 넣기 어려움
function getTemplateFilesConfig(context: any): TemplateFileInfo[] {
	const { tableName, packagePath } = context

	const tableNameCamelCase = tableName[0]?.toLowerCase() + tableName?.slice(1)

	return [
		{
			templateFile: "sample-vo-template.hbs",
			outputPath: `src/main/java/${packagePath}/service/${tableName}VO.java`,
			fileName: `${tableName}VO.java`,
			language: "java",
		},
		{
			templateFile: "sample-default-vo-template.hbs",
			outputPath: `src/main/java/${packagePath}/service/${tableName}DefaultVO.java`,
			fileName: `${tableName}DefaultVO.java`,
			language: "java",
		},
		{
			templateFile: "sample-controller-template.hbs",
			outputPath: `src/main/java/${packagePath}/web/${tableName}Controller.java`,
			fileName: `${tableName}Controller.java`,
			language: "java",
		},
		{
			templateFile: "sample-service-template.hbs",
			outputPath: `src/main/java/${packagePath}/service/${tableName}Service.java`,
			fileName: `${tableName}Service.java`,
			language: "java",
		},
		{
			templateFile: "sample-service-impl-template.hbs",
			outputPath: `src/main/java/${packagePath}/service/impl/${tableName}ServiceImpl.java`,
			fileName: `${tableName}ServiceImpl.java`,
			language: "java",
		},
		{
			templateFile: "sample-mapper-interface-template.hbs",
			outputPath: `src/main/java/${packagePath}/service/impl/${tableName}Mapper.java`,
			fileName: `${tableName}Mapper.java`,
			language: "java",
		},
		{
			templateFile: "sample-mapper-template.hbs",
			outputPath: `src/main/resources/mapper/${tableName}_SQL.xml`, // 생성 경로 고민해보기 : `src/main/resources/mapper/${packagePath}/${tableName}_SQL.xml`, `src/main/resources/mapper/${tableNameCamelCase}/${tableName}_SQL.xml`
			fileName: `${tableName}_SQL.xml`,
			language: "xml",
		},
		{
			templateFile: "sample-thymeleaf-list.hbs",
			outputPath: `src/main/resources/templates/thymeleaf/${tableNameCamelCase}/${tableNameCamelCase}List.html`,
			fileName: `${tableNameCamelCase}List.html`,
			language: "html",
		},
		{
			templateFile: "sample-thymeleaf-register.hbs",
			outputPath: `src/main/resources/templates/thymeleaf/${tableNameCamelCase}/${tableNameCamelCase}Register.html`,
			fileName: `${tableNameCamelCase}Register.html`,
			language: "html",
		},
		{
			templateFile: "sample-jsp-list.hbs",
			outputPath: `src/main/webapp/WEB-INF/jsp/${packagePath}/${tableNameCamelCase}List.jsp`,
			fileName: `${tableNameCamelCase}List.jsp`,
			language: "html",
		},
		{
			templateFile: "sample-jsp-register.hbs",
			outputPath: `src/main/webapp/WEB-INF/jsp/${packagePath}/${tableNameCamelCase}Register.jsp`,
			fileName: `${tableNameCamelCase}Register.jsp`,
			language: "html",
		},
	]
}

// Read template file content
async function readTemplateFile(extensionContext: vscode.ExtensionContext, templateFileName: string): Promise<string> {
	const templatePath = path.join(extensionContext.extensionPath, "templates", "code", templateFileName)

	try {
		const content = await fs.readFile(templatePath, "utf-8")
		return content
	} catch (error) {
		console.error(`Error reading template file ${templateFileName}:`, error)
		throw new Error(`Failed to read template file: ${templateFileName}`)
	}
}

// 프로젝트 루트 경로를 가져오는 헬퍼 함수
function getWorkspaceRoot(): string | undefined {
	if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
		return vscode.workspace.workspaceFolders[0].uri.fsPath
	}
	return undefined
}

// 기본 패키지 경로 생성 함수 : 예) egovframework.example.sample -> egovframework/example/sample
function createPackagePath(packageName: string): string {
	return packageName.replace(/\./g, "/")
}

// 템플릿 컴파일 함수 개선
function compileTemplate(templateContent: string, context: any): string {
	const Handlebars = require("handlebars")

	// Handlebars 헬퍼 등록
	registerHandlebarsHelpers()

	const template = Handlebars.compile(templateContent)
	return template(context)
}

// Handlebars 헬퍼 등록 함수
function registerHandlebarsHelpers() {
	const Handlebars = require("handlebars")

	Handlebars.registerHelper("error", function (message: any) {
		console.error(message)
		return new Handlebars.SafeString(`<span class="error">${message}</span>`)
	})

	Handlebars.registerHelper("empty", function (value: any) {
		return value === null || value === ""
	})

	Handlebars.registerHelper("eq", function (a: any, b: any) {
		return a === b
	})

	Handlebars.registerHelper("concat", function (...args: any[]) {
		return args.slice(0, -1).join("")
	})

	Handlebars.registerHelper("setVar", function (varName: any, varValue: any, options: any) {
		options.data.root[varName] = varValue
	})

	Handlebars.registerHelper("lowercase", function (str: any) {
		if (typeof str !== "string") {
			return ""
		}
		return str.toLowerCase()
	})

	Handlebars.registerHelper("unless", function (this: any, conditional: any, options: any) {
		if (!conditional) {
			return options.fn(this)
		} else {
			return options.inverse(this)
		}
	})

	Handlebars.registerHelper("add", function (a: any, b: any) {
		return (Number(a) || 0) + (Number(b) || 0)
	})
}

/*
 * Generate CRUD Code from DDL
 */
export async function generateCrudFromDDL(
	ddl: string,
	context: vscode.ExtensionContext,
	packageName?: string,
	outputPath?: string,
): Promise<void> {
	try {
		console.log("generateCrudFromDDL called with DDL:", ddl)
		console.log("Provided packageName:", packageName)
		console.log("Provided outputPath:", outputPath)

		let folderPath: string
		let finalPackageName: string

		// folderPath 설정 : 전달받은 outputPath를 이용해서 (또는 전달받은 outputPath가 없으면 showOpenDialog로 선택해서)
		if (outputPath && outputPath.trim()) {
			folderPath = outputPath.trim()
			console.log("Using provided output path:", folderPath)
		} else {
			// 화면단에서 Output Path 입력을 필수로 설정했기 때문에, 이 else 코드는 사용되지 않음
			const workspaceRoot = getWorkspaceRoot()
			let defaultFolder = workspaceRoot

			console.log("Workspace root:", workspaceRoot)

			const selectedFolder = await vscode.window.showOpenDialog({
				title: "Select Folder to Save Generated Files",
				canSelectFolders: true,
				canSelectFiles: false,
				canSelectMany: false,
				openLabel: "Select Folder",
				defaultUri: defaultFolder ? vscode.Uri.file(defaultFolder) : undefined,
			})

			if (!selectedFolder || selectedFolder.length === 0) {
				throw new Error("No folder selected.")
			}

			folderPath = selectedFolder[0].fsPath
			console.log("Selected folder:", folderPath)
		}

		// finalPackageName 설정 : 전달받은 packageName을 이용해서 (또는 전달받은 packageName이 없으면 showInputBox로 선택해서)
		if (packageName && packageName.trim()) {
			finalPackageName = packageName.trim()
			console.log("Using provided package name:", finalPackageName)
		} else {
			// 화면단에서 packageName 입력을 필수로 설정했기 때문에, 이 else 코드는 사용되지 않음
			const inputPackageName = await vscode.window.showInputBox({
				prompt: "Enter package name (e.g., com.example.project)",
				value: "com.example.project",
				validateInput: (value) => {
					if (!value || !/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/.test(value)) {
						return "Please enter a valid package name with dot-separated lowercase segments (e.g., com.example.project)"
					}
					return null
				},
			})

			if (!inputPackageName) {
				throw new Error("Package name is required.")
			}
			finalPackageName = inputPackageName
		}

		// DDL 파싱 : 테이블 이름, 컬럼 정보, 기본키 정보 추출
		const { tableName, dbTableName, attributes, pkAttributes } = parseDDL(ddl)
		console.log("Parsed DDL - tableName:", tableName, "attributes:", attributes.length)

		// 템플릿 컨텍스트 생성 : 테이블 이름, 컬럼 정보, 기본키 정보, 패키지 이름, 패키지 경로 등
		const templateContext = {
			...getTemplateContext(tableName, attributes, pkAttributes, finalPackageName, dbTableName),
			// packageName: finalPackageName, // getTemplateContext 안에서 정의됨
			packagePath: createPackagePath(finalPackageName), //
			// author: "Generated by eGovFrame CRUD Generator", // getTemplateContext 안에서 정의됨
			// date: new Date().toISOString().split("T")[0], // getTemplateContext 안에서 정의됨
			// version: "1.0", // getTemplateContext 안에서 정의됨
		}

		console.log("Template context:", JSON.stringify(templateContext, null, 2))

		const files: { filePath: string; content: string }[] = []

		// 템플릿 파일 가져오기
		const templateFilesConfig = getTemplateFilesConfig(templateContext) // tableName, packagePath만 사용함...
		// templateFilesConfig = [ {templateFile: string outputPath: string, fileName: string}, ... ]

		// 템플릿 파일을 Handlebars 템플릿으로 컴파일하고, 파일 경로 생성
		for (const templateInfo of templateFilesConfig) {
			try {
				console.log("Processing template:", templateInfo.templateFile)

				// 템플릿 파일 읽기
				const templateContent = await readTemplateFile(context, templateInfo.templateFile)

				// 템플릿 컴파일 : Handlebars 템플릿으로 컴파일
				const content = compileTemplate(templateContent, templateContext)

				// 파일 경로 생성 : folderPath와 templateInfo.outputPath를 결합
				const fullFilePath = path.join(folderPath, templateInfo.outputPath)
				console.log("Generated file path:", fullFilePath)

				// 파일 경로와 컨텐트 추가
				files.push({
					filePath: fullFilePath,
					content: content,
				})
			} catch (error) {
				console.error(`Error processing template ${templateInfo.templateFile}:`, error)
			}
		}

		console.log("Generated files count:", files.length)

		// 파일 목록을 보여주고 사용자가 선택한 파일만 저장
		const selectedFilePaths = await showFileList(files)
		console.log("Selected files count:", selectedFilePaths.length)

		// 선택된 파일들 저장
		for (const file of files) {
			if (selectedFilePaths.includes(file.filePath)) {
				console.log("Creating file:", file.filePath)
				await fs.outputFile(file.filePath, file.content)

				// 생성된 파일을 에디터에서 열기 (최대 3개까지만)
				if (selectedFilePaths.indexOf(file.filePath) < 3) {
					const document = await vscode.workspace.openTextDocument(file.filePath)
					await vscode.window.showTextDocument(document)
				}
			}
		}

		if (selectedFilePaths.length > 0) {
			vscode.window.showInformationMessage(`${selectedFilePaths.length} CRUD files generated successfully!`)
		}
	} catch (error) {
		console.error("Error in generateCrudFromDDL:", error)
		const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
		vscode.window.showErrorMessage(`CRUD generation failed: ${errorMessage}`)
		throw error
	}
}

/*
 * Upload Templates
 */
export async function uploadTemplates(ddl: string, packageName: string): Promise<void> {
	const selectedFiles = await vscode.window.showOpenDialog({
		title: "Select HBS Template Files to Upload",
		canSelectFolders: false,
		canSelectFiles: true,
		canSelectMany: true,
		filters: { "Handlebars Templates": ["hbs"], "All Files": ["*"] },
	})

	if (!selectedFiles || selectedFiles.length === 0) {
		vscode.window.showErrorMessage("No files selected.")
		return
	}

	const selectedFolderPath = path.dirname(selectedFiles[0].fsPath)

	for (const file of selectedFiles) {
		const templatePath = file.fsPath
		const outputPath = path.join(selectedFolderPath, path.basename(file.fsPath, ".hbs") + ".generated")

		try {
			const currentParsedDDL = parseDDL(ddl)
			const context = getTemplateContext(
				currentParsedDDL.tableName,
				currentParsedDDL.attributes,
				currentParsedDDL.pkAttributes,
				packageName,
				currentParsedDDL.dbTableName,
			)
			const renderedContent = await renderTemplate(templatePath, context)
			await fs.writeFile(outputPath, renderedContent)
			vscode.window.showInformationMessage(`Custom template saved successfully to ${outputPath}`)

			// Open the newly created file in the editor
			const document = await vscode.workspace.openTextDocument(outputPath)
			await vscode.window.showTextDocument(document)
		} catch (error) {
			throw error
		}
	}
}

/*
 * Download Template Context
 */
export async function downloadTemplateContext(ddl: string, context: any): Promise<void> {
	const selectedFolder = await vscode.window.showOpenDialog({
		title: "Select Folder to Save JSON",
		canSelectFolders: true,
		canSelectFiles: false,
		canSelectMany: false,
		openLabel: "Select Folder",
	})

	if (!selectedFolder || selectedFolder.length === 0) {
		vscode.window.showErrorMessage("No folder selected.")
		return
	}

	const folderPath = selectedFolder[0].fsPath

	try {
		const { tableName } = parseDDL(ddl)
		const jsonContent = JSON.stringify(context, null, 2)
		const outputPath = path.join(folderPath, `${tableName}_TemplateContext.json`)
		await fs.writeFile(outputPath, jsonContent)
		vscode.window.showInformationMessage(`TemplateContext JSON saved successfully to ${outputPath}`)

		// Open the newly created file in the editor
		const document = await vscode.workspace.openTextDocument(outputPath)
		await vscode.window.showTextDocument(document)
	} catch (error) {
		throw error
	}
}
