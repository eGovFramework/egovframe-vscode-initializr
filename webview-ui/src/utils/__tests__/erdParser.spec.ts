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

	it("does not mark a column as primary key when only its comment mentions primary key", () => {
		const model = parseErdModel(`
			CREATE TABLE notes (
				id INT PRIMARY KEY,
				memo VARCHAR(100) COMMENT 'not the primary key just a note'
			);
		`)

		const columns = model.tables[0].columns
		expect(columns.map((column) => column.name)).toEqual(["id", "memo"])
		expect(columns.find((column) => column.name === "id")?.isPrimaryKey).toBe(true)
		expect(columns.find((column) => column.name === "memo")?.isPrimaryKey).toBe(false)
	})

	it("does not read a table-level primary key constraint out of a column comment", () => {
		const model = parseErdModel(`
			CREATE TABLE notes (
				id INT,
				memo VARCHAR(100) COMMENT 'see primary key (id) for details',
				PRIMARY KEY (id)
			);
		`)

		const columns = model.tables[0].columns
		expect(columns.map((column) => column.name)).toEqual(["id", "memo"])
		expect(columns.find((column) => column.name === "memo")?.isPrimaryKey).toBe(false)
	})

	it("does not read a foreign key constraint out of a column comment", () => {
		const model = parseErdModel(`
			CREATE TABLE notes (
				id INT PRIMARY KEY,
				memo VARCHAR(100) COMMENT 'foreign key (id) references users(id) is defined elsewhere'
			);
		`)

		const columns = model.tables[0].columns
		expect(columns.map((column) => column.name)).toEqual(["id", "memo"])
		expect(columns.find((column) => column.name === "memo")?.isForeignKey).toBe(false)
		expect(model.relationships).toEqual([])
	})
})
