import * as fs from "fs"
import * as path from "path"

/**
 * ripgrepPath.ts
 *
 * 아키텍처 점검이 쓸 ripgrep(rg) 실행 파일을 찾는다. 확장은 rg를 직접 배포하지 않고,
 * VS Code(데스크톱·Server)가 자체 검색 기능을 위해 함께 설치한 rg를 빌려 쓴다.
 * 그래서 사용자의 OS·아키텍처에 맞는 바이너리가 항상 있고 VSIX 크기도 늘지 않는다.
 *
 * 탐색 순서 (resolveRipgrepPath):
 *   1. Cline 방식의 고정 후보 6개를 순서대로 확인 (listClineStyleCandidates)
 *   2. appRoot 아래 @vscode/ripgrep* 패키지 디렉터리를 나열해 bin/…/rg 확인 (listVsCodeRipgrepCandidates)
 *   3. 시스템에 설치된 rg (/usr/bin, /opt/homebrew/bin, /usr/local/bin, PATH) (listSystemRipgrepCandidates)
 *   4. 개발 환경(F5)용으로 확장 저장소 node_modules의 @vscode/ripgrep 1.18 플랫폼 패키지 (listDevRipgrepCandidates)
 *   그래도 없으면 undefined를 돌려주고, 엔진(archChecker)이 fs 재귀 탐색으로 대체한다.
 *
 * VS Code 안의 rg 위치는 버전마다 달라져 왔다. 1.122.0부터 `@vscode/ripgrep`이 플랫폼별 하위 디렉터리를
 * 가진 `@vscode/ripgrep-universal`로 바뀌었고(1.143 기준 `node_modules.asar.unpacked/@vscode/
 * ripgrep-universal/bin/<platform>-<arch>/rg`), 그 전에는 `node_modules[.asar.unpacked]/@vscode/ripgrep/bin/rg`
 * 였다. 1단계가 알려진 배치를 빠르게 맞추고, 2단계가 패키지 이름이 또 바뀌어도 `bin/…/rg` 구조만 유지되면 따라간다.
 *
 * 이 모듈은 vscode를 import하지 않는다(단위 테스트 가능). appRoot는 Controller가
 * vscode.env.appRoot로, extensionPath는 context.extensionPath로 넘긴다.
 */

export interface RipgrepLookupOptions {
	/** VS Code 설치 루트 (vscode.env.appRoot). 없으면 VS Code 쪽 탐색(1·2단계)을 건너뛴다 */
	appRoot?: string
	/** 확장 루트 (context.extensionPath). 개발 환경의 node_modules 탐색(4단계)에 쓴다 */
	extensionPath?: string
	platform?: NodeJS.Platform
	arch?: string
	/** PATH 환경 변수 (기본 process.env.PATH). 3단계의 PATH 탐색에 쓴다 */
	envPath?: string
}

function binaryName(platform: NodeJS.Platform): string {
	return platform === "win32" ? "rg.exe" : "rg"
}

function isExecutableFile(candidate: string, platform: NodeJS.Platform): boolean {
	try {
		if (!fs.statSync(candidate).isFile()) {
			return false
		}
	} catch {
		return false
	}
	if (platform === "win32") {
		return true
	}
	try {
		fs.accessSync(candidate, fs.constants.X_OK)
		return true
	} catch {
		try {
			fs.chmodSync(candidate, 0o755)
			return true
		} catch {
			return false
		}
	}
}

/**
 * 1단계: Cline 확장이 VS Code 내장 rg를 찾는 방식을 그대로 따른 고정 후보 6개.
 * 참조: cline/cline `apps/vscode/src/extension.ts`의 `getBinaryLocation("rg")`.
 * VS Code 1.122.0에서 `@vscode/ripgrep`이 플랫폼별 하위 디렉터리를 가진 `@vscode/ripgrep-universal`로
 * 바뀌었으므로 새 배치를 먼저 보고, 1.121 이하용 옛 경로(`@vscode/ripgrep`, 더 오래된 `vscode-ripgrep`)로 내려간다.
 */
export function listClineStyleCandidates(
	appRoot: string,
	platform: NodeJS.Platform = process.platform,
	arch: string = process.arch,
): string[] {
	const binary = binaryName(platform)
	const target = `${platform}-${arch}`
	return [
		path.join(appRoot, "node_modules", "@vscode", "ripgrep-universal", "bin", target, binary),
		path.join(appRoot, "node_modules.asar.unpacked", "@vscode", "ripgrep-universal", "bin", target, binary),
		path.join(appRoot, "node_modules", "@vscode", "ripgrep", "bin", binary),
		path.join(appRoot, "node_modules", "vscode-ripgrep", "bin", binary),
		path.join(appRoot, "node_modules.asar.unpacked", "vscode-ripgrep", "bin", binary),
		path.join(appRoot, "node_modules.asar.unpacked", "@vscode", "ripgrep", "bin", binary),
	]
}

