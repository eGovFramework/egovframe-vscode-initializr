/**
 * Database type to Java type mapping
 * 데이터베이스 데이터 타입을 Java 데이터 타입으로 매핑
 */
const predefinedDataTypes: { [key: string]: string } = {
	// String types
	VARCHAR: "java.lang.String",
	VARCHAR2: "java.lang.String",
	NVARCHAR: "java.lang.String",
	NVARCHAR2: "java.lang.String",
	CHAR: "java.lang.String",
	NCHAR: "java.lang.String",
	TEXT: "java.lang.String",
	MEDIUMTEXT: "java.lang.String",
	CLOB: "java.lang.String",
	NCLOB: "java.lang.String",

	// Integer types
	INT: "java.lang.Integer",
	INTEGER: "java.lang.Integer",
	MEDIUMINT: "java.lang.Integer",
	BIGINT: "java.lang.Long",
	SMALLINT: "java.lang.Short",
	TINYINT: "java.lang.Byte",
	// NUMBER(Oracle)는 정밀도/스케일에 따라 매핑이 달라져 getJavaClassName에서 처리

	// Decimal types
	DECIMAL: "java.math.BigDecimal",
	NUMERIC: "java.math.BigDecimal",
	FLOAT: "java.lang.Float",
	REAL: "java.lang.Double",
	DOUBLE: "java.lang.Double",

	// PostgreSQL Serial types
	SMALLSERIAL: "java.lang.Short",
	SERIAL: "java.lang.Integer",
	BIGSERIAL: "java.lang.Long",

	// Date/Time types
	// java.time 타입은 @DateTimeFormat 으로 형식을 지정할 수 있어 date · datetime-local · time 입력란과 바로 맞물린다.
	// WITH TIME ZONE 타입은 getJavaClassName 에서 따로 처리한다.
	DATE: "java.time.LocalDate",
	TIME: "java.time.LocalTime",
	DATETIME: "java.time.LocalDateTime",
	TIMESTAMP: "java.time.LocalDateTime",

	// Boolean types
	BOOLEAN: "java.lang.Boolean",
	BOOL: "java.lang.Boolean",
	BIT: "java.lang.Boolean",

	// MySQL specific types
	ENUM: "java.lang.String",
	SET: "java.lang.String",
	TINYTEXT: "java.lang.String",
	LONGTEXT: "java.lang.String",
	TINYBLOB: "byte[]",
	MEDIUMBLOB: "byte[]",
	LONGBLOB: "byte[]",
	BLOB: "byte[]",
	BINARY: "byte[]",
	VARBINARY: "byte[]",

	// PostgreSQL specific types
	BYTEA: "byte[]",

	// Oracle specific types
	RAW: "byte[]",
}

/**
 * Oracle NUMBER 타입 정밀도/스케일별 Java 클래스명 반환
 * - Oracle NUMBER는 소수점이 있으면 BigDecimal, 정수면 자릿수에 따라 Integer/Long을 쓴다.
 * - 크기 정보가 없는 NUMBER는 임의 정밀도이므로 BigDecimal로 처리한다.
 */
function getJavaTypeByNumberPrecision(upperType: string): string {
	const sizeMatch = RegExp(/\(\s*(\d+)\s*(?:,\s*(\d+))?\s*\)/).exec(upperType)
	if (!sizeMatch) {
		return "java.math.BigDecimal"
	}
	const precision = Number(sizeMatch[1])
	const scale = sizeMatch[2] ? Number(sizeMatch[2]) : 0
	if (scale > 0) {
		return "java.math.BigDecimal"
	}
	if (precision <= 9) {
		return "java.lang.Integer"
	}
	if (precision <= 18) {
		return "java.lang.Long"
	}
	return "java.math.BigDecimal"
}

/**
 * Get Java class name for the given database data type
 * 주어진 데이터베이스 데이터 타입에 대한 Java 클래스명 반환
 */
export function getJavaClassName(dataType: string): string {
	const upperType = dataType.toUpperCase()
	const baseType = RegExp(/^\w+/).exec(upperType)?.[0] ?? upperType

	if (baseType === "NUMBER") {
		return getJavaTypeByNumberPrecision(upperType)
	}

	// 오프셋이 있는 값은 LocalDateTime · LocalTime 으로 읽지 못하는 드라이버가 있어 기존 java.sql 매핑을 유지한다.
	if (/\bWITH\s+TIME\s+ZONE\b/.test(upperType)) {
		if (baseType === "TIMESTAMP") {
			return "java.sql.Timestamp"
		}
		if (baseType === "TIME") {
			return "java.sql.Time"
		}
	}

	return predefinedDataTypes[baseType] || "java.lang.Object"
}

// 등록/수정 화면의 입력란 종류. boolean 은 input 이 아니라 select 로 렌더링한다.
export type InputType = "text" | "number" | "boolean" | "date" | "datetime-local" | "time"

const INTEGER_JAVA_TYPES = ["java.lang.Integer", "java.lang.Long", "java.lang.Short", "java.lang.Byte"]
const DECIMAL_JAVA_TYPES = ["java.math.BigDecimal", "java.lang.Float", "java.lang.Double"]

// 날짜·시간 타입별 입력란 종류와 형식. 패턴은 브라우저가 해당 입력란에서 보내는 값의 형식과 같다.
const DATE_TIME_INPUTS: { [javaType: string]: { inputType: InputType; pattern: string } } = {
	"java.time.LocalDate": { inputType: "date", pattern: "yyyy-MM-dd" },
	"java.time.LocalDateTime": { inputType: "datetime-local", pattern: "yyyy-MM-dd'T'HH:mm" },
	"java.time.LocalTime": { inputType: "time", pattern: "HH:mm" },
}

/**
 * Get the HTML input kind for the given Java type
 * 주어진 Java 타입에 맞는 등록/수정 화면 입력란 종류 반환 (형식을 정할 수 없는 타입은 text)
 */
export function getInputType(javaType: string): InputType {
	if (INTEGER_JAVA_TYPES.includes(javaType) || DECIMAL_JAVA_TYPES.includes(javaType)) {
		return "number"
	}
	if (javaType === "java.lang.Boolean") {
		return "boolean"
	}
	return DATE_TIME_INPUTS[javaType]?.inputType ?? "text"
}

/**
 * 숫자 입력란의 step 값 반환 (정수는 "1", 소수는 "any", 숫자가 아니면 빈 문자열)
 */
export function getInputStep(javaType: string): string {
	if (INTEGER_JAVA_TYPES.includes(javaType)) {
		return "1"
	}
	if (DECIMAL_JAVA_TYPES.includes(javaType)) {
		return "any"
	}
	return ""
}

/**
 * 날짜·시간 타입의 @DateTimeFormat 패턴 반환 (날짜·시간 타입이 아니면 빈 문자열)
 */
export function getDateTimePattern(javaType: string): string {
	return DATE_TIME_INPUTS[javaType]?.pattern ?? ""
}
