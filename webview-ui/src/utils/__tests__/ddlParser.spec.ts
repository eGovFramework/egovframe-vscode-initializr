import { describe, it, expect } from "vitest"
import { parseDDL, splitColumnDefinitions, validateDDL } from "@shared/ddlParser"

describe("parseDDL", () => {
	it("should parse basic MySQL columns and inline primary key", () => {
		const result = parseDDL(`
			CREATE TABLE users (
				id INT PRIMARY KEY AUTO_INCREMENT,
				user_nm VARCHAR(50) NOT NULL
			);
		`)

		expect(result.dbTableName).toBe("users")
		expect(result.attributes.map((attribute) => attribute.columnName)).toEqual(["id", "user_nm"])
		expect(result.pkAttributes.map((attribute) => attribute.columnName)).toEqual(["id"])
	})

	it("should not split columns on commas inside COMMENT literals", () => {
		const result = parseDDL(`
			CREATE TABLE users (
				user_id VARCHAR(20) NOT NULL COMMENT '사용자 ID, 기본키',
				user_nm VARCHAR(50) NOT NULL COMMENT '사용자 이름',
				PRIMARY KEY (user_id)
			);
		`)

		expect(result.attributes.map((attribute) => attribute.columnName)).toEqual(["user_id", "user_nm"])
		expect(result.pkAttributes.map((attribute) => attribute.columnName)).toEqual(["user_id"])
	})

	it("should not split columns on commas inside DEFAULT literals and escaped quotes", () => {
		const result = parseDDL(`
			CREATE TABLE codes (
				code_id VARCHAR(10) PRIMARY KEY,
				code_nm VARCHAR(50) DEFAULT 'A,B' COMMENT 'user''s code, label',
				use_yn CHAR(1) DEFAULT 'Y'
			);
		`)

		expect(result.attributes.map((attribute) => attribute.columnName)).toEqual(["code_id", "code_nm", "use_yn"])
	})

	it("should not treat a column as primary key when only its comment mentions primary key", () => {
		const result = parseDDL(`
			CREATE TABLE notes (
				id INT PRIMARY KEY,
				note VARCHAR(200) COMMENT 'this is the primary key column'
			);
		`)

		expect(result.pkAttributes).toHaveLength(1)
		expect(result.pkAttributes[0].columnName).toBe("id")
		expect(result.attributes.find((attribute) => attribute.columnName === "note")?.isPrimaryKey).toBe(false)
		expect(result.attributes[0].isPrimaryKey).toBe(true)
	})

	it("should ignore an opening parenthesis inside a string literal", () => {
		const result = parseDDL(`
			CREATE TABLE notices (
				notice_id INT PRIMARY KEY COMMENT '공지 ID (필수',
				title VARCHAR(200) COMMENT '제목'
			);
		`)

		expect(result.attributes.map((attribute) => attribute.columnName)).toEqual(["notice_id", "title"])
	})

	it("should ignore a closing parenthesis inside a string literal", () => {
		const result = parseDDL(`
			CREATE TABLE remarks (
				remark_id INT PRIMARY KEY COMMENT '비고 ID)',
				remark_ct VARCHAR(200) COMMENT '내용'
			);
		`)

		expect(result.attributes.map((attribute) => attribute.columnName)).toEqual(["remark_id", "remark_ct"])
	})

	it("should parse columns when a comment contains a backslash-escaped quote", () => {
		const result = parseDDL(`
			CREATE TABLE users (
				user_id VARCHAR(20) NOT NULL COMMENT 'user\\'s id',
				user_nm VARCHAR(50) NOT NULL
			);
		`)

		expect(result.dbTableName).toBe("users")
		expect(result.attributes.map((attribute) => attribute.columnName)).toEqual(["user_id", "user_nm"])
	})

	it("should parse columns when a default value is a double quoted literal containing an apostrophe", () => {
		const result = parseDDL(`
			CREATE TABLE users (
				user_id VARCHAR(20) NOT NULL DEFAULT "it's",
				user_nm VARCHAR(50) NOT NULL
			);
		`)

		expect(result.attributes.map((attribute) => attribute.columnName)).toEqual(["user_id", "user_nm"])
	})

	it("should parse columns when a default value ends with a backslash", () => {
		const result = parseDDL(`
			CREATE TABLE files (
				path VARCHAR(50) DEFAULT 'C:\\',
				nm VARCHAR(10)
			);
		`)

		expect(result.attributes.map((attribute) => attribute.columnName)).toEqual(["path", "nm"])
	})

	it("should keep every column when a trailing backslash precedes later quoted comments", () => {
		const result = parseDDL(`
			CREATE TABLE t (
				p VARCHAR(50) DEFAULT 'C:\\',
				amt DECIMAL(10,2) COMMENT '금액(원), 세금',
				nm VARCHAR(10) COMMENT '이름, 별칭'
			);
		`)

		expect(result.attributes.map((attribute) => attribute.columnName)).toEqual(["p", "amt", "nm"])
	})

	it("should keep every column when a dialect-ambiguous backslash meets a line comment", () => {
		const result = parseDDL(`
			CREATE TABLE a (
				p VARCHAR(50) DEFAULT 'C:\\',
				id INT -- owner's
			);
		`)

		expect(result.attributes.map((attribute) => attribute.columnName)).toEqual(["p", "id"])
	})
})

