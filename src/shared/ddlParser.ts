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
	tableComment: string // table comment (DDL COMMENT 절에서 추출, 없으면 tableName)
	attributes: Column[]
	pkAttributes: Column[]
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

// DDL 파싱 함수
export function parseDDL(ddl: string): ParsedDDL {
	// 공백 정규화
	ddl = ddl.replace(/\s+/g, " ").trim()

	// 테이블 이름 추출 (백틱 처리 추가) - DDL 시작 부분에서만 매칭
	const tableNameMatch = RegExp(/^\s*CREATE\s+TABLE\s+[`]?(\w+)[`]?/i).exec(ddl)
	if (!tableNameMatch) {
		throw new Error("Unable to parse table name from DDL")
	}
	const tableName = convertCamelcaseToPascalcase(convertToCamelCase(tableNameMatch[1]))

	// 컬럼 정의 추출
	const columnDefinitionsMatch = RegExp(/\((.*)\)/s).exec(ddl)
	if (!columnDefinitionsMatch) {
		throw new Error("Unable to parse column definitions from DDL")
	}

	// 컬럼 정의를 개별 컬럼으로 분리
	const columnDefinitions = columnDefinitionsMatch[1]
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
	const pkConstraintMatch = RegExp(/PRIMARY KEY\s*\(([^)]+)\)/i).exec(ddl)
	const primaryKeyColumns = pkConstraintMatch
		? pkConstraintMatch[1].split(",").map((col) => col.trim().replace(/[`"']/g, ""))
		: []

	// PostgreSQL: COMMENT ON COLUMN table.col IS 'comment' 파싱
	const pgColumnComments: Record<string, string> = {}
	const pgColumnCommentRegex = /COMMENT ON COLUMN\s+\w+\.(\w+)\s+IS\s+'([^']+)'/gi
	let pgCommentMatch
	while ((pgCommentMatch = pgColumnCommentRegex.exec(ddl)) !== null) {
		pgColumnComments[pgCommentMatch[1]] = pgCommentMatch[2]
	}

	// 테이블 COMMENT 파싱
	// MySQL: ) COMMENT 'table comment'
	const mysqlTableCommentMatch = RegExp(/\)\s*COMMENT\s+'([^']+)'/i).exec(ddl)
	// PostgreSQL: COMMENT ON TABLE tableName IS 'table comment'
	const pgTableCommentMatch = RegExp(/COMMENT ON TABLE\s+\w+\s+IS\s+'([^']+)'/i).exec(ddl)
	const tableComment = mysqlTableCommentMatch?.[1] ?? pgTableCommentMatch?.[1] ?? tableName

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

		// MySQL: 인라인 COMMENT 'text' 파싱
		const mysqlCommentMatch = RegExp(/COMMENT\s+'([^']+)'/i).exec(columnDef)
		const comment = mysqlCommentMatch?.[1] ?? pgColumnComments[columnName] ?? columnName

		// Column 객체 생성
		const column: Column = {
			ccName,
			columnName,
			isPrimaryKey,
			pcName: convertCamelcaseToPascalcase(ccName),
			dataType,
			javaType: getJavaClassName(dataType),
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

	return { tableName, tableComment, attributes, pkAttributes }
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

	// 괄호 쌍 확인
	const openParens = (ddl.match(/\(/g) || []).length
	const closeParens = (ddl.match(/\)/g) || []).length

	// 괄호 개수가 맞지 않으면 유효하지 않음
	if (openParens !== closeParens) {
		return false
	}

	// 최소한의 컬럼 정의 확인
	const columnRegex = /\((.*)\)/s
	const columnMatch = columnRegex.exec(ddl)
	if (!columnMatch?.[1]?.trim()) {
		return false
	}

	// 각 컬럼 정의 검증
	const columnDefinitions = columnMatch[1]
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
