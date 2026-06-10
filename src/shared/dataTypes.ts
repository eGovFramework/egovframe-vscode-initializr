/**
 * Database type to Java type mapping
 * 데이터베이스 데이터 타입을 Java 데이터 타입으로 매핑
 */
const predefinedDataTypes: { [key: string]: string } = {
	// String types
	VARCHAR: "java.lang.String",
	VARCHAR2: "java.lang.String",
	CHAR: "java.lang.String",
	TEXT: "java.lang.String",
	MEDIUMTEXT: "java.lang.String",

	// Integer types
	INT: "java.lang.Integer",
	INTEGER: "java.lang.Integer",
	NUMBER: "java.lang.Integer",
	BIGINT: "java.lang.Long",
	SMALLINT: "java.lang.Short",
	TINYINT: "java.lang.Byte",

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
}

/**
 * Get Java class name for the given database data type
 * 주어진 데이터베이스 데이터 타입에 대한 Java 클래스명 반환
 */
export function getJavaClassName(dataType: string): string {
	return predefinedDataTypes[dataType.toUpperCase()] || "java.lang.Object"
}
