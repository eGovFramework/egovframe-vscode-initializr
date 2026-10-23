import * as fs from "fs-extra"
import * as path from "path"
import { resolveWithinBase } from "./pathSafety"

/**
 * templateCache.ts
 *
 * 내려받은 프로젝트 템플릿(ZIP)과 POM 템플릿의 캐시 경로 규칙.
 *
 * 캐시는 templates/projects/{examples,pom}/cache/<version>/<fileName> 에 둔다.
 * manifest가 버전마다 같은 파일명(예: egovframe-boot-web.zip)을 쓰므로 버전 디렉터리로
 * 구분하지 않으면 서로 다른 버전이 같은 캐시 파일을 두고 덮어쓰게 된다.
 *
 * VS Code 의존성이 없어 단위 테스트가 가능하다.
 */

export type TemplateCacheKind = "examples" | "pom"

const CACHE_DIR_NAME = "cache"
const CACHE_KINDS: TemplateCacheKind[] = ["examples", "pom"]

export interface TemplateCacheFile {
	/** 절대 경로 */
	path: string
	/** templates/projects 기준 상대 경로 (항상 / 구분자) */
	relativePath: string
	size: number
}

function getProjectsDir(extensionPath: string): string {
	return path.join(extensionPath, "templates", "projects")
}

/** 종류별 캐시 루트: templates/projects/<kind>/cache */
export function getTemplateCacheRoot(extensionPath: string, kind: TemplateCacheKind): string {
	return path.join(getProjectsDir(extensionPath), kind, CACHE_DIR_NAME)
}

/**
 * 캐시 파일의 절대 경로: <cache root>/<version>/<fileName>.
 * 버전과 파일명이 캐시 루트를 벗어나면 예외를 던진다 (CWE-22 방어 심층).
 */
export function getTemplateCachePath(extensionPath: string, kind: TemplateCacheKind, version: string, fileName: string): string {
	const root = getTemplateCacheRoot(extensionPath, kind)
	const versionDir = resolveWithinBase(root, version)
	return resolveWithinBase(versionDir, fileName)
}

async function collectFiles(dir: string, projectsDir: string, into: TemplateCacheFile[]): Promise<void> {
	const entries = await fs.readdir(dir, { withFileTypes: true })
	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			await collectFiles(entryPath, projectsDir, into)
			continue
		}
		if (!entry.isFile()) {
			continue
		}
		const stats = await fs.stat(entryPath)
		into.push({
			path: entryPath,
			relativePath: path.relative(projectsDir, entryPath).split(path.sep).join("/"),
			size: stats.size,
		})
	}
}

/** 두 캐시 루트 아래의 모든 파일(하위 디렉터리 포함)을 나열한다 */
export async function listTemplateCacheFiles(extensionPath: string): Promise<TemplateCacheFile[]> {
	const projectsDir = getProjectsDir(extensionPath)
	const files: TemplateCacheFile[] = []
	for (const kind of CACHE_KINDS) {
		const root = getTemplateCacheRoot(extensionPath, kind)
		if (await fs.pathExists(root)) {
			await collectFiles(root, projectsDir, files)
		}
	}
	return files
}

/** 두 캐시 루트의 내용을 모두 지운다. 루트 디렉터리 자체는 남긴다 */
export async function clearTemplateCache(extensionPath: string): Promise<{ cleared: number; size: number }> {
	const files = await listTemplateCacheFiles(extensionPath)
	const size = files.reduce((sum, file) => sum + file.size, 0)

	for (const kind of CACHE_KINDS) {
		const root = getTemplateCacheRoot(extensionPath, kind)
		if (await fs.pathExists(root)) {
			await fs.emptyDir(root)
		}
	}

	return { cleared: files.length, size }
}
