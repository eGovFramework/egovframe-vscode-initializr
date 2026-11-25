import { describe, expect, it } from "vitest"
import * as fs from "fs-extra"
import * as os from "os"
import * as path from "path"
import {
	DEFAULT_GITHUB_RELEASES_BASE_URL,
	TemplateResolutionError,
	isSafeDownloadPath,
	loadProjectTemplatesManifest,
	resolveProjectTemplate,
	type ProjectTemplatesManifest,
} from "../templateManifest"

const ZIP_SHA = "46b1d649bee0d3b71d7a430f6f090ff49fa5446bcef5154c30543744566302b0"
const POM_SHA = "8197e367ab307d5d03bd75ecd52edfb875ea01f18e4fc86d71b0cea45dab0a73"

function makeManifest(overrides: Partial<ProjectTemplatesManifest> = {}): ProjectTemplatesManifest {
	return {
		description: "test manifest",
		repository: {
			owner: "eGovFramework",
			repo: "egovframe-templates-download",
			baseUrl: "https://example.test/releases/download/",
		},
		templates: [
			{
				templateId: "boot-web-project",
				displayName: "Boot > Web Project",
				description: "Spring Boot based web project",
				category: "Boot",
				projectName: "egov-boot-web",
				latestVersion: "5.1.0-beta.1",
				versions: [
					{
						version: "5.1.0-beta.1",
						fileName: "egovframe-boot-web.zip",
						pomFile: "egovframe-boot-web-pom.xml",
						isLatest: true,
						included: true,
					},
					{
						version: "4.3.1",
						fileName: "egovframe-boot-web.zip",
						pomFile: "egovframe-boot-web-pom.xml",
						isLatest: false,
						included: false,
						downloadUrl: "v4.3/egovframe-boot-web.zip",
						pomDownloadUrl: "v4.3/egovframe-boot-web-pom.xml",
						sha256: ZIP_SHA,
						pomSha256: POM_SHA,
					},
				],
			},
			{
				templateId: "frontend-only",
				displayName: "Frontend Only",
				versions: [
					{
						version: "1.0.0",
						fileName: "frontend.zip",
						pomFile: "",
						// included 생략 = 확장에 번들된 것으로 취급
					},
				],
			},
		],
		...overrides,
	}
}

/** 첫 템플릿의 4.3.1 버전 항목을 덮어쓴 manifest를 만든다 */
function withDownloadable(entryOverrides: Record<string, unknown>): ProjectTemplatesManifest {
	const manifest = makeManifest()
	const versions = manifest.templates[0].versions
	versions[1] = { ...versions[1], ...entryOverrides } as (typeof versions)[number]
	return manifest
}

