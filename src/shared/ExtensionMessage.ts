/**
 * ExtensionMessage.ts
 *
 * 익스텐션이 웹뷰로 보내는 메시지 타입
 */

export type ExtensionMessage =
	| {
			type: "action"
			action?: "egovButtonClicked" | "chatButtonClicked" | "focusChatInput"
			tab?: any
	  }
	| {
			type: "selectedOutputPath"
			text: string
	  }
	| {
			type: "currentWorkspacePath"
			text: string
	  }
	| {
			type: "projectGenerationProgress"
			text: string
	  }
	| {
			type: "projectGenerationResult"
			success: boolean
			text: string
			projectPath?: string
			error?: string
	  }
	| {
			type: "success" | "error"
			text?: string
			message?: string
	  }
	| {
			type: "selectedOutputFolder"
			text: string
	  }
	| {
			type: "selectedOutputFolderDuplicate"
			text: string
	  }
	| {
			type: "relinquishControl"
	  }
	| {
			type: "validationResult"
			isValid: boolean
			previews?: { [key: string]: string }
			languages?: { [key: string]: string }
			packageName?: string
			error?: string
	  }
	| {
			type: "sampleDDLs"
			data: { [key: string]: { name: string; ddl: string } }
	  }
	| {
			type: "currentTheme"
			theme: "light" | "vs-dark"
	  }
	| {
			type: "themeChanged"
			theme: "light" | "vs-dark"
	  }
	| {
			type: "selectedConfigFilePath"
			text: string
	  }
	| {
			type: "egovSettings"
			settings: {
				defaultGroupId: string
				defaultArtifactId: string
				defaultPackageName: string
				language: string
			}
	  }
	| {
			type: "extensionInfo"
			info: {
				displayName: string
				version: string
				description: string
				repository: string
				homepage: string
				author: string
				license: string
			}
	  }
	| {
			type: "projectTemplates"
			templates: Array<{
				displayName: string
				fileName: string
				pomFile: string
				description?: string
				category?: string
				projectName?: string
			}>
	  }
	| {
			type: "configTemplates"
			templates: Array<{
				displayName: string
				templateFolder: string
				templateFile: string
				webView: string
				fileNameProperty: string
				javaConfigTemplate: string
				yamlTemplate: string
				propertiesTemplate: string
			}>
	  }
