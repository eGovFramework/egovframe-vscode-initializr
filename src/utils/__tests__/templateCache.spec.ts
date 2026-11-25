import { afterEach, beforeEach, describe, expect, it } from "vitest"
import * as fs from "fs-extra"
import * as os from "os"
import * as path from "path"
import { clearTemplateCache, getTemplateCachePath, getTemplateCacheRoot, listTemplateCacheFiles } from "../templateCache"

describe("templateCache", () => {
	let globalStoragePath: string
	let cacheRoot: string

	beforeEach(async () => {
		globalStoragePath = await fs.mkdtemp(path.join(os.tmpdir(), "egov-global-storage-"))
		cacheRoot = getTemplateCacheRoot(globalStoragePath)
	})

	afterEach(async () => {
		await fs.remove(globalStoragePath)
	})

	it("캐시 루트는 확장의 globalStorage 아래 template-cache 디렉터리다", () => {
		expect(cacheRoot).toBe(path.join(globalStoragePath, "template-cache"))
	})

	it("캐시 파일 경로는 <루트>/<종류>/<버전>/<파일명>이다 (버전이 달라도 파일명이 같을 수 있다)", () => {
		expect(getTemplateCachePath(cacheRoot, "examples", "4.3.1", "egovframe-boot-web.zip")).toBe(
			path.join(cacheRoot, "examples", "4.3.1", "egovframe-boot-web.zip"),
		)
		expect(getTemplateCachePath(cacheRoot, "pom", "4.3.1", "egovframe-boot-web-pom.xml")).toBe(
			path.join(cacheRoot, "pom", "4.3.1", "egovframe-boot-web-pom.xml"),
		)
	})

	it("캐시 루트를 벗어나는 버전·파일명을 거부한다", () => {
		expect(() => getTemplateCachePath(cacheRoot, "examples", "../4.3.1", "x.zip")).toThrow()
		expect(() => getTemplateCachePath(cacheRoot, "pom", "4.3.1", "../../x.xml")).toThrow()
	})

	it("캐시 루트 아래의 파일을 하위 디렉터리까지 나열한다", async () => {
		await fs.outputFile(getTemplateCachePath(cacheRoot, "examples", "4.3.1", "a.zip"), "aaaa")
		await fs.outputFile(getTemplateCachePath(cacheRoot, "pom", "4.3.1", "a-pom.xml"), "bb")
		await fs.outputFile(path.join(cacheRoot, "examples", "4.3.1", "a.zip.123.part"), "c")

		const files = await listTemplateCacheFiles(cacheRoot)

		expect(files.map((f) => f.relativePath).sort()).toEqual([
			"examples/4.3.1/a.zip",
			"examples/4.3.1/a.zip.123.part",
			"pom/4.3.1/a-pom.xml",
		])
		expect(files.reduce((sum, f) => sum + f.size, 0)).toBe(7)
	})

	it("캐시 루트가 아직 없으면 빈 목록을 돌려주고 디렉터리를 만들지 않는다", async () => {
		expect(await listTemplateCacheFiles(cacheRoot)).toEqual([])
		expect(await fs.pathExists(cacheRoot)).toBe(false)
	})

	it("캐시를 비우면 루트 아래 내용을 모두 지우고 개수·크기를 돌려준다", async () => {
		await fs.outputFile(getTemplateCachePath(cacheRoot, "examples", "4.3.1", "a.zip"), "aaaa")
		await fs.outputFile(getTemplateCachePath(cacheRoot, "pom", "4.3.1", "a-pom.xml"), "bb")

		const result = await clearTemplateCache(cacheRoot)

		expect(result).toEqual({ cleared: 2, size: 6 })
		expect(await fs.readdir(cacheRoot)).toEqual([])
	})

	it("캐시 루트가 없을 때 비우기는 아무것도 만들지 않고 0을 돌려준다", async () => {
		expect(await clearTemplateCache(cacheRoot)).toEqual({ cleared: 0, size: 0 })
		expect(await fs.pathExists(cacheRoot)).toBe(false)
	})
})
