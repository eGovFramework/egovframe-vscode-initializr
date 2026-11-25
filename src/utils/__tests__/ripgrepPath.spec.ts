import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, describe, expect, it } from "vitest"
import {
	listClineStyleCandidates,
	listDevRipgrepCandidates,
	listSystemRipgrepCandidates,
	listVsCodeRipgrepCandidates,
	resolveRipgrepPath,
} from "../ripgrepPath"

const tempDirs: string[] = []
function makeTempDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "egov-rgpath-"))
	tempDirs.push(dir)
	return dir
}
function touch(file: string, mode = 0o755): void {
	fs.mkdirSync(path.dirname(file), { recursive: true })
	fs.writeFileSync(file, "#!/bin/sh\n")
	fs.chmodSync(file, mode)
}
afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		fs.rmSync(dir, { recursive: true, force: true })
	}
})

/** 테스트 머신의 PATH·시스템 rg에 영향을 받지 않도록 빈 PATH를 쓴다 */
const noSystem = { envPath: "" }

describe("1단계 listClineStyleCandidates", () => {
	it("Cline과 같은 순서로 고정 후보 6개를 만든다", () => {
		const c = listClineStyleCandidates("/app", "darwin", "arm64")
		expect(c).toEqual([
			"/app/node_modules/@vscode/ripgrep-universal/bin/darwin-arm64/rg",
			"/app/node_modules.asar.unpacked/@vscode/ripgrep-universal/bin/darwin-arm64/rg",
			"/app/node_modules/@vscode/ripgrep/bin/rg",
			"/app/node_modules/vscode-ripgrep/bin/rg",
			"/app/node_modules.asar.unpacked/vscode-ripgrep/bin/rg",
			"/app/node_modules.asar.unpacked/@vscode/ripgrep/bin/rg",
		])
	})

	it("Windows에서는 rg.exe를 가리킨다", () => {
		expect(listClineStyleCandidates("C:\\app", "win32", "x64")[0]).toBe(
			path.join("C:\\app", "node_modules", "@vscode", "ripgrep-universal", "bin", "win32-x64", "rg.exe"),
		)
	})
})

describe("2단계 listVsCodeRipgrepCandidates", () => {
	it("appRoot 아래 @vscode/ripgrep* 패키지의 bin/<platform>-<arch>/rg와 bin/rg를 후보로 만든다", () => {
		const appRoot = makeTempDir()
		fs.mkdirSync(path.join(appRoot, "node_modules.asar.unpacked", "@vscode", "ripgrep-next"), { recursive: true })
		fs.mkdirSync(path.join(appRoot, "node_modules", "@vscode", "ripgrep"), { recursive: true })

		const candidates = listVsCodeRipgrepCandidates(appRoot, "darwin", "arm64")
		expect(candidates).toEqual([
			path.join(appRoot, "node_modules.asar.unpacked", "@vscode", "ripgrep-next", "bin", "darwin-arm64", "rg"),
			path.join(appRoot, "node_modules.asar.unpacked", "@vscode", "ripgrep-next", "bin", "rg"),
			path.join(appRoot, "node_modules", "@vscode", "ripgrep", "bin", "darwin-arm64", "rg"),
			path.join(appRoot, "node_modules", "@vscode", "ripgrep", "bin", "rg"),
		])
	})

	it("디렉터리를 나열할 수 없으면 빈 목록", () => {
		expect(listVsCodeRipgrepCandidates(path.join(os.tmpdir(), "no-such-approot"), "linux", "x64")).toEqual([])
	})

	it("자기 플랫폼 전용 패키지를 단일 패키지·universal보다 먼저 본다", () => {
		const appRoot = makeTempDir()
		const scope = path.join(appRoot, "node_modules", "@vscode")
		for (const name of ["ripgrep-universal", "ripgrep", "ripgrep-linux-x64"]) {
			fs.mkdirSync(path.join(scope, name), { recursive: true })
		}
		const candidates = listVsCodeRipgrepCandidates(appRoot, "linux", "x64")
		const order = ["ripgrep-linux-x64", `${path.sep}ripgrep${path.sep}`, "ripgrep-universal"].map((marker) =>
			candidates.findIndex((c) => c.includes(marker)),
		)
		expect(order[0]).toBeLessThan(order[1])
		expect(order[1]).toBeLessThan(order[2])
	})
})

describe("3단계 listSystemRipgrepCandidates", () => {
	it("유닉스에서는 알려진 설치 위치 뒤에 PATH 항목을 붙인다", () => {
		expect(listSystemRipgrepCandidates("darwin", "/a/bin:/b/bin")).toEqual([
			"/usr/bin/rg",
			"/opt/homebrew/bin/rg",
			"/usr/local/bin/rg",
			"/a/bin/rg",
			"/b/bin/rg",
		])
	})

	it("Windows에서는 PATH(세미콜론 구분)의 rg.exe만 본다", () => {
		expect(listSystemRipgrepCandidates("win32", "C:\\tools;;D:\\bin")).toEqual([
			path.join("C:\\tools", "rg.exe"),
			path.join("D:\\bin", "rg.exe"),
		])
	})

	it("PATH가 비어 있으면 알려진 위치만", () => {
		expect(listSystemRipgrepCandidates("linux", "")).toEqual(["/usr/bin/rg", "/opt/homebrew/bin/rg", "/usr/local/bin/rg"])
	})
})