function listRipgrepPackageDirs(scopeDir: string, platform: NodeJS.Platform, arch: string): string[] {
	let names: string[]
	try {
		names = fs
			.readdirSync(scopeDir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && entry.name.startsWith("ripgrep"))
			.map((entry) => entry.name)
	} catch {
		return []
	}
	// 자기 플랫폼 전용 패키지 → 단일 패키지 → universal → 그 밖의 ripgrep* 순서
	const priority = [`ripgrep-${platform}-${arch}`, "ripgrep", "ripgrep-universal"]
	names.sort((a, b) => {
		const ia = priority.indexOf(a)
		const ib = priority.indexOf(b)
		return (ia === -1 ? priority.length : ia) - (ib === -1 ? priority.length : ib) || a.localeCompare(b)
	})
	return names.map((name) => path.join(scopeDir, name))
}

/**
 * 2단계: VS Code 설치 루트(appRoot) 아래 node_modules.asar.unpacked와 node_modules의
 * @vscode/ripgrep* 패키지 디렉터리를 실제로 나열해 후보를 만든다 (존재 여부는 확인하지 않는다).
 * 1단계의 고정 후보에 없는 새 패키지 이름이 등장해도 bin/<platform>-<arch>/rg 또는 bin/rg 구조면 따라간다.
 */
export function listVsCodeRipgrepCandidates(
	appRoot: string,
	platform: NodeJS.Platform = process.platform,
	arch: string = process.arch,
): string[] {
	const binary = binaryName(platform)
	const candidates: string[] = []
	for (const modulesDir of ["node_modules.asar.unpacked", "node_modules"]) {
		const scopeDir = path.join(appRoot, modulesDir, "@vscode")
		for (const pkgDir of listRipgrepPackageDirs(scopeDir, platform, arch)) {
			candidates.push(path.join(pkgDir, "bin", `${platform}-${arch}`, binary))
			candidates.push(path.join(pkgDir, "bin", binary))
		}
	}
	return candidates
}

/**
 * 3단계: 시스템에 설치된 rg. 잘 알려진 설치 위치를 먼저 보고, 그다음 PATH의 각 디렉터리를 본다.
 * (Cline의 findSystemRipgrep과 같은 순서. Windows는 PATH만 본다)
 */
export function listSystemRipgrepCandidates(
	platform: NodeJS.Platform = process.platform,
	envPath: string | undefined = process.env.PATH,
): string[] {
	const binary = binaryName(platform)
	const candidates: string[] = []
	if (platform !== "win32") {
		candidates.push("/usr/bin/rg", "/opt/homebrew/bin/rg", "/usr/local/bin/rg")
	}
	const separator = platform === "win32" ? ";" : ":"
	for (const dir of (envPath ?? "").split(separator)) {
		if (dir.trim().length > 0) {
			candidates.push(path.join(dir.trim(), binary))
		}
	}
	return candidates
}

/**
 * 4단계: 확장 저장소의 node_modules에 npm이 설치한 @vscode/ripgrep 플랫폼별 패키지 경로 (개발 환경용)
 */
export function listDevRipgrepCandidates(
	extensionPath: string,
	platform: NodeJS.Platform = process.platform,
	arch: string = process.arch,
): string[] {
	const binary = binaryName(platform)
	const scopeDir = path.join(extensionPath, "node_modules", "@vscode")
	return [path.join(scopeDir, `ripgrep-${platform}-${arch}`, "bin", binary), path.join(scopeDir, "ripgrep", "bin", binary)]
}

/**
 * 위 4단계 순서로 후보를 모아, 실제로 존재하는 첫 rg 실행 파일 경로를 돌려준다.
 * 없으면 undefined (엔진은 fs 탐색으로 대체한다). 비-Windows에서는 실행 비트가 빠져 있으면 복구를 시도한다.
 */
export function resolveRipgrepPath(options: RipgrepLookupOptions = {}): string | undefined {
	const platform = options.platform ?? process.platform
	const arch = options.arch ?? process.arch
	const envPath = options.envPath ?? process.env.PATH
	const candidates = [
		...(options.appRoot ? listClineStyleCandidates(options.appRoot, platform, arch) : []),
		...(options.appRoot ? listVsCodeRipgrepCandidates(options.appRoot, platform, arch) : []),
		...listSystemRipgrepCandidates(platform, envPath),
		...(options.extensionPath ? listDevRipgrepCandidates(options.extensionPath, platform, arch) : []),
	]
	const seen = new Set<string>()
	for (const candidate of candidates) {
		if (seen.has(candidate)) {
			continue
		}
		seen.add(candidate)
		if (isExecutableFile(candidate, platform)) {
			return candidate
		}
	}
	return undefined
}
