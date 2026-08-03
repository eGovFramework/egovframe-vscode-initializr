import { getJavaClassName } from "./dataTypes"

// 데이터베이스 컬럼의 정보를 담는 인터페이스
export interface Column {
	ccName: string // camelCase name
	columnName: string // original column name
	isPrimaryKey: boolean
	pcName: string // PascalCase name
	dataType: string // SQL data type
	javaType: string // Java type
}

export interface ParsedDDL {
	tableName: string
	dbTableName: string // 실제 DB 테이블명 (DDL 원본 테이블명, Java 클래스명 변환 전)
	attributes: Column[]
	pkAttributes: Column[]
}

// snake_case를 camelCase로 변환하는 함수
function convertToCamelCase(str: string): string {
	// 언더스코어 뒤의 영문/숫자를 모두 처리한다. 숫자만 오는 경우(addr_1 등)에도
	// 언더스코어를 제거해 addr1처럼 일관된 camelCase 식별자를 생성한다.
	return str.toLowerCase().replace(/_([a-z0-9])/g, (match, ch) => ch.toUpperCase())
}

// camelCase를 PascalCase로 변환하는 함수
function convertCamelcaseToPascalcase(name: string): string {
	if (!name) {
		return name
	}
	return name.charAt(0).toUpperCase() + name.slice(1)
}

// 인용부호 해석 방식
// backslash: MySQL 계열(백슬래시 이스케이프) · doubled: 표준 SQL(중복 인용부호만) · none: 인용부호 무시
type QuoteMode = "backslash" | "doubled" | "none"

interface QuoteMask {
	quoted: boolean[] // 각 문자가 인용부호(', ", `) 안인지 여부(여닫는 인용부호 자체 포함)
	balanced: boolean // 스캔이 끝났을 때 모든 인용부호가 닫혔는지 여부
	spansLines: boolean // 문자열 리터럴이 줄바꿈을 넘겼는지 여부(해석이 어긋났다는 신호)
}

// 인용부호 안에 있는 문자 위치를 표시한 마스크를 만든다.
// 단일·이중 인용부호와 백틱 식별자를 각각 추적해 문자열 안의 콤마·괄호를 구조 문자로 오인하지 않게 한다.
function buildQuoteMask(sql: string, mode: QuoteMode): QuoteMask {
	const quoted = Array<boolean>(sql.length).fill(false)

	if (mode === "none") {
		return { quoted, balanced: true, spansLines: false }
	}

	let openQuote: string | undefined
	let spansLines = false

	for (let index = 0; index < sql.length; index += 1) {
		const char = sql[index]

		if (!openQuote) {
			if (char === "'" || char === '"' || char === "`") {
				openQuote = char
				quoted[index] = true
			}
			continue
		}

		quoted[index] = true

		if (char === "\n" || char === "\r") {
			spansLines = true
		}

		if (char === openQuote) {
			if (sql[index + 1] === openQuote) {
				quoted[index + 1] = true
				index += 1
			} else {
				openQuote = undefined
			}
		} else if (mode === "backslash" && openQuote !== "`" && char === "\\" && index + 1 < sql.length) {
			quoted[index + 1] = true
			index += 1
		}
	}

	return { quoted, balanced: openQuote === undefined, spansLines }
}

// 인용부호가 모두 닫히고 문자열이 줄바꿈을 넘지 않는 첫 해석을 고른다.
// MySQL 백슬래시 이스케이프를 먼저 시도하고, 어긋나면 표준 SQL의 중복 인용부호 해석을 시도한다.
// 줄바꿈을 넘긴 문자열은 인용부호 해석이 어긋났다는 신호다(DDL의 문자열 리터럴은 한 줄에 담긴다).
function resolveQuoteMask(sql: string): QuoteMask {
	for (const mode of ["backslash", "doubled"] as const) {
		const mask = buildQuoteMask(sql, mode)
		if (mask.balanced && !mask.spansLines) {
			return mask
		}
	}

	// 둘 다 실패하면 인용부호를 무시해 기존 동작 이하로 떨어지지 않게 한다.
	return buildQuoteMask(sql, "none")
}

