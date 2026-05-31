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
})
