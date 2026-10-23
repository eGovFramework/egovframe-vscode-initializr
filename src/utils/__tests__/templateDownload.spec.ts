import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { EventEmitter } from "events"
import { PassThrough } from "stream"
import { createHash } from "crypto"
import * as fs from "fs-extra"
import * as os from "os"
import * as path from "path"
import type * as http from "http"
import {
	TemplateDownloadError,
	TemplateIntegrityError,
	buildTemplateDownloadUrl,
	downloadVerifiedFile,
	ensureVerifiedFile,
	requireSha256,
	sha256File,
	type DownloadRequest,
} from "../templateDownload"

const BASE = "https://example.test/releases/download/"
const ZIP_URL = `${BASE}v4.3/egovframe-boot-web.zip`

const sha256Of = (data: Buffer | string) => createHash("sha256").update(data).digest("hex")

interface Route {
	status: number
	headers?: Record<string, string>
	body?: Buffer | string
	/** 응답 본문을 이 조각들로 나눠 보낸다 */
	chunks?: Buffer[]
	/** 본문 일부를 보낸 뒤 이 오류로 스트림을 끊는다 */
	error?: Error
	/** 본문을 끝내지 않고 요청에 timeout 이벤트를 발생시킨다 */
	emitTimeout?: boolean
}

/** https.request 대역: 등록된 URL에 미리 정한 응답을 돌려주고 호출 URL과 옵션을 기록한다 */
function fakeTransport(routes: Record<string, Route>) {
	const calls: { url: string; options: http.RequestOptions }[] = []

	const request: DownloadRequest = (url, options, callback) => {
		calls.push({ url: url.href, options })
		const req = new EventEmitter() as EventEmitter & http.ClientRequest
		let res: (PassThrough & http.IncomingMessage) | undefined

		req.destroy = ((error?: Error) => {
			if (res && !res.destroyed) {
				res.destroy(error)
			}
			return req
		}) as http.ClientRequest["destroy"]
		req.end = ((): http.ClientRequest => {
			setImmediate(() => {
				const route = routes[url.href]
				if (!route) {
					req.emit("error", new Error(`fake transport: no route for ${url.href}`))
					return
				}
				res = new PassThrough() as PassThrough & http.IncomingMessage
				res.statusCode = route.status
				res.headers = { ...(route.headers ?? {}) }
				callback(res)

				const chunks = route.chunks ?? (route.body !== undefined ? [Buffer.from(route.body)] : [])
				for (const chunk of chunks) {
					res.write(chunk)
				}
				if (route.error) {
					res.destroy(route.error)
				} else if (route.emitTimeout) {
					req.emit("timeout")
				} else {
					res.end()
				}
			})
			return req
		}) as http.ClientRequest["end"]

		return req
	}

	return { request, calls }
}

describe("buildTemplateDownloadUrl", () => {
	it("상대 경로를 baseUrl 뒤에 이어 붙인다", () => {
		expect(buildTemplateDownloadUrl(BASE, "v4.3/egovframe-boot-web.zip")).toBe(ZIP_URL)
	})

	it("baseUrl 끝에 슬래시가 없어도 마지막 세그먼트를 잃지 않는다", () => {
		expect(buildTemplateDownloadUrl("https://example.test/releases/download", "v4.3/x.zip")).toBe(
			"https://example.test/releases/download/v4.3/x.zip",
		)
	})

	it("https가 아닌 baseUrl을 거부한다", () => {
		expect(() => buildTemplateDownloadUrl("http://example.test/releases/download/", "v4.3/x.zip")).toThrow(
			TemplateDownloadError,
		)
	})

	it("baseUrl 바깥으로 벗어나는 상대 경로를 거부한다", () => {
		for (const relativePath of [
			"../x.zip",
			"//evil.example/x.zip",
			"https://evil.example/x.zip",
			"/x.zip",
			"v4.3/../../x.zip",
		]) {
			expect(() => buildTemplateDownloadUrl(BASE, relativePath), relativePath).toThrow(TemplateDownloadError)
		}
	})
})

