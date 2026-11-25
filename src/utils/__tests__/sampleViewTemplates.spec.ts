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

// 문자열 · 숫자(정수/소수) · Boolean · 날짜/시간 컬럼을 모두 포함한다.
const orderDDL = `CREATE TABLE orders(
  id VARCHAR(36) PRIMARY KEY COMMENT 'Order ID',
  memo VARCHAR(200) COMMENT 'Memo',
  quantity INT DEFAULT 1 COMMENT 'Quantity',
  total_amount DECIMAL(10,2) NOT NULL COMMENT 'Total Amount',
  is_paid BOOLEAN DEFAULT FALSE COMMENT 'Paid',
  order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Order Date',
  ship_date DATE COMMENT 'Ship Date',
  ship_time TIME COMMENT 'Ship Time'
) COMMENT 'Order Table';`

function render(templateFile: string, ddl: string = productDDL): string {
	registerTemplateHelpers()

	const { tableName, attributes, pkAttributes, dbTableName } = parseDDL(ddl)
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

describe("sample-vo-template.hbs date/time fields", () => {
	const java = render("sample-vo-template.hbs", orderDDL)

	// 형식을 지정하지 않으면 브라우저의 date · datetime-local · time 입력값을 바인딩하지 못한다.
	it("annotates each date/time field with the pattern its input sends", () => {
		expect(java).toMatch(/@DateTimeFormat\(pattern = "yyyy-MM-dd'T'HH:mm"\)\s+private java\.time\.LocalDateTime orderDate;/)
		expect(java).toMatch(/@DateTimeFormat\(pattern = "yyyy-MM-dd"\)\s+private java\.time\.LocalDate shipDate;/)
		expect(java).toMatch(/@DateTimeFormat\(pattern = "HH:mm"\)\s+private java\.time\.LocalTime shipTime;/)
	})

	it("does not annotate other fields", () => {
		expect(java.match(/@DateTimeFormat\(/g)).toHaveLength(3)
	})

	it("imports DateTimeFormat only when a date/time field exists", () => {
		const importLine = "import org.springframework.format.annotation.DateTimeFormat;"

		expect(java).toContain(importLine)
		expect(render("sample-vo-template.hbs")).not.toContain("DateTimeFormat")
	})
})

describe("sample-controller-template.hbs empty input handling", () => {
	const java = render("sample-controller-template.hbs")

	// 브라우저는 비운 입력란을 빈 문자열로 보낸다. null 로 바꾸지 않으면 NULL 허용 FK · NOT NULL 문자열 컬럼에 '' 이 저장된다.
	it("converts empty strings to null with an @InitBinder", () => {
		expect(java).toContain("@InitBinder")
		expect(java).toContain("binder.registerCustomEditor(String.class, new StringTrimmerEditor(true));")
		expect(java).toContain("import org.springframework.beans.propertyeditors.StringTrimmerEditor;")
		expect(java).toContain("import org.springframework.web.bind.WebDataBinder;")
		expect(java).toContain("import org.springframework.web.bind.annotation.InitBinder;")
	})
})

describe("sample-service-impl-template.hbs missing row handling", () => {
	const java = render("sample-service-impl-template.hbs")

	// 삭제된 글의 수정 화면에 접근하면 컨트롤러가 null 을 참조해 NullPointerException 이 났다.
	it("throws info.nodata.msg when the row does not exist", () => {
		expect(java).toMatch(/if \(resultVO == null\) \{\s+throw processException\("info\.nodata\.msg"\);\s+\}/)
		expect(java).not.toMatch(/\/\/\s*(if \(resultVO == null\)|throw processException)/)
	})
})

describe("sample-thymeleaf-register.hbs typed inputs", () => {
	const html = render("sample-thymeleaf-register.hbs", orderDDL)

	it("keeps a text input for string columns", () => {
		expect(html).toMatch(/<input type="text" id="memo" name="memo"/)
	})

	it("renders number inputs with a step that matches the Java type", () => {
		expect(html).toMatch(/<input type="number" step="1" id="quantity" name="quantity"/)
		expect(html).toMatch(/<input type="number" step="any" id="totalAmount" name="totalAmount"/)
	})

	// th:field 는 VO 의 @DateTimeFormat 패턴으로 값을 출력한다 (th:value 는 toString() 결과를 그대로 쓴다).
	it("renders date/time inputs bound with th:field", () => {
		expect(html).toContain(`<input type="datetime-local" class="krds-input" th:field="*{orderDate}">`)
		expect(html).toContain(`<input type="date" class="krds-input" th:field="*{shipDate}">`)
		expect(html).toContain(`<input type="time" class="krds-input" th:field="*{shipTime}">`)
	})

	// 빈 선택지는 null 로 바인딩되어 DDL 의 DEFAULT 가 적용된다.
	it("renders a select with an empty option for Boolean columns", () => {
		const select = html.match(/<select id="isPaid"[\s\S]*?<\/select>/)?.[0] ?? ""

		expect(select).toContain(`name="isPaid"`)
		expect(select).toContain(`<option value=""></option>`)
		expect(select).toContain(`<option value="true" th:selected="\${ordersVO.isPaid == true}">true</option>`)
		expect(select).toContain(`<option value="false" th:selected="\${ordersVO.isPaid == false}">false</option>`)
		expect(html).not.toMatch(/<input[^>]*name="isPaid"/)
	})

	it("keeps the primary key as a read-only text input", () => {
		expect(html).toMatch(/<input type="text" id="id" name="id"[^>]*th:readonly="readonly">/)
	})

	it("keeps an error message for every non-key column", () => {
		for (const field of ["memo", "quantity", "totalAmount", "isPaid", "orderDate", "shipDate", "shipTime"]) {
			expect(html).toContain(`th:errors="*{${field}}"`)
		}
	})
})

describe("sample-jsp-register.hbs typed inputs", () => {
	const jsp = render("sample-jsp-register.hbs", orderDDL)

	it("keeps a plain form:input for string columns", () => {
		expect(jsp).toContain(`<form:input path="memo" cssClass="krds-input" />`)
	})

	it("renders number inputs with a step that matches the Java type", () => {
		expect(jsp).toContain(`<form:input type="number" step="1" path="quantity" cssClass="krds-input" />`)
		expect(jsp).toContain(`<form:input type="number" step="any" path="totalAmount" cssClass="krds-input" />`)
	})

	it("renders date/time inputs", () => {
		expect(jsp).toContain(`<form:input type="datetime-local" path="orderDate" cssClass="krds-input" />`)
		expect(jsp).toContain(`<form:input type="date" path="shipDate" cssClass="krds-input" />`)
		expect(jsp).toContain(`<form:input type="time" path="shipTime" cssClass="krds-input" />`)
	})

	it("renders a select with an empty option for Boolean columns", () => {
		const select = jsp.match(/<form:select path="isPaid"[\s\S]*?<\/form:select>/)?.[0] ?? ""

		expect(select).toContain(`<form:option value="" label="" />`)
		expect(select).toContain(`<form:option value="true" label="true" />`)
		expect(select).toContain(`<form:option value="false" label="false" />`)
		expect(jsp).not.toContain(`<form:input path="isPaid"`)
	})

	it("keeps an error message for every non-key column", () => {
		for (const field of ["memo", "quantity", "totalAmount", "isPaid", "orderDate", "shipDate", "shipTime"]) {
			expect(jsp).toContain(`<form:errors path="${field}" cssClass="error-message" />`)
		}
	})
})
