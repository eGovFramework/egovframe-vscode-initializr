import * as vscode from "vscode"
import * as fs from "fs-extra"
import * as path from "path"
import AdmZip from "adm-zip"
import * as https from "https"
import * as http from "http"
import { replacePlaceholders } from "../shared/placeholderUtil"
import { assertSafeProjectName, resolveWithinBase } from "./pathSafety"
import { ProjectConfigPayload, ProjectTemplatePayload } from "../shared/WebviewMessage"

export interface EgovProjectTemplate {
	id: string
	name: string
	description: string
	fileName: string
	pomFile?: string
	category?: string
	tags?: string[]
	version?: string
	frameworkVersion?: string
	dependencies?: string[]
	// Version-related fields for download support
	templateId?: string
	included?: boolean
	downloadUrl?: string
	pomDownloadUrl?: string
}

export interface EgovProjectConfig {
	projectName: string
	artifactId: string
	groupId: string
	version?: string
	url?: string
	outputPath: string
	packageName: string
	template: EgovProjectTemplate
	includeSpringBoot?: boolean
	includeJPA?: boolean
	includeMyBatis?: boolean
	includeThymeleaf?: boolean
	author?: string
	description?: string
	// Repository base URL for downloading templates (from manifest)
	repositoryBaseUrl?: string
}

export interface ProjectGenerationResult {
	success: boolean
	message: string
	projectPath?: string
	error?: string
}

// 기본 GitHub URL for downloading templates (fallback if not provided)
const DEFAULT_GITHUB_RELEASES_BASE_URL = "https://github.com/eGovFramework/egovframe-templates-download/releases/download/"

// 캐시 디렉토리 이름
const CACHE_DIR_NAME = "cache"

/**
 * Download a file from URL to local path
 */
async function downloadFile(url: string, destPath: string, progressCallback?: (message: string) => void): Promise<void> {
	return new Promise((resolve, reject) => {
		progressCallback?.(`Downloading from ${url.substring(0, 80)}...`)

		const file = fs.createWriteStream(destPath)
		const parsedUrl = new URL(url)
		const protocol = parsedUrl.protocol === "https:" ? https : http

		const options = {
			hostname: parsedUrl.hostname,
			port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
			path: parsedUrl.pathname + parsedUrl.search,
			method: "GET",
			headers: {
				"User-Agent": "egovframe-vscode-initializr",
			},
		}

		const request = protocol.get(options, (response) => {
			// Handle redirects (301, 302, 307, 308)
			if (response.statusCode && [301, 302, 307, 308].includes(response.statusCode)) {
				const redirectUrl = response.headers.location
				if (redirectUrl) {
					file.close()
					// Safely remove incomplete file
					try {
						if (fs.existsSync(destPath)) {
							fs.unlinkSync(destPath)
						}
					} catch (e) {
						// Ignore deletion errors
					}
					downloadFile(redirectUrl, destPath, progressCallback).then(resolve).catch(reject)
					return
				}
			}

			if (response.statusCode !== 200) {
				file.close()
				// Safely remove incomplete file
				try {
					if (fs.existsSync(destPath)) {
						fs.unlinkSync(destPath)
					}
				} catch (e) {
					// Ignore deletion errors
				}
				reject(new Error(`Failed to download: HTTP ${response.statusCode}`))
				return
			}

			const totalLength = parseInt(response.headers["content-length"] || "0", 10)
			let downloadedLength = 0

			response.on("data", (chunk) => {
				downloadedLength += chunk.length
				if (totalLength > 0) {
					const percent = Math.round((downloadedLength / totalLength) * 100)
					progressCallback?.(`Downloading... ${percent}%`)
				}
			})

			response.pipe(file)

			file.on("finish", () => {
				file.close()
				progressCallback?.(`Download completed`)
				resolve()
			})
		})

		request.on("error", (err) => {
			file.close()
			fs.unlink(destPath, () => {}) // Remove incomplete file
			reject(err)
		})

		file.on("error", (err) => {
			file.close()
			fs.unlink(destPath, () => {}) // Remove incomplete file
			reject(err)
		})
	})
}

/**
 * Get or download template file
 * Returns the path to the template zip file
 */
