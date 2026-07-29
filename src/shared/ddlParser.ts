import { getJavaClassName } from "./dataTypes"

// 데이터베이스 컬럼의 정보를 담는 인터페이스
export interface Column {
	ccName: string // camelCase name
	columnName: string // original column name
	isPrimaryKey: boolean
	pcName: string // PascalCase name
	dataType: string // SQL data type
	javaType: string // Java type
	comment: string // column comment (DDL COMMENT 절에서 추출, 없으면 columnName)
}

export interface ParsedDDL {
	tableName: string
	dbTableName: string // 실제 DB 테이블명 (DDL 원본 테이블명, Java 클래스명 변환 전)
	tableComment: string // table comment (DDL COMMENT 절에서 추출, 없으면 tableName)
	attributes: Column[]
	pkAttributes: Column[]
}

export interface CreateTableStatement {
	tableName: string
	body: string
	statement: string
}

// 인용부호 해석 방식
// backslash: MySQL 계열(백슬래시 이스케이프) · doubled: 표준 SQL(중복 인용부호만) · none: 인용부호 무시
type QuoteMode = "backslash" | "doubled" | "none"

interface QuoteMask {
	quoted: boolean[] // 각 문자가 인용부호(', ", `) 안인지 여부(여닫는 인용부호 자체 포함)
	balanced: boolean // 스캔이 끝났을 때 모든 인용부호가 닫혔는지 여부
	spansLines: boolean // 문자열 리터럴이 줄바꿈을 넘겼는지 여부(해석이 어긋났다는 신호)
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

function escapeRegExp(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function decodeSqlComment(comment: string): string {
	return comment.replace(/''/g, "'")
}

// 인용부호 안에 있는 문자 위치를 표시한 마스크를 만든다.
// 단일·이중 인용부호와 백틱 식별자를 각각 추적해 문자열 안의 콤마·괄호·세미콜론을 구조 문자로 오인하지 않게 한다.
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

// 주석 안 아포스트로피가 문자열 시작으로 오인되지 않게 파싱 전에 SQL 주석을 제거한다.
// 문자열 안의 주석 표식은 보존하고, 문자열 이스케이프 해석은 mode를 따른다.
// spansLines는 문자열 리터럴이 줄바꿈을 넘겼는지를 알린다(해석이 어긋났는지 판단하는 신호).
function removeSqlComments(sql: string, mode: QuoteMode): { text: string; balanced: boolean; spansLines: boolean } {
	let text = ""
	let openQuote: string | undefined
	let spansLines = false

	for (let index = 0; index < sql.length; index += 1) {
		const char = sql[index]
		const nextChar = sql[index + 1]

		if (!openQuote) {
			if (char === "-" && nextChar === "-") {
				index += 2
				while (index < sql.length && sql[index] !== "\n" && sql[index] !== "\r") {
					index += 1
				}
				index -= 1
				continue
			}

			if (char === "#") {
				index += 1
				while (index < sql.length && sql[index] !== "\n" && sql[index] !== "\r") {
					index += 1
				}
				index -= 1
				continue
			}

			if (char === "/" && nextChar === "*") {
				text += " "
				index += 2
				while (index < sql.length && !(sql[index] === "*" && sql[index + 1] === "/")) {
					index += 1
				}
				if (index < sql.length) {
					index += 1
				}
				continue
			}

			if (mode !== "none" && (char === "'" || char === '"' || char === "`")) {
				openQuote = char
			}

			text += char
			continue
		}

		text += char

		if (char === "\n" || char === "\r") {
			spansLines = true
		}

		if (char === openQuote) {
			if (nextChar === openQuote) {
				text += nextChar
				index += 1
			} else {
				openQuote = undefined
			}
		} else if (mode === "backslash" && openQuote !== "`" && char === "\\" && index + 1 < sql.length) {
			text += nextChar
			index += 1
		}
	}

	return { text, balanced: openQuote === undefined, spansLines }
}

// 닫힌 인용부호 해석 기준으로 주석을 먼저 제거해 이후 구조 스캔의 오탐을 줄인다.
// MySQL 백슬래시 해석을 먼저 시도하되, 인용부호가 닫히지 않거나 문자열이 줄바꿈을 넘긴 해석은
// 어긋난 것으로 보고 다음 해석으로 넘어간다. 어느 해석도 만족하지 못하면 기존 동작 보존을 위해 원문을 돌려준다.
function stripSqlComments(sql: string): string {
	for (const mode of ["backslash", "doubled"] as const) {
		const result = removeSqlComments(sql, mode)
		if (result.balanced && !result.spansLines) {
			return result.text
		}
	}

	return sql
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

	// 둘 다 실패하면 인용부호를 무시해 기존 base 동작 이하로 떨어지지 않게 한다.
	return buildQuoteMask(sql, "none")
}

function extractStatementOptions(ddl: string, startIndex: number): string {
	const mask = resolveQuoteMask(ddl)

	for (let index = startIndex; index < ddl.length; index += 1) {
		if (ddl[index] === ";" && !mask.quoted[index]) {
			return ddl.slice(startIndex, index)
		}
	}

	return ddl.slice(startIndex)
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

	// depth가 닫히지 않으면 인용부호를 무시해 기존 base 동작 이하로 떨어지지 않게 한다.
	return splitTopLevelCommas(body, buildQuoteMask(body, "none")).definitions
}

function findStatementBodyEnd(ddl: string, bodyStart: number, mask: QuoteMask): number | undefined {
	let depth = 1

	for (let index = bodyStart; index < ddl.length; index += 1) {
		const char = ddl[index]

		if (mask.quoted[index]) {
			continue
		}

		if (char === "(") {
			depth += 1
		} else if (char === ")") {
			depth -= 1
			if (depth === 0) {
				return index
			}
		}
	}

	return undefined
}

// 본문이 다음 CREATE TABLE 문장을 삼켰는지 검사한다(인용부호 해석 어긋남 신호).
function swallowsAnotherStatement(body: string): boolean {
	return /CREATE\s+TABLE\s/i.test(body)
}

export function extractCreateTableStatements(ddl: string): CreateTableStatement[] {
	const sql = stripSqlComments(ddl)
	const statements: CreateTableStatement[] = []
	const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*\(/gi
	const resolvedMask = resolveQuoteMask(sql)
	let fallbackMask: QuoteMask | undefined
	let match: RegExpExecArray | null

	while ((match = createTableRegex.exec(sql)) !== null) {
		const bodyStart = createTableRegex.lastIndex
		const findFallbackBodyEnd = (): number | undefined => {
			fallbackMask ??= buildQuoteMask(sql, "none")
			return findStatementBodyEnd(sql, bodyStart, fallbackMask)
		}
		let bodyEnd = findStatementBodyEnd(sql, bodyStart, resolvedMask) ?? findFallbackBodyEnd()

		if (bodyEnd !== undefined && swallowsAnotherStatement(sql.slice(bodyStart, bodyEnd))) {
			bodyEnd = findFallbackBodyEnd() ?? bodyEnd
		}

		if (bodyEnd === undefined) {
			// 닫는 괄호를 찾지 못한 문장은 건너뛴다. 다음 CREATE TABLE을 본문 시작 이후에서 찾도록 lastIndex를 명시한다.
			createTableRegex.lastIndex = bodyStart
			continue
		}

		statements.push({
			tableName: match[1],
			body: sql.slice(bodyStart, bodyEnd),
			statement: sql.slice(match.index, bodyEnd + 1),
		})
		createTableRegex.lastIndex = bodyEnd + 1
	}

	return statements
}

// 컬럼 정의에서 제외할 항목 검사 함수
function isValidColumnDefinition(column: string, includePrimaryKey = false): boolean {
	const upper = column.toUpperCase()

	return (
		column.length > 0 &&
		!upper.startsWith("UNIQUE KEY") &&
		!upper.startsWith("KEY") &&
		!upper.startsWith("CONSTRAINT") &&
		!upper.startsWith("COMMENT ON") &&
		!upper.startsWith("FOREIGN KEY") &&
		(includePrimaryKey || !upper.startsWith("PRIMARY KEY"))
	)
}

// DDL 파싱 함수
export function parseDDL(ddl: string): ParsedDDL {
	// 주석을 먼저 제거하되 문장 추출까지는 줄바꿈을 남긴다.
	// 인용부호 해석이 줄 경계를 어긋남 신호로 쓰므로 공백 정규화는 추출 이후에 한다.
	const cleanedDdl = stripSqlComments(ddl)
	const normalizedDdl = cleanedDdl.replace(/\s+/g, " ").trim()
	const createTableStatement = extractCreateTableStatements(cleanedDdl)[0]

	// 테이블 이름 추출 (백틱 처리 추가) - DDL 시작 부분에서만 매칭
	if (!createTableStatement) {
		throw new Error("Unable to parse table name from DDL")
	}

	const dbTableName = createTableStatement.tableName
	const tableName = convertCamelcaseToPascalcase(convertToCamelCase(dbTableName))
	const normalizedStatement = createTableStatement.statement.replace(/\s+/g, " ").trim()

	// 컬럼 정의 추출 (정의 단위로 공백 정규화)
	const columnDefinitions = createTableStatement.body
	const columnsArray = splitColumnDefinitions(columnDefinitions)
		.map((column) => column.replace(/\s+/g, " ").trim())
		.filter((column) => isValidColumnDefinition(column, true))

	const attributes: Column[] = []
	const pkAttributes: Column[] = []

	// PRIMARY KEY 제약조건 찾기
	const pkConstraintMatch = RegExp(/PRIMARY KEY\s*\(([^)]+)\)/i).exec(normalizedStatement)
	const primaryKeyColumns = pkConstraintMatch
		? pkConstraintMatch[1].split(",").map((col) => col.trim().replace(/[`"']/g, ""))
		: []

	// PostgreSQL: COMMENT ON COLUMN table.col IS 'comment' 파싱
	const pgColumnComments: Record<string, string> = {}
	const escapedTableName = escapeRegExp(createTableStatement.tableName)
	const pgColumnCommentRegex = new RegExp(
		`COMMENT ON COLUMN\\s+(?:"?\\w+"?\\.)?"?${escapedTableName}"?\\."?(\\w+)"?\\s+IS\\s+'((?:''|[^'])*)'`,
		"gi",
	)
	let pgCommentMatch
	while ((pgCommentMatch = pgColumnCommentRegex.exec(normalizedDdl)) !== null) {
		pgColumnComments[pgCommentMatch[1]] = decodeSqlComment(pgCommentMatch[2])
	}

	// 테이블 COMMENT 파싱
	// MySQL: 컬럼 정의 블록 이후의 테이블 옵션 COMMENT 'table comment'
	const createTableEnd = normalizedDdl.indexOf(normalizedStatement) + normalizedStatement.length
	const tableOptions = extractStatementOptions(normalizedDdl, createTableEnd)
	const mysqlTableCommentMatch = RegExp(/\bCOMMENT\s*=?\s*'((?:''|[^'])*)'/i).exec(tableOptions)
	// PostgreSQL: COMMENT ON TABLE tableName IS 'table comment'
	const pgTableCommentMatch = new RegExp(
		`COMMENT ON TABLE\\s+(?:"?\\w+"?\\.)?"?${escapedTableName}"?\\s+IS\\s+'((?:''|[^'])*)'`,
		"i",
	).exec(normalizedDdl)
	const tableCommentMatch = mysqlTableCommentMatch?.[1] ?? pgTableCommentMatch?.[1]
	const tableComment = tableCommentMatch === undefined ? tableName : decodeSqlComment(tableCommentMatch)

	// 각 컬럼 파싱
	columnsArray.forEach((columnDef) => {
		if (columnDef.trim().toUpperCase().startsWith("PRIMARY KEY")) {
			return // PRIMARY KEY 정의 줄은 건너뛰기
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

		// PRIMARY KEY 확인 (COMMENT 문자열 본문은 제외해 'primary key' 문구가 든 주석의 오탐 방지)
		const columnDefWithoutComment = columnDef.replace(/COMMENT\s+'(?:''|[^'])*'/i, "")
		const isPrimaryKey =
			primaryKeyColumns.includes(columnName) || columnDefWithoutComment.toUpperCase().includes("PRIMARY KEY")

		// camelCase 이름 생성
		const ccName = convertToCamelCase(columnName)

		// MySQL: 인라인 COMMENT 'text' 파싱
		const mysqlCommentMatch = RegExp(/COMMENT\s+'((?:''|[^'])*)'/i).exec(columnDef)
		const comment =
			mysqlCommentMatch?.[1] === undefined
				? (pgColumnComments[columnName] ?? columnName)
				: decodeSqlComment(mysqlCommentMatch[1])

		// Column 객체 생성
		const column: Column = {
			ccName,
			columnName,
			isPrimaryKey,
			pcName: convertCamelcaseToPascalcase(ccName),
			dataType,
			// NUMBER(15,2)처럼 크기 정보가 매핑에 필요하므로 원본 타입을 넘긴다
			javaType: getJavaClassName(rawDataType),
			comment,
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

	return { tableName, dbTableName, tableComment, attributes, pkAttributes }
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

	const createTableStatement = extractCreateTableStatements(ddl)[0]
	if (!createTableStatement) {
		return false
	}

	// 최소한의 컬럼 정의 확인
	if (!createTableStatement.body.trim()) {
		return false
	}

	// 각 컬럼 정의 검증
	const columnDefinitions = createTableStatement.body
	const columnsArray = splitColumnDefinitions(columnDefinitions).filter((column) => isValidColumnDefinition(column))

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
