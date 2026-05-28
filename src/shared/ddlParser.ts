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

// DDL 파싱 함수
export function parseDDL(ddl: string): ParsedDDL {
	// 공백 정규화
	const normalizedDdl = ddl.replace(/\s+/g, " ").trim()
	const createTableStatement = extractCreateTableStatements(normalizedDdl)[0]

	// 테이블 이름 추출 (백틱 처리 추가) - DDL 시작 부분에서만 매칭
	if (!createTableStatement) {
		throw new Error("Unable to parse table name from DDL")
	}
	const tableName = convertCamelcaseToPascalcase(convertToCamelCase(createTableStatement.tableName))

	// 컬럼 정의 추출
	const columnDefinitions = createTableStatement.body
	const columnsArray = columnDefinitions
		.split(/,(?![^(]*\))/)
		.map((column) => column.trim())
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
	const pkConstraintMatch = RegExp(/PRIMARY KEY\s*\(([^)]+)\)/i).exec(createTableStatement.statement)
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

	return { tableName, attributes, pkAttributes }
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

	// 괄호 쌍 확인
	const openParens = (createTableStatement.statement.match(/\(/g) || []).length
	const closeParens = (createTableStatement.statement.match(/\)/g) || []).length

	// 괄호 개수가 맞지 않으면 유효하지 않음
	if (openParens !== closeParens) {
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
