/**
 * Java 소스를 파서 없이 텍스트로 판정하기 위한 전처리 유틸.
 * 주석 제거, package·import 수집, 파일 이름과 같은 타입의 선언부 추출, 토큰 검색을 맡는다.
 * `vscode`를 import하지 않는 순수 모듈이다. 파일 시스템은 `createCachedReader`의 기본 reader만 쓴다.
 */
import * as fs from "fs"
import type { ReadFile } from "./javaIndex"

/** import 수집 결과. static import는 담지 않는다 */
export interface JavaImports {
	/** 단순 이름 → 패키지: `import a.b.C;` → `C` → `a.b` */
	single: Map<string, string>
	/** 와일드카드 import의 패키지 목록: `import a.b.*;` → `a.b` */
	wildcard: string[]
}

export type JavaTypeKind = "class" | "interface" | "enum" | "record" | "annotation"

export interface JavaTypeDeclaration {
	kind: JavaTypeKind
	name: string
	isAbstract: boolean
	/** 선언 직전 블록의 어노테이션 원문: `@Repository("userDAO")`, `@org.egovframe.rte.psl.dataaccess.mapper.EgovMapper` */
	annotations: string[]
	/** 제네릭 인자를 뗀 이름(패키지는 유지, FQCN 가능). class는 0~1개, interface는 0개 이상 */
	extendsNames: string[]
	implementsNames: string[]
}

/** UTF-8 BOM(U+FEFF)의 문자 코드. 소스 파일에 보이지 않는 문자를 적지 않으려 코드로 쓴다 */
const BOM_CODE = 0xfeff

function isLineTerminator(ch: string): boolean {
	return ch === "\n" || ch === "\r"
}

/** Java 식별자를 이루는 문자인지. 범위를 벗어난 위치(빈 문자열)는 false */
function isIdentifierChar(ch: string): boolean {
	return /[\w$]/.test(ch)
}

/**
 * `start`(여는 따옴표 위치)에서 시작하는 문자열·문자 리터럴이 끝난 다음 위치를 돌려준다.
 * `\"`·`\'` 같은 이스케이프는 건너뛰고, 닫는 따옴표가 없으면 줄 끝에서 멈춘다 (한 줄짜리 따옴표 하나가 파일 끝까지 번지지 않도록).
 * 텍스트 블록(`"""`)은 다루지 않으며 일반 문자열처럼 읽는다.
 */
function skipQuoted(src: string, start: number): number {
	const quote = src[start]
	let i = start + 1
	while (i < src.length) {
		const ch = src[i]
		if (ch === "\\" && i + 1 < src.length && !isLineTerminator(src[i + 1])) {
			i += 2
		} else if (ch === quote) {
			return i + 1
		} else if (isLineTerminator(ch)) {
			return i
		} else {
			i++
		}
	}
	return i
}

/**
 * 블록 주석과 줄 주석(`//`)을 지운다. 문자열·문자 리터럴 안의 주석 기호는 코드로 보지 않고 그대로 둔다.
 * 주석 자리는 공백으로 채우되 줄바꿈(`\n`·`\r`)은 남겨서 줄 수와 열 위치를 유지한다. 선행 UTF-8 BOM은 제거한다.
 * 한 글자씩 상태(코드/리터럴/주석)를 따라가야 하므로 정규식 한 줄로는 쓸 수 없다.
 */
export function stripJavaComments(content: string): string {
	const src = content.charCodeAt(0) === BOM_CODE ? content.slice(1) : content
	let out = ""
	let copiedUpTo = 0
	let i = 0
	while (i < src.length) {
		const ch = src[i]
		if (ch === '"' || ch === "'") {
			i = skipQuoted(src, i)
		} else if (ch === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) {
			let end: number
			if (src[i + 1] === "/") {
				end = i + 2
				while (end < src.length && !isLineTerminator(src[end])) {
					end++
				}
			} else {
				const close = src.indexOf("*/", i + 2)
				end = close === -1 ? src.length : close + 2
			}
			out += src.slice(copiedUpTo, i) + src.slice(i, end).replace(/[^\r\n]/g, " ")
			copiedUpTo = end
			i = end
		} else {
			i++
		}
	}
	return out + src.slice(copiedUpTo)
}

