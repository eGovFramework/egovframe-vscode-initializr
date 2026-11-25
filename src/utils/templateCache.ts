import * as fs from "fs-extra"
import * as path from "path"
import { resolveWithinBase } from "./pathSafety"

/**
 * templateCache.ts
 *
 * 내려받은 프로젝트 템플릿(ZIP)과 POM 템플릿의 캐시 경로 규칙.
 *
 * 캐시는 확장 설치 디렉터리가 아니라 VS Code가 확장별로 제공하는 globalStorage
 * (ExtensionContext.globalStorageUri) 아래에 둔다:
 *   <globalStorageUri>/template-cache/{examples,pom}/<version>/<fileName>
 *
 * - 확장 디렉터리는 업데이트 때마다 통째로 교체되고 읽기 전용일 수 있으며, 그 안의 파일은
 *   VSIX 패키징에 섞여 들어갈 수 있다. globalStorage는 업데이트 후에도 유지되고 확장을
 *   제거하면 VS Code가 정리한다.
 * - manifest가 버전마다 같은 파일명(예: egovframe-boot-web.zip)을 쓰므로 버전 디렉터리로
 *   구분하지 않으면 서로 다른 버전이 같은 캐시 파일을 두고 덮어쓰게 된다.
 *
 * VS Code 의존성이 없어 단위 테스트가 가능하다.
 */

export type TemplateCacheKind = "examples" | "pom"

const CACHE_DIR_NAME = "template-cache"

export interface TemplateCacheFile {
	/** 절대 경로 */
	path: string
	/** 캐시 루트 기준 상대 경로 (항상 / 구분자) */
	relativePath: string
	size: number
}

/** 확장의 globalStorage 경로(ExtensionContext.globalStorageUri.fsPath)에서 템플릿 캐시 루트를 구한다 */
export function getTemplateCacheRoot(globalStoragePath: string): string {
	return path.join(globalStoragePath, CACHE_DIR_NAME)
}

/**
 * 캐시 파일의 절대 경로: <cacheRoot>/<kind>/<version>/<fileName>.
 * 버전과 파일명이 캐시 루트를 벗어나면 예외를 던진다 (CWE-22 방어 심층).
 */
export function getTemplateCachePath(cacheRoot: string, kind: TemplateCacheKind, version: string, fileName: string): string {
	const kindRoot = path.join(cacheRoot, kind)
	const versionDir = resolveWithinBase(kindRoot, version)
	return resolveWithinBase(versionDir, fileName)
}

async function collectFiles(dir: string, cacheRoot: string, into: TemplateCacheFile[]): Promise<void> {
	const entries = await fs.readdir(dir, { withFileTypes: true })
	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			await collectFiles(entryPath, cacheRoot, into)
			continue
		}
		if (!entry.isFile()) {
			continue
		}
		const stats = await fs.stat(entryPath)
		into.push({
			path: entryPath,
			relativePath: path.relative(cacheRoot, entryPath).split(path.sep).join("/"),
			size: stats.size,
		})
	}
}

/** 캐시 루트 아래의 모든 파일(하위 디렉터리 포함)을 나열한다. 루트가 없으면 빈 목록 */
export async function listTemplateCacheFiles(cacheRoot: string): Promise<TemplateCacheFile[]> {
	const files: TemplateCacheFile[] = []
	if (await fs.pathExists(cacheRoot)) {
		await collectFiles(cacheRoot, cacheRoot, files)
	}
	return files
}

/** 캐시 루트의 내용을 모두 지운다. 루트 디렉터리 자체는 있으면 남기고, 없으면 만들지 않는다 */
export async function clearTemplateCache(cacheRoot: string): Promise<{ cleared: number; size: number }> {
	const files = await listTemplateCacheFiles(cacheRoot)
	const size = files.reduce((sum, file) => sum + file.size, 0)

	if (await fs.pathExists(cacheRoot)) {
		await fs.emptyDir(cacheRoot)
	}

	return { cleared: files.length, size }
}