describe("requireSha256", () => {
	it("기록된 해시를 소문자로 돌려준다", () => {
		expect(requireSha256("ABCDEF".padEnd(64, "0"), "x")).toBe("abcdef".padEnd(64, "0"))
	})

	it("해시가 없으면 무결성 오류로 거부한다", () => {
		expect(() => requireSha256(undefined, "egovframe-boot-web.zip (4.3.1)")).toThrow(TemplateIntegrityError)
		expect(() => requireSha256(undefined, "egovframe-boot-web.zip (4.3.1)")).toThrow(/egovframe-boot-web\.zip \(4\.3\.1\)/)
	})
})

describe("downloadVerifiedFile / ensureVerifiedFile", () => {
	let workDir: string
	let destPath: string
	const body = Buffer.from("PK\u0003\u0004 fake zip payload for hashing")
	const bodySha = sha256Of(body)

	beforeEach(async () => {
		workDir = await fs.mkdtemp(path.join(os.tmpdir(), "egov-download-"))
		destPath = path.join(workDir, "cache", "4.3.1", "egovframe-boot-web.zip")
	})

	afterEach(async () => {
		await fs.remove(workDir)
	})

	const leftovers = async () => ((await fs.pathExists(path.dirname(destPath))) ? fs.readdir(path.dirname(destPath)) : [])

	it("sha256 파일 해시를 계산한다", async () => {
		await fs.outputFile(destPath, body)
		expect(await sha256File(destPath)).toBe(bodySha)
	})

	it("200 응답을 받아 해시가 맞으면 목적지에 저장하고 .part 파일을 남기지 않는다", async () => {
		const transport = fakeTransport({ [ZIP_URL]: { status: 200, headers: { "content-length": String(body.length) }, body } })
		const progress: string[] = []

		await downloadVerifiedFile(ZIP_URL, destPath, bodySha, {
			request: transport.request,
			onProgress: (m) => progress.push(m),
		})

		expect(await fs.readFile(destPath)).toEqual(body)
		expect(await leftovers()).toEqual(["egovframe-boot-web.zip"])
		expect(progress.length).toBeGreaterThan(0)
	})

	it("https 리다이렉트를 따라가며 상대 Location도 현재 URL 기준으로 해석한다", async () => {
		const hop = "https://objects.example/abc/egovframe-boot-web.zip"
		const transport = fakeTransport({
			[ZIP_URL]: { status: 302, headers: { location: hop } },
			[hop]: { status: 307, headers: { location: "/final/egovframe-boot-web.zip" } },
			"https://objects.example/final/egovframe-boot-web.zip": { status: 200, body },
		})

		await downloadVerifiedFile(ZIP_URL, destPath, bodySha, { request: transport.request })

		expect(transport.calls.map((c) => c.url)).toEqual([ZIP_URL, hop, "https://objects.example/final/egovframe-boot-web.zip"])
		expect(await fs.readFile(destPath)).toEqual(body)
	})

	it("http로 내려가는 리다이렉트를 거부한다", async () => {
		const transport = fakeTransport({ [ZIP_URL]: { status: 302, headers: { location: "http://example.test/x.zip" } } })

		await expect(downloadVerifiedFile(ZIP_URL, destPath, bodySha, { request: transport.request })).rejects.toThrow(
			TemplateDownloadError,
		)
		expect(transport.calls).toHaveLength(1)
		expect(await leftovers()).toEqual([])
	})

	it("리다이렉트 상한을 넘으면 중단한다", async () => {
		const transport = fakeTransport({
			[ZIP_URL]: { status: 302, headers: { location: `${BASE}a.zip` } },
			[`${BASE}a.zip`]: { status: 302, headers: { location: `${BASE}b.zip` } },
			[`${BASE}b.zip`]: { status: 302, headers: { location: `${BASE}c.zip` } },
			[`${BASE}c.zip`]: { status: 200, body },
		})

		await expect(
			downloadVerifiedFile(ZIP_URL, destPath, bodySha, { request: transport.request, maxRedirects: 2 }),
		).rejects.toThrow(/redirect/i)
		expect(transport.calls).toHaveLength(3)
	})

	it("Location 없는 리다이렉트와 200이 아닌 응답을 거부한다", async () => {
		const noLocation = fakeTransport({ [ZIP_URL]: { status: 302 } })
		await expect(downloadVerifiedFile(ZIP_URL, destPath, bodySha, { request: noLocation.request })).rejects.toThrow(
			TemplateDownloadError,
		)

		const notFound = fakeTransport({ [ZIP_URL]: { status: 404, body: "not found" } })
		await expect(downloadVerifiedFile(ZIP_URL, destPath, bodySha, { request: notFound.request })).rejects.toThrow(/HTTP 404/)
		expect(await leftovers()).toEqual([])
	})

	it("https가 아닌 URL은 요청을 보내기 전에 거부한다", async () => {
		const transport = fakeTransport({})

		await expect(
			downloadVerifiedFile("http://example.test/x.zip", destPath, bodySha, { request: transport.request }),
		).rejects.toThrow(TemplateDownloadError)
		expect(transport.calls).toHaveLength(0)
	})

	it("Content-Length가 상한을 넘으면 본문을 읽지 않고 중단한다", async () => {
		const transport = fakeTransport({ [ZIP_URL]: { status: 200, headers: { "content-length": "999" }, body } })

		await expect(
			downloadVerifiedFile(ZIP_URL, destPath, bodySha, { request: transport.request, maxBytes: 100 }),
		).rejects.toThrow(/exceeds|too large/i)
		expect(await leftovers()).toEqual([])
	})

	it("Content-Length가 거짓이어도 받은 바이트가 상한을 넘으면 중단한다", async () => {
		const transport = fakeTransport({
			[ZIP_URL]: { status: 200, headers: { "content-length": "10" }, chunks: [Buffer.alloc(60), Buffer.alloc(60)] },
		})

		await expect(
			downloadVerifiedFile(ZIP_URL, destPath, bodySha, { request: transport.request, maxBytes: 100 }),
		).rejects.toThrow(/exceeds|too large/i)
		expect(await leftovers()).toEqual([])
	})

	it("해시가 다르면 무결성 오류를 내고 파일을 남기지 않는다", async () => {
		const transport = fakeTransport({ [ZIP_URL]: { status: 200, body: Buffer.from("tampered payload") } })

		await expect(downloadVerifiedFile(ZIP_URL, destPath, bodySha, { request: transport.request })).rejects.toThrow(
			TemplateIntegrityError,
		)
		expect(await leftovers()).toEqual([])
	})

	it("응답 스트림이 중간에 끊기면 다운로드 오류를 내고 .part를 정리한다", async () => {
		const transport = fakeTransport({
			[ZIP_URL]: { status: 200, chunks: [body.subarray(0, 8)], error: new Error("ECONNRESET") },
		})

		await expect(downloadVerifiedFile(ZIP_URL, destPath, bodySha, { request: transport.request })).rejects.toThrow(
			TemplateDownloadError,
		)
		expect(await leftovers()).toEqual([])
	})

	it("소켓 타임아웃을 요청 옵션으로 전달하고 timeout 이벤트를 실패로 처리한다", async () => {
		const transport = fakeTransport({ [ZIP_URL]: { status: 200, chunks: [body.subarray(0, 8)], emitTimeout: true } })

		await expect(
			downloadVerifiedFile(ZIP_URL, destPath, bodySha, { request: transport.request, timeoutMs: 1234 }),
		).rejects.toThrow(/timed out/i)
		expect(transport.calls[0].options.timeout).toBe(1234)
		expect(await leftovers()).toEqual([])
	})

	it("임시 파일 이름에 프로세스 ID를 넣어 다른 창의 동시 다운로드와 겹치지 않게 한다", async () => {
		const transport = fakeTransport({ [ZIP_URL]: { status: 200, headers: { "content-length": String(body.length) }, body } })
		const seenDuringDownload: string[] = []
		const onProgress = (message: string) => {
			if (message.startsWith("Downloading...")) {
				seenDuringDownload.push(...fs.readdirSync(path.dirname(destPath)))
			}
		}

		await downloadVerifiedFile(ZIP_URL, destPath, bodySha, { request: transport.request, onProgress })

		expect(seenDuringDownload).toContain(`egovframe-boot-web.zip.${process.pid}.part`)
		expect(await leftovers()).toEqual(["egovframe-boot-web.zip"])
	})

	it("하루 넘게 남아 있던 .part 잔여물은 지우고, 최근 .part(다른 창의 진행 중 다운로드일 수 있음)는 남겨 둔다", async () => {
		const stale = `${destPath}.11111.part`
		const legacyStale = `${destPath}.part`
		const recent = `${destPath}.22222.part`
		await fs.outputFile(stale, "stale partial")
		await fs.outputFile(legacyStale, "stale partial without pid")
		await fs.outputFile(recent, "another window is still downloading")
		const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
		await fs.utimes(stale, twoDaysAgo, twoDaysAgo)
		await fs.utimes(legacyStale, twoDaysAgo, twoDaysAgo)
		const transport = fakeTransport({ [ZIP_URL]: { status: 200, body } })

		await downloadVerifiedFile(ZIP_URL, destPath, bodySha, { request: transport.request })

		expect((await leftovers()).sort()).toEqual(["egovframe-boot-web.zip", "egovframe-boot-web.zip.22222.part"])
	})

	it("ensureVerifiedFile: 캐시 파일의 해시가 맞으면 네트워크 없이 그 경로를 돌려준다", async () => {
		await fs.outputFile(destPath, body)
		const transport = fakeTransport({})

		const result = await ensureVerifiedFile(ZIP_URL, destPath, bodySha, { request: transport.request })

		expect(result).toBe(destPath)
		expect(transport.calls).toHaveLength(0)
	})

	it("ensureVerifiedFile: 캐시 파일의 해시가 다르면 지우고 한 번 다시 받는다", async () => {
		await fs.outputFile(destPath, "stale cache from an older manifest")
		const transport = fakeTransport({ [ZIP_URL]: { status: 200, body } })

		const result = await ensureVerifiedFile(ZIP_URL, destPath, bodySha, { request: transport.request })

		expect(result).toBe(destPath)
		expect(transport.calls).toHaveLength(1)
		expect(await fs.readFile(destPath)).toEqual(body)
	})

	it("ensureVerifiedFile: 다시 받은 파일도 해시가 다르면 무결성 오류를 내고 캐시를 비운다", async () => {
		await fs.outputFile(destPath, "stale cache")
		const transport = fakeTransport({ [ZIP_URL]: { status: 200, body: Buffer.from("upstream was replaced") } })

		await expect(ensureVerifiedFile(ZIP_URL, destPath, bodySha, { request: transport.request })).rejects.toThrow(
			TemplateIntegrityError,
		)
		expect(transport.calls).toHaveLength(1)
		expect(await leftovers()).toEqual([])
	})

	it("ensureVerifiedFile: 캐시가 없으면 내려받는다", async () => {
		const transport = fakeTransport({ [ZIP_URL]: { status: 200, body } })

		await ensureVerifiedFile(ZIP_URL, destPath, bodySha, { request: transport.request })

		expect(transport.calls).toHaveLength(1)
		expect(await fs.readFile(destPath)).toEqual(body)
	})
})