describe("resolveProjectTemplate", () => {
	it("다운로드 대상 버전을 manifest의 다운로드 경로·해시와 함께 확정한다", () => {
		const resolved = resolveProjectTemplate(makeManifest(), "boot-web-project", "4.3.1")

		expect(resolved).toEqual({
			templateId: "boot-web-project",
			version: "4.3.1",
			displayName: "Boot > Web Project",
			fileName: "egovframe-boot-web.zip",
			pomFile: "egovframe-boot-web-pom.xml",
			included: false,
			downloadUrl: "v4.3/egovframe-boot-web.zip",
			pomDownloadUrl: "v4.3/egovframe-boot-web-pom.xml",
			sha256: ZIP_SHA,
			pomSha256: POM_SHA,
			repositoryBaseUrl: "https://example.test/releases/download/",
		})
	})

	it("번들된 버전은 included=true이고 다운로드 필드가 없다", () => {
		const resolved = resolveProjectTemplate(makeManifest(), "boot-web-project", "5.1.0-beta.1")

		expect(resolved.included).toBe(true)
		expect(resolved.fileName).toBe("egovframe-boot-web.zip")
		expect(resolved.downloadUrl).toBeUndefined()
		expect(resolved.pomDownloadUrl).toBeUndefined()
		expect(resolved.sha256).toBeUndefined()
		expect(resolved.pomSha256).toBeUndefined()
	})

	it("included가 생략된 버전은 번들된 것으로 취급한다", () => {
		const resolved = resolveProjectTemplate(makeManifest(), "frontend-only", "1.0.0")

		expect(resolved.included).toBe(true)
		expect(resolved.pomFile).toBe("")
	})

	it("repository.baseUrl이 없으면 기본 GitHub Releases URL을 사용한다", () => {
		const resolved = resolveProjectTemplate(makeManifest({ repository: undefined }), "boot-web-project", "4.3.1")

		expect(resolved.repositoryBaseUrl).toBe(DEFAULT_GITHUB_RELEASES_BASE_URL)
	})

	it("해시는 소문자 16진수로 정규화한다", () => {
		const resolved = resolveProjectTemplate(
			withDownloadable({ sha256: ZIP_SHA.toUpperCase(), pomSha256: POM_SHA.toUpperCase() }),
			"boot-web-project",
			"4.3.1",
		)

		expect(resolved.sha256).toBe(ZIP_SHA)
		expect(resolved.pomSha256).toBe(POM_SHA)
	})

	it("알 수 없는 templateId를 거부한다", () => {
		expect(() => resolveProjectTemplate(makeManifest(), "no-such-template", "4.3.1")).toThrow(TemplateResolutionError)
		expect(() => resolveProjectTemplate(makeManifest(), "no-such-template", "4.3.1")).toThrow(/no-such-template/)
	})

	it("해당 템플릿에 없는 버전을 거부한다", () => {
		expect(() => resolveProjectTemplate(makeManifest(), "boot-web-project", "9.9.9")).toThrow(TemplateResolutionError)
		expect(() => resolveProjectTemplate(makeManifest(), "boot-web-project", "9.9.9")).toThrow(/9\.9\.9/)
	})

	it("다운로드 대상인데 downloadUrl이 없으면 거부한다", () => {
		expect(() => resolveProjectTemplate(withDownloadable({ downloadUrl: undefined }), "boot-web-project", "4.3.1")).toThrow(
			TemplateResolutionError,
		)
	})

	it("다운로드 대상에 pomFile이 있는데 pomDownloadUrl이 없으면 거부한다 (번들 POM으로 대체되면 안 된다)", () => {
		expect(() =>
			resolveProjectTemplate(withDownloadable({ pomDownloadUrl: undefined }), "boot-web-project", "4.3.1"),
		).toThrow(TemplateResolutionError)
	})

	it("pomFile이 없는 다운로드 대상은 pomDownloadUrl 없이도 확정된다", () => {
		const resolved = resolveProjectTemplate(
			withDownloadable({ pomFile: "", pomDownloadUrl: undefined, pomSha256: undefined }),
			"boot-web-project",
			"4.3.1",
		)

		expect(resolved.pomFile).toBe("")
		expect(resolved.pomDownloadUrl).toBeUndefined()
	})

	it("절대 URL이나 경로 탈출이 들어간 downloadUrl을 거부한다", () => {
		for (const downloadUrl of [
			"https://evil.example/x.zip",
			"//evil.example/x.zip",
			"/v4.3/egovframe-boot-web.zip",
			"v4.3/../egovframe-boot-web.zip",
			"../v4.3/egovframe-boot-web.zip",
			"v4.3\\egovframe-boot-web.zip",
			"v4.3/egovframe-boot-web.zip?x=1",
			"",
		]) {
			expect(
				() => resolveProjectTemplate(withDownloadable({ downloadUrl }), "boot-web-project", "4.3.1"),
				downloadUrl,
			).toThrow(TemplateResolutionError)
		}
	})

	it("경로 구분자나 상위 참조가 들어간 fileName·pomFile·version을 거부한다", () => {
		expect(() => resolveProjectTemplate(withDownloadable({ fileName: "../x.zip" }), "boot-web-project", "4.3.1")).toThrow(
			TemplateResolutionError,
		)
		expect(() => resolveProjectTemplate(withDownloadable({ fileName: "x.tar.gz" }), "boot-web-project", "4.3.1")).toThrow(
			TemplateResolutionError,
		)
		expect(() => resolveProjectTemplate(withDownloadable({ pomFile: "sub/pom.xml" }), "boot-web-project", "4.3.1")).toThrow(
			TemplateResolutionError,
		)

		const badVersion = makeManifest()
		badVersion.templates[0].versions[1].version = "../4.3.1"
		expect(() => resolveProjectTemplate(badVersion, "boot-web-project", "../4.3.1")).toThrow(TemplateResolutionError)
	})

	it("형식이 잘못된 sha256을 거부한다", () => {
		expect(() => resolveProjectTemplate(withDownloadable({ sha256: "abc" }), "boot-web-project", "4.3.1")).toThrow(
			TemplateResolutionError,
		)
		expect(() =>
			resolveProjectTemplate(withDownloadable({ pomSha256: "sha256:" + POM_SHA }), "boot-web-project", "4.3.1"),
		).toThrow(TemplateResolutionError)
	})
})

describe("isSafeDownloadPath", () => {
	it("상대 경로 세그먼트만으로 이루어진 값만 허용한다", () => {
		expect(isSafeDownloadPath("v4.3/egovframe-boot-web.zip")).toBe(true)
		expect(isSafeDownloadPath("egovframe-boot-web.zip")).toBe(true)
		expect(isSafeDownloadPath("v4.3/./x.zip")).toBe(false)
		expect(isSafeDownloadPath("v4.3//x.zip")).toBe(false)
		expect(isSafeDownloadPath("v4.3/x.zip#frag")).toBe(false)
		expect(isSafeDownloadPath("v4.3/x y.zip")).toBe(false)
	})
})

describe("loadProjectTemplatesManifest", () => {
	it("extensionPath 아래의 templates/templates-projects.json을 읽는다", async () => {
		const extensionPath = await fs.mkdtemp(path.join(os.tmpdir(), "egov-manifest-"))
		try {
			await fs.ensureDir(path.join(extensionPath, "templates"))
			await fs.writeJson(path.join(extensionPath, "templates", "templates-projects.json"), makeManifest())

			const manifest = await loadProjectTemplatesManifest(extensionPath)

			expect(manifest.templates.map((t) => t.templateId)).toEqual(["boot-web-project", "frontend-only"])
		} finally {
			await fs.remove(extensionPath)
		}
	})

	it("templates 배열이 없는 파일은 거부한다", async () => {
		const extensionPath = await fs.mkdtemp(path.join(os.tmpdir(), "egov-manifest-"))
		try {
			await fs.ensureDir(path.join(extensionPath, "templates"))
			await fs.writeJson(path.join(extensionPath, "templates", "templates-projects.json"), { repository: {} })

			await expect(loadProjectTemplatesManifest(extensionPath)).rejects.toThrow(TemplateResolutionError)
		} finally {
			await fs.remove(extensionPath)
		}
	})
})
