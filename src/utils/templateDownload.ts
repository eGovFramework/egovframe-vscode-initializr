import * as fs from "fs-extra"
import * as path from "path"
import * as https from "https"
import type * as http from "http"
import { createHash } from "crypto"
import { once } from "events"
import { finished } from "stream/promises"
import { SHA256_HEX_PATTERN } from "./templateManifest"

/**
 * templateDownload.ts
 *
 * GitHub Releases에서 프로젝트 템플릿(ZIP)·POM 템플릿을 내려받고 무결성을 검증한다.
 *
 * - https만 허용하고 리다이렉트도 https로만 따라간다 (횟수 상한 있음)
 * - 응답 크기 상한을 Content-Length와 실제 수신 바이트 양쪽에서 적용한다
 * - 임시 파일(<파일명>.<pid>.part)에 받으면서 sha256을 계산하고, 확장에 번들된 manifest의 해시와
 *   일치할 때만 최종 경로로 옮긴다. 따라서 캐시 디렉터리에는 검증을 통과한 파일만 들어간다.
 *   임시 파일 이름에 프로세스 ID가 들어가므로 여러 VS Code 창이 같은 템플릿을 동시에 받아도
 *   서로 덮어쓰지 않으며, 비정상 종료로 하루 넘게 남은 임시 파일은 다음 다운로드 때 정리한다
 * - 캐시 파일을 쓸 때도 해시를 다시 확인해, 확장 업데이트로 해시가 바뀌었거나 파일이 손상된
 *   경우 지우고 한 번 다시 받는다
 *
 * VS Code 의존성이 없고 전송 계층(https.request)을 주입할 수 있어 단위 테스트가 가능하다.
 */

/** 네트워크·HTTP·크기·리다이렉트 등 전송 단계의 실패 */
export class TemplateDownloadError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "TemplateDownloadError"
	}
}

/** 받은 내용이 manifest에 기록된 해시와 다르거나, 해시가 기록되어 있지 않은 경우 */
export class TemplateIntegrityError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "TemplateIntegrityError"
	}
}

export const DEFAULT_MAX_TEMPLATE_BYTES = 200 * 1024 * 1024
export const DEFAULT_MAX_REDIRECTS = 5
export const DEFAULT_DOWNLOAD_TIMEOUT_MS = 60_000

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308])
const USER_AGENT = "egovframe-vscode-initializr"
/** 이보다 오래된 .part 잔여물은 비정상 종료가 남긴 것으로 보고 지운다 */
const STALE_PART_MAX_AGE_MS = 24 * 60 * 60 * 1000

/** https.request와 같은 모양의 전송 함수. 테스트에서 대역으로 바꿀 수 있다 */
export type DownloadRequest = (
	url: URL,
	options: http.RequestOptions,
	callback: (response: http.IncomingMessage) => void,
) => http.ClientRequest

export interface DownloadOptions {
	maxBytes?: number
	maxRedirects?: number
	/** 소켓 유휴 타임아웃 (ms). 응답 도중에 멈춘 전송도 이 시간이 지나면 실패로 처리한다 */
	timeoutMs?: number
	onProgress?: (message: string) => void
	/** 전송 계층 주입 (기본값 https.request) */
	request?: DownloadRequest
}

const defaultRequest: DownloadRequest = (url, options, callback) => https.request(url, options, callback)

function parseHttpsUrl(value: string, what: string): URL {
	let url: URL
	try {
		url = new URL(value)
	} catch {
		throw new TemplateDownloadError(`${what} is not a valid URL: ${value}`)
	}
	if (url.protocol !== "https:") {
		throw new TemplateDownloadError(`${what} must use https: ${value}`)
	}
	return url
}

/**
 * manifest의 repository.baseUrl과 상대 다운로드 경로를 합쳐 절대 https URL을 만든다.
 * 결과가 baseUrl의 origin·경로 접두사를 벗어나면 거부한다.
 */
export function buildTemplateDownloadUrl(baseUrl: string, relativePath: string): string {
	const base = parseHttpsUrl(baseUrl, "Template repository base URL")
	if (!base.pathname.endsWith("/")) {
		base.pathname += "/"
	}

	let target: URL
	try {
		target = new URL(relativePath, base)
	} catch {
		throw new TemplateDownloadError(`Invalid template download path: ${relativePath}`)
	}

	const escapes =
		target.protocol !== "https:" ||
		target.origin !== base.origin ||
		!target.pathname.startsWith(base.pathname) ||
		target.search !== "" ||
		target.hash !== ""
	if (escapes) {
		throw new TemplateDownloadError(`Template download path escapes the repository base URL: ${relativePath}`)
	}
	return target.href
}

/**
 * manifest에 기록된 sha256을 소문자로 정규화해 돌려준다.
 * 기록이 없으면 다운로드를 진행하지 않도록 무결성 오류를 던진다 (fail closed).
 */
