// Version information for a template
export interface TemplateVersion {
	version: string
	fileName: string
	pomFile: string
	releaseDate: string
	isLatest: boolean
	included: boolean // true: Extension에 포함됨, false: 다운로드 필요
	downloadUrl?: string // included가 false일 때 다운로드 URL
	pomDownloadUrl?: string // included가 false일 때 POM 다운로드 URL
	fileSize?: string
}

// Template manifest structure (from templates-projects.json)
export interface TemplateManifest {
	templateId: string
	displayName: string
	description: string
	category: string
	projectName?: string
	latestVersion: string
	versions: TemplateVersion[]
}

// Repository information for downloading templates
export interface TemplateRepository {
	owner: string
	repo: string
	baseUrl: string
}

// Full manifest structure
export interface ProjectTemplatesManifest {
	description: string
	repository: TemplateRepository
	templates: TemplateManifest[]
}

// Project template with version information (used in UI)
export interface ProjectTemplate {
	displayName: string
	fileName: string
	pomFile: string
	description?: string
	category?: string
	projectName?: string
	artifactId?: string
	// Version-related fields
	templateId?: string
	version?: string
	isLatest?: boolean
	included?: boolean // true: Extension에 포함됨, false: 다운로드 필요
	downloadUrl?: string
	pomDownloadUrl?: string
	fileSize?: string
	releaseDate?: string
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
 * Manifest에서 ProjectTemplate 배열로 변환 (최신 버전 기준)
 */
export function convertManifestToTemplates(manifest: ProjectTemplatesManifest): ProjectTemplate[] {
	const templates: ProjectTemplate[] = []

	manifest.templates.forEach((template) => {
		// Get latest version
		const latestVersion = template.versions.find((v) => v.isLatest) || template.versions[0]
		if (latestVersion) {
			templates.push({
				displayName: template.displayName,
				fileName: latestVersion.fileName,
				pomFile: latestVersion.pomFile || "",
				description: template.description,
				category: template.category,
				projectName: template.projectName,
				version: latestVersion.version,
				isLatest: latestVersion.isLatest,
				included: latestVersion.included,
				downloadUrl: latestVersion.downloadUrl,
				pomDownloadUrl: latestVersion.pomDownloadUrl,
				fileSize: latestVersion.fileSize,
				releaseDate: latestVersion.releaseDate,
				templateId: template.templateId,
			})
		}
	})

	return templates
}

/**
 * 특정 템플릿의 모든 버전 정보 가져오기
 */
export function getTemplateVersions(manifest: ProjectTemplatesManifest, templateId: string): TemplateVersion[] {
	const template = manifest.templates.find((t) => t.templateId === templateId)
	return template?.versions || []
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
	} else if (!/^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$/.test(config.projectName)) {
		// 프로젝트명 허용 규칙 — 백엔드 `src/utils/pathSafety.ts`의 PROJECT_NAME_PATTERN과 동일하게 유지한다.
		errors.push("Project name can only contain letters, numbers, hyphens, underscores, and single dots between segments")
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
				// Version-related fields for download support
				templateId: config.template.templateId,
				version: config.template.version,
				included: config.template.included,
				downloadUrl: config.template.downloadUrl,
				pomDownloadUrl: config.template.pomDownloadUrl,
			},
		},
		method,
	}
}
