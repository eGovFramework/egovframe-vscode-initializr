import * as vscode from "vscode"
import { Controller } from "../controller"
import { ExtensionMessage } from "@shared/ExtensionMessage"
import { WebviewMessage } from "@shared/WebviewMessage"

export class WebviewProvider implements vscode.WebviewViewProvider {
	public static readonly sideBarId = "egovframe.SidebarProvider"
	public static readonly tabPanelId = "egovframe.TabPanelProvider"

	private static sideBarInstance: WebviewProvider | undefined
	private static tabInstances: WebviewProvider[] = []

	public controller: Controller
	public view?: vscode.WebviewView | vscode.WebviewPanel

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly outputChannel: vscode.OutputChannel,
	) {
		this.controller = new Controller(context, outputChannel, (message: ExtensionMessage) => this.postMessage(message))
	}

	public static getSidebarInstance(): WebviewProvider | undefined {
		return WebviewProvider.sideBarInstance
	}

	public static getTabInstances(): WebviewProvider[] {
		return WebviewProvider.tabInstances
	}

	public static getVisibleInstance(): WebviewProvider | undefined {
		// Check tab instances first as they are usually more prominent
		const visibleTab = WebviewProvider.tabInstances.find((instance) => {
			if (instance.view && "visible" in instance.view) {
				return instance.view.visible
			}
			return false
		})

		if (visibleTab) {
			return visibleTab
		}

		// Check sidebar instance
		if (WebviewProvider.sideBarInstance?.view && "visible" in WebviewProvider.sideBarInstance.view) {
			return WebviewProvider.sideBarInstance.view.visible ? WebviewProvider.sideBarInstance : undefined
		}

		return undefined
	}

	public static getAllInstances(): WebviewProvider[] {
		const instances: WebviewProvider[] = []
		if (WebviewProvider.sideBarInstance) {
			instances.push(WebviewProvider.sideBarInstance)
		}
		instances.push(...WebviewProvider.tabInstances)
		return instances
	}

	public resolveWebviewView(webviewView: vscode.WebviewView | vscode.WebviewPanel): void {
		this.view = webviewView

		// Register this instance
		if ("viewType" in webviewView && webviewView.viewType === WebviewProvider.sideBarId) {
			WebviewProvider.sideBarInstance = this
		} else {
			WebviewProvider.tabInstances.push(this)
		}

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		}

		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview)

		// Handle messages from the webview
		webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
			await this.controller.handleWebviewMessage(message)
		})

		// Handle disposal
		if ("onDidDispose" in webviewView) {
			webviewView.onDidDispose(() => {
				this.dispose()
			})
		}
	}

	private dispose(): void {
		// Remove from instances
		if (WebviewProvider.sideBarInstance === this) {
			WebviewProvider.sideBarInstance = undefined
		} else {
			const index = WebviewProvider.tabInstances.indexOf(this)
			if (index > -1) {
				WebviewProvider.tabInstances.splice(index, 1)
			}
		}

		this.controller.dispose()
	}

	private async postMessage(message: ExtensionMessage): Promise<boolean> {
		if (this.view) {
			return await this.view.webview.postMessage(message)
		}
		return false
	}

	private getHtmlForWebview(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, "webview-ui", "build", "assets", "index.js"),
		)
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, "webview-ui", "build", "assets", "index.css"),
		)

		// VSCode settings에서 language 읽기 (vscode.workspace.getConfiguration — Extension Host에서 실행)
		const language = vscode.workspace.getConfiguration("egovframeInitializr").get<string>("language", "en")
		// XSS 방지: enum 검증
		const safeLanguage = language === "ko" ? "ko" : "en"
		return `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>eGovFrame Initializr</title>
				<link rel="stylesheet" type="text/css" href="${styleUri}">
			</head>
			<body>
				<div id="root"></div>
				<script>window.__EGOV_INIT_LANGUAGE__ = "${safeLanguage}";</script>
				<script type="module" src="${scriptUri}"></script>
			</body>
			</html>
		`
	}
}