/** `a.b.C` 꼴의 점으로 이은 이름 (점 앞뒤 공백 허용) */
const DOTTED_NAME = String.raw`[\w$]+(?:\s*\.\s*[\w$]+)*`

/** 파일 맨 앞의 package 선언. 본문의 문자열 안에 적힌 `package x;`는 보지 않는다 */
const PACKAGE_DECLARATION = new RegExp(String.raw`^[\s;]*package\s+(${DOTTED_NAME})\s*;`)

/** 앞 선언의 끝에서 이어지는 import 한 건. 그룹: 1 = static, 2 = 이름, 3 = `.*` */
const IMPORT_DECLARATION_SOURCE = String.raw`[\s;]*\bimport\s+(static\s+)?(${DOTTED_NAME})(\s*\.\s*\*)?\s*;`

/** 점으로 이은 이름에서 공백을 걷어낸다: `a . b` → `a.b` */
function compactName(name: string): string {
	return name.replace(/\s+/g, "")
}

/** `package a.b;`의 패키지 이름. 선언이 없으면(기본 패키지) null. 주석을 지운 소스를 받는다 */
export function readPackage(stripped: string): string | null {
	const match = PACKAGE_DECLARATION.exec(stripped)
	return match ? compactName(match[1]) : null
}

/**
 * import를 모은다 (여러 줄에 걸친 import 포함, static import 제외). 주석을 지운 소스를 받는다.
 * import는 package 선언 뒤 첫 타입 선언 앞에만 올 수 있으므로 앞에서부터 이어서 읽는다.
 * 본문의 문자열 안에 적힌 `import x.Y;`는 모으지 않는다.
 */
export function collectImports(stripped: string): JavaImports {
	const single = new Map<string, string>()
	const wildcard: string[] = []
	const packageDeclaration = PACKAGE_DECLARATION.exec(stripped)
	const importDeclaration = new RegExp(IMPORT_DECLARATION_SOURCE, "y")
	importDeclaration.lastIndex = packageDeclaration ? packageDeclaration[0].length : 0
	for (let match = importDeclaration.exec(stripped); match; match = importDeclaration.exec(stripped)) {
		if (match[1]) {
			continue
		}
		const name = compactName(match[2])
		if (match[3]) {
			if (!wildcard.includes(name)) {
				wildcard.push(name)
			}
			continue
		}
		const pkg = packageOf(name)
		if (pkg !== null) {
			single.set(simpleNameOf(name), pkg)
		}
	}
	return { single, wildcard }
}

