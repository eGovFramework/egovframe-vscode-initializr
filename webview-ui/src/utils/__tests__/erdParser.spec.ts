import { describe, expect, it } from "vitest"
import { parseErdModel } from "@shared/erdParser"

describe("parseErdModel", () => {
	it("parses tables and table-level foreign key relationships", () => {
		const model = parseErdModel(`
			CREATE TABLE users (
				id INT PRIMARY KEY AUTO_INCREMENT,
				name VARCHAR(100) NOT NULL
			);

			CREATE TABLE orders (
				id INT PRIMARY KEY AUTO_INCREMENT,
				user_id INT NOT NULL,
				CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
			);
		`)

		expect(model.tables).toHaveLength(2)
		expect(model.tables[0].columns.find((column) => column.name === "id")?.isPrimaryKey).toBe(true)
		expect(model.tables[1].columns.find((column) => column.name === "user_id")?.isForeignKey).toBe(true)
		expect(model.relationships).toEqual([
			{
				fromTable: "orders",
				fromColumn: "user_id",
				toTable: "users",
				toColumn: "id",
			},
		])
	})

	it("parses inline foreign key references", () => {
		const model = parseErdModel(`
			CREATE TABLE users (
				id INT PRIMARY KEY
			);

			CREATE TABLE comments (
				id INT PRIMARY KEY,
				user_id INT REFERENCES users(id)
			);
		`)

		expect(model.relationships).toEqual([
			{
				fromTable: "comments",
				fromColumn: "user_id",
				toTable: "users",
				toColumn: "id",
			},
		])
	})

	it("does not split column definitions on commas inside COMMENT literals", () => {
		const model = parseErdModel(`
			CREATE TABLE users (
				user_id VARCHAR(20) NOT NULL COMMENT '사용자 ID, 기본키',
				reg_dt DATETIME COMMENT '등록일시, YYYY-MM-DD HH:MM:SS',
				PRIMARY KEY (user_id)
			);
		`)

		expect(model.tables).toHaveLength(1)
		expect(model.tables[0].columns.map((column) => column.name)).toEqual(["user_id", "reg_dt"])
		expect(model.tables[0].columns.map((column) => column.dataType)).toEqual(["VARCHAR(20)", "DATETIME"])
		expect(model.tables[0].columns[0].isPrimaryKey).toBe(true)
		expect(model.tables[0].columns[1].isPrimaryKey).toBe(false)
	})

	it("ignores parentheses inside string literals when extracting tables", () => {
		const model = parseErdModel(`
			CREATE TABLE notices (
				notice_id INT PRIMARY KEY COMMENT '공지 ID (필수',
				title VARCHAR(200) COMMENT '제목'
			);
		`)

		expect(model.tables).toHaveLength(1)
		expect(model.tables[0].columns.map((column) => column.name)).toEqual(["notice_id", "title"])
	})

	it("keeps every table when a dialect-ambiguous backslash meets a line comment", () => {
		const model = parseErdModel(`
			CREATE TABLE a (
				p VARCHAR(50) DEFAULT 'C:\\',
				id INT
			);

			CREATE TABLE b (
				id INT -- user's id
			);
		`)

		expect(model.tables.map((table) => table.name)).toEqual(["a", "b"])
		expect(model.tables[0].columns.map((column) => column.name)).toEqual(["p", "id"])
	})

	it("keeps foreign key relationships when a comment contains a comma", () => {
		const model = parseErdModel(`
			CREATE TABLE users (
				user_id VARCHAR(20) NOT NULL COMMENT '사용자 ID, 기본키',
				PRIMARY KEY (user_id)
			);

			CREATE TABLE orders (
				order_id INT PRIMARY KEY,
				user_id VARCHAR(20) NOT NULL COMMENT '주문자, 사용자 ID',
				CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(user_id)
			);
		`)

		expect(model.tables.map((table) => table.name)).toEqual(["users", "orders"])
		expect(model.tables[1].columns.map((column) => column.name)).toEqual(["order_id", "user_id"])
		expect(model.relationships).toEqual([
			{
				fromTable: "orders",
				fromColumn: "user_id",
				toTable: "users",
				toColumn: "user_id",
			},
		])
		expect(model.tables[1].columns.find((column) => column.name === "user_id")?.isForeignKey).toBe(true)
	})
})
