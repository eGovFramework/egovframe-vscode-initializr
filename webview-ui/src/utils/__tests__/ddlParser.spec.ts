import { describe, it, expect } from "vitest"
import { parseDDL, splitColumnDefinitions, validateDDL } from "@shared/ddlParser"

describe("ddlParser", () => {
	it("should parse basic MySQL columns and inline primary key", () => {
		const result = parseDDL(`
			CREATE TABLE users (
				id INT PRIMARY KEY,
				user_name VARCHAR(100),
				created_at TIMESTAMP
			);
		`)

		expect(result.tableName).toBe("Users")
		expect(result.attributes).toHaveLength(3)
		expect(result.pkAttributes).toHaveLength(1)

		expect(result.attributes[0]).toMatchObject({
			columnName: "id",
			ccName: "id",
			pcName: "Id",
			dataType: "INT",
			javaType: "java.lang.Integer",
			isPrimaryKey: true,
		})
		expect(result.attributes[1]).toMatchObject({
			columnName: "user_name",
			ccName: "userName",
			pcName: "UserName",
			dataType: "VARCHAR",
			javaType: "java.lang.String",
			isPrimaryKey: false,
		})
		expect(result.attributes[2]).toMatchObject({
			columnName: "created_at",
			ccName: "createdAt",
			pcName: "CreatedAt",
			dataType: "TIMESTAMP",
			javaType: "java.sql.Timestamp",
			isPrimaryKey: false,
		})
	})

	it("should parse table-level primary key and decimal type with precision", () => {
		const result = parseDDL(`
			CREATE TABLE orders (
				order_id BIGINT,
				user_id INT,
				amount DECIMAL(10,2),
				PRIMARY KEY (order_id)
			);
		`)

		expect(result.tableName).toBe("Orders")
		expect(result.attributes).toHaveLength(3)
		expect(result.pkAttributes).toHaveLength(1)
		expect(result.pkAttributes[0]).toMatchObject({
			columnName: "order_id",
			ccName: "orderId",
			dataType: "BIGINT",
			javaType: "java.lang.Long",
			isPrimaryKey: true,
		})
		expect(result.attributes[2]).toMatchObject({
			columnName: "amount",
			dataType: "DECIMAL",
			javaType: "java.math.BigDecimal",
		})
	})

	it("should ignore table constraints and indexes", () => {
		const result = parseDDL(`
			CREATE TABLE members (
				id INT,
				email VARCHAR(255),
				CONSTRAINT uq_email UNIQUE (email),
				FOREIGN KEY (id) REFERENCES other_table(id),
				KEY idx_email (email),
				PRIMARY KEY (id)
			);
		`)

		expect(result.attributes).toHaveLength(2)
		expect(result.attributes.map((attribute) => attribute.columnName)).toEqual(["id", "email"])
		expect(result.pkAttributes).toHaveLength(1)
		expect(result.pkAttributes[0].columnName).toBe("id")
	})

	it("should strip quotes from column names and convert snake case names", () => {
		const result = parseDDL(`
			CREATE TABLE user_profiles (
				\`profile_id\` INT PRIMARY KEY,
				"display_name" VARCHAR(255)
			);
		`)

		expect(result.tableName).toBe("UserProfiles")
		expect(result.dbTableName).toBe("user_profiles")
		expect(result.attributes[0]).toMatchObject({
			columnName: "profile_id",
			ccName: "profileId",
			pcName: "ProfileId",
			isPrimaryKey: true,
		})
		expect(result.attributes[1]).toMatchObject({
			columnName: "display_name",
			ccName: "displayName",
			pcName: "DisplayName",
		})
	})

	it("should use Object as fallback Java type for unknown SQL types", () => {
		const result = parseDDL(`
			CREATE TABLE files (
				id INT,
				metadata JSONB
			);
		`)

		expect(result.attributes[1]).toMatchObject({
			columnName: "metadata",
			dataType: "JSONB",
			javaType: "java.lang.Object",
		})
	})

	it("should map MySQL text types to java.lang.String", () => {
		const result = parseDDL(`
			CREATE TABLE articles (
				id INT PRIMARY KEY,
				summary TINYTEXT,
				body LONGTEXT
			);
		`)

		expect(result.attributes[1]).toMatchObject({
			columnName: "summary",
			dataType: "TINYTEXT",
			javaType: "java.lang.String",
		})
		expect(result.attributes[2]).toMatchObject({
			columnName: "body",
			dataType: "LONGTEXT",
			javaType: "java.lang.String",
		})
	})

	it("should map MySQL blob and binary types to byte[]", () => {
		const result = parseDDL(`
			CREATE TABLE blobs (
				id INT PRIMARY KEY,
				tiny TINYBLOB,
				medium MEDIUMBLOB,
				large LONGBLOB,
				data BLOB,
				fixed BINARY(16),
				variable VARBINARY(255)
			);
		`)

		expect(result.attributes[1]).toMatchObject({ columnName: "tiny", dataType: "TINYBLOB", javaType: "byte[]" })
		expect(result.attributes[2]).toMatchObject({ columnName: "medium", dataType: "MEDIUMBLOB", javaType: "byte[]" })
		expect(result.attributes[3]).toMatchObject({ columnName: "large", dataType: "LONGBLOB", javaType: "byte[]" })
		expect(result.attributes[4]).toMatchObject({ columnName: "data", dataType: "BLOB", javaType: "byte[]" })
		expect(result.attributes[5]).toMatchObject({ columnName: "fixed", dataType: "BINARY", javaType: "byte[]" })
		expect(result.attributes[6]).toMatchObject({ columnName: "variable", dataType: "VARBINARY", javaType: "byte[]" })
	})

	it("should map PostgreSQL BYTEA type to byte[]", () => {
		const result = parseDDL(`
			CREATE TABLE pg_files (
				id INT PRIMARY KEY,
				content BYTEA
			);
		`)

		expect(result.attributes[1]).toMatchObject({
			columnName: "content",
			dataType: "BYTEA",
			javaType: "byte[]",
		})
	})

	it("should parse MySQL column and table comments", () => {
		const result = parseDDL(`
			CREATE TABLE users (
				id INT PRIMARY KEY COMMENT 'User ID',
				display_name VARCHAR(100) COMMENT 'User''s display name'
			) ENGINE=InnoDB COMMENT='Users; table';
		`)

		expect(result.tableComment).toBe("Users; table")
		expect(result.attributes[0].comment).toBe("User ID")
		expect(result.attributes[1].comment).toBe("User's display name")
	})

	it("should parse PostgreSQL column and table comments for the target table", () => {
		const result = parseDDL(`
			CREATE TABLE users (
				id INT PRIMARY KEY,
				display_name VARCHAR(100)
			);
			COMMENT ON TABLE other_table IS 'Other table';
			COMMENT ON COLUMN other_table.id IS 'Other ID';
			COMMENT ON TABLE users IS 'Users table';
			COMMENT ON COLUMN users.id IS 'User ID';
			COMMENT ON COLUMN users.display_name IS 'User''s display name';
		`)

		expect(result.tableComment).toBe("Users table")
		expect(result.attributes[0].comment).toBe("User ID")
		expect(result.attributes[1].comment).toBe("User's display name")
	})

	it("should fall back to generated names when comments are absent", () => {
		const result = parseDDL(`
			CREATE TABLE user_profiles (
				profile_id INT PRIMARY KEY
			);
		`)

		expect(result.tableComment).toBe("UserProfiles")
		expect(result.attributes[0].comment).toBe("profile_id")
	})

	it("should map Oracle NUMBER to Java type by precision and scale", () => {
		const result = parseDDL(`
			CREATE TABLE payment (
				pay_id NUMBER(19) PRIMARY KEY,
				amount NUMBER(15,2),
				rate NUMBER(5,4),
				seq NUMBER(5),
				big_seq NUMBER(12),
				qty NUMBER
			);
		`)

		expect(result.attributes.map((attribute) => [attribute.columnName, attribute.javaType])).toEqual([
			["pay_id", "java.math.BigDecimal"],
			["amount", "java.math.BigDecimal"],
			["rate", "java.math.BigDecimal"],
			["seq", "java.lang.Integer"],
			["big_seq", "java.lang.Long"],
			["qty", "java.math.BigDecimal"],
		])
	})

	it("should map newly added Oracle and MySQL types", () => {
		const result = parseDDL(`
			CREATE TABLE extra_types (
				id INT PRIMARY KEY,
				name NVARCHAR(100),
				uname NVARCHAR2(100),
				code NCHAR(2),
				doc CLOB,
				ndoc NCLOB,
				raw_data RAW(16),
				cnt MEDIUMINT,
				flag BOOL
			);
		`)

		expect(result.attributes.map((attribute) => [attribute.columnName, attribute.javaType])).toEqual([
			["id", "java.lang.Integer"],
			["name", "java.lang.String"],
			["uname", "java.lang.String"],
			["code", "java.lang.String"],
			["doc", "java.lang.String"],
			["ndoc", "java.lang.String"],
			["raw_data", "byte[]"],
			["cnt", "java.lang.Integer"],
			["flag", "java.lang.Boolean"],
		])
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

		const noteColumn = result.attributes.find((attribute) => attribute.columnName === "note")
		expect(noteColumn?.isPrimaryKey).toBe(false)
		expect(noteColumn?.comment).toBe("this is the primary key column")

		expect(result.attributes[0].isPrimaryKey).toBe(true)
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
		expect(result.attributes[0].comment).toBe("사용자 ID, 기본키")
		expect(result.attributes[1].comment).toBe("사용자 이름")
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
		expect(result.attributes[1].comment).toBe("user's code, label")
	})

	it("should ignore parentheses inside string literals when extracting the statement body", () => {
		const result = parseDDL(`
			CREATE TABLE notices (
				notice_id INT PRIMARY KEY COMMENT '공지 ID (필수',
				title VARCHAR(200) COMMENT '제목'
			);
		`)

		expect(result.attributes.map((attribute) => attribute.columnName)).toEqual(["notice_id", "title"])
		expect(result.attributes[0].comment).toBe("공지 ID (필수")
	})

	it("should not end the statement body at a closing parenthesis inside a string literal", () => {
		const result = parseDDL(`
			CREATE TABLE remarks (
				remark_id INT PRIMARY KEY COMMENT '비고 ID)',
				remark_ct VARCHAR(200) COMMENT '내용'
			);
		`)

		expect(result.attributes.map((attribute) => attribute.columnName)).toEqual(["remark_id", "remark_ct"])
		expect(result.attributes[1].comment).toBe("내용")
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

	it("should parse the first table when an earlier column comment contains a backslash-escaped quote", () => {
		const result = parseDDL(`
			CREATE TABLE users (
				user_id VARCHAR(20) NOT NULL COMMENT 'user\\'s id',
				PRIMARY KEY (user_id)
			);
			CREATE TABLE orders (
				order_id INT PRIMARY KEY,
				amt DECIMAL(10,2)
			);
		`)

		expect(result.dbTableName).toBe("users")
		expect(result.attributes.map((attribute) => attribute.columnName)).toEqual(["user_id"])
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

	it("should not treat a comment marker inside a string literal as a comment", () => {
		const result = parseDDL(`
			CREATE TABLE t (
				id INT COMMENT 'a -- b, c',
				nm VARCHAR(10)
			);
		`)

		expect(result.attributes.map((attribute) => attribute.columnName)).toEqual(["id", "nm"])
		expect(result.attributes[0].comment).toBe("a -- b, c")
	})

	it("should keep a comment marker that a MySQL escape puts inside a string literal", () => {
		const result = parseDDL(`
			CREATE TABLE t (
				id INT COMMENT 'it\\'s -- ok',
				nm VARCHAR(10)
			);
		`)

		expect(result.attributes.map((attribute) => attribute.columnName)).toEqual(["id", "nm"])
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

	it("should keep every column when a trailing backslash precedes later quoted comments", () => {
		const result = parseDDL(`
			CREATE TABLE t (
				p VARCHAR(50) DEFAULT 'C:\\',
				amt DECIMAL(10,2) COMMENT '금액(원), 세금',
				nm VARCHAR(10) COMMENT '이름, 별칭'
			);
		`)

		expect(result.attributes.map((attribute) => attribute.columnName)).toEqual(["p", "amt", "nm"])
		expect(result.attributes[1].comment).toBe("금액(원), 세금")
	})

	it("should keep a generated column expression when two dashes are not a line comment", () => {
		// MySQL은 `--` 뒤에 공백이 없으면 줄 주석으로 보지 않는다. 주석으로 지우면 괄호 균형이 깨진다.
		const ddl = `CREATE TABLE t (
  id INT,
  x INT GENERATED ALWAYS AS (a--b) STORED,
  nm INT
);`
		const result = parseDDL(ddl)
		expect(result.attributes.map((column) => column.columnName)).toEqual(["id", "x", "nm"])
	})

	it("should keep an arithmetic default when two dashes are not a line comment", () => {
		const ddl = `CREATE TABLE t (
  id INT DEFAULT (5--3),
  nm INT
);`
		const result = parseDDL(ddl)
		expect(result.attributes.map((column) => column.columnName)).toEqual(["id", "nm"])
	})

	it("should convert underscore followed by a digit into a clean camelCase name", () => {
		const result = parseDDL(`
			CREATE TABLE addresses (
				id INT PRIMARY KEY,
				addr_1 VARCHAR(200),
				zip_no_1 VARCHAR(10)
			);
		`)

		const addr = result.attributes.find((attribute) => attribute.columnName === "addr_1")
		expect(addr?.ccName).toBe("addr1")
		expect(addr?.pcName).toBe("Addr1")

		const zip = result.attributes.find((attribute) => attribute.columnName === "zip_no_1")
		expect(zip?.ccName).toBe("zipNo1")
		expect(zip?.pcName).toBe("ZipNo1")

		// 기존 영문 변환 동작은 유지된다
		const id = result.attributes.find((attribute) => attribute.columnName === "id")
		expect(id?.ccName).toBe("id")
	})
})

describe("validateDDL", () => {
	it("should accept valid CREATE TABLE statements", () => {
		expect(
			validateDDL(`
				CREATE TABLE sample (
					id INT,
					name VARCHAR(20)
				);
			`),
		).toBe(true)
	})

	it("should reject invalid DDL", () => {
		expect(validateDDL("SELECT * FROM sample")).toBe(false)
		expect(validateDDL("CREATE TABLE sample ()")).toBe(false)
		expect(
			validateDDL(`
				CREATE TABLE sample (
					id
				);
			`),
		).toBe(false)
	})

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

	it("should reject empty input", () => {
		expect(validateDDL("")).toBe(false)
	})

	it("should reject input that does not start with CREATE TABLE", () => {
		expect(validateDDL("   \n\t ")).toBe(false)
		expect(validateDDL("SELECT * FROM users")).toBe(false)
	})

	it("should reject CREATE TABLE with no closing parenthesis (statement extraction fails)", () => {
		expect(validateDDL("CREATE TABLE sample (id INT")).toBe(false)
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

	it("should accept a dialect-ambiguous backslash followed by a line comment", () => {
		expect(
			validateDDL(`
				CREATE TABLE a (
					p VARCHAR(50) DEFAULT 'C:\\',
					id INT -- owner's
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
