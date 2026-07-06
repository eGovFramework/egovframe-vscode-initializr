import * as vscode from "vscode"
import { Controller } from "../controller"
import { ExtensionMessage } from "@shared/ExtensionMessage"

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
		// 원시 값 그대로 넘기고, 스키마 검증은 Controller.handleWebviewMessage가 수행한다
		webviewView.webview.onDidReceiveMessage(async (message: unknown) => {
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
		// CSP(Content Security Policy)의 inline script 허용을 위한 보안용 랜덤 nonce 생성
		const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("")
		// CSP 지시문
		// - default-src 'none' : 기본 전면 차단(deny-by-default)
		// - script-src         : nonce가 부여된 inline script + 로컬 번들 스크립트(webview.cspSource)만 허용
		// - style-src          : 다수의 inline style 및 Monaco가 동적으로 주입하는 <style> 허용을 위해 'unsafe-inline'
		// - worker-src blob:   : monaco-sql-languages의 방언별 Worker(mysql/pgsql/editor)가 Vite ?worker&inline 번들링으로
		//                        base64 → blob: URL에서 동적 생성되므로 반드시 blob: 허용이 필요(이 한 줄이 워커 차단 문제의 핵심)
		// - font-src / img-src : codicon 폰트 및 data: 인라인 아이콘 허용
		const csp = [
			`default-src 'none'`,
			`script-src 'nonce-${nonce}' ${webview.cspSource}`,
			`style-src ${webview.cspSource} 'unsafe-inline'`,
			`worker-src ${webview.cspSource} blob:`,
			`font-src ${webview.cspSource} data:`,
			`img-src ${webview.cspSource} data:`,
		].join("; ")
		return `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<meta http-equiv="Content-Security-Policy" content="${csp};">
				<title>eGovFrame Initializr</title>
				<link rel="stylesheet" type="text/css" href="${styleUri}">
			</head>
			<body>
				<div id="root"></div>
				<script nonce="${nonce}">window.__EGOV_INIT_LANGUAGE__ = "${safeLanguage}";</script>
				<script type="module" src="${scriptUri}" nonce="${nonce}"></script>
			</body>
			</html>
		`
	}
}
