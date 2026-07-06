import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs-extra"

/**
 * Clear template cache directories
 */
async function clearCacheDirectories(extensionPath: string): Promise<{ cleared: number; size: number }> {
	const cachePaths = [
		path.join(extensionPath, "templates", "projects", "examples", "cache"),
		path.join(extensionPath, "templates", "projects", "pom", "cache"),
	]

	let totalCleared = 0
	let totalSize = 0

	for (const cachePath of cachePaths) {
		if (await fs.pathExists(cachePath)) {
			const files = await fs.readdir(cachePath)
			for (const file of files) {
				const filePath = path.join(cachePath, file)
				const stats = await fs.stat(filePath)
				totalSize += stats.size
				await fs.remove(filePath)
				totalCleared++
			}
		}
	}

	return { cleared: totalCleared, size: totalSize }
}

/**
 * Get cache info
 */
async function getCacheInfo(extensionPath: string): Promise<{ files: string[]; size: number; path: string }> {
	const cachePaths = [
		path.join(extensionPath, "templates", "projects", "examples", "cache"),
		path.join(extensionPath, "templates", "projects", "pom", "cache"),
	]

	const files: string[] = []
	let totalSize = 0

	for (const cachePath of cachePaths) {
		if (await fs.pathExists(cachePath)) {
			const cacheFiles = await fs.readdir(cachePath)
			for (const file of cacheFiles) {
				const filePath = path.join(cachePath, file)
				const stats = await fs.stat(filePath)
				totalSize += stats.size
				files.push(file)
			}
		}
	}

	return {
		files,
		size: totalSize,
		path: path.join(extensionPath, "templates", "projects", "*/cache"),
	}
}

/**
 * Command to clear template cache
 */
export function registerClearTemplateCacheCommand(context: vscode.ExtensionContext): vscode.Disposable {
	return vscode.commands.registerCommand("egovframe.clearTemplateCache", async () => {
		const answer = await vscode.window.showWarningMessage(
			"템플릿 캐시를 삭제하시겠습니까? 다운로드된 모든 템플릿 파일이 삭제됩니다.",
			{ modal: true },
			"캐시 삭제",
			"취소",
		)

		if (answer === "캐시 삭제") {
			try {
				const result = await clearCacheDirectories(context.extensionPath)
				const sizeInMB = (result.size / 1024 / 1024).toFixed(2)

				if (result.cleared > 0) {
					vscode.window.showInformationMessage(
						`템플릿 캐시가 삭제되었습니다. (${result.cleared}개 파일, ${sizeInMB} MB)`,
					)
				} else {
					vscode.window.showInformationMessage("캐시가 비어있습니다.")
				}
			} catch (error) {
				vscode.window.showErrorMessage(`캐시 삭제 실패: ${error}`)
			}
		}
	})
}

/**
 * Command to show template cache info
 */
export function registerShowTemplateCacheInfoCommand(context: vscode.ExtensionContext): vscode.Disposable {
	return vscode.commands.registerCommand("egovframe.showTemplateCacheInfo", async () => {
		try {
			const cacheInfo = await getCacheInfo(context.extensionPath)
			const sizeInMB = (cacheInfo.size / 1024 / 1024).toFixed(2)

			if (cacheInfo.files.length === 0) {
				vscode.window.showInformationMessage("캐시가 비어있습니다.")
				return
			}

			const fileList = cacheInfo.files.join("\n• ")
			vscode.window.showInformationMessage(
				`템플릿 캐시 정보\n\n` +
					`위치: ${cacheInfo.path}\n` +
					`크기: ${sizeInMB} MB\n` +
					`파일 (${cacheInfo.files.length}개):\n• ${fileList}`,
				{ modal: true },
			)
		} catch (error) {
			vscode.window.showErrorMessage(`캐시 정보 조회 실패: ${error}`)
		}
	})
}
