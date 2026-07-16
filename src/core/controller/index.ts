import * as vscode from "vscode"
import { ExtensionMessage } from "@shared/ExtensionMessage"
import { parseWebviewMessage } from "@shared/webviewMessageSchema"

export class Controller {
	private postMessage: (message: ExtensionMessage) => Thenable<boolean> | undefined
	private themeChangeDisposable?: vscode.Disposable

	constructor(
		readonly context: vscode.ExtensionContext,
		private readonly outputChannel: vscode.OutputChannel,
		postMessage: (message: ExtensionMessage) => Thenable<boolean> | undefined,
	) {
		this.outputChannel.appendLine("eGovFrame Controller instantiated")
		this.postMessage = postMessage
		// 테마 변경 이벤트 리스너 등록
		this.setupThemeChangeListener()
	}

	// 테마 변경 이벤트 리스너
	private setupThemeChangeListener() {
		// 테마 변경 이벤트 감지
		this.themeChangeDisposable = vscode.window.onDidChangeActiveColorTheme(async (colorTheme) => {
			const themeName = vscode.workspace.getConfiguration("workbench").get<string>("colorTheme")
			const monacoTheme = this.getMonacoThemeFromVSCodeTheme(colorTheme.kind)

			console.log(`Theme changed: ${themeName} (kind: ${colorTheme.kind}) -> Monaco: ${monacoTheme}`)

			// 웹뷰에 테마 변경 알림
			await this.postMessageToWebview({
				type: "themeChanged",
				theme: monacoTheme,
			})
		})
	}

	// Monaco Editor에 적용할 테마로 변환
	private getMonacoThemeFromVSCodeTheme(themeKind: vscode.ColorThemeKind): "light" | "vs-dark" {
		switch (themeKind) {
			case vscode.ColorThemeKind.Light: // 1
			case vscode.ColorThemeKind.HighContrastLight: // 4
				return "light"
			case vscode.ColorThemeKind.Dark: // 2
			case vscode.ColorThemeKind.HighContrast: // 3
			default:
				return "vs-dark"
		}
	}

	async dispose() {
		this.outputChannel.appendLine("Disposing eGovFrame Controller...")
		this.themeChangeDisposable?.dispose()
	}

	// Send any JSON serializable data to the react app
	async postMessageToWebview(message: ExtensionMessage) {
		await this.postMessage(message)
	}