describe("validateDDL", () => {
	it("should accept CREATE TABLE statements whose comments contain commas", () => {
		expect(
			validateDDL(`
				CREATE TABLE users (
					user_id VARCHAR(20) NOT NULL COMMENT '사용자 ID, 기본키',
					user_nm VARCHAR(50) NOT NULL COMMENT '사용자 이름',
					PRIMARY KEY (user_id)
				);
			`),
		).toBe(true)
	})

	it("should accept an unbalanced parenthesis inside a string literal", () => {
		expect(
			validateDDL(`
				CREATE TABLE notices (
					notice_id INT PRIMARY KEY COMMENT '공지 ID (필수',
					title VARCHAR(200) COMMENT '제목'
				);
			`),
		).toBe(true)
	})

	it("should accept a comment containing a backslash-escaped quote", () => {
		expect(
			validateDDL(`
				CREATE TABLE users (
					user_id VARCHAR(20) NOT NULL COMMENT 'user\\'s id',
					user_nm VARCHAR(50) NOT NULL
				);
			`),
		).toBe(true)
	})

	it("should accept a double quoted default value containing an apostrophe", () => {
		expect(
			validateDDL(`
				CREATE TABLE users (
					user_id VARCHAR(20) NOT NULL DEFAULT "it's",
					user_nm VARCHAR(50) NOT NULL
				);
			`),
		).toBe(true)
	})

	it("should accept a line comment containing an apostrophe", () => {
		expect(
			validateDDL(`
				CREATE TABLE t (
					id INT PRIMARY KEY, -- user's id
					nm VARCHAR(10)
				);
			`),
		).toBe(true)
	})

	it("should reject empty input", () => {
		expect(validateDDL("")).toBe(false)
	})

	it("should reject input that does not start with CREATE TABLE", () => {
		expect(validateDDL("SELECT * FROM users;")).toBe(false)
	})

	it("should reject CREATE TABLE with no closing parenthesis", () => {
		expect(validateDDL("CREATE TABLE sample (id INT")).toBe(false)
	})
})

describe("splitColumnDefinitions", () => {
	it("should split on top level commas only", () => {
		expect(splitColumnDefinitions("a DECIMAL(10,2), CHECK (a IN ('Y','N')), b INT")).toEqual([
			"a DECIMAL(10,2)",
			"CHECK (a IN ('Y','N'))",
			"b INT",
		])
	})

	it("should keep commas inside single quoted literals", () => {
		expect(splitColumnDefinitions("id INT COMMENT 'a, b', nm VARCHAR(10)")).toEqual([
			"id INT COMMENT 'a, b'",
			"nm VARCHAR(10)",
		])
	})

	it("should keep commas inside literals using doubled quotes", () => {
		expect(splitColumnDefinitions("id INT COMMENT 'a''b, c', nm VARCHAR(10)")).toEqual([
			"id INT COMMENT 'a''b, c'",
			"nm VARCHAR(10)",
		])
	})

	it("should keep commas inside literals using backslash-escaped quotes", () => {
		expect(splitColumnDefinitions("id INT COMMENT 'a\\', b', nm VARCHAR(10)")).toEqual([
			"id INT COMMENT 'a\\', b'",
			"nm VARCHAR(10)",
		])
	})

	it("should keep commas inside double quoted literals", () => {
		expect(splitColumnDefinitions(`id INT DEFAULT "it's, ok", nm VARCHAR(10)`)).toEqual([
			`id INT DEFAULT "it's, ok"`,
			"nm VARCHAR(10)",
		])
	})

	it("should keep commas inside backtick quoted identifiers", () => {
		expect(splitColumnDefinitions("`a,b` INT, c INT")).toEqual(["`a,b` INT", "c INT"])
	})

	it("should not treat a trailing backslash as an escape when it unbalances the quotes", () => {
		expect(splitColumnDefinitions("path VARCHAR(50) DEFAULT 'C:\\', nm VARCHAR(10)")).toEqual([
			"path VARCHAR(50) DEFAULT 'C:\\'",
			"nm VARCHAR(10)",
		])
	})

	it("should fall back to quote-unaware splitting when a quote is left open", () => {
		expect(splitColumnDefinitions("id INT COMMENT 'oops, nm VARCHAR(10)")).toEqual(["id INT COMMENT 'oops", "nm VARCHAR(10)"])
	})

	it("should drop empty definitions", () => {
		expect(splitColumnDefinitions("")).toEqual([])
		expect(splitColumnDefinitions(" , , ")).toEqual([])
	})
})
