import * as path from "path"

/**
 * Path traversal hardening utilities (CWE-22).
 *
 * These helpers harden file-system writes that are driven by free-form
 * webview form input (project name, configuration file name). They contain
 * no VS Code dependency so they can be unit tested in isolation.
 */

/**
 * Allowed character set for an eGovFrame project name.
 * Letters, digits, hyphen and underscore only — separators and dots are
 * intentionally excluded so that no path component (e.g. `..`, `/`, `\`)
 * can appear in the name.
 */
export const PROJECT_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/

/**
 * Returns true when the given project name is safe to use as a single
 * directory component.
 */
export function isValidProjectName(projectName: string): boolean {
	return typeof projectName === "string" && PROJECT_NAME_PATTERN.test(projectName)
}

/**
 * Throws when the project name is not a safe single directory component.
 */
export function assertSafeProjectName(projectName: string): void {
	if (!isValidProjectName(projectName)) {
		throw new Error("Project name can only contain letters, numbers, hyphens, and underscores")
	}
}

/**
 * Reduces a user-supplied file name to its base name and rejects values that
 * resolve to a directory traversal. Any leading directory segments (including
 * `..`) are stripped so the result is always a plain file name.
 */
export function sanitizeFileName(rawFileName: string): string {
	if (typeof rawFileName !== "string") {
		throw new Error("Invalid file name")
	}

	const baseName = path.basename(rawFileName.trim())

	if (!baseName || baseName === "." || baseName === "..") {
		throw new Error("Invalid file name")
	}

	return baseName
}

/**
 * Resolves `childPath` against `baseDir` and verifies the result stays inside
 * `baseDir`. Returns the resolved absolute path, or throws if the resolved
 * location escapes the base directory (path traversal).
 */
export function resolveWithinBase(baseDir: string, childPath: string): string {
	const resolvedBase = path.resolve(baseDir)
	const resolvedTarget = path.resolve(resolvedBase, childPath)
	const relative = path.relative(resolvedBase, resolvedTarget)

	if (relative === "" || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
		throw new Error("Resolved path escapes the target directory")
	}

	return resolvedTarget
}