export function requireSha256(value: string | undefined, label: string): string {
	if (value === undefined || value === "") {
		throw new TemplateIntegrityError(
			`No sha256 is recorded in the bundled manifest for ${label}, so it cannot be downloaded safely. ` +
				`Update the extension to a version whose manifest records the hash.`,
		)
	}
	if (!SHA256_HEX_PATTERN.test(value)) {
		throw new TemplateIntegrityError(`The sha256 recorded for ${label} is malformed`)
	}
	return value.toLowerCase()
}

/** 파일의 sha256(16진수 소문자)을 스트리밍으로 계산한다 */
export async function sha256File(filePath: string): Promise<string> {
	const hash = createHash("sha256")
	for await (const chunk of fs.createReadStream(filePath)) {
		hash.update(chunk as Buffer)
	}
	return hash.digest("hex")
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** 이 프로세스가 destPath를 받는 동안 쓰는 임시 파일 경로 */
function partPathFor(destPath: string): string {
	return `${destPath}.${process.pid}.part`
}

/**
 * destPath를 받다가 남은 오래된 임시 파일(<파일명>.part, <파일명>.<pid>.part)을 지운다.
 * 최근 것은 다른 창이 진행 중인 다운로드일 수 있으므로 남겨 둔다.
 */
async function removeStaleParts(destPath: string): Promise<void> {
	const dir = path.dirname(destPath)
	const pattern = new RegExp(`^${escapeRegExp(path.basename(destPath))}\\.(?:\\d+\\.)?part$`)
	let entries: string[]
	try {
		entries = await fs.readdir(dir)
	} catch {
		return
	}
	const cutoff = Date.now() - STALE_PART_MAX_AGE_MS
	for (const entry of entries) {
		if (!pattern.test(entry)) {
			continue
		}
		const entryPath = path.join(dir, entry)
		try {
			if ((await fs.stat(entryPath)).mtimeMs < cutoff) {
				await fs.remove(entryPath)
			}
		} catch {
			// 다른 프로세스가 막 지웠거나 잠근 파일 — 다음 기회에 정리한다
		}
	}
}

function toDownloadError(error: unknown): Error {
	if (error instanceof TemplateDownloadError || error instanceof TemplateIntegrityError) {
		return error
	}
	const message = error instanceof Error ? error.message : String(error)
	return new TemplateDownloadError(`Download interrupted: ${message}`)
}

interface OpenedResponse {
	response: http.IncomingMessage
	/** 요청 객체에서 보고된 오류 — 응답 스트림이 끊긴 진짜 원인을 보존한다 */
	failure: { error?: Error }
}

function openResponse(url: URL, timeoutMs: number, request: DownloadRequest): Promise<OpenedResponse> {
	return new Promise((resolve, reject) => {
		const failure: { error?: Error } = {}
		const requestOptions: http.RequestOptions = {
			method: "GET",
			headers: { "User-Agent": USER_AGENT, Accept: "application/octet-stream" },
			timeout: timeoutMs,
		}
		const req = request(url, requestOptions, (response) => {
			// 본문을 읽기 시작하기 전에 끊기는 경우도 원인을 보존하고 unhandled 'error'를 막는다
			response.on("error", (error) => {
				failure.error ??= toDownloadError(error)
			})
			resolve({ response, failure })
		})
		req.on("timeout", () => {
			req.destroy(new TemplateDownloadError(`Download of ${url.href} timed out after ${timeoutMs} ms without data`))
		})
		req.on("error", (error) => {
			failure.error = toDownloadError(error)
			reject(failure.error)
		})
		req.end()
	})
}

async function closeQuietly(stream: fs.WriteStream): Promise<void> {
	if (stream.closed) {
		return
	}
	stream.destroy()
	await once(stream, "close")
}

async function writeBody(
	opened: OpenedResponse,
	partPath: string,
	maxBytes: number,
	declaredLength: number,
	onProgress?: (message: string) => void,
): Promise<string> {
	const { response, failure } = opened
	const hash = createHash("sha256")
	const out = fs.createWriteStream(partPath)
	let received = 0
	let lastPercent = -1

	try {
		// 본문을 읽기 전에 임시 파일이 실제로 열려 있게 한다 — 열기 실패를 먼저 드러내고,
		// 다른 창이 .part 존재 여부로 진행 중인 다운로드를 알아볼 수 있다
		await once(out, "open")
		for await (const chunk of response) {
			const buffer = chunk as Buffer
			received += buffer.length
			if (received > maxBytes) {
				throw new TemplateDownloadError(`Template download exceeds the ${maxBytes}-byte limit`)
			}
			hash.update(buffer)
			if (!out.write(buffer)) {
				await once(out, "drain")
			}
			if (onProgress && declaredLength > 0) {
				const percent = Math.min(100, Math.floor((received / declaredLength) * 100))
				if (percent !== lastPercent) {
					lastPercent = percent
					onProgress(`Downloading... ${percent}%`)
				}
			}
		}
		out.end()
		await finished(out)
	} catch (error) {
		response.destroy()
		await closeQuietly(out)
		// for-await를 빠져나오며 스트림이 AbortError로 파기되므로, 우리가 던진 오류(크기 상한 등)는
		// 그대로 보존하고, 스트림 자체의 실패만 요청 단계에서 기록된 원인으로 바꿔 보고한다
		if (error instanceof TemplateDownloadError || error instanceof TemplateIntegrityError) {
			throw error
		}
		throw failure.error ?? toDownloadError(error)
	}

	return hash.digest("hex")
}

/** URL의 내용을 partPath에 받으면서 sha256을 계산해 돌려준다. 리다이렉트·크기·프로토콜 규칙을 적용한다 */
async function fetchToFile(url: string, partPath: string, options: DownloadOptions): Promise<string> {
	const maxBytes = options.maxBytes ?? DEFAULT_MAX_TEMPLATE_BYTES
	const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS
	const timeoutMs = options.timeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS
	const request = options.request ?? defaultRequest

	let current = parseHttpsUrl(url, "Template download URL")
	let redirects = 0

	for (;;) {
		options.onProgress?.(`Downloading from ${current.host}...`)
		const opened = await openResponse(current, timeoutMs, request)
		const { response } = opened
		const status = response.statusCode ?? 0

		if (REDIRECT_STATUS_CODES.has(status)) {
			response.resume()
			const location = response.headers.location
			if (!location) {
				throw new TemplateDownloadError(`HTTP ${status} redirect from ${current.href} has no Location header`)
			}
			if (redirects >= maxRedirects) {
				throw new TemplateDownloadError(`Too many redirects (more than ${maxRedirects}) while downloading ${url}`)
			}
			redirects++
			let next: URL
			try {
				next = new URL(location, current)
			} catch {
				throw new TemplateDownloadError(`Invalid redirect Location from ${current.href}: ${location}`)
			}
			if (next.protocol !== "https:") {
				throw new TemplateDownloadError(`Refusing redirect to a non-https URL: ${next.href}`)
			}
			current = next
			continue
		}

		if (status !== 200) {
			response.resume()
			throw new TemplateDownloadError(`Failed to download ${current.href}: HTTP ${status}`)
		}

		const declaredLength = Number(response.headers["content-length"])
		if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
			response.destroy()
			throw new TemplateDownloadError(
				`Template at ${current.href} is too large: ${declaredLength} bytes exceeds the ${maxBytes}-byte limit`,
			)
		}

		return writeBody(opened, partPath, maxBytes, Number.isFinite(declaredLength) ? declaredLength : 0, options.onProgress)
	}
}

