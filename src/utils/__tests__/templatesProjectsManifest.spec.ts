import { describe, expect, it } from "vitest"
import * as path from "path"
import { collectManifestIssues, loadProjectTemplatesManifest, resolveProjectTemplate } from "../templateManifest"

/**
 * 확장에 번들되는 실제 manifest(templates/templates-projects.json)의 일관성 검사.
 * 항목을 추가·수정할 때 다운로드 경로나 해시 형식이 어긋나면 커밋 전에 여기서 드러난다.
 */
describe("templates/templates-projects.json", () => {
	const extensionPath = path.resolve(__dirname, "..", "..", "..")

	it("다운로드 경로·파일명·해시 형식 규칙을 모두 지킨다", async () => {
		const manifest = await loadProjectTemplatesManifest(extensionPath)

		// TODO: 4.3 릴리스 자산이 모두 업로드되고 해시가 기록되면 requireSha256: true로 올린다
		expect(collectManifestIssues(manifest)).toEqual([])
	})

	it("모든 (templateId, version) 조합이 호스트에서 확정된다", async () => {
		const manifest = await loadProjectTemplatesManifest(extensionPath)

		for (const template of manifest.templates) {
			for (const version of template.versions) {
				expect(() => resolveProjectTemplate(manifest, template.templateId, version.version)).not.toThrow()
			}
		}
	})

	it("Boot > Web Project 4.3.1은 다운로드 대상이며 ZIP·POM 해시가 기록되어 있다", async () => {
		const manifest = await loadProjectTemplatesManifest(extensionPath)
		const resolved = resolveProjectTemplate(manifest, "boot-web-project", "4.3.1")

		expect(resolved.included).toBe(false)
		expect(resolved.sha256).toBe("46b1d649bee0d3b71d7a430f6f090ff49fa5446bcef5154c30543744566302b0")
		expect(resolved.pomSha256).toBe("8197e367ab307d5d03bd75ecd52edfb875ea01f18e4fc86d71b0cea45dab0a73")
	})
})
