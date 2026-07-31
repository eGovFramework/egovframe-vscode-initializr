import type { WebviewScope } from "@shared/WebviewMessage"

export function createSelectOutputPathMessage(scope?: WebviewScope) {
	return {
		type: "selectOutputPath" as const,
		...(scope ? { scope } : {}),
	}
}

export function createGetWorkspacePathMessage(scope?: WebviewScope) {
	return {
		type: "getWorkspacePath" as const,
		...(scope ? { scope } : {}),
	}
}

// file path selection in eGovFrame Configuration Generation - Especially for EhcacheForm
export function createSelectConfigFilePathMessage() {
	return {
		type: "selectConfigFilePath" as const,
	}
}