async function getOrDownloadTemplate(
	template: ProjectTemplatePayload,
	extensionPath: string,
	repositoryBaseUrl?: string,
	progressCallback?: (message: string) => void,
): Promise<string> {
	const examplesDir = path.join(extensionPath, "templates", "projects", "examples")
	const localPath = path.join(examplesDir, template.fileName)

	// 1. Check if file is included in extension
	if (template.included !== false) {
		if (await fs.pathExists(localPath)) {
			return localPath
		}
	}

	// 2. Check cache directory
	const cacheDir = path.join(examplesDir, CACHE_DIR_NAME)
	const cachedPath = path.join(cacheDir, template.fileName)

	if (await fs.pathExists(cachedPath)) {
		progressCallback?.(`📦 Using cached template: ${template.fileName}`)
		return cachedPath
	}

	// 3. Download from GitHub
	if (!template.downloadUrl) {
		throw new Error(`Template file not found and no download URL available: ${template.fileName}`)
	}

	// Ensure cache directory exists
	await fs.ensureDir(cacheDir)

	// Use provided baseUrl or fallback to default
	const baseUrl = repositoryBaseUrl || DEFAULT_GITHUB_RELEASES_BASE_URL

	// Construct full download URL
	const fullUrl = template.downloadUrl.startsWith("http") ? template.downloadUrl : `${baseUrl}${template.downloadUrl}`

	progressCallback?.(`📥 Downloading template from GitHub...`)
	await downloadFile(fullUrl, cachedPath, progressCallback)

	return cachedPath
}

/**
 * Get or download POM template file
 */
async function getOrDownloadPomTemplate(
	template: ProjectTemplatePayload,
	extensionPath: string,
	repositoryBaseUrl?: string,
	progressCallback?: (message: string) => void,
): Promise<string | null> {
	if (!template.pomFile) {
		return null
	}

	const pomDir = path.join(extensionPath, "templates", "projects", "pom")
	const localPath = path.join(pomDir, template.pomFile)

	// 1. Check if file is included in extension
	if (template.included !== false) {
		if (await fs.pathExists(localPath)) {
			return localPath
		}
	}

	// 2. Check cache directory
	const cacheDir = path.join(pomDir, CACHE_DIR_NAME)
	const cachedPath = path.join(cacheDir, template.pomFile)

	if (await fs.pathExists(cachedPath)) {
		return cachedPath
	}

	// 3. Download from GitHub (if pomDownloadUrl is available)
	if (!template.pomDownloadUrl) {
		// POM file is optional, return null if not available
		return null
	}

	// Ensure cache directory exists
	await fs.ensureDir(cacheDir)

	// Use provided baseUrl or fallback to default
	const baseUrl = repositoryBaseUrl || DEFAULT_GITHUB_RELEASES_BASE_URL

	// Construct full download URL
	const fullUrl = template.pomDownloadUrl.startsWith("http") ? template.pomDownloadUrl : `${baseUrl}${template.pomDownloadUrl}`

	progressCallback?.(`📥 Downloading POM template from GitHub...`)
	await downloadFile(fullUrl, cachedPath, progressCallback)

	return cachedPath
}

/*
 * Generate eGovFrame project
 *
 * Form-based Project Generation
 */
/** 프로젝트 생성 입력 — 웹뷰 페이로드에 컨트롤러가 manifest의 repository.baseUrl을 주입한 형태 */
export type GenerateProjectInput = ProjectConfigPayload & { repositoryBaseUrl?: string }

