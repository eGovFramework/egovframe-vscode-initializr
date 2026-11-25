import { describe, it, expect } from "vitest"
import {
	collectImports,
	findTypeDeclaration,
	hasToken,
	packageOf,
	readPackage,
	simpleNameOf,
	stripJavaComments,
} from "../javaSource"

describe("stripJavaComments", () => {
	it("블록·줄 주석을 지우고 문자열 리터럴 안의 // 와 /* 는 남기며 줄 수를 유지한다", () => {
		const src = `package a; // c\n/* x\n y */ String s = "http://h/*k*/"; char c = '/';\n`
		const out = stripJavaComments(src)
		expect(out.split("\n")).toHaveLength(src.split("\n").length)
		expect(out).not.toContain("// c")
		expect(out).not.toContain("x")
		expect(out).toContain(`"http://h/*k*/"`)
		expect(out).toContain("'/'")
	})
	it("UTF-8 BOM과 CRLF를 처리한다", () => {
		const out = stripJavaComments(String.fromCharCode(0xfeff) + "package a.b;\r\nimport x.Y;\r\n")
		expect(readPackage(out)).toBe("a.b")
		expect(collectImports(out).single.get("Y")).toBe("x")
	})

	// 브리프 밖 보강: 구현이 가르는 경계 입력
	it("선행 BOM을 실제로 지운다 (\\s가 BOM에도 매치되므로 읽기 결과만으로는 알 수 없다)", () => {
		const out = stripJavaComments(String.fromCharCode(0xfeff) + "package a;")
		expect(out).toBe("package a;")
	})
	it("이스케이프된 따옴표를 문자열의 끝으로 보지 않고, 문자열 뒤의 줄 주석은 지운다", () => {
		const out = stripJavaComments(`String s = "a\\"b // not"; // real\n`)
		expect(out).toContain(`"a\\"b // not"`)
		expect(out).not.toContain("real")
	})
	it("문자 리터럴 안의 따옴표와 이스케이프를 리터럴로 읽는다", () => {
		const out = stripJavaComments(`char a = '"'; char b = '\\''; // c\n`)
		expect(out).toContain(`'"'`)
		expect(out).toContain(`'\\''`)
		expect(out).not.toContain("// c")
	})
	it("닫히지 않은 블록 주석은 끝까지 지우고 줄 수를 유지한다", () => {
		const out = stripJavaComments("int a; /* b\n c\n d")
		expect(out.split("\n")).toHaveLength(3)
		expect(out.trim()).toBe("int a;")
	})
	it("CRLF 줄바꿈을 그대로 두어 줄 수를 유지한다", () => {
		const src = "a; // x\r\n/* y\r\n z */ b;\r\n"
		const out = stripJavaComments(src)
		expect(out.split("\r\n")).toHaveLength(src.split("\r\n").length)
		expect(out).not.toMatch(/[xyz]/)
	})
	it("\\r만으로 끝나는 줄에서도 줄 주석이 거기서 끝난다", () => {
		expect(stripJavaComments("a // c\rb")).toBe("a     \rb")
	})
})
describe("readPackage", () => {
	it("선언이 없으면(기본 패키지) null이고, 본문 문자열 안의 package는 보지 않는다", () => {
		expect(readPackage(stripJavaComments("class A {}"))).toBeNull()
		expect(readPackage(stripJavaComments(`class A { String s = "package x.y;"; }`))).toBeNull()
	})
	it("주석과 공백이 섞인 선언도 읽는다", () => {
		expect(readPackage(stripJavaComments("/* license */\npackage  a .b ;\nclass A {}"))).toBe("a.b")
	})
})
describe("collectImports", () => {
	it("단일·와일드카드·여러 줄 import를 모으고 static import는 뺀다", () => {
		const imp = collectImports(stripJavaComments(`import a.b.C;\nimport a.b.*;\nimport\n  d.e.F;\nimport static g.H.i;\n`))
		expect([...imp.single]).toEqual([
			["C", "a.b"],
			["F", "d.e"],
		])
		expect(imp.wildcard).toEqual(["a.b"])
	})

	// 브리프 밖 보강
	it("static 와일드카드 import도 뺀다", () => {
		const imp = collectImports(stripJavaComments(`import static a.B.*;\nimport c.D;\n`))
		expect([...imp.single]).toEqual([["D", "c"]])
		expect(imp.wildcard).toEqual([])
	})
	it("본문 문자열 안의 import와 첫 타입 선언 뒤의 글자는 모으지 않는다", () => {
		const imp = collectImports(stripJavaComments(`import a.B;\nclass X { String s = "import evil.Y;"; }\nimport c.D;\n`))
		expect([...imp.single]).toEqual([["B", "a"]])
	})
	it("같은 와일드카드를 중복으로 담지 않고, 주석·세미콜론이 끼어도 읽는다", () => {
		const imp = collectImports(stripJavaComments(`package p;;\nimport /* c */ a.b.*;\nimport a.b.*;\nimport x.Y;\n`))
		expect(imp.wildcard).toEqual(["a.b"])
		expect([...imp.single]).toEqual([["Y", "x"]])
	})
})
describe("findTypeDeclaration", () => {
	it("파일 이름과 같은 타입의 선언부를 읽는다 (앞에 다른 최상위 클래스가 있어도)", () => {
		const d = findTypeDeclaration(
			stripJavaComments(
				`class Helper extends Object {}\n@Repository("userDAO") @Transactional\npublic class UserDAO<T> extends a.b.BaseDAO<T> implements Serializable, UserRepo {}`,
			),
			"UserDAO",
		)
		expect(d).toEqual({
			kind: "class",
			name: "UserDAO",
			isAbstract: false,
			annotations: ['@Repository("userDAO")', "@Transactional"],
			extendsNames: ["a.b.BaseDAO"],
			implementsNames: ["Serializable", "UserRepo"],
		})
	})
	it("extends가 다음 줄에 있어도, 메서드의 제네릭 바운드는 보지 않고 읽는다", () => {
		const d = findTypeDeclaration(
			stripJavaComments(
				`public abstract class BaseDAO\n\textends EgovAbstractDAO {\n\tpublic <T extends Serializable> T get() { return null; }\n}`,
			),
			"BaseDAO",
		)
		expect(d).toMatchObject({ isAbstract: true, extendsNames: ["EgovAbstractDAO"] })
	})
	it("interface·enum·record·@interface를 구분하고 interface의 extends 여러 개를 읽는다", () => {
		expect(findTypeDeclaration("@Mapper public interface UserMapper extends Base1, Base2<X> {}", "UserMapper")).toMatchObject(
			{ kind: "interface", annotations: ["@Mapper"], extendsNames: ["Base1", "Base2"] },
		)
		expect(findTypeDeclaration("public enum Color { RED }", "Color")?.kind).toBe("enum")
		expect(findTypeDeclaration("public record Point(int x) {}", "Point")?.kind).toBe("record")
		expect(findTypeDeclaration("public @interface Marker {}", "Marker")?.kind).toBe("annotation")
		expect(findTypeDeclaration("public class Other {}", "Missing")).toBeNull()
	})
	it("FQCN 어노테이션과 한 줄 다중 어노테이션을 원문 그대로 둔다", () => {
		const d = findTypeDeclaration(
			`@org.egovframe.rte.psl.dataaccess.mapper.EgovMapper("m") @SuppressWarnings({"a","b"}) public interface M {}`,
			"M",
		)
		expect(d?.annotations).toEqual([
			'@org.egovframe.rte.psl.dataaccess.mapper.EgovMapper("m")',
			'@SuppressWarnings({"a","b"})',
		])
	})

	// 브리프 밖 보강
	it("어노테이션 인자의 문자열 안에 괄호·중괄호·class가 있어도 선언 직전 블록을 잘못 끊지 않는다", () => {
		const d = findTypeDeclaration(`class Prev {}\n@Doc("class X {") @Foo("})") @Bar\npublic class X {}`, "X")
		expect(d).toMatchObject({ kind: "class", annotations: ['@Doc("class X {")', '@Foo("})")', "@Bar"] })
	})
	it("abstract는 선언 직전 블록에서만 보고 어노테이션 인자의 문자열은 보지 않는다", () => {
		expect(findTypeDeclaration(`@Foo("abstract") public class X {}`, "X")?.isAbstract).toBe(false)
	})
	it("제네릭 바운드와 중첩 제네릭의 쉼표에 속지 않는다", () => {
		expect(findTypeDeclaration("class A<T extends Foo & Bar<T>> extends B<T> implements C<T>, D {}", "A")).toMatchObject({
			extendsNames: ["B"],
			implementsNames: ["C", "D"],
		})
		expect(findTypeDeclaration("interface I extends A<B<C, D>>, E {}", "I")).toMatchObject({ extendsNames: ["A", "E"] })
	})
	it("record 컴포넌트·enum·permits가 있어도 extends·implements 목록만 읽는다", () => {
		expect(findTypeDeclaration("record P(@Foo({1,2}) int x, String y) implements Q, R<S> {}", "P")).toMatchObject({
			kind: "record",
			implementsNames: ["Q", "R"],
		})
		expect(findTypeDeclaration("enum E implements A, B { X, Y }", "E")).toMatchObject({
			kind: "enum",
			implementsNames: ["A", "B"],
		})
		expect(findTypeDeclaration("sealed interface Shape extends Base permits Circle, Square {}", "Shape")).toMatchObject({
			extendsNames: ["Base"],
			implementsNames: [],
		})
	})
	it("이름이 접두사만 같은 다른 타입에는 매치하지 않는다", () => {
		expect(findTypeDeclaration("public class UserDAOImpl {}", "UserDAO")).toBeNull()
	})
	it("선언 키워드가 다른 식별자의 끝부분일 때는 선언으로 보지 않는다", () => {
		expect(findTypeDeclaration("public subclass X {}", "X")).toBeNull()
	})
	it("@interface는 앞 토큰에 붙어 있어도 annotation으로 읽는다", () => {
		expect(findTypeDeclaration("@Retention(RUNTIME)public@interface M {}", "M")).toMatchObject({
			kind: "annotation",
			annotations: ["@Retention(RUNTIME)"],
		})
	})
	it("CRLF로 줄이 나뉜 어노테이션과 extends·implements를 읽는다", () => {
		const src =
			"@Service\r\n@Transactional(\r\n\treadOnly = true\r\n)\r\npublic class S\r\n\textends Base\r\n\timplements I {\r\n}\r\n"
		expect(findTypeDeclaration(stripJavaComments(src), "S")).toMatchObject({
			annotations: ["@Service", "@Transactional( readOnly = true )"],
			extendsNames: ["Base"],
			implementsNames: ["I"],
		})
	})
})
describe("hasToken", () => {
	it("토큰 경계를 지킨다", () => {
		expect(hasToken("@RepositoryRestResource class A {}", "@Repository")).toBe(false)
		expect(hasToken("@Repository\nclass A {}", "@Repository")).toBe(true)
		expect(hasToken('@MapperScan(basePackages = "x")', "@Mapper")).toBe(false)
	})

	// 브리프 밖 보강
	it("식별자 문자로 시작하는 토큰은 앞 경계도 지킨다", () => {
		expect(hasToken("class MyRepository {}", "Repository")).toBe(false)
		expect(hasToken("class A extends Repository {}", "Repository")).toBe(true)
	})
})
describe("packageOf / simpleNameOf", () => {
	it("점으로 이은 이름에서 패키지와 단순 이름을 나누고 제네릭 인자는 뗀다", () => {
		expect(packageOf("a.b.C")).toBe("a.b")
		expect(packageOf("C")).toBeNull()
		expect(packageOf("a.b.C<x.Y>")).toBe("a.b")
		expect(simpleNameOf("a.b.C<T>")).toBe("C")
		expect(simpleNameOf("C")).toBe("C")
	})
})
