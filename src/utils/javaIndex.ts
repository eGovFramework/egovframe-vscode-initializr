/**
 * 프로젝트의 모든 `.java`를 패키지 선언 기준 FQCN으로 색인하고, Java의 이름 해석 순서대로 타입 참조를 푼다.
 * 파일 시스템은 직접 읽지 않고 주입된 `readFile`만 쓰는 순수 모듈이며 `vscode`를 import하지 않는다.
 */
import * as path from "path"
import { readPackage, simpleNameOf, stripJavaComments, type JavaImports } from "./javaSource"

export interface JavaIndexEntry {
	fqcn: string
	package: string | null
	simpleName: string
	filePath: string
}

export interface JavaIndex {
	byFqcn: Map<string, JavaIndexEntry>
	bySimpleName: Map<string, JavaIndexEntry[]>
}

export type ReadFile = (filePath: string) => string

export type ReferenceResolution =
	| {
			kind: "resolved"
			entry: JavaIndexEntry
			how: "fqcn" | "single-import" | "same-package" | "wildcard-import" | "unique-simple-name"
	  }
	| { kind: "unresolved"; reason: "not-in-project" | "ambiguous" }

function fqcnOf(pkg: string | null, simpleName: string): string {
	return pkg ? `${pkg}.${simpleName}` : simpleName
}

/**
 * 파일 목록을 색인한다. simpleName은 파일 이름(`.java` 제외), package는 package 선언, fqcn은 둘을 이은 값이다.
 * 같은 FQCN이 둘이면 먼저 온 항목을 `byFqcn`에 두고, `bySimpleName`에는 둘 다 넣는다. 읽을 수 없는 파일은 건너뛴다.
 * 파일 시스템(macOS)이 돌려주는 NFD 파일 이름을 소스 텍스트와 맞추려고 simpleName은 NFC로 정규화한다.
 */
export function buildJavaIndex(filePaths: string[], readFile: ReadFile): JavaIndex {
	const byFqcn = new Map<string, JavaIndexEntry>()
	const bySimpleName = new Map<string, JavaIndexEntry[]>()
	for (const filePath of filePaths) {
		let content: string
		try {
			content = readFile(filePath)
		} catch {
			continue
		}
		const simpleName = path.basename(filePath, ".java").normalize("NFC")
		const pkg = readPackage(stripJavaComments(content))
		const entry: JavaIndexEntry = { fqcn: fqcnOf(pkg, simpleName), package: pkg, simpleName, filePath }
		if (!byFqcn.has(entry.fqcn)) {
			byFqcn.set(entry.fqcn, entry)
		}
		const sameName = bySimpleName.get(simpleName)
		if (sameName) {
			sameName.push(entry)
		} else {
			bySimpleName.set(simpleName, [entry])
		}
	}
	return { byFqcn, bySimpleName }
}

/**
 * 타입 참조 `rawName`을 Java의 이름 해석 순서로 푼다: FQCN → 단일 import → 같은 패키지 → 와일드카드 import → 프로젝트에서 유일한 단순 이름.
 * `rawName`에 `.`이 있으면 FQCN으로만 찾는다. 단일 import가 프로젝트 밖 타입을 가리키면 그 이름은 외부 타입이므로
 * 아래 단계로 내려가지 않고 `not-in-project`로 끝낸다. 와일드카드가 둘 이상 맞으면 `ambiguous`다.
 */
export function resolveTypeReference(
	index: JavaIndex,
	from: { package: string | null; imports: JavaImports },
	rawName: string,
): ReferenceResolution {
	const name = rawName.trim()
	const notInProject: ReferenceResolution = { kind: "unresolved", reason: "not-in-project" }
	const ambiguous: ReferenceResolution = { kind: "unresolved", reason: "ambiguous" }

	if (name.includes(".")) {
		const entry = index.byFqcn.get(name)
		return entry ? { kind: "resolved", entry, how: "fqcn" } : notInProject
	}

	const importedPackage = from.imports.single.get(name)
	if (importedPackage !== undefined) {
		const entry = index.byFqcn.get(fqcnOf(importedPackage, name))
		return entry ? { kind: "resolved", entry, how: "single-import" } : notInProject
	}

	const samePackage = index.byFqcn.get(fqcnOf(from.package, name))
	if (samePackage) {
		return { kind: "resolved", entry: samePackage, how: "same-package" }
	}

	const wildcardMatches = new Map<string, JavaIndexEntry>()
	for (const pkg of from.imports.wildcard) {
		const entry = index.byFqcn.get(fqcnOf(pkg, name))
		if (entry) {
			wildcardMatches.set(entry.fqcn, entry)
		}
	}
	if (wildcardMatches.size === 1) {
		return { kind: "resolved", entry: [...wildcardMatches.values()][0], how: "wildcard-import" }
	}
	if (wildcardMatches.size > 1) {
		return ambiguous
	}

	const candidates = index.bySimpleName.get(simpleNameOf(name)) ?? []
	if (candidates.length === 1) {
		return { kind: "resolved", entry: candidates[0], how: "unique-simple-name" }
	}
	return candidates.length > 1 ? ambiguous : notInProject
}
