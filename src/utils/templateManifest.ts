import * as fs from "fs-extra"
import * as path from "path"

/**
 * templateManifest.ts
 *
 * templates/templates-projects.json(프로젝트 템플릿 manifest)을 읽고, 웹뷰가 고른
 * (templateId, version)을 확장 호스트가 신뢰할 수 있는 템플릿 소스로 확정한다.
 *
 * 웹뷰는 신뢰 경계 밖이므로 파일명·다운로드 경로·해시 같은 "어떻게 가져오는지"는
 * 웹뷰 페이로드가 아니라 확장에 번들된 이 manifest에서만 읽는다. manifest는 VSIX 안에
 * 들어가므로 Marketplace 배포 경로와 같은 신뢰 수준을 가진다.
 *
 * VS Code 의존성이 없어 단위 테스트가 가능하다.
 */

/** 기본 GitHub Releases 다운로드 기준 URL (manifest의 repository.baseUrl이 없을 때) */
export const DEFAULT_GITHUB_RELEASES_BASE_URL = "https://github.com/eGovFramework/egovframe-templates-download/releases/download/"

// 단일 경로 컴포넌트로만 쓸 수 있는 파일명: 경로 구분자(/, \)가 없고, 점으로 시작하거나 연속된 점(..)을 포함할 수 없다
export const SAFE_ZIP_FILE_PATTERN = /^(?!\.)(?!.*\.\.)[A-Za-z0-9._-]+\.zip$/
export const SAFE_XML_FILE_PATTERN = /^(?!\.)(?!.*\.\.)[A-Za-z0-9._-]+\.xml$/
// 버전 문자열은 캐시 디렉터리 이름으로도 쓰이므로 영숫자로 시작하는 단일 경로 컴포넌트여야 한다
export const SAFE_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
// GitHub Release 자산의 sha256 digest 형식 (16진수 64자리)
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i

// 다운로드 경로의 각 세그먼트: 영숫자·점·밑줄·하이픈만 허용하고, 점만으로 이루어진 세그먼트(., ..)는 제외한다
const SAFE_PATH_SEGMENT_PATTERN = /^(?!\.+$)[A-Za-z0-9._-]+$/

export interface TemplateVersionEntry {
	version: string
	fileName: string
	pomFile?: string
	releaseDate?: string
	isLatest?: boolean
	/** true(또는 생략)면 확장에 번들됨, false면 downloadUrl로 내려받아야 함 */
	included?: boolean
	/** repository.baseUrl 기준 상대 경로 (예: "v4.3/egovframe-boot-web.zip") */
	downloadUrl?: string
	pomDownloadUrl?: string
	/** 다운로드한 ZIP의 sha256 (16진수 64자리) */
	sha256?: string
	/** 다운로드한 POM 템플릿의 sha256 */
	pomSha256?: string
	fileSize?: string
}

export interface TemplateManifestEntry {
	templateId: string
	displayName: string
	description?: string
	category?: string
	projectName?: string
	latestVersion?: string
	versions: TemplateVersionEntry[]
}

export interface TemplateRepositoryInfo {
	owner?: string
	repo?: string
	baseUrl?: string
}

export interface ProjectTemplatesManifest {
	description?: string
	repository?: TemplateRepositoryInfo
	templates: TemplateManifestEntry[]
}

/** 호스트가 manifest에서 확정한 템플릿 소스. 프로젝트 생성기는 이 값만 신뢰한다 */
export interface ResolvedProjectTemplate {
	templateId: string
	version: string
	displayName: string
	/** templates/projects/examples/ 아래(번들) 또는 캐시의 ZIP 파일명 */
	fileName: string
	/** templates/projects/pom/ 아래(번들) 또는 캐시의 POM 템플릿 파일명. 없으면 빈 문자열 */
	pomFile: string
	included: boolean
	downloadUrl?: string
	pomDownloadUrl?: string
	sha256?: string
	pomSha256?: string
	repositoryBaseUrl: string
}

