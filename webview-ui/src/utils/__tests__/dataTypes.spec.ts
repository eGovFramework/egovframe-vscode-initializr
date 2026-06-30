import { describe, it, expect } from "vitest"
import { getJavaClassName } from "@shared/dataTypes"

describe("getJavaClassName", () => {
	it("문자열 타입을 java.lang.String으로 변환한다", () => {
		expect(getJavaClassName("VARCHAR")).toBe("java.lang.String")
		expect(getJavaClassName("VARCHAR2")).toBe("java.lang.String")
		expect(getJavaClassName("CHAR")).toBe("java.lang.String")
		expect(getJavaClassName("TEXT")).toBe("java.lang.String")
		expect(getJavaClassName("MEDIUMTEXT")).toBe("java.lang.String")
	})

	it("정수 타입을 적절한 Java 타입으로 변환한다", () => {
		expect(getJavaClassName("INT")).toBe("java.lang.Integer")
		expect(getJavaClassName("INTEGER")).toBe("java.lang.Integer")
		expect(getJavaClassName("BIGINT")).toBe("java.lang.Long")
		expect(getJavaClassName("SMALLINT")).toBe("java.lang.Short")
		expect(getJavaClassName("TINYINT")).toBe("java.lang.Byte")
	})

	it("Oracle NUMBER 타입을 정밀도/스케일에 따라 변환한다", () => {
		// 크기 정보가 없으면 임의 정밀도로 보아 BigDecimal
		expect(getJavaClassName("NUMBER")).toBe("java.math.BigDecimal")
		// 스케일이 있으면 BigDecimal
		expect(getJavaClassName("NUMBER(10,2)")).toBe("java.math.BigDecimal")
		// 정수이고 정밀도 ≤ 9이면 Integer
		expect(getJavaClassName("NUMBER(5)")).toBe("java.lang.Integer")
		expect(getJavaClassName("NUMBER(9)")).toBe("java.lang.Integer")
		// 정수이고 정밀도 ≤ 18이면 Long
		expect(getJavaClassName("NUMBER(10)")).toBe("java.lang.Long")
		expect(getJavaClassName("NUMBER(18)")).toBe("java.lang.Long")
		// 정수이고 정밀도 > 18이면 BigDecimal
		expect(getJavaClassName("NUMBER(20)")).toBe("java.math.BigDecimal")
	})

	it("소수 타입을 적절한 Java 타입으로 변환한다", () => {
		expect(getJavaClassName("DECIMAL")).toBe("java.math.BigDecimal")
		expect(getJavaClassName("NUMERIC")).toBe("java.math.BigDecimal")
		expect(getJavaClassName("FLOAT")).toBe("java.lang.Float")
		expect(getJavaClassName("REAL")).toBe("java.lang.Double")
		expect(getJavaClassName("DOUBLE")).toBe("java.lang.Double")
	})

	it("PostgreSQL 시퀀스 타입을 적절한 Java 타입으로 변환한다", () => {
		expect(getJavaClassName("SMALLSERIAL")).toBe("java.lang.Short")
		expect(getJavaClassName("SERIAL")).toBe("java.lang.Integer")
		expect(getJavaClassName("BIGSERIAL")).toBe("java.lang.Long")
	})

	it("날짜/시간 타입을 적절한 Java 타입으로 변환한다", () => {
		expect(getJavaClassName("DATE")).toBe("java.sql.Date")
		expect(getJavaClassName("TIME")).toBe("java.sql.Time")
		expect(getJavaClassName("DATETIME")).toBe("java.util.Date")
		expect(getJavaClassName("TIMESTAMP")).toBe("java.sql.Timestamp")
	})

	it("불리언 타입을 java.lang.Boolean으로 변환한다", () => {
		expect(getJavaClassName("BOOLEAN")).toBe("java.lang.Boolean")
		expect(getJavaClassName("BIT")).toBe("java.lang.Boolean")
	})

	it("MySQL 열거형 타입을 java.lang.String으로 변환한다", () => {
		expect(getJavaClassName("ENUM")).toBe("java.lang.String")
		expect(getJavaClassName("SET")).toBe("java.lang.String")
	})

	it("소문자 타입명을 대소문자 무관하게 처리한다", () => {
		expect(getJavaClassName("varchar")).toBe("java.lang.String")
		expect(getJavaClassName("int")).toBe("java.lang.Integer")
		expect(getJavaClassName("timestamp")).toBe("java.sql.Timestamp")
	})

	it("알 수 없는 타입은 java.lang.Object를 반환한다", () => {
		expect(getJavaClassName("JSONB")).toBe("java.lang.Object")
		expect(getJavaClassName("UNKNOWN_TYPE")).toBe("java.lang.Object")
		expect(getJavaClassName("XML")).toBe("java.lang.Object")
	})
})