	/**
	 * Handles messages from the webview.
	 * postMessage로 수신한 값은 신뢰 경계 밖 입력이므로 스키마 검증을 통과한 메시지만 처리한다 (CWE-20).
	 */
	async handleWebviewMessage(rawMessage: unknown) {
		const parsed = parseWebviewMessage(rawMessage)
		if (!parsed.success) {
			console.error("Controller: Rejected invalid webview message:", parsed.error)
			this.outputChannel.appendLine(`Rejected invalid webview message — ${parsed.error}`)
			return
		}
		const message = parsed.message

		console.log("Controller: Received webview message:", message.type, message)
		switch (message.type) {
			case "webviewDidLaunch":
				// Simple acknowledgment that webview is ready
				console.log("Webview launched successfully")
				break

			// Output path selection in eGovFrame project generation progress
			case "selectOutputPath": {
				console.log("Received selectOutputPath message")
				const { getHomeDirectoryUri } = await import("../../utils/path")

				try {
					const folders = await vscode.window.showOpenDialog({
						canSelectFolders: true,
						canSelectFiles: false,
						canSelectMany: false,
						openLabel: "Select Output Directory",
						defaultUri: vscode.workspace.workspaceFolders?.[0].uri || getHomeDirectoryUri() || undefined, // 워크스페이스 경로 또는 사용자 홈 디렉터리를 기본 경로로 설정
						title: "Select Directory for eGovFrame Project",
					})

					console.log("Selected folders:", folders)
					if (folders && folders.length > 0) {
						console.log("Sending selectedOutputPath response:", folders[0].fsPath)
						await this.postMessageToWebview({
							type: "selectedOutputPath",
							text: folders[0].fsPath,
						})
					} else {
						console.log("No folder selected")
					}
				} catch (error) {
					console.error("Error in selectOutputPath:", error)
				}
				break
			}

			// Form-based Project Generation
			case "generateProject": {
				if (message.projectConfig && message.method) {
					const { generateEgovProject, openProjectInVSCode } = await import("../../utils/projectGenerator")

					try {
						// Send progress updates to webview
						const sendProgress = (progressMessage: string) => {
							this.postMessageToWebview({
								type: "projectGenerationProgress",
								text: progressMessage,
							})
						}

						// Read manifest to get repository baseUrl
						let repositoryBaseUrl: string | undefined
						try {
							const manifestJsonPath = vscode.Uri.joinPath(
								this.context.extensionUri,
								"templates",
								"templates-projects.json",
							)
							const manifestJsonContent = await vscode.workspace.fs.readFile(manifestJsonPath)
							const manifest = JSON.parse(manifestJsonContent.toString())
							repositoryBaseUrl = manifest.repository?.baseUrl
						} catch (manifestError) {
							console.warn("Could not read manifest for baseUrl, using default:", manifestError)
						}

						// Add repositoryBaseUrl to projectConfig
						const projectConfigWithBaseUrl = {
							...message.projectConfig,
							repositoryBaseUrl,
						}

						// Generate the project
						const result = await generateEgovProject(
							projectConfigWithBaseUrl, // { projectName: string, artifactId: string, groupId: string, version: string(초기값 "1.0.0"), url: string(초기값 "http://www.egovframe.go.kr"), outputPath: string, template: {displayName: string, fileName: string, pomFile: string}, repositoryBaseUrl: string }
							this.context.extensionPath,
							sendProgress,
						)

						// Send result to webview
						await this.postMessageToWebview({
							type: "projectGenerationResult",
							success: result.success, // boolean
							text: result.message,
							projectPath: result.projectPath,
							error: result.error,
						})

						if (result.error) {
							vscode.window.showErrorMessage(`❌ Failed to generate project: ${result.error}`)
						}
					} catch (error) {
						await this.postMessageToWebview({
							type: "projectGenerationResult",
							success: false,
							text: "Project generation failed",
							error: error instanceof Error ? error.message : String(error),
						})
						vscode.window.showErrorMessage(`❌ Failed to generate project: ${error}`)
					}
				}
				break
			}

			// Command-based Project Generation
			/*
			case "generateProjectByCommand": {
				// Start interactive project generation workflow
				try {
					const { startInteractiveProjectGeneration } = await import("../../utils/projectGenerator")
					await startInteractiveProjectGeneration(this.context)
				} catch (error) {
					vscode.window.showErrorMessage(`Failed to start interactive generation: ${error}`)
				}
				break
			}
			*/

			case "getWorkspacePath": {
				const workspaceFolders = vscode.workspace.workspaceFolders
				if (workspaceFolders && workspaceFolders.length > 0) {
					await this.postMessageToWebview({
						type: "currentWorkspacePath",
						text: workspaceFolders[0].uri.fsPath,
					})
				}
				break
			}

			case "getDefaultSettings": {
				const config = vscode.workspace.getConfiguration("egovframeInitializr")
				const defaultGroupId = config.get<string>("defaultGroupId", "egovframework.com") || "egovframework.com"
				const defaultArtifactId = config.get<string>("defaultArtifactId", "egovframe-project") || "egovframe-project"
				const defaultPackageName =
					config.get<string>("defaultPackageName", "egovframework.example.sample") || "egovframework.example.sample"
				const language = config.get<string>("language", "en") || "en"

				await this.postMessageToWebview({
					type: "egovSettings",
					settings: {
						defaultGroupId,
						defaultArtifactId,
						defaultPackageName,
						language,
					},
				})
				break
			}

			case "generateCode": {
				if (message.ddl) {
					try {
						console.log("Starting CRUD code generation with DDL:", message.ddl)
						console.log("Package name:", message.packageName)
						console.log("Output path:", message.outputPath)
						const { generateCrudFromDDL } = await import("../../utils/codeGenerator")
						await generateCrudFromDDL(message.ddl, this.context, message.packageName, message.outputPath)
						await this.postMessageToWebview({
							type: "success",
							text: "CRUD code generation completed successfully",
						})
					} catch (error) {
						console.error("CRUD code generation error:", error)
						await this.postMessageToWebview({
							type: "error",
							text: error instanceof Error ? error.message : "Code generation failed",
						})
					}
				} else {
					await this.postMessageToWebview({
						type: "error",
						text: "No DDL provided for code generation",
					})
				}
				break
			}

			case "uploadTemplates": {
				if (message.ddl) {
					try {
						const { uploadTemplates } = await import("../../utils/codeGenerator")
						await uploadTemplates(message.ddl, message.packageName || "")
						await this.postMessageToWebview({
							type: "success",
							text: "Custom template code generation completed successfully",
						})
					} catch (error) {
						await this.postMessageToWebview({
							type: "error",
							text: error instanceof Error ? error.message : "Template generation failed",
						})
					}
				}
				break
			}

			case "downloadTemplateContext": {
				if (message.ddl && message.context) {
					try {
						const { downloadTemplateContext } = await import("../../utils/codeGenerator")
						await downloadTemplateContext(message.ddl, message.context)
						await this.postMessageToWebview({
							type: "success",
							text: "Template context downloaded successfully",
						})
					} catch (error) {
						await this.postMessageToWebview({
							type: "error",
							text: error instanceof Error ? error.message : "Template context download failed",
						})
					}
				}
				break
			}

			case "validateDDLOnly": {
				if (message.ddl) {
					try {
						console.log("Starting DDL validation only:", message.ddl)
						const { validateDDLOnly } = await import("../../utils/previewGenerator")
						const result = await validateDDLOnly(message.ddl, this.context, message.packageName)
						await this.postMessageToWebview({
							type: "validationResult",
							isValid: result.isValid,
							packageName: result.packageName,
							error: result.error,
						})
					} catch (error) {
						console.error("DDL validation error:", error)
						await this.postMessageToWebview({
							type: "validationResult",
							isValid: false,
							error: error instanceof Error ? error.message : "Validation failed",
						})
					}
				} else {
					await this.postMessageToWebview({
						type: "validationResult",
						isValid: false,
						error: "No DDL provided for validation",
					})
				}
				break
			}

			case "validateAndPreview": {
				if (message.ddl) {
					try {
						console.log("Starting DDL validation and preview generation:", message.ddl)
						const { validateDDLAndGeneratePreviews } = await import("../../utils/previewGenerator")
						const result = await validateDDLAndGeneratePreviews(message.ddl, this.context, message.packageName)
						await this.postMessageToWebview({
							type: "validationResult",
							isValid: result.isValid,
							previews: result.previews,
							packageName: result.packageName,
							languages: result.languages,
							error: result.error,
						})
					} catch (error) {
						console.error("DDL validation and preview error:", error)
						await this.postMessageToWebview({
							type: "validationResult",
							isValid: false,
							error: error instanceof Error ? error.message : "Validation and preview failed",
						})
					}
				} else {
					await this.postMessageToWebview({
						type: "validationResult",
						isValid: false,
						error: "No DDL provided for validation",
					})
				}
				break
			}

			case "generateConfig": {
				console.log("Received generateConfig message:", message)

				//const template = message.value?.template || message.template
				//const formData = message.value?.formData || message.formData
				//const outputFolder = message.value?.outputFolder
				const template = message.template
				const formData = message.formData
				const outputFolder = message.formData.outputFolder // outputFolder는 formData에 포함되어 있음

				console.log("Template:", template)
				console.log("FormData:", formData)
				console.log("OutputFolder:", outputFolder)

				if (template && formData) {
					try {
						console.log("Importing configGenerator...")
						const { generateConfigFile } = await import("../../utils/configGenerator")
						console.log("Starting config file generation...")
						await generateConfigFile(template, formData, this.context, outputFolder)
						console.log("Config file generated successfully")
						await this.postMessageToWebview({
							type: "success",
							text: "Configuration file generated successfully",
						})
					} catch (error) {
						console.error("Config generation error:", error)
						await this.postMessageToWebview({
							type: "error",
							text: error instanceof Error ? error.message : "Configuration file generation failed",
						})
					}
				} else {
					console.log("Missing template or form data:", { template, formData })
					await this.postMessageToWebview({
						type: "error",
						text: "Missing template or form data for config generation",
					})
				}
				break
			}

			case "showError": {
				if (message.value) {
					vscode.window.showErrorMessage(message.value)
				}
				break
			}

			case "showWarning": {
				if (message.value) {
					vscode.window.showWarningMessage(message.value)
				}
				break
			}

			case "openPackageSettings": {
				vscode.commands.executeCommand("workbench.action.openSettings", "egovframe")
				break
			}

			case "selectOutputFolder": {
				console.log("Controller: Received selectOutputFolder message")
				const { getHomeDirectoryUri } = await import("../../utils/path")

				try {
					console.log("Controller: Opening folder selection dialog...")
					const folders = await vscode.window.showOpenDialog({
						canSelectFolders: true,
						canSelectFiles: false,
						canSelectMany: false,
						openLabel: "Select Output Directory",
						defaultUri: vscode.workspace.workspaceFolders?.[0].uri || getHomeDirectoryUri() || undefined, // 워크스페이스 경로 또는 사용자 홈 디렉터리를 기본 경로로 설정
						title: "Select Directory for Configuration Files",
					})

					console.log("Controller: Selected folders:", folders)
					if (folders && folders.length > 0) {
						const selectedOutputFolderPath = folders[0].fsPath
						const { checkFileExistence } = await import("../../utils/configGenerator")

						// 파일 중복 검사
						const fileExists = await checkFileExistence(selectedOutputFolderPath, message.formData)

						if (fileExists) {
							// 중복 파일이 존재하면
							console.log("Controller: Duplicate file exists:", message.formData.txtFileName)

							await this.postMessageToWebview({
								type: "selectedOutputFolderDuplicate",
								text: "Duplicate file exists:" + message.formData.txtFileName,
							})
						} else {
							// 중복 파일이 존재하지 않으면
							console.log("Controller: Sending selectedOutputFolder response:", selectedOutputFolderPath)

							await this.postMessageToWebview({
								type: "selectedOutputFolder",
								text: selectedOutputFolderPath,
							})
						}

						console.log("Controller: Message sent to webview")
					} else {
						console.log("Controller: No folder selected by user")
					}
				} catch (error) {
					console.error("Controller: Error in selectOutputFolder:", error)
				}
				break
			}

			case "getSampleDDLs": {
				const { SAMPLE_DDLS } = await import("../../utils/SampleDDLs")
				await this.postMessageToWebview({
					type: "sampleDDLs",
					data: SAMPLE_DDLS,
				})
				break
			}

			// 초기 테마 요청 처리
			case "getCurrentTheme": {
				const colorTheme = vscode.window.activeColorTheme
				const monacoTheme = this.getMonacoThemeFromVSCodeTheme(colorTheme.kind)

				await this.postMessageToWebview({
					type: "currentTheme",
					theme: monacoTheme,
				})
				break
			}

			// file path selection in eGovFrame Configuration Generation - Especially for EhcacheForm
			case "selectConfigFilePath": {
				console.log("Received selectConfigFilePath message")
				const { getHomeDirectoryUri } = await import("../../utils/path")
				const { processConfigPath } = await import("../../utils/configGenerator")

				try {
					const files = await vscode.window.showOpenDialog({
						canSelectFolders: false,
						canSelectFiles: true,
						canSelectMany: false,
						openLabel: "Select File",
						defaultUri: vscode.workspace.workspaceFolders?.[0].uri || getHomeDirectoryUri() || undefined, // 워크스페이스 경로 또는 사용자 홈 디렉터리를 기본 경로로 설정
						title: "Select Configuration File",
						filters: {
							"All Files": ["*"],
							"XML Files": ["xml"],
							"Properties Files": ["properties"],
							"JSON Files": ["json", "jsonc"],
							"YAML Files": ["yaml", "yml"],
							"Java Files": ["java"],
						},
					})

					console.log("Selected files:", files)
					if (files && files.length > 0) {
						const selectedPath = files[0].fsPath
						console.log("Selected file path:", selectedPath)

						// 경로 처리: src/main/resources 이후 경로만 추출
						const processedPath = processConfigPath(selectedPath)
						console.log("Processed path:", processedPath)

						await this.postMessageToWebview({
							type: "selectedConfigFilePath",
							text: processedPath,
						})
					} else {
						console.log("No file selected")
					}
				} catch (error) {
					console.error("Error in selectConfigFilePath:", error)
				}
				break
			}

			case "getEgovSettings": {
				try {
					const config = vscode.workspace.getConfiguration("egovframeInitializr")
					const settings = {
						defaultGroupId: config.get<string>("defaultGroupId", "egovframework.com"),
						defaultArtifactId: config.get<string>("defaultArtifactId", "egovframe-project"),
						defaultPackageName: config.get<string>("defaultPackageName", "egovframework.example.sample"),
						language: config.get<string>("language", "en"),
					}

					await this.postMessageToWebview({
						type: "egovSettings",
						settings,
					})
				} catch (error) {
					console.error("Error getting eGov settings:", error)
					await this.postMessageToWebview({
						type: "error",
						message: "Failed to get eGov settings",
					})
				}
				break
			}

			case "updateEgovSettings": {
				try {
					const config = vscode.workspace.getConfiguration("egovframeInitializr")

					if (message.settings && message.settings.defaultGroupId !== undefined) {
						await config.update("defaultGroupId", message.settings.defaultGroupId, vscode.ConfigurationTarget.Global)
					}
					if (message.settings && message.settings.defaultArtifactId !== undefined) {
						await config.update(
							"defaultArtifactId",
							message.settings.defaultArtifactId,
							vscode.ConfigurationTarget.Global,
						)
					}
					if (message.settings && message.settings.defaultPackageName !== undefined) {
						await config.update(
							"defaultPackageName",
							message.settings.defaultPackageName,
							vscode.ConfigurationTarget.Global,
						)
					}
					if (message.settings && message.settings.language !== undefined) {
						await config.update("language", message.settings.language, vscode.ConfigurationTarget.Global)
					}

					await this.postMessageToWebview({
						type: "success",
						message: "Settings saved successfully",
					})
				} catch (error) {
					console.error("Error updating eGov settings:", error)
					await this.postMessageToWebview({
						type: "error",
						message: "Failed to save settings",
					})
				}
				break
			}

			case "getExtensionInfo": {
				try {
					// Read package.json from extension context
					const packageJsonPath = vscode.Uri.joinPath(this.context.extensionUri, "package.json")
					const packageJsonContent = await vscode.workspace.fs.readFile(packageJsonPath)
					const packageJson = JSON.parse(packageJsonContent.toString())

					const info = {
						displayName: packageJson.displayName || "eGovFrame Initializr",
						version: packageJson.version || "Unknown",
						description: packageJson.description || "",
						repository: packageJson.repository?.url || "",
						homepage: packageJson.homepage || "",
						author: packageJson.author?.name || packageJson.author || "",
						license: packageJson.license || "",
					}

					await this.postMessageToWebview({
						type: "extensionInfo",
						info,
					})
				} catch (error) {
					console.error("Error getting extension info:", error)
					await this.postMessageToWebview({
						type: "error",
						message: "Failed to get extension info",
					})
				}
				break
			}

			case "getProjectTemplates": {
				try {
					// Read templates-projects.json from extension context
					const templatesJsonPath = vscode.Uri.joinPath(
						this.context.extensionUri,
						"templates",
						"templates-projects.json",
					)
					const templatesJsonContent = await vscode.workspace.fs.readFile(templatesJsonPath)
					const manifest = JSON.parse(templatesJsonContent.toString())

					await this.postMessageToWebview({
						type: "projectTemplates",
						templates: manifest,
					})
				} catch (error) {
					console.error("Error reading project templates:", error)
					await this.postMessageToWebview({
						type: "error",
						message: "Failed to load project templates",
					})
				}
				break
			}

			case "getConfigTemplates": {
				try {
					// Read templates-context-xml.json from extension context
					const templatesJsonPath = vscode.Uri.joinPath(
						this.context.extensionUri,
						"templates",
						"templates-context-xml.json",
					)
					const templatesJsonContent = await vscode.workspace.fs.readFile(templatesJsonPath)
					const templates = JSON.parse(templatesJsonContent.toString())

					await this.postMessageToWebview({
						type: "configTemplates",
						templates,
					})
				} catch (error) {
					console.error("Error reading config templates:", error)
					await this.postMessageToWebview({
						type: "error",
						message: "Failed to load config templates",
					})
				}
				break
			}

			// Architecture Check - Project Path Selection
			case "selectProjectPath": {
				console.log("Received selectProjectPath message")
				const { getHomeDirectoryUri } = await import("../../utils/path")

				try {
					const folders = await vscode.window.showOpenDialog({
						canSelectFolders: true,
						canSelectFiles: false,
						canSelectMany: false,
						openLabel: "Select Project Directory",
						defaultUri: vscode.workspace.workspaceFolders?.[0].uri || getHomeDirectoryUri() || undefined,
						title: "Select eGovFrame Project Root Directory",
					})

					if (folders && folders.length > 0) {
						await this.postMessageToWebview({
							type: "selectedProjectPath",
							text: folders[0].fsPath,
						})
					}
				} catch (error) {
					console.error("Error in selectProjectPath:", error)
					await this.postMessageToWebview({
						type: "error",
						text: "Failed to select project path",
					})
				}
				break
			}

			// Architecture Check - Start Check
			case "startArchCheck": {
				if (message.projectPath) {
					try {
						const { checkEgovArchitecture } = await import("../../utils/archChecker")

						// Progress callback to send updates to webview
						const progressCallback = (progressMessage: string) => {
							this.postMessageToWebview({
								type: "archCheckProgress",
								text: progressMessage,
							})
						}

						const results = await checkEgovArchitecture(message.projectPath, progressCallback)

						await this.postMessageToWebview({
							type: "archCheckResult",
							success: true,
							results,
						})
					} catch (error) {
						console.error("Architecture check error:", error)
						await this.postMessageToWebview({
							type: "archCheckResult",
							success: false,
							error: error instanceof Error ? error.message : "Architecture check failed",
						})
					}
				} else {
					await this.postMessageToWebview({
						type: "error",
						text: "No project path provided for architecture check",
					})
				}
				break
			}

			// Architecture Check - Export Results
			case "exportArchResults": {
				if (message.results && message.projectPath) {
					try {
						const { exportArchResults } = await import("../../utils/archChecker")
						await exportArchResults(message.results, message.projectPath)
						vscode.window.showInformationMessage("✅ Architecture check results exported successfully")
					} catch (error) {
						console.error("Export results error:", error)
						vscode.window.showErrorMessage(
							`❌ Failed to export results: ${error instanceof Error ? error.message : "Unknown error"}`,
						)
					}
				} else {
					vscode.window.showWarningMessage("No results to export")
				}
				break
			}

			// Open File in Editor
			case "openFile": {
				if (message.filePath) {
					try {
						const fileUri = vscode.Uri.file(message.filePath)
						const document = await vscode.workspace.openTextDocument(fileUri)
						await vscode.window.showTextDocument(document)
					} catch (error) {
						console.error("Error opening file:", error)
						vscode.window.showErrorMessage(`Failed to open file: ${message.filePath}`)
					}
				}
				break
			}

			default:
				console.log("Unhandled message type:", message.type)
				break
		}
	}
}