export async function generateEgovProject(
	config: GenerateProjectInput,
	extensionPath: string,
	progressCallback?: (message: string) => void,
): Promise<ProjectGenerationResult> {
	try {
		// Validate config
		if (!config.projectName?.trim()) {
			throw new Error("Project name is required")
		}

		if (!config.artifactId?.trim()) {
			throw new Error("Artifact ID is required")
		}

		if (!config.groupId?.trim()) {
			throw new Error("Group ID is required")
		}
		/*
		if (!config.version?.trim()) {
			throw new Error("Version is required")
		}

		if (!config.url?.trim()) {
			throw new Error("URL is required")
		}
		*/

		if (!config.outputPath?.trim()) {
			throw new Error("Output path is required")
		}

		if (!config.template?.fileName) {
			throw new Error("Template file name is required")
		}

		// Restrict project name to a safe single directory component (CWE-22)
		assertSafeProjectName(config.projectName)

		// Setup paths
		// Defense in depth: ensure the project root stays inside the output path
		const projectRoot = resolveWithinBase(config.outputPath, config.projectName)

		progressCallback?.("📁 Creating project directory...")

		// Check if project directory already exists
		if (await fs.pathExists(projectRoot)) {
			throw new Error(`Project directory already exists: ${projectRoot}`)
		}

		// Get template file (download if needed)
		progressCallback?.("Preparing template...")
		const zipFilePath = await getOrDownloadTemplate(
			config.template,
			extensionPath,
			config.repositoryBaseUrl,
			progressCallback,
		)

		// Check if template file exists after download attempt
		if (!(await fs.pathExists(zipFilePath))) {
			throw new Error(`Template file not found: ${zipFilePath}`)
		}

		progressCallback?.("📦 Extracting template...")

		// Extract template ZIP.
		// NOTE: Do NOT switch back to a streaming extractor (extract-zip/yauzl/fd-slicer).
		// Those hand-roll an fd refCount over serialized chunk streams; on newer Node
		// runtimes (VS Code 1.128+) the completion event never fires for templates that
		// contain large files, so extraction hangs forever right here. adm-zip reads the
		// archive fully and writes synchronously — no stream lifecycle to wedge.
		new AdmZip(zipFilePath).extractAllTo(projectRoot, /* overwrite */ true, /* keepOriginalPermission */ true)

		// processTemplateFiles를 적용할만한 zip파일이 없음 => 아래 processTemplateFiles, processFilesRecursively 함수 주석처리
		/*
		progressCallback?.("📝 Processing template files...")

		// Process template files (replace placeholders)
		await processTemplateFiles(projectRoot, config)
		*/

		// Generate POM file if needed
		if (config.template.pomFile) {
			await generatePomFile(config, projectRoot, extensionPath, config.template, config.repositoryBaseUrl, progressCallback)
		}

		// updatePackageNames 함수 주석처리
		/*
		// Update package names in Java files
		await updatePackageNames(projectRoot, config.packageName, progressCallback)
		*/

		progressCallback?.("✅ Project generated successfully!")

		// Notify completion
		vscode.window
			.showInformationMessage(
				`✅ eGovFrame project '${config.projectName}' created successfully!`,
				"Open project in new window",
			)
			.then((selection) => {
				if (selection === "Open project in new window") {
					vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(projectRoot), true)
				}
			})
		/* 이런 방식도 가능하다 (참고만)
		const openProject = await vscode.window.showInformationMessage(
			`✅ eGovFrame project "${message.projectConfig.projectName}" created successfully!`,
			"Open Project",
			"Open in New Window",
		)
		if (openProject === "Open Project") {
			const projectUri = vscode.Uri.file(result.projectPath!)
			await vscode.commands.executeCommand("vscode.openFolder", projectUri, true)
			await openProjectInVSCode(result.projectPath!)
		} else if (openProject === "Open in New Window") {
			const projectUri = vscode.Uri.file(result.projectPath!)
			await vscode.commands.executeCommand("vscode.openFolder", projectUri, true)
		}
		*/

		return {
			success: true,
			message: "Project generated successfully",
			projectPath: projectRoot,
		}
	} catch (error) {
		console.error("Error generating eGovFrame project:", error)
		const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
		return {
			success: false,
			message: "Project generation failed",
			error: errorMessage,
		}
	}
}

// generateEgovProject 함수에서 processTemplateFiles 함수 주석처리
/*
// Internal function for Form-based Project Generation
async function processTemplateFiles(projectRoot: string, config: EgovProjectConfig): Promise<void> { // config = { projectName: string, groupId: string, outputPath: string, template: {displayName: string, fileName: string, pomFile: string} }
	const placeholders = {
		"{{projectName}}": config.projectName,
		"{{groupId}}": config.groupId,
		//"{{PACKAGE_NAME}}": config.packageName,
		//"{{AUTHOR}}": config.author || "eGovFrame Developer",
		//"{{DESCRIPTION}}": config.description || `eGovFrame project: ${config.projectName}`,
		//"{{FRAMEWORK_VERSION}}": config.template.frameworkVersion || "4.3.0",
	}

	// Find all text files to process
	const textFileExtensions = [".java", ".xml", ".jsp", ".html", ".js", ".css", ".properties", ".yml", ".yaml", ".md", ".txt"]

	await processFilesRecursively(projectRoot, placeholders, textFileExtensions)
}

// Internal function for processTemplateFiles
async function processFilesRecursively(projectRoot: string, placeholders: Record<string, string>, extensions: string[]): Promise<void> {
	const entries = await fs.readdir(projectRoot, { withFileTypes: true })
	// If called with `withFileTypes: true`, the result data will be an array of Dirent (after path = projectRoot)
	// fs.Dirent object : 디렉터리 내 파일 및 하위 디렉터리에 대한 정보를 담은 구조체
	// 예) projectroot.file-a, projectroot.forder-B.fild-b → entries = [a, B.b]

	for (const entry of entries) {
		const fullPath = path.join(projectRoot, entry.name)

		if (entry.isDirectory()) {
			// 디렉터리면 하위 디렉터리를 재귀적으로 처리
			await processFilesRecursively(fullPath, placeholders, extensions)
		} else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
			// 파일이면 파일 내용을 읽어서 플레이스홀더를 대체
			try {
				let content = await fs.readFile(fullPath, "utf8")

				// Replace placeholders
				for (const [placeholder, value] of Object.entries(placeholders)) {
					content = content.replace(new RegExp(placeholder, "g"), value)
				}

				// Replace file's content with the replaced content
				await fs.writeFile(fullPath, content, "utf8")
			} catch (error) {
				console.warn(`Warning: Could not process file ${fullPath}:`, error)
			}
		}
	}
}
*/

