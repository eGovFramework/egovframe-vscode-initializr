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

		// 다운로드 대상 버전은 모두 sha256(POM이 있으면 pomSha256)을 기록해야 한다 — 누락은 호스트가 다운로드를 거부한다
		expect(collectManifestIssues(manifest, { requireSha256: true })).toEqual([])
	})

	it("모든 (templateId, version) 조합이 호스트에서 확정된다", async () => {
		const manifest = await loadProjectTemplatesManifest(extensionPath)

		for (const template of manifest.templates) {
			for (const version of template.versions) {
				expect(() => resolveProjectTemplate(manifest, template.templateId, version.version)).not.toThrow()
			}
		}
	})

	it("Boot > Web Project 4.3.2는 다운로드 대상이며 v4.3.2 릴리스 자산의 ZIP·POM 해시가 기록되어 있다", async () => {
		const manifest = await loadProjectTemplatesManifest(extensionPath)
		const resolved = resolveProjectTemplate(manifest, "boot-web-project", "4.3.2")

		expect(resolved.included).toBe(false)
		expect(resolved.downloadUrl).toBe("v4.3.2/egovframe-boot-web.zip")
		expect(resolved.sha256).toBe("c897a8deac08b362c6543f61b6451def6b344d9ce4bd087a3e0390ac151bfb8d")
		expect(resolved.pomSha256).toBe("a3d0f880a70f5ade55475ad70587dc1770681771cfb9d58dfb8115b77aa3c7cb")
	})
})
