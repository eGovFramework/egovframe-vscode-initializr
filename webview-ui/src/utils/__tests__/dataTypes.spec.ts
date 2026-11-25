import { describe, it, expect } from "vitest"
import { getDateTimePattern, getInputStep, getInputType, getJavaClassName } from "@shared/dataTypes"

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
		expect(getJavaClassName("DATE")).toBe("java.time.LocalDate")
		expect(getJavaClassName("TIME")).toBe("java.time.LocalTime")
		expect(getJavaClassName("DATETIME")).toBe("java.time.LocalDateTime")
		expect(getJavaClassName("TIMESTAMP")).toBe("java.time.LocalDateTime")
		expect(getJavaClassName("TIMESTAMP(6)")).toBe("java.time.LocalDateTime")
	})

	// 오프셋이 있는 값은 LocalDateTime 으로 읽을 수 없는 드라이버가 있어 기존 java.sql 매핑을 유지한다.
	it("WITH TIME ZONE 타입은 기존 java.sql 타입을 유지한다", () => {
		expect(getJavaClassName("TIMESTAMP WITH TIME ZONE")).toBe("java.sql.Timestamp")
		expect(getJavaClassName("timestamp(6) with time zone")).toBe("java.sql.Timestamp")
		expect(getJavaClassName("TIME WITH TIME ZONE")).toBe("java.sql.Time")
		expect(getJavaClassName("TIMESTAMP WITHOUT TIME ZONE")).toBe("java.time.LocalDateTime")
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
		expect(getJavaClassName("timestamp")).toBe("java.time.LocalDateTime")
	})

	it("알 수 없는 타입은 java.lang.Object를 반환한다", () => {
		expect(getJavaClassName("JSONB")).toBe("java.lang.Object")
		expect(getJavaClassName("UNKNOWN_TYPE")).toBe("java.lang.Object")
		expect(getJavaClassName("XML")).toBe("java.lang.Object")
	})
})

describe("등록 화면 입력란 정보", () => {
	it("Java 타입별 입력란 종류를 반환한다", () => {
		expect(getInputType("java.lang.String")).toBe("text")
		expect(getInputType("java.lang.Integer")).toBe("number")
		expect(getInputType("java.lang.Long")).toBe("number")
		expect(getInputType("java.lang.Short")).toBe("number")
		expect(getInputType("java.lang.Byte")).toBe("number")
		expect(getInputType("java.math.BigDecimal")).toBe("number")
		expect(getInputType("java.lang.Float")).toBe("number")
		expect(getInputType("java.lang.Double")).toBe("number")
		expect(getInputType("java.lang.Boolean")).toBe("boolean")
		expect(getInputType("java.time.LocalDate")).toBe("date")
		expect(getInputType("java.time.LocalDateTime")).toBe("datetime-local")
		expect(getInputType("java.time.LocalTime")).toBe("time")
	})

	it("형식을 정할 수 없는 타입은 text 입력란을 쓴다", () => {
		expect(getInputType("java.sql.Timestamp")).toBe("text")
		expect(getInputType("byte[]")).toBe("text")
		expect(getInputType("java.lang.Object")).toBe("text")
	})

	it("숫자 입력란의 step 을 정수와 소수로 구분한다", () => {
		expect(getInputStep("java.lang.Integer")).toBe("1")
		expect(getInputStep("java.lang.Long")).toBe("1")
		expect(getInputStep("java.math.BigDecimal")).toBe("any")
		expect(getInputStep("java.lang.Double")).toBe("any")
		expect(getInputStep("java.lang.String")).toBe("")
		expect(getInputStep("java.time.LocalDate")).toBe("")
	})

	// 패턴은 브라우저의 date · datetime-local · time 입력란이 보내는 값의 형식과 같아야 한다.
	it("날짜·시간 타입의 @DateTimeFormat 패턴을 반환한다", () => {
		expect(getDateTimePattern("java.time.LocalDate")).toBe("yyyy-MM-dd")
		expect(getDateTimePattern("java.time.LocalDateTime")).toBe("yyyy-MM-dd'T'HH:mm")
		expect(getDateTimePattern("java.time.LocalTime")).toBe("HH:mm")
		expect(getDateTimePattern("java.lang.String")).toBe("")
		expect(getDateTimePattern("java.sql.Timestamp")).toBe("")
	})
})
