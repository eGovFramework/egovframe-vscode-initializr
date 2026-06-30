export interface ProjectTemplate {
	displayName: string
	fileName: string
	pomFile: string
	description?: string
	category?: string
	projectName?: string
	artifactId?: string
}

export interface ProjectConfig {
	projectName: string // pom.xml - ###NAME###
	artifactId: string // pom.xml - ###ARTIFACT_ID###
	groupId: string // pom.xml - ###GROUP_ID###
	outputPath: string
	version?: string // pom.xml - ###VERSION###
	url?: string // pom.xml - ###URL###
	template: ProjectTemplate
}

export interface EgovProjectGenerationRequest {
	config: ProjectConfig
	method: "form" | "command"
}

export interface EgovProjectGenerationResponse {
	success: boolean
	message: string
	projectPath?: string
	error?: string
}

/**
 * 템플릿 배열로부터 카테고리 목록을 추출
 * Set은 요소의 첫 등장 순서를 보존하므로, templates 배열에서 카테고리 등장 순서에 주의가 필요하다
 */
export function categoriesFromProjectTemplates(templates: ProjectTemplate[]): string[] {
	const categories = new Set<string>()
	categories.add("All")
	templates.forEach((template) => {
		if (template.category) {
			categories.add(template.category)
		}
	})
	return Array.from(categories)
}

/**
 * 카테고리에 해당하는 템플릿 배열 반환
 */
export function getTemplatesByCategory(templates: ProjectTemplate[], category: string): ProjectTemplate[] {
	if (category === "All") {
		return templates
	}
	return templates.filter((template) => template.category === category)
}

export function validateProjectConfig(config: Partial<ProjectConfig>): string[] {
	const errors: string[] = []

	if (!config.projectName || config.projectName.trim() === "") {
		errors.push("Project name is required")
	}

	// groupId validation (only for templates with pomFile)
	if (config.template?.pomFile) {
		if (!config.groupId || config.groupId.trim() === "") {
			errors.push("Group ID is required for this template")
		} else if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/.test(config.groupId)) {
			errors.push(
				"Group ID must consist of dot-separated segments, where each segment starts with a lowercase letter and contains only lowercase letters or numbers",
			)
		}
	}

	// artifactId validation (only for templates with pomFile)
	if (config.template?.pomFile) {
		if (!config.artifactId || config.artifactId.trim() === "") {
			errors.push("Artifact ID is required for this template")
		} else if (!/^[a-z][a-z0-9-]*$/.test(config.artifactId)) {
			errors.push("Artifact ID must start with a lowercase letter and contain only lowercase letters, numbers, or hyphens")
		}
	}

	if (!config.outputPath || config.outputPath.trim() === "") {
		errors.push("Output path is required")
	}

	if (!config.template) {
		errors.push("Template selection is required")
	}

	return errors
}

export function createGenerateProjectByCommandMessage() {
	return {
		type: "generateProjectByCommand" as const,
	}
}

export function createProjectGenerationMessage(config: ProjectConfig, method: "form" | "command") {
	return {
		type: "generateProject" as const,
		projectConfig: {
			projectName: config.projectName,
			artifactId: config.artifactId,
			groupId: config.groupId,
			version: config.version,
			url: config.url,
			outputPath: config.outputPath,
			template: {
				displayName: config.template.displayName,
				fileName: config.template.fileName,
				pomFile: config.template.pomFile,
			},
		},
		method,
	}
}
