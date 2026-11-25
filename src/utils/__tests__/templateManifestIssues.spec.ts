import { describe, expect, it } from "vitest"
import { collectManifestIssues, type ProjectTemplatesManifest } from "../templateManifest"

const ZIP_SHA = "46b1d649bee0d3b71d7a430f6f090ff49fa5446bcef5154c30543744566302b0"

function makeManifest(): ProjectTemplatesManifest {
	return {
		repository: { baseUrl: "https://example.test/releases/download/" },
		templates: [
			{
				templateId: "web-project",
				displayName: "Web Project",
				versions: [
					{ version: "5.1.0", fileName: "egovframe-web.zip", pomFile: "egovframe-web-pom.xml", included: true },
					{
						version: "4.3.1",
						fileName: "egovframe-web.zip",
						pomFile: "egovframe-web-pom.xml",
						included: false,
						downloadUrl: "v4.3/egovframe-web.zip",
						pomDownloadUrl: "v4.3/egovframe-web-pom.xml",
						sha256: ZIP_SHA,
						pomSha256: ZIP_SHA,
					},
				],
			},
		],
	}
}

describe("collectManifestIssues", () => {
	it("정상 manifest에는 문제가 없다", () => {
		expect(collectManifestIssues(makeManifest())).toEqual([])
	})

	it("중복된 templateId를 보고한다", () => {
		const manifest = makeManifest()
		manifest.templates.push({ ...manifest.templates[0] })

		expect(collectManifestIssues(manifest)).toEqual([expect.stringContaining("duplicate templateId")])
	})

	it("한 템플릿 안의 중복 version을 보고한다", () => {
		const manifest = makeManifest()
		manifest.templates[0].versions.push({ ...manifest.templates[0].versions[0] })

		expect(collectManifestIssues(manifest)).toEqual([expect.stringContaining("duplicate version")])
	})

	it("안전하지 않은 fileName·pomFile·version을 보고한다", () => {
		const manifest = makeManifest()
		manifest.templates[0].versions[0] = {
			...manifest.templates[0].versions[0],
			version: "../5",
			fileName: "sub/x.zip",
			pomFile: "x.txt",
		}

		const issues = collectManifestIssues(manifest)
		expect(issues).toHaveLength(3)
		expect(issues.join("\n")).toMatch(/version/)
		expect(issues.join("\n")).toMatch(/fileName/)
		expect(issues.join("\n")).toMatch(/pomFile/)
	})

	it("다운로드 대상에 downloadUrl이 없거나 절대 URL이면 보고한다", () => {
		const missing = makeManifest()
		delete missing.templates[0].versions[1].downloadUrl
		expect(collectManifestIssues(missing)).toEqual([expect.stringContaining("downloadUrl")])

		const absolute = makeManifest()
		absolute.templates[0].versions[1].downloadUrl = "https://evil.example/x.zip"
		expect(collectManifestIssues(absolute)).toEqual([expect.stringContaining("downloadUrl")])
	})

	it("다운로드 대상에 pomFile이 있는데 pomDownloadUrl이 없으면 보고한다", () => {
		const manifest = makeManifest()
		delete manifest.templates[0].versions[1].pomDownloadUrl

		expect(collectManifestIssues(manifest)).toEqual([expect.stringContaining("pomDownloadUrl")])
	})

	it("pomFile이 없는 다운로드 대상은 pomDownloadUrl·pomSha256이 없어도 된다", () => {
		const manifest = makeManifest()
		manifest.templates[0].versions[1] = {
			...manifest.templates[0].versions[1],
			pomFile: "",
			pomDownloadUrl: undefined,
			pomSha256: undefined,
		}

		expect(collectManifestIssues(manifest)).toEqual([])
	})

	it("형식이 잘못된 sha256·pomSha256을 보고한다", () => {
		const manifest = makeManifest()
		manifest.templates[0].versions[1].sha256 = "sha256:" + ZIP_SHA
		manifest.templates[0].versions[1].pomSha256 = "abc"

		const issues = collectManifestIssues(manifest)
		expect(issues).toHaveLength(2)
		expect(issues.join("\n")).toMatch(/sha256/)
		expect(issues.join("\n")).toMatch(/pomSha256/)
	})

	it("requireSha256 옵션을 켜면 다운로드 대상의 해시 누락을 보고한다", () => {
		const manifest = makeManifest()
		delete manifest.templates[0].versions[1].sha256
		delete manifest.templates[0].versions[1].pomSha256

		expect(collectManifestIssues(manifest)).toEqual([])
		expect(collectManifestIssues(manifest, { requireSha256: true })).toEqual([
			expect.stringContaining("sha256"),
			expect.stringContaining("pomSha256"),
		])
	})

	it("번들된 버전에는 다운로드 필드를 요구하지 않는다", () => {
		const manifest = makeManifest()
		manifest.templates[0].versions = [manifest.templates[0].versions[0]]

		expect(collectManifestIssues(manifest, { requireSha256: true })).toEqual([])
	})
})