// Internal function for Form-based Project Generation
async function generatePomFile(
	config: ProjectConfigPayload,
	projectRoot: string,
	extensionPath: string,
	template: ProjectTemplatePayload,
	repositoryBaseUrl?: string,
	progressCallback?: (message: string) => void,
): Promise<void> {
	try {
		progressCallback?.("📝 Generating Maven POM file...")

		// Get POM template file (download if needed)
		const templatePath = await getOrDownloadPomTemplate(template, extensionPath, repositoryBaseUrl, progressCallback)
		const outputPath = path.join(projectRoot, "pom.xml")

		// Check if POM template exists
		if (!templatePath || !(await fs.pathExists(templatePath))) {
			// 이 안에는 다음 코드만 있어도 될 것 같다.
			// throw new Error(`POM template not found: ${config.template.pomFile}`)
			// getOrDownloadPomTemplate 함수에서 이미 아래 localTemplatePath 경우까지 다 처리하기 때문이다.
			// 이 if문 안에 있는 코드를 그대로 두겠다.

			// Fallback to local path
			const localTemplatePath = path.join(extensionPath, "templates", "projects", "pom", config.template.pomFile)
			if (!(await fs.pathExists(localTemplatePath))) {
				throw new Error(`POM template not found: ${config.template.pomFile}`)
			}
			// Use local template path
			let content = await fs.readFile(localTemplatePath, "utf8")
			// Replace placeholders and write
			const placeholders = {
				"###NAME###": config.projectName,
				"###ARTIFACT_ID###": config.artifactId,
				"###GROUP_ID###": config.groupId,
				"###VERSION###": config.version || "1.0.0",
				"###URL###": config.url || "https://www.egovframe.go.kr",
			}
			content = replacePlaceholders(content, placeholders)
			await fs.writeFile(outputPath, content, "utf8")
			progressCallback?.("📝 Maven POM file generated successfully!")
			return
		}

		// Read POM template
		let content = await fs.readFile(templatePath, "utf8")

		// Replace placeholders
		const placeholders = {
			"###NAME###": config.projectName,
			"###ARTIFACT_ID###": config.artifactId,
			"###GROUP_ID###": config.groupId,
			"###VERSION###": config.version || "1.0.0",
			"###URL###": config.url || "https://www.egovframe.go.kr",
			//"{{PACKAGE_NAME}}": config.packageName,
			//"{{DESCRIPTION}}": config.description || `eGovFrame project: ${config.projectName}`,
			//"{{FRAMEWORK_VERSION}}": config.template.frameworkVersion || "4.3.0",
		}
		content = replacePlaceholders(content, placeholders)

		// Write POM file
		await fs.writeFile(outputPath, content, "utf8")

		progressCallback?.("📝 Maven POM file generated successfully!")
	} catch (error) {
		console.error("Error generating POM file:", error)
		throw error
	}
}

