import { afterEach, beforeEach, describe, expect, it } from "vitest"
import * as fs from "fs-extra"
import * as os from "os"
import * as path from "path"
import { clearTemplateCache, getTemplateCachePath, getTemplateCacheRoot, listTemplateCacheFiles } from "../templateCache"

describe("templateCache", () => {
	let extensionPath: string

	beforeEach(async () => {
		extensionPath = await fs.mkdtemp(path.join(os.tmpdir(), "egov-cache-"))
	})

	afterEach(async () => {
		await fs.remove(extensionPath)
	})

	it("캐시 루트는 templates/projects/<kind>/cache 이다", () => {
		expect(getTemplateCacheRoot(extensionPath, "examples")).toBe(
			path.join(extensionPath, "templates", "projects", "examples", "cache"),
		)
		expect(getTemplateCacheRoot(extensionPath, "pom")).toBe(path.join(extensionPath, "templates", "projects", "pom", "cache"))
	})

	it("캐시 파일 경로는 버전 디렉터리 아래에 둔다 (버전이 달라도 파일명이 같을 수 있다)", () => {
		expect(getTemplateCachePath(extensionPath, "examples", "4.3.1", "egovframe-boot-web.zip")).toBe(
			path.join(extensionPath, "templates", "projects", "examples", "cache", "4.3.1", "egovframe-boot-web.zip"),
		)
	})

	it("캐시 루트를 벗어나는 버전·파일명을 거부한다", () => {
		expect(() => getTemplateCachePath(extensionPath, "examples", "../4.3.1", "x.zip")).toThrow()
		expect(() => getTemplateCachePath(extensionPath, "pom", "4.3.1", "../../x.xml")).toThrow()
	})

	it("두 캐시 루트의 파일을 하위 디렉터리까지 나열한다", async () => {
		await fs.outputFile(getTemplateCachePath(extensionPath, "examples", "4.3.1", "a.zip"), "aaaa")
		await fs.outputFile(getTemplateCachePath(extensionPath, "pom", "4.3.1", "a-pom.xml"), "bb")
		await fs.outputFile(path.join(getTemplateCacheRoot(extensionPath, "examples"), "legacy.zip"), "c")

		const files = await listTemplateCacheFiles(extensionPath)

		expect(files.map((f) => f.relativePath).sort()).toEqual([
			"examples/cache/4.3.1/a.zip",
			"examples/cache/legacy.zip",
			"pom/cache/4.3.1/a-pom.xml",
		])
		expect(files.reduce((sum, f) => sum + f.size, 0)).toBe(7)
	})

	it("캐시 루트가 없으면 빈 목록을 돌려준다", async () => {
		expect(await listTemplateCacheFiles(extensionPath)).toEqual([])
	})

	it("캐시를 비우면 파일과 버전 디렉터리를 지우고 루트는 남긴다", async () => {
		await fs.outputFile(getTemplateCachePath(extensionPath, "examples", "4.3.1", "a.zip"), "aaaa")
		await fs.outputFile(getTemplateCachePath(extensionPath, "pom", "4.3.1", "a-pom.xml"), "bb")

		const result = await clearTemplateCache(extensionPath)

		expect(result).toEqual({ cleared: 2, size: 6 })
		expect(await fs.readdir(getTemplateCacheRoot(extensionPath, "examples"))).toEqual([])
		expect(await fs.readdir(getTemplateCacheRoot(extensionPath, "pom"))).toEqual([])
	})
})