function splitTopLevelCommas(body: string, mask: QuoteMask): { definitions: string[]; closed: boolean } {
	const definitions: string[] = []
	let depth = 0
	let startIndex = 0

	for (let index = 0; index < body.length; index += 1) {
		const char = body[index]

		if (mask.quoted[index]) {
			continue
		}

		if (char === "(") {
			depth += 1
		} else if (char === ")" && depth > 0) {
			depth -= 1
		} else if (char === "," && depth === 0) {
			const definition = body.slice(startIndex, index).trim()
			if (definition) {
				definitions.push(definition)
			}
			startIndex = index + 1
		}
	}

	const definition = body.slice(startIndex).trim()
	if (definition) {
		definitions.push(definition)
	}

	return { definitions, closed: depth === 0 }
}

// CREATE TABLE 본문을 컬럼 정의 단위로 분리하는 함수
// 문자열 리터럴('' 이스케이프 포함)과 괄호 depth를 인식해 최상위 콤마에서만 분리한다.
// COMMENT '사용자 ID, 기본키'처럼 주석에 콤마가 있어도 컬럼 정의가 쪼개지지 않는다.
export function splitColumnDefinitions(body: string): string[] {
	const resolved = splitTopLevelCommas(body, resolveQuoteMask(body))
	if (resolved.closed) {
		return resolved.definitions
	}

	// depth가 닫히지 않으면 인용부호를 무시해 기존 동작 이하로 떨어지지 않게 한다.
	return splitTopLevelCommas(body, buildQuoteMask(body, "none")).definitions
}

// 인용부호 밖의 괄호만 세어 여닫는 개수가 맞는지 확인한다.
function hasBalancedUnquotedParens(ddl: string, mask: QuoteMask): boolean {
	let openParens = 0
	let closeParens = 0

	for (let index = 0; index < ddl.length; index += 1) {
		if (mask.quoted[index]) {
			continue
		}
		if (ddl[index] === "(") {
			openParens += 1
		} else if (ddl[index] === ")") {
			closeParens += 1
		}
	}

	return openParens === closeParens
}

// DDL 파싱 함수
export function parseDDL(ddl: string): ParsedDDL {
	// 인용부호 해석이 줄 경계를 어긋남 신호로 쓰므로 공백 정규화는 컬럼 블록 추출 이후에 한다.
	const normalizedDdl = ddl.replace(/\s+/g, " ").trim()

	// 테이블 이름 추출 (백틱 처리 추가) - DDL 시작 부분에서만 매칭
	const tableNameMatch = RegExp(/^\s*CREATE\s+TABLE\s+[`]?(\w+)[`]?/i).exec(normalizedDdl)
	if (!tableNameMatch) {
		throw new Error("Unable to parse table name from DDL")
	}

	const dbTableName = tableNameMatch[1]
	const tableName = convertCamelcaseToPascalcase(convertToCamelCase(dbTableName))

	// 컬럼 정의 추출 (원본 DDL에서 추출해 문자열 리터럴의 줄바꿈 신호를 보존)
	const columnDefinitionsMatch = RegExp(/\((.*)\)/s).exec(ddl)
	if (!columnDefinitionsMatch) {
		throw new Error("Unable to parse column definitions from DDL")
	}

	// 컬럼 정의를 개별 컬럼으로 분리 (정의 단위로 공백 정규화)
	const columnDefinitions = columnDefinitionsMatch[1]
	const columnsArray = splitColumnDefinitions(columnDefinitions)
		.map((column) => column.replace(/\s+/g, " ").trim())
		.filter(
			(column) =>
				column &&
				!column.toUpperCase().startsWith("UNIQUE KEY") &&
				!column.toUpperCase().startsWith("KEY") &&
				!column.toUpperCase().startsWith("CONSTRAINT") &&
				!column.toUpperCase().startsWith("FOREIGN KEY"),
		)

	const attributes: Column[] = []
	const pkAttributes: Column[] = []

	// PRIMARY KEY 제약조건 찾기
	const pkConstraintMatch = RegExp(/PRIMARY KEY\s*\(([^)]+)\)/i).exec(normalizedDdl)
	const primaryKeyColumns = pkConstraintMatch
		? pkConstraintMatch[1].split(",").map((col) => col.trim().replace(/[`"']/g, ""))
		: []

	// 각 컬럼 파싱
	columnsArray.forEach((columnDef) => {
		if (columnDef.trim().toUpperCase().startsWith("PRIMARY KEY") || columnDef.trim().toUpperCase().startsWith("COMMENT ON")) {
			return // PRIMARY KEY 정의 줄이나 COMMENT 줄은 건너뛰기
		}

		// 기본 컬럼 정보 추출 (백틱 처리 추가)
		const parts = columnDef.split(" ").filter((part) => part.trim()) // 빈 문자열 제거
		const columnName = parts[0]?.replace(/[`"']/g, "") // 백틱과 따옴표 제거
		const rawDataType = parts[1] ? parts[1].toUpperCase() : ""

		// 컬럼명 유효성 검사
		if (!columnName || columnName.trim() === "") {
			throw new Error(`Invalid column definition: missing column name in "${columnDef}"`)
		}

		// 데이터 타입 유효성 검사
		if (!rawDataType || rawDataType.trim() === "") {
			throw new Error(`Invalid column definition: missing data type for column "${columnName}"`)
		}

		// 데이터 타입에서 크기 정보 제거
		const dataType = RegExp(/^\w+/).exec(rawDataType)?.[0] ?? rawDataType

		// PRIMARY KEY 확인
		const isPrimaryKey = primaryKeyColumns.includes(columnName) || columnDef.toUpperCase().includes("PRIMARY KEY")

		// camelCase 이름 생성
		const ccName = convertToCamelCase(columnName)

		// Column 객체 생성
		const column: Column = {
			ccName,
			columnName,
			isPrimaryKey,
			pcName: convertCamelcaseToPascalcase(ccName),
			dataType,
			javaType: getJavaClassName(dataType),
		}

		attributes.push(column)
		if (isPrimaryKey) {
			pkAttributes.push(column)
		}
	})

	// 결과가 비어있는지 확인
	if (attributes.length === 0) {
		throw new Error("No valid columns found in DDL")
	}

	return { tableName, dbTableName, attributes, pkAttributes }
}

