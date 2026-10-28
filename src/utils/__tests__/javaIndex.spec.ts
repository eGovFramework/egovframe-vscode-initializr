import { describe, it, expect } from "vitest"
import { buildJavaIndex, resolveTypeReference } from "../javaIndex"

describe("javaIndex", () => {
	const files: Record<string, string> = {
		"/p/a/dao/BaseDAO.java": "package a.dao;\npublic abstract class BaseDAO {}",
		"/p/b/dao/BaseDAO.java": "package b.dao;\npublic abstract class BaseDAO {}",
		"/p/a/cmmn/Only.java": "package a.cmmn;\npublic class Only {}",
		"/p/Default.java": "public class Default {}",
	}
	const index = buildJavaIndex(Object.keys(files), (p) => files[p])
	const noImports = { single: new Map<string, string>(), wildcard: [] as string[] }

	it("패키지 선언으로 FQCN을 만들고 기본 패키지는 단순 이름을 FQCN으로 쓴다", () => {
		expect(index.byFqcn.get("a.dao.BaseDAO")?.filePath).toBe("/p/a/dao/BaseDAO.java")
		expect(index.byFqcn.get("Default")?.package).toBeNull()
		expect(index.bySimpleName.get("BaseDAO")).toHaveLength(2)
	})

	it("FQCN > 단일 import > 같은 패키지 > 와일드카드 > 유일한 단순 이름 순으로 푼다", () => {
		expect(resolveTypeReference(index, { package: "x", imports: noImports }, "b.dao.BaseDAO")).toMatchObject({
			kind: "resolved",
			how: "fqcn",
			entry: { package: "b.dao" },
		})
		expect(
			resolveTypeReference(
				index,
				{ package: "a.dao", imports: { single: new Map([["BaseDAO", "b.dao"]]), wildcard: [] } },
				"BaseDAO",
			),
		).toMatchObject({ how: "single-import", entry: { package: "b.dao" } })
		expect(resolveTypeReference(index, { package: "a.dao", imports: noImports }, "BaseDAO")).toMatchObject({
			how: "same-package",
			entry: { package: "a.dao" },
		})
		expect(
			resolveTypeReference(index, { package: "x", imports: { single: new Map(), wildcard: ["b.dao"] } }, "BaseDAO"),
		).toMatchObject({ how: "wildcard-import", entry: { package: "b.dao" } })
		expect(
			resolveTypeReference(
				index,
				{ package: "x", imports: { single: new Map(), wildcard: ["a.dao", "b.dao"] } },
				"BaseDAO",
			),
		).toEqual({ kind: "unresolved", reason: "ambiguous" })
		expect(resolveTypeReference(index, { package: "x", imports: noImports }, "Only")).toMatchObject({
			how: "unique-simple-name",
		})
		expect(resolveTypeReference(index, { package: "x", imports: noImports }, "BaseDAO")).toEqual({
			kind: "unresolved",
			reason: "ambiguous",
		})
		expect(resolveTypeReference(index, { package: "x", imports: noImports }, "EgovAbstractDAO")).toEqual({
			kind: "unresolved",
			reason: "not-in-project",
		})
	})

	it("macOS의 NFD 파일 이름도 NFC simpleName으로 색인한다", () => {
		const nfdPath = `/p/${"가".normalize("NFD")}.java`
		const nfdIndex = buildJavaIndex([nfdPath], () => "package k;\npublic class 가 {}")
		const entry = nfdIndex.byFqcn.get("k.가".normalize("NFC"))
		expect(entry?.simpleName).toBe("가".normalize("NFC"))
		expect(entry?.filePath).toBe(nfdPath)
		expect(nfdIndex.bySimpleName.get("가".normalize("NFC"))).toHaveLength(1)
	})

	it("읽을 수 없는 파일은 던지지 않고 색인에서 건너뛴다", () => {
		const partial = buildJavaIndex(["/p/Bad.java", "/p/Good.java"], (p) => {
			if (p === "/p/Bad.java") {
				throw new Error("EACCES")
			}
			return "package g;\npublic class Good {}"
		})
		expect(partial.byFqcn.has("g.Good")).toBe(true)
		expect(partial.bySimpleName.has("Bad")).toBe(false)
	})

	it("같은 FQCN이 둘이면 먼저 온 항목을 유지하되 bySimpleName에는 둘 다 넣는다", () => {
		const dup = buildJavaIndex(["/p1/X.java", "/p2/X.java"], () => "package d;\nclass X {}")
		expect(dup.byFqcn.get("d.X")?.filePath).toBe("/p1/X.java")
		expect(dup.bySimpleName.get("X")).toHaveLength(2)
	})
})
