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
})
