import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import * as Handlebars from "handlebars"
import { parseDDL } from "../../shared/ddlParser"
import { getTemplateContext } from "../../shared/templateContext"

const productDDL = `CREATE TABLE products(
  id VARCHAR(36) PRIMARY KEY COMMENT 'Product ID',
  name VARCHAR(200) NOT NULL COMMENT 'Product Name',
  price DECIMAL(10,2) NOT NULL COMMENT 'Price',
  stock_quantity INT DEFAULT 0 COMMENT 'Stock Quantity'
) COMMENT 'Product Table';`

// Mirrors the subset of registerHandlebarsHelpers in codeGeneratorUtils.ts used by these templates.
function registerTemplateHelpers() {
	Handlebars.registerHelper("eq", function (a: any, b: any) {
		return a === b
	})

	Handlebars.registerHelper("concat", function (...args: any[]) {
		return args.slice(0, -1).join("")
	})

	Handlebars.registerHelper("setVar", function (varName: any, varValue: any, options: any) {
		options.data.root[varName] = varValue
	})

	Handlebars.registerHelper("add", function (a: any, b: any) {
		return (Number(a) || 0) + (Number(b) || 0)
	})
}

function render(templateFile: string): string {
	registerTemplateHelpers()

	const { tableName, attributes, pkAttributes, dbTableName } = parseDDL(productDDL)
	const context = getTemplateContext(tableName, attributes, pkAttributes, "egovframework.example.sample", dbTableName)
	const templatePath = path.resolve(__dirname, "../../../templates/code", templateFile)

	return Handlebars.compile(fs.readFileSync(templatePath, "utf8"))(context)
}

describe("sample-thymeleaf-register.hbs", () => {
	const html = render("sample-thymeleaf-register.hbs")

	// 정의되지 않은 contextPath 변수를 참조하면 등록·수정·삭제·목록 버튼이 ReferenceError 로 멈춘다.
	it("does not reference an undefined contextPath variable", () => {
		expect(html).not.toContain("contextPath")
	})

	it("builds every form action with a Thymeleaf link expression", () => {
		expect(html).toContain(".attr('action', [[@{/products/productsList.do}]])")
		expect(html).toContain(".attr('action', [[@{/products/addProducts.do}]])")
		expect(html).toContain(".attr('action', [[@{/products/updateProducts.do}]])")
		expect(html).toContain(".attr('action', [[@{/products/deleteProducts.do}]])")
	})

	// *{{{ccName}}} 는 Handlebars 가 바깥 중괄호까지 소비해 *price 로 렌더링된다.
	it("renders th:errors as a selection expression", () => {
		expect(html).toContain(`th:errors="*{name}"`)
		expect(html).toContain(`th:errors="*{price}"`)
		expect(html).toContain(`th:errors="*{stockQuantity}"`)
		expect(html).not.toMatch(/th:errors="\*[A-Za-z]/)
	})
})

describe("sample-thymeleaf-list.hbs", () => {
	const html = render("sample-thymeleaf-list.hbs")

	// #contextPathHolder 요소는 어디에도 없어서 contextPath 가 항상 빈 문자열이 된다.
	it("does not depend on a contextPathHolder element", () => {
		expect(html).not.toContain("contextPath")
	})

	it("builds every form action with a Thymeleaf link expression", () => {
		expect(html).toContain(".attr('action', [[@{/products/productsList.do}]])")
		expect(html).toContain(".attr('action', [[@{/products/addProductsView.do}]])")
		expect(html).toContain(".attr('action', [[@{/products/updateProductsView.do}]])")
	})
})

describe("unused imports in generated Java sources", () => {
	it("does not import RequestParam in the controller", () => {
		expect(render("sample-controller-template.hbs")).not.toContain("RequestParam")
	})

	// @EgovNullCheck 사용부가 주석이므로 import 도 주석이어야 컴파일 경고가 나지 않는다.
	it("keeps the EgovNullCheck import commented out together with its usage in the VO", () => {
		const java = render("sample-vo-template.hbs")

		expect(java).not.toMatch(/^import .*EgovNullCheck;/m)
		expect(java).toMatch(/^\/\/ import org\.egovframe\.rte\.ptl\.reactive\.validation\.EgovNullCheck;/m)
	})
})