/**
 * url의 내용을 destPath에 내려받는다. 임시 파일(<파일명>.<pid>.part)에 받아 sha256이 expectedSha256과
 * 일치할 때만 destPath로 옮기고, 그렇지 않으면 임시 파일을 지우고 예외를 던진다.
 */
export async function downloadVerifiedFile(
	url: string,
	destPath: string,
	expectedSha256: string,
	options: DownloadOptions = {},
): Promise<void> {
	const expected = expectedSha256.toLowerCase()
	const partPath = partPathFor(destPath)

	await fs.ensureDir(path.dirname(destPath))
	await removeStaleParts(destPath)
	await fs.remove(partPath)

	let actual: string
	try {
		actual = await fetchToFile(url, partPath, options)
	} catch (error) {
		await fs.remove(partPath).catch(() => undefined)
		throw error
	}

	if (actual !== expected) {
		await fs.remove(partPath).catch(() => undefined)
		throw new TemplateIntegrityError(
			`Integrity check failed for ${path.basename(destPath)}: the file served at ${url} has sha256 ${actual}, ` +
				`but this extension's manifest records ${expected}. The template was not extracted. ` +
				`If the template was republished, update the extension to a version whose manifest records the new hash.`,
		)
	}

	await fs.move(partPath, destPath, { overwrite: true })
	options.onProgress?.(`Download verified: ${path.basename(destPath)}`)
}

/**
 * destPath에 해시가 일치하는 캐시 파일이 있으면 그대로 쓰고, 없거나 해시가 다르면 (캐시를 지우고)
 * 한 번 내려받는다. 성공하면 destPath를 돌려준다.
 */
export async function ensureVerifiedFile(
	url: string,
	destPath: string,
	expectedSha256: string,
	options: DownloadOptions = {},
): Promise<string> {
	const expected = expectedSha256.toLowerCase()
	const fileName = path.basename(destPath)

	if (await fs.pathExists(destPath)) {
		if ((await sha256File(destPath)) === expected) {
			options.onProgress?.(`Using cached template: ${fileName}`)
			return destPath
		}
		options.onProgress?.(`Cached ${fileName} does not match the manifest hash; downloading it again`)
		await fs.remove(destPath)
	}

	await downloadVerifiedFile(url, destPath, expected, options)
	return destPath
}