/** 줄 끝 공백을 다듬고 빈 줄을 버린 뒤 한 칸 공백으로 이어 붙인다 (줄이 나뉜 선언부를 한 줄처럼 읽기 위해) */
function joinLines(text: string): string {
	return text
		.split(/\r\n|\r|\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.join(" ")
}

/**
 * 문자열·문자 리터럴(따옴표 포함)을 같은 길이의 공백으로 가린다.
 * 리터럴 안의 괄호·중괄호·`class X` 글자를 구조로 오인하지 않게 하려는 것이며, 위치는 원문과 1:1로 대응한다.
 */
function maskLiterals(code: string): string {
	let out = ""
	let copiedUpTo = 0
	let i = 0
	while (i < code.length) {
		if (code[i] === '"' || code[i] === "'") {
			const end = skipQuoted(code, i)
			out += code.slice(copiedUpTo, i) + " ".repeat(end - i)
			copiedUpTo = end
			i = end
		} else {
			i++
		}
	}
	return out + code.slice(copiedUpTo)
}

/** `open`부터 짝이 맞는 `close`까지(중첩 포함)를 지우고 그 자리에 공백 하나를 남긴다. 짝 없는 `close`는 버린다 */
function dropEnclosed(text: string, open: string, close: string): string {
	let out = ""
	let depth = 0
	for (const ch of text) {
		if (ch === open) {
			if (depth === 0) {
				out += " "
			}
			depth++
		} else if (ch === close) {
			depth = Math.max(0, depth - 1)
		} else if (depth === 0) {
			out += ch
		}
	}
	return out
}

/** 제네릭 인자(`<...>`)와 공백을 뗀 타입 이름: ` a.b.C<T> ` → `a.b.C` */
function plainTypeName(name: string): string {
	return compactName(dropEnclosed(name, "<", ">"))
}

/** `a.b.C` → `a.b`, 패키지가 없는 `C` → null */
export function packageOf(name: string): string | null {
	const plain = plainTypeName(name)
	const dot = plain.lastIndexOf(".")
	return dot > 0 ? plain.slice(0, dot) : null
}

/** 패키지와 제네릭 인자를 뗀 단순 이름: `a.b.C<T>` → `C` */
export function simpleNameOf(name: string): string {
	const plain = plainTypeName(name)
	return plain.slice(plain.lastIndexOf(".") + 1)
}

/**
 * 선언 키워드 앞으로 역방향 스캔해 "선언 직전 블록"(어노테이션·수식어)이 시작되는 위치를 돌려준다.
 * 소괄호·중괄호 깊이가 0인 `;`·`}`(앞 선언의 끝)에서만 끊는다.
 * `@SuppressWarnings({"a","b"})`의 `}`는 깊이 1 이상이라 지나친다. 끊을 곳이 없으면 문자열 시작(0)이다.
 */
function findPrecedingBlockStart(code: string, keywordStart: number): number {
	let depth = 0
	for (let i = keywordStart - 1; i >= 0; i--) {
		const ch = code[i]
		if (ch === ")") {
			depth++
		} else if (ch === "}") {
			if (depth === 0) {
				return i + 1
			}
			depth++
		} else if (ch === "(" || ch === "{") {
			depth = Math.max(0, depth - 1)
		} else if (ch === ";" && depth === 0) {
			return i + 1
		}
	}
	return 0
}

/** 어노테이션 한 건: 이름(FQCN 가능)과 소괄호 인자(중첩 한 단계까지) */
const ANNOTATION_SOURCE = String.raw`@[\w.]+(\s*\([^()]*(\([^()]*\))*[^()]*\))?`

/** 선언부가 끝나는 첫 `{`의 위치. 레코드 컴포넌트·어노테이션 인자의 `{`는 소괄호 안이라 건너뛴다 */
function findBodyStart(code: string, from: number): number {
	let depth = 0
	for (let i = from; i < code.length; i++) {
		const ch = code[i]
		if (ch === "(") {
			depth++
		} else if (ch === ")") {
			depth = Math.max(0, depth - 1)
		} else if (ch === "{" && depth === 0) {
			return i
		}
	}
	return code.length
}

/** 쉼표로 나뉜 타입 이름 목록을 이름 배열로 만든다 (제네릭은 이미 지워진 상태) */
function splitNames(list: string): string[] {
	return list
		.split(",")
		.map(compactName)
		.filter((name) => name.length > 0)
}

/**
 * 타입 이름 뒤 선언부(`<T> extends A<T> implements B, C`)에서 extends·implements 목록을 읽는다.
 * 제네릭(`<...>`)과 괄호(레코드 컴포넌트) 안쪽을 먼저 지우므로, `<T extends Bound>`의 extends나
 * `Comparator<Map<String, Object>>`의 쉼표에 속지 않는다. 패키지는 그대로 둔다. `permits` 목록은 버린다.
 */
function readTypeLists(header: string): { extendsNames: string[]; implementsNames: string[] } {
	const flat = dropEnclosed(dropEnclosed(header, "<", ">"), "(", ")")
	const parts = flat.split(/\b(extends|implements|permits)\b/)
	let extendsNames: string[] = []
	let implementsNames: string[] = []
	for (let i = 1; i + 1 < parts.length; i += 2) {
		if (parts[i] === "extends") {
			extendsNames = splitNames(parts[i + 1])
		} else if (parts[i] === "implements") {
			implementsNames = splitNames(parts[i + 1])
		}
	}
	return { extendsNames, implementsNames }
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * 파일 이름과 같은 타입(`typeName`)의 선언부를 읽는다. 없으면 null. 주석을 지운 소스를 받는다.
 * 같은 이름의 중첩 타입은 구분하지 않고 첫 매치를 쓴다.
 *
 * 줄을 공백으로 이어 붙인 문자열에서 `class|interface|enum|record <이름>`(`@interface`는 kind `annotation`)을 찾고,
 * 그 앞은 깊이 0의 `;`·`}`까지(어노테이션·수식어), 뒤는 첫 `{`까지(extends·implements)를 읽는다.
 * 메서드의 제네릭 바운드(`<T extends Serializable>`)는 본문이라 선언부에 들어오지 않는다.
 */
export function findTypeDeclaration(stripped: string, typeName: string): JavaTypeDeclaration | null {
	const text = joinLines(stripped)
	const code = maskLiterals(text)
	const keywordPattern = new RegExp(String.raw`(^|[^\w$])(class|interface|enum|record)\s+${escapeRegExp(typeName)}(?![\w$])`)
	const match = keywordPattern.exec(code)
	if (!match) {
		return null
	}

	let keywordStart = match.index + match[1].length
	let kind: JavaTypeKind = match[2] as JavaTypeKind
	if (kind === "interface") {
		// `@interface`는 키워드 앞(공백 건너뛰고)에 `@`가 붙는다
		let at = keywordStart - 1
		while (at >= 0 && /\s/.test(code[at])) {
			at--
		}
		if (at >= 0 && code[at] === "@") {
			kind = "annotation"
			keywordStart = at
		}
	}

	const blockStart = findPrecedingBlockStart(code, keywordStart)
	const maskedBlock = code.slice(blockStart, keywordStart)
	const rawBlock = text.slice(blockStart, keywordStart)
	const annotations: string[] = []
	const annotationPattern = new RegExp(ANNOTATION_SOURCE, "g")
	for (let found = annotationPattern.exec(maskedBlock); found; found = annotationPattern.exec(maskedBlock)) {
		annotations.push(rawBlock.slice(found.index, found.index + found[0].length))
	}

	const headerStart = match.index + match[0].length
	const header = code.slice(headerStart, findBodyStart(code, headerStart))
	return {
		kind,
		name: typeName,
		isAbstract: /\babstract\b/.test(maskedBlock),
		annotations,
		...readTypeLists(header),
	}
}

/**
 * 소스에 `token`이 식별자 경계를 지켜 들어 있는지 본다. 주석을 지운 소스를 받는다.
 * 토큰이 식별자 문자로 끝나면 바로 뒤에, 식별자 문자로 시작하면 바로 앞에 식별자 문자가 오지 않아야 한다.
 * 그래서 `@Repository`는 `@RepositoryRestResource`에, `@Mapper`는 `@MapperScan`에 매칭되지 않는다.
 */
export function hasToken(stripped: string, token: string): boolean {
	if (token.length === 0) {
		return false
	}
	const checkBefore = isIdentifierChar(token.charAt(0))
	const checkAfter = isIdentifierChar(token.charAt(token.length - 1))
	for (let at = stripped.indexOf(token); at !== -1; at = stripped.indexOf(token, at + 1)) {
		const startsClean = !checkBefore || !isIdentifierChar(stripped.charAt(at - 1))
		const endsClean = !checkAfter || !isIdentifierChar(stripped.charAt(at + token.length))
		if (startsClean && endsClean) {
			return true
		}
	}
	return false
}

/**
 * 경로마다 한 번만 읽는 reader를 만든다. 색인·분류·상속 체인 추적이 같은 파일을 거듭 읽지 않도록 내용을 경로별로 기억한다.
 * 읽기에 실패한 경로도 그 오류를 기억했다가 다시 던지므로 다시 읽지 않는다.
 */
export function createCachedReader(read: ReadFile = (p) => fs.readFileSync(p, "utf8")): ReadFile {
	const cache = new Map<string, { content: string } | { error: unknown }>()
	return (filePath) => {
		let entry = cache.get(filePath)
		if (!entry) {
			try {
				entry = { content: read(filePath) }
			} catch (error) {
				entry = { error }
			}
			cache.set(filePath, entry)
		}
		if ("error" in entry) {
			throw entry.error
		}
		return entry.content
	}
}