describe("4단계 listDevRipgrepCandidates", () => {
	it("확장 저장소 node_modules의 플랫폼 패키지와 단일 패키지 경로를 돌려준다", () => {
		expect(listDevRipgrepCandidates("/ext", "win32", "arm64")).toEqual([
			path.join("/ext", "node_modules", "@vscode", "ripgrep-win32-arm64", "bin", "rg.exe"),
			path.join("/ext", "node_modules", "@vscode", "ripgrep", "bin", "rg.exe"),
		])
	})
})

describe("resolveRipgrepPath", () => {
	it("아무 데도 없으면 undefined", () => {
		expect(
			resolveRipgrepPath({
				appRoot: makeTempDir(),
				extensionPath: makeTempDir(),
				platform: "linux",
				arch: "x64",
				...noSystem,
			}),
		).toBeUndefined()
	})

	it("1단계: VS Code 1.143 배치(ripgrep-universal/bin/<platform>-<arch>/rg)를 찾고 다른 아키텍처는 고르지 않는다", () => {
		const appRoot = makeTempDir()
		const rg = path.join(appRoot, "node_modules.asar.unpacked", "@vscode", "ripgrep-universal", "bin", "darwin-arm64", "rg")
		touch(rg)
		expect(resolveRipgrepPath({ appRoot, platform: "darwin", arch: "arm64", ...noSystem })).toBe(rg)
		expect(resolveRipgrepPath({ appRoot, platform: "darwin", arch: "x64", ...noSystem })).toBeUndefined()
	})

	it("1단계: 예전 배치(ripgrep/bin/rg, vscode-ripgrep)와 Windows 파일명도 찾는다", () => {
		const appRoot = makeTempDir()
		const rg = path.join(appRoot, "node_modules.asar.unpacked", "vscode-ripgrep", "bin", "rg.exe")
		touch(rg)
		expect(resolveRipgrepPath({ appRoot, platform: "win32", arch: "x64", ...noSystem })).toBe(rg)
	})

	it("2단계: 고정 후보에 없는 새 패키지 이름도 디렉터리 나열로 찾는다", () => {
		const appRoot = makeTempDir()
		const rg = path.join(appRoot, "node_modules.asar.unpacked", "@vscode", "ripgrep-next", "bin", "linux-x64", "rg")
		touch(rg)
		expect(resolveRipgrepPath({ appRoot, platform: "linux", arch: "x64", ...noSystem })).toBe(rg)
	})

	it("3단계: VS Code 쪽이 없으면 PATH의 rg를 쓰고, 4단계 개발 환경 패키지보다 앞선다", () => {
		const appRoot = makeTempDir()
		const extensionPath = makeTempDir()
		const pathDir = makeTempDir()
		const systemRg = path.join(pathDir, "rg")
		touch(systemRg)
		touch(path.join(extensionPath, "node_modules", "@vscode", "ripgrep-linux-x64", "bin", "rg"))
		expect(resolveRipgrepPath({ appRoot, extensionPath, platform: "linux", arch: "x64", envPath: pathDir })).toBe(systemRg)
	})

	it("4단계: 모두 없으면 확장 node_modules의 플랫폼 패키지로 대체하고, 실행 비트가 빠져 있으면 복구한다", () => {
		const appRoot = makeTempDir()
		const extensionPath = makeTempDir()
		const rg = path.join(extensionPath, "node_modules", "@vscode", "ripgrep-linux-x64", "bin", "rg")
		touch(rg, 0o644)
		expect(resolveRipgrepPath({ appRoot, extensionPath, platform: "linux", arch: "x64", ...noSystem })).toBe(rg)
		if (process.platform !== "win32") {
			expect(fs.statSync(rg).mode & 0o111).not.toBe(0)
		}
	})

	it("디렉터리는 실행 파일로 보지 않는다", () => {
		const appRoot = makeTempDir()
		fs.mkdirSync(path.join(appRoot, "node_modules", "@vscode", "ripgrep", "bin", "rg"), { recursive: true })
		expect(resolveRipgrepPath({ appRoot, platform: "linux", arch: "x64", ...noSystem })).toBeUndefined()
	})

	it("이 Mac에 설치된 VS Code가 있으면 실제 rg를 찾는다 (없으면 건너뜀)", () => {
		const appRoot = "/Applications/Visual Studio Code.app/Contents/Resources/app"
		if (!fs.existsSync(appRoot)) {
			return
		}
		const found = resolveRipgrepPath({ appRoot, ...noSystem })
		expect(found).toBeDefined()
		expect(found!.startsWith(appRoot)).toBe(true)
	})
})