// generateEgovProject 함수에서 updatePackageNames 함수 주석처리
/*
// Internal function for Form-based Project Generation
async function updatePackageNames(
	projectRoot: string,
	packageName: string,
	progressCallback?: (message: string) => void,
): Promise<void> {
	try {
		progressCallback?.("📦 Updating package names...")

		// Find all Java files
		const javaFiles = await findFilesByExtension(projectRoot, ".java")

		for (const javaFile of javaFiles) {
			try {
				let content = await fs.readFile(javaFile, "utf8")

				// Update package declaration
				content = content.replace(/^package\s+[\w.]+;/m, `package ${packageName};`)

				// Update import statements (if they reference the same base package)
				const packageParts = packageName.split(".")
				const basePackage = packageParts.slice(0, -1).join(".")
				content = content.replace(/import\s+egovframework\.[\w.]+;/g, (match) => {
					const importPath = match.match(/import\s+([\w.]+);/)?.[1]
					if (importPath) {
						const className = importPath.split(".").pop()
						return `import ${basePackage}.${className};`
					}
					return match
				})

				await fs.writeFile(javaFile, content, "utf8")
			} catch (error) {
				console.warn(`Warning: Could not update package in ${javaFile}:`, error)
			}
		}

		// Update directory structure to match package name
		await updateDirectoryStructure(projectRoot, packageName)

		progressCallback?.("📦 Package names updated successfully!")
	} catch (error) {
		console.error("Error updating package names:", error)
		throw error
	}
}

// Internal function for updatePackageNames and updateDirectoryStructure
async function findFilesByExtension(dir: string, extension: string): Promise<string[]> {
	const files: string[] = []
	const entries = await fs.readdir(dir, { withFileTypes: true })

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)

		if (entry.isDirectory()) {
			files.push(...(await findFilesByExtension(fullPath, extension)))
		} else if (entry.isFile() && path.extname(entry.name) === extension) {
			files.push(fullPath)
		}
	}

	return files
}

// Internal function for updatePackageNames
async function updateDirectoryStructure(projectRoot: string, packageName: string): Promise<void> {
	const srcMainJava = path.join(projectRoot, "src", "main", "java")

	if (!(await fs.pathExists(srcMainJava))) {
		return
	}

	// Create new package directory structure
	const packageDirs = packageName.split(".")
	const newPackageDir = path.join(srcMainJava, ...packageDirs)

	await fs.ensureDir(newPackageDir)

	// Move Java files to new package directory
	const javaFiles = await findFilesByExtension(srcMainJava, ".java")

	for (const javaFile of javaFiles) {
		const fileName = path.basename(javaFile)
		const newFilePath = path.join(newPackageDir, fileName)

		// Skip if file is already in the correct location
		if (javaFile === newFilePath) {
			continue
		}

		await fs.move(javaFile, newFilePath, { overwrite: true })
	}
}
*/

/**
 * Open project in VSCode
 */
export async function openProjectInVSCode(projectPath: string): Promise<void> {
	try {
		await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(projectPath), true)
	} catch (error) {
		console.error("Error opening project in VSCode:", error)
		throw error
	}
}

/**
 * Start interactive project generation
 *
 * Command-based Project Generation
 */
/*
export async function startInteractiveProjectGeneration(context: vscode.ExtensionContext): Promise<void> {
	try {
		// Get available templates
		const templates = await getAvailableTemplates(context.extensionPath)

		if (templates.length === 0) {
			vscode.window.showErrorMessage("No project templates found")
			return
		}

		// Step 1: Select template
		const templateItems = templates.map((template) => ({
			label: template.name,
			description: template.description,
			detail: `Category: ${template.category || "General"} | File: ${template.fileName}`,
			template,
		}))

		const selectedTemplateItem = await vscode.window.showQuickPick(templateItems, {
			placeHolder: "Select a project template",
			matchOnDescription: true,
			matchOnDetail: true,
		})

		if (!selectedTemplateItem) {
			return
		}

		// Step 2: Enter project name
		const projectName = await vscode.window.showInputBox({
			prompt: "Enter project name",
			validateInput: (value) => {
				if (!value || !value.trim()) {
					return "Project name is required"
				}
				if (!/^[a-zA-Z0-9_-]+$/.test(value.trim())) {
					return "Project name can only contain letters, numbers, hyphens, and underscores"
				}
				return null
			},
		})

		if (!projectName) {
			return
		}

		// Step 3: Enter package name (if template has POM file)
		let packageName = "egovframework.example.sample"
		if (selectedTemplateItem.template.pomFile) {
			const inputPackageName = await vscode.window.showInputBox({
				prompt: "Enter Java package name (e.g., com.company.project)",
				value: packageName,
				validateInput: (value) => {
					if (!value || !value.includes(".")) {
						return "Please enter a valid package name (e.g., com.company.project)"
					}
					return null
				},
			})

			if (!inputPackageName) {
				return
			}
			packageName = inputPackageName
		}

		// Step 4: Select output directory
		const folderOptions = await vscode.window.showOpenDialog({
			canSelectFolders: true,
			canSelectFiles: false,
			canSelectMany: false,
			openLabel: "Select Output Directory",
		})

		if (!folderOptions || folderOptions.length === 0) {
			return
		}

		const outputPath = folderOptions[0].fsPath

		// Step 5: Generate project
		const config: EgovProjectConfig = {
			projectName: projectName.trim(),
			outputPath,
			packageName,
			template: selectedTemplateItem.template,
		}

		vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: "Generating eGovFrame project...",
				cancellable: false,
			},
			async (progress) => {
				const result = await generateEgovProject(config, context.extensionPath, (message) => {
					progress.report({ message })
				})

				if (result.success) {
					const selection = await vscode.window.showInformationMessage(
						`Project '${projectName}' generated successfully!`,
						"Open Project",
						"Open in New Window",
					)

					if (selection === "Open Project") {
						await openProjectInVSCode(result.projectPath!)
					} else if (selection === "Open in New Window") {
						await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(result.projectPath!), true)
					}
				} else {
					vscode.window.showErrorMessage(`Failed to generate project: ${result.error}`)
				}
			},
		)
	} catch (error) {
		console.error("Error in interactive project generation:", error)
		vscode.window.showErrorMessage(`Interactive generation failed: ${error}`)
	}
}
*/

