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
		expect(resolved.sha256).toBe("198fea08152906cd3ba58f4f42f90908e1d75c453fb1ffb1ca5ea52b1663a547")
		expect(resolved.pomSha256).toBe("e49d2ed79ed758db90100a1b3a6fb04f2bd9ddd182a47a033e027d29d85ffb53")
	})
})
