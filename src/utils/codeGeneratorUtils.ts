import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs-extra"
import * as Handlebars from "handlebars"
import { getJavaClassName as getJavaClassNameFromShared } from "../shared/dataTypes"
import { TemplateContext } from "../shared/templateContext"

// Register Handlebars helpers
function registerHandlebarsHelpers() {
	Handlebars.registerHelper("error", function (message) {
		console.error(message)
		return new Handlebars.SafeString(`<span class="error">${message}</span>`)
	})

	Handlebars.registerHelper("empty", function (value) {
		return value === null || value === ""
	})

	Handlebars.registerHelper("eq", function (a, b) {
		return a === b
	})

	Handlebars.registerHelper("concat", function (...args) {
		return args.slice(0, -1).join("")
	})

	Handlebars.registerHelper("setVar", function (varName, varValue, options) {
		options.data.root[varName] = varValue
	})

	Handlebars.registerHelper("lowercase", function (str) {
		if (typeof str !== "string") {
			return ""
		}
		return str.toLowerCase()
	})

	Handlebars.registerHelper("add", function (a, b) {
		return (Number(a) || 0) + (Number(b) || 0)
	})
}

// renderTemplate 함수는 Handlebars를 사용하여 템플릿을 렌더링한다.
export async function renderTemplate(templateFilePath: string, context: TemplateContext): Promise<string> {
	registerHandlebarsHelpers()
	const template = await fs.readFile(templateFilePath, "utf-8")
	const compiledTemplate = Handlebars.compile(template)
	return compiledTemplate(context)
}

// 데이터베이스 데이터 타입을 Java 타입으로 변환한다.
export function getJavaClassName(dataType: string): string {
	return getJavaClassNameFromShared(dataType)
}

// getFilePathForOutput 함수는 생성된 파일의 경로를 반환한다.
export function getFilePathForOutput(folderPath: string, tableName: string, fileName: string): string {
	const baseJavaPath = path.join(folderPath, "src", "main", "java")
	const defaultPackageName = vscode.workspace
		.getConfiguration("egovframeInitializr")
		.get<string>("defaultPackageName", "egovframework.example.sample")
	const packagePath = defaultPackageName.replace(/\./g, path.sep)
	let outputPath = path.join(folderPath, fileName)

	if (fs.existsSync(baseJavaPath)) {
		if (fileName.endsWith("_Mapper.xml")) {
			outputPath = path.join(folderPath, "src", "main", "resources", "mappers", fileName)
		} else if (fileName.endsWith("Controller.java")) {
			outputPath = path.join(baseJavaPath, packagePath, "web", fileName)
		} else if (fileName.endsWith("Service.java") || fileName.endsWith("VO.java") || fileName.endsWith("DefaultVO.java")) {
			outputPath = path.join(baseJavaPath, packagePath, "service", fileName)
		} else if (fileName.endsWith("ServiceImpl.java") || fileName.endsWith("Mapper.java") || fileName.endsWith("DAO.java")) {
			outputPath = path.join(baseJavaPath, packagePath, "service", "impl", fileName)
		} else if (fileName.endsWith(".jsp")) {
			outputPath = path.join(folderPath, "src", "main", "webapp", "views", fileName)
		} else if (fileName.endsWith(".html")) {
			outputPath = path.join(folderPath, "src", "main", "resources", "templates", "thymeleaf", fileName)
		}
	}

	return outputPath
}

// showFileList 함수는 생성된 파일 목록을 사용자에게 보여주고, 생성할 파일을 선택하도록 한다.
export async function showFileList(files: { filePath: string; content: string }[]) {
	const quickPickItems = files.map((file) => ({
		label: path.basename(file.filePath),
		description: file.filePath.replace(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "", ""),
		filePath: file.filePath,
		picked: true,
	}))

	const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
		canPickMany: true,
		placeHolder: "Select the files to be generated",
	})

	if (!selectedItems) {
		vscode.window.showErrorMessage("No files selected.")
		return []
	}

	return selectedItems.map((item) => item.filePath)
}