/*
// Internal function for Command-based Project Generation
export async function getAvailableTemplates(extensionPath: string): Promise<EgovProjectTemplate[]> {
	try {
		const templatesConfigPath = path.join(extensionPath, "templates", "templates-projects.json")

		if (await fs.pathExists(templatesConfigPath)) {
			const templatesData = await fs.readJSON(templatesConfigPath)
			return templatesData
		} else {
			// Fallback to default templates if config file not found
			return getDefaultTemplates()
		}
	} catch (error) {
		console.error("Error loading templates:", error)
		return getDefaultTemplates()
	}
}

// Internal function for getAvailableTemplates
function getDefaultTemplates(): EgovProjectTemplate[] {
	return [
		{
			id: "simple-web",
			name: "Simple Web Application",
			description: "Basic eGovFrame web application template",
			fileName: "example-template-simple.zip",
			pomFile: "simple-pom.xml",
			category: "Web Application",
			tags: ["web", "mvc", "basic"],
			frameworkVersion: "4.3.0",
		},
		{
			id: "enterprise",
			name: "Enterprise Application",
			description: "Full-featured enterprise application template",
			fileName: "example-template-enterprise.zip",
			pomFile: "enterprise-pom.xml",
			category: "Enterprise",
			tags: ["enterprise", "full-stack", "advanced"],
			frameworkVersion: "4.3.0",
		},
		{
			id: "mobile-hybrid",
			name: "Mobile Hybrid Application",
			description: "Mobile hybrid application template",
			fileName: "egovframework-all-in-one-mobile-4.3.0.zip",
			pomFile: "mobile-pom.xml",
			category: "Mobile",
			tags: ["mobile", "hybrid", "cordova"],
			frameworkVersion: "4.3.0",
		},
		{
			id: "msa-portal",
			name: "MSA Portal",
			description: "Microservices architecture portal template",
			fileName: "egovframe-msa-portal-backend.zip",
			pomFile: "msa-pom.xml",
			category: "Microservices",
			tags: ["msa", "microservices", "portal"],
			frameworkVersion: "4.3.0",
		},
		{
			id: "spring-boot",
			name: "Spring Boot Web",
			description: "Spring Boot based web application",
			fileName: "example-boot-web.zip",
			pomFile: "boot-pom.xml",
			category: "Spring Boot",
			tags: ["spring-boot", "web", "modern"],
			frameworkVersion: "4.3.0",
		},
	]
}
*/

// 쓰이는 곳 없음
/**
 * Get project size information
 */
export async function getProjectSize(projectPath: string): Promise<{ files: number; size: number }> {
	try {
		const getFolderSize = require("get-folder-size")
		const size = await new Promise<number>((resolve, reject) => {
			getFolderSize(projectPath, (err: Error | null, size: number) => {
				if (err) {
					reject(err)
				} else {
					resolve(size)
				}
			})
		})

		const files = await countFiles(projectPath)
		return { files, size }
	} catch (error) {
		console.error("Error getting project size:", error)
		return { files: 0, size: 0 }
	}
}

// getProjectSize 외에 쓰이는 곳 없음
async function countFiles(dir: string): Promise<number> {
	let count = 0
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true })

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name)

			if (entry.isDirectory()) {
				count += await countFiles(fullPath)
			} else if (entry.isFile()) {
				count++
			}
		}
	} catch (error) {
		console.warn(`Warning: Could not read directory ${dir}:`, error)
	}

	return count
}
