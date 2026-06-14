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
	DATE: "java.sql.Date",
	TIME: "java.sql.Time",
	DATETIME: "java.util.Date",
	TIMESTAMP: "java.sql.Timestamp",

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

	return predefinedDataTypes[baseType] || "java.lang.Object"
}
