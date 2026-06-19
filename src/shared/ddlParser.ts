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

// snake_case를 camelCase로 변환하는 함수
function convertToCamelCase(str: string): string {
	return str.toLowerCase().replace(/_([a-z])/g, (match, letter) => letter.toUpperCase())
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

function extractStatementOptions(ddl: string, startIndex: number): string {
	let inString = false

	for (let index = startIndex; index < ddl.length; index += 1) {
		if (ddl[index] === "'" && inString && ddl[index + 1] === "'") {
			index += 1
		} else if (ddl[index] === "'") {
			inString = !inString
		} else if (ddl[index] === ";" && !inString) {
			return ddl.slice(startIndex, index)
		}
	}

	return ddl.slice(startIndex)
}

export function extractCreateTableStatements(ddl: string): CreateTableStatement[] {
	const statements: CreateTableStatement[] = []
	const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*\(/gi
	let match: RegExpExecArray | null

	while ((match = createTableRegex.exec(ddl)) !== null) {
		const bodyStart = createTableRegex.lastIndex
		let depth = 1
		let currentIndex = bodyStart

		while (currentIndex < ddl.length && depth > 0) {
			const char = ddl[currentIndex]
			if (char === "(") {
				depth += 1
			} else if (char === ")") {
				depth -= 1
			}
			currentIndex += 1
		}

		if (depth === 0) {
			const bodyEnd = currentIndex - 1
			statements.push({
				tableName: match[1],
				body: ddl.slice(bodyStart, bodyEnd),
				statement: ddl.slice(match.index, currentIndex),
			})
			createTableRegex.lastIndex = currentIndex
		}
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
	// 공백 정규화
	const normalizedDdl = ddl.replace(/\s+/g, " ").trim()
	const createTableStatement = extractCreateTableStatements(normalizedDdl)[0]

	// 테이블 이름 추출 (백틱 처리 추가) - DDL 시작 부분에서만 매칭
	if (!createTableStatement) {
		throw new Error("Unable to parse table name from DDL")
	}

	const dbTableName = createTableStatement.tableName
	const tableName = convertCamelcaseToPascalcase(convertToCamelCase(dbTableName))

	// 컬럼 정의 추출
	const columnDefinitions = createTableStatement.body
	const columnsArray = columnDefinitions
		.split(/,(?![^(]*\))/)
		.map((column) => column.trim())
		.filter((column) => isValidColumnDefinition(column, true))

	const attributes: Column[] = []
	const pkAttributes: Column[] = []

	// PRIMARY KEY 제약조건 찾기
	const pkConstraintMatch = RegExp(/PRIMARY KEY\s*\(([^)]+)\)/i).exec(createTableStatement.statement)
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
	const createTableEnd = normalizedDdl.indexOf(createTableStatement.statement) + createTableStatement.statement.length
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
	const columnsArray = columnDefinitions
		.split(/,(?![^(]*\))/)
		.map((column) => column.trim())
		.filter((column) => isValidColumnDefinition(column))

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
