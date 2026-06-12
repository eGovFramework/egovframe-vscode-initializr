import { describe, it, expect } from "vitest"
import { parseDDL, validateDDL } from "@shared/ddlParser"

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

	it("should reject empty or whitespace-only input", () => {
		expect(validateDDL("")).toBe(false)
		expect(validateDDL("   \n\t ")).toBe(false)
	})

	it("should reject statements with an unclosed parenthesis", () => {
		expect(validateDDL("CREATE TABLE sample (id INT")).toBe(false)
	})
})