// DDL 유효성 검사 함수
export function validateDDL(ddl: string): boolean {
	if (!ddl) {
		return false
	}

	// CREATE TABLE 문법 확인 - DDL 시작 부분에 CREATE TABLE이 와야 함 (공백/주석 제외)
	const trimmedDDL = ddl.trim()
	if (!/^\s*CREATE\s+TABLE\s+/i.test(trimmedDDL)) {
		return false
	}

	// CREATE TABLE 테이블명 ( ... ) 형식 확인 - 테이블명 뒤에 괄호가 있어야 함
	if (!/CREATE\s+TABLE\s+[^\s(]+\s*\(/i.test(ddl)) {
		return false
	}

	// 괄호 쌍 확인 — 문자열 리터럴 안의 괄호는 세지 않는다.
	// 인용부호 인식 계산이 맞지 않으면 기존(인용부호 무시) 계산도 시도해 기존 동작 이하로 떨어지지 않게 한다.
	if (!hasBalancedUnquotedParens(ddl, resolveQuoteMask(ddl)) && !hasBalancedUnquotedParens(ddl, buildQuoteMask(ddl, "none"))) {
		return false
	}

	// 최소한의 컬럼 정의 확인
	const columnRegex = /\((.*)\)/s
	const columnMatch = columnRegex.exec(ddl)
	if (!columnMatch?.[1]?.trim()) {
		return false
	}

	// 각 컬럼 정의 검증 (정의 단위로 공백 정규화)
	const columnDefinitions = columnMatch[1]
	const columnsArray = splitColumnDefinitions(columnDefinitions)
		.map((column) => column.replace(/\s+/g, " ").trim())
		.filter(
			(column) =>
				column &&
				!column.toUpperCase().startsWith("UNIQUE KEY") &&
				!column.toUpperCase().startsWith("KEY") &&
				!column.toUpperCase().startsWith("CONSTRAINT") &&
				!column.toUpperCase().startsWith("PRIMARY KEY") &&
				!column.toUpperCase().startsWith("COMMENT ON") &&
				!column.toUpperCase().startsWith("FOREIGN KEY"),
		)

	// 각 컬럼에 컬럼명과 자료형이 있는지 확인
	for (const columnDef of columnsArray) {
		const parts = columnDef.split(" ").filter((part) => part.trim())
		const columnName = parts[0]?.replace(/[`"']/g, "")
		const dataType = parts[1]

		// 컬럼명 검사
		if (!columnName || columnName.trim() === "") {
			return false
		}

		// 자료형 검사
		if (!dataType || dataType.trim() === "") {
			return false
		}
	}

	return true
}