/** manifest 조회·검증 실패 */
export class TemplateResolutionError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "TemplateResolutionError"
	}
}

/**
 * repository.baseUrl 뒤에 그대로 붙일 수 있는 상대 경로인지 검사한다.
 * 스킴·호스트·선행 슬래시·상위 디렉터리 참조·쿼리·프래그먼트가 있으면 거부한다.
 */
export function isSafeDownloadPath(value: unknown): boolean {
	if (typeof value !== "string" || value.length === 0) {
		return false
	}
	return value.split("/").every((segment) => SAFE_PATH_SEGMENT_PATTERN.test(segment))
}

function normalizeSha256(value: unknown, label: string): string | undefined {
	if (value === undefined) {
		return undefined
	}
	if (typeof value !== "string" || !SHA256_HEX_PATTERN.test(value)) {
		throw new TemplateResolutionError(`${label} must be a 64-character hexadecimal sha256 digest`)
	}
	return value.toLowerCase()
}

/**
 * (templateId, version)으로 manifest 항목을 찾아 생성기가 신뢰할 수 있는 형태로 확정한다.
 * 항목이 없거나 파일명·다운로드 경로·해시 형식이 안전 규칙을 어기면 예외를 던진다.
 */
export function resolveProjectTemplate(
	manifest: ProjectTemplatesManifest,
	templateId: string,
	version: string,
): ResolvedProjectTemplate {
	const entry = manifest.templates.find((template) => template.templateId === templateId)
	if (!entry) {
		throw new TemplateResolutionError(`Unknown project template: ${templateId}`)
	}

	const versionEntry = entry.versions.find((candidate) => candidate.version === version)
	if (!versionEntry) {
		throw new TemplateResolutionError(`Version ${version} is not available for template ${templateId}`)
	}

	if (!SAFE_VERSION_PATTERN.test(versionEntry.version)) {
		throw new TemplateResolutionError(`Unsafe version string in manifest: ${versionEntry.version}`)
	}
	if (!SAFE_ZIP_FILE_PATTERN.test(versionEntry.fileName)) {
		throw new TemplateResolutionError(`Unsafe template file name in manifest: ${versionEntry.fileName}`)
	}
	const pomFile = versionEntry.pomFile ?? ""
	if (pomFile !== "" && !SAFE_XML_FILE_PATTERN.test(pomFile)) {
		throw new TemplateResolutionError(`Unsafe POM template file name in manifest: ${pomFile}`)
	}

	const included = versionEntry.included !== false
	const resolved: ResolvedProjectTemplate = {
		templateId: entry.templateId,
		version: versionEntry.version,
		displayName: entry.displayName,
		fileName: versionEntry.fileName,
		pomFile,
		included,
		repositoryBaseUrl: manifest.repository?.baseUrl || DEFAULT_GITHUB_RELEASES_BASE_URL,
	}

	if (included) {
		return resolved
	}

	if (!isSafeDownloadPath(versionEntry.downloadUrl)) {
		throw new TemplateResolutionError(
			`Template ${templateId} ${version} is not bundled and has no valid relative downloadUrl in the manifest`,
		)
	}
	resolved.downloadUrl = versionEntry.downloadUrl
	resolved.sha256 = normalizeSha256(versionEntry.sha256, `sha256 of ${templateId} ${version}`)

	if (pomFile !== "") {
		// 다운로드 대상의 POM은 반드시 함께 내려받아야 한다 — 같은 파일명의 번들 POM(다른 버전)으로 대체되면 안 된다
		if (!isSafeDownloadPath(versionEntry.pomDownloadUrl)) {
			throw new TemplateResolutionError(
				`Template ${templateId} ${version} declares a POM template but has no valid relative pomDownloadUrl in the manifest`,
			)
		}
		resolved.pomDownloadUrl = versionEntry.pomDownloadUrl
		resolved.pomSha256 = normalizeSha256(versionEntry.pomSha256, `pomSha256 of ${templateId} ${version}`)
	}

	return resolved
}

/** 확장 디렉터리의 templates/templates-projects.json 경로 */
export function getProjectTemplatesManifestPath(extensionPath: string): string {
	return path.join(extensionPath, "templates", "templates-projects.json")
}

/** 확장에 번들된 manifest를 읽는다. 구조가 manifest가 아니면 예외를 던진다 */
export async function loadProjectTemplatesManifest(extensionPath: string): Promise<ProjectTemplatesManifest> {
	const manifestPath = getProjectTemplatesManifestPath(extensionPath)
	const parsed: unknown = await fs.readJson(manifestPath)

	if (parsed === null || typeof parsed !== "object" || !Array.isArray((parsed as { templates?: unknown }).templates)) {
		throw new TemplateResolutionError(`Project templates manifest is malformed: ${manifestPath}`)
	}
	return parsed as ProjectTemplatesManifest
}

export interface ManifestIssueOptions {
	/** true면 다운로드 대상 버전에 sha256(그리고 pomFile이 있으면 pomSha256)이 없는 것도 문제로 본다 */
	requireSha256?: boolean
}

/**
 * manifest 전체의 일관성 문제를 사람이 읽을 수 있는 문장 목록으로 돌려준다.
 * 비어 있으면 모든 항목이 resolveProjectTemplate를 통과할 수 있는 상태다.
 */
export function collectManifestIssues(manifest: ProjectTemplatesManifest, options: ManifestIssueOptions = {}): string[] {
	const issues: string[] = []
	const seenTemplateIds = new Set<string>()

	for (const template of manifest.templates) {
		if (seenTemplateIds.has(template.templateId)) {
			issues.push(`duplicate templateId: ${template.templateId}`)
		}
		seenTemplateIds.add(template.templateId)

		const seenVersions = new Set<string>()
		for (const entry of template.versions) {
			const label = `${template.templateId} ${entry.version}`

			if (seenVersions.has(entry.version)) {
				issues.push(`${template.templateId}: duplicate version ${entry.version}`)
			}
			seenVersions.add(entry.version)

			if (!SAFE_VERSION_PATTERN.test(entry.version)) {
				issues.push(`${label}: unsafe version string`)
			}
			if (!SAFE_ZIP_FILE_PATTERN.test(entry.fileName)) {
				issues.push(`${label}: unsafe fileName "${entry.fileName}"`)
			}
			const pomFile = entry.pomFile ?? ""
			if (pomFile !== "" && !SAFE_XML_FILE_PATTERN.test(pomFile)) {
				issues.push(`${label}: unsafe pomFile "${pomFile}"`)
			}

			if (entry.included !== false) {
				continue
			}

			if (!isSafeDownloadPath(entry.downloadUrl)) {
				issues.push(`${label}: downloadable version needs a relative downloadUrl (got "${entry.downloadUrl ?? ""}")`)
			}
			if (entry.sha256 === undefined) {
				if (options.requireSha256) {
					issues.push(`${label}: downloadable version is missing sha256`)
				}
			} else if (!SHA256_HEX_PATTERN.test(entry.sha256)) {
				issues.push(`${label}: sha256 is not a 64-character hexadecimal digest`)
			}

			if (pomFile === "") {
				continue
			}
			if (!isSafeDownloadPath(entry.pomDownloadUrl)) {
				issues.push(
					`${label}: downloadable version with a pomFile needs a relative pomDownloadUrl (got "${entry.pomDownloadUrl ?? ""}")`,
				)
			}
			if (entry.pomSha256 === undefined) {
				if (options.requireSha256) {
					issues.push(`${label}: downloadable version is missing pomSha256`)
				}
			} else if (!SHA256_HEX_PATTERN.test(entry.pomSha256)) {
				issues.push(`${label}: pomSha256 is not a 64-character hexadecimal digest`)
			}
		}
	}

	return issues
}
