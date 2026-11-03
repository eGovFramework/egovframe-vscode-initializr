import * as fs from "fs"
import * as path from "path"
import { describe, expect, it } from "vitest"
import {
	DirectDependency,
	ModuleGraph,
	RUNTIME_MODULE_GRAPH,
	RuntimeGraphBranch,
	generationOfArtifactId,
	reachRequiredLibrary,
	selectGraphBranch,
	toModuleKey,
} from "../runtimeModuleGraph"

const BRANCHES: RuntimeGraphBranch[] = ["3.9.x", "3.10.x", "4.0.x", "4.1.x", "4.2.x", "4.3.x", "5.0.x", "5.1.x"]
const G = RUNTIME_MODULE_GRAPH
const dep = (key: string, exclusions: string[] = []): DirectDependency => ({ key, exclusions, evidence: key })
const sorted = (g: ModuleGraph) =>
	Object.fromEntries(
		Object.keys(g)
			.sort()
			.map((k) => [k, [...g[k]].sort()]),
	)

// fixtures/runtime-graph/graph-<branch>.txt: "artifact=" 줄의 두 번째 조각(artifactId)을 toModuleKey로 바꾸고,
// "dep " 줄 중 scope=compile optional=false이고 toModuleKey가 null이 아닌 것만 간선으로 삼는다.
// 간선이 없는 모듈도 [] 로 넣는다. artifactId가 비었거나 toModuleKey가 null인 artifact 줄은 건너뛴다.
function parseFixture(branch: RuntimeGraphBranch): ModuleGraph {
	const text = fs.readFileSync(path.join(__dirname, "fixtures/runtime-graph", `graph-${branch}.txt`), "utf8")
	const graph: ModuleGraph = {}
	let current: string | null = null
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim()
		if (line.startsWith("== ")) {
			current = null
		} else if (line.startsWith("artifact=")) {
			const artifactId = line.slice("artifact=".length).split(/\s+/)[0].split(":")[1]
			current = artifactId ? toModuleKey(artifactId) : null
			if (current && !graph[current]) {
				graph[current] = []
			}
		} else if (current && line.startsWith("dep ") && /\bscope=compile\b/.test(line) && /\boptional=false\b/.test(line)) {
			const key = toModuleKey(line.split(/\s+/)[1].split(":")[1] ?? "")
			if (key) {
				graph[current].push(key)
			}
		}
	}
	return graph
}

describe("runtimeModuleGraph", () => {
	it.each(BRANCHES)("%s 그래프 상수는 픽스처와 같다", (b) => {
		expect(sorted(RUNTIME_MODULE_GRAPH[b])).toEqual(sorted(parseFixture(b)))
	})

	it("아티팩트 이름 → 모듈 키·세대", () => {
		expect(toModuleKey("egovframework.rte.ptl.mvc")).toBe("ptl-mvc")
		expect(toModuleKey("org.egovframe.rte.psl.dataaccess")).toBe("psl-dataaccess")
		expect(toModuleKey("egovframe-rte-fdl-cmmn")).toBe("fdl-cmmn")
		expect(toModuleKey("spring-modules-validation")).toBeNull()
		expect(toModuleKey("egovframe-boot-starter-crypto")).toBeNull()
		expect(generationOfArtifactId("egovframework.rte.fdl.cmmn")).toBe("3.x")
		expect(generationOfArtifactId("org.egovframe.rte.fdl.cmmn")).toBe("4.x")
		expect(generationOfArtifactId("egovframe-rte-fdl-cmmn")).toBe("5.x")
	})

	it("브랜치 선택", () => {
		expect(selectGraphBranch("3.x", "3.9.0")).toBe("3.9.x")
		expect(selectGraphBranch("3.x")).toBe("3.10.x")
		expect(selectGraphBranch("4.x", "4.1.0")).toBe("4.1.x")
		expect(selectGraphBranch("4.x")).toBe("4.3.x")
		expect(selectGraphBranch("5.x", "5.0.2")).toBe("5.0.x")
		// 5.1.x 그래프는 베타 소스 기준이므로 버전이 5.1.으로 시작할 때만 쓰고, 버전을 모르면 정식 5.0.x를 쓴다
		expect(selectGraphBranch("5.x", "5.1.0")).toBe("5.1.x")
		expect(selectGraphBranch("5.x")).toBe("5.0.x")
	})

	it("5.1.x: AI 모듈 3개가 추가되고 필수 라이브러리 4종의 도달 경로는 5.0.x와 같다", () => {
		expect(Object.keys(G["5.1.x"]).filter((k) => !(k in G["5.0.x"]))).toEqual(["ai-core", "ai-langchain4j", "ai-springai"])
		expect(G["5.1.x"]["ai-langchain4j"]).toEqual(["ai-core"])
		expect(G["5.1.x"]["ai-springai"]).toEqual(["ai-core"])
		expect(toModuleKey("egovframe-rte-ai-core")).toBe("ai-core")
		const d = [dep("ptl-mvc"), dep("psl-dataaccess")]
		for (const target of ["ptl-mvc", "fdl-cmmn", "fdl-logging", "psl-dataaccess"]) {
			expect(reachRequiredLibrary(target, d, G["5.1.x"])).toEqual(reachRequiredLibrary(target, d, G["5.0.x"]))
		}
		for (const key of Object.keys(G["5.0.x"])) {
			expect(G["5.1.x"][key]).toEqual(G["5.0.x"][key])
		}
	})

	it("5.0.x: ptl-mvc·psl-dataaccess 직접 선언이면 cmmn·logging은 전이", () => {
		const d = [dep("ptl-mvc"), dep("psl-dataaccess")]
		expect(reachRequiredLibrary("fdl-cmmn", d, G["5.0.x"])).toEqual({ status: "transitive", via: ["ptl-mvc", "fdl-cmmn"] })
		expect(reachRequiredLibrary("fdl-logging", d, G["5.0.x"])).toEqual({
			status: "transitive",
			via: ["psl-dataaccess", "fdl-logging"],
		})
		expect(reachRequiredLibrary("ptl-mvc", d, G["5.0.x"])).toEqual({ status: "direct", via: ["ptl-mvc"] })
		expect(reachRequiredLibrary("ptl-mvc", [dep("fdl-logging")], G["5.0.x"])).toEqual({ status: "missing", via: [] })
	})

	it("exclusion은 하위 트리를 끊고(4.3.x), 다른 경로로는 다시 들어오며(5.0.x filehandling → string → logging), *는 전부 끊는다", () => {
		expect(reachRequiredLibrary("fdl-logging", [dep("ptl-mvc", ["fdl-cmmn"])], G["4.3.x"])).toEqual({
			status: "excluded",
			via: ["ptl-mvc", "fdl-cmmn", "fdl-logging"],
		})
		expect(reachRequiredLibrary("fdl-logging", [dep("ptl-mvc", ["fdl-cmmn"])], G["5.0.x"])).toEqual({
			status: "transitive",
			via: ["ptl-mvc", "fdl-filehandling", "fdl-string", "fdl-logging"],
		})
		expect(reachRequiredLibrary("fdl-logging", [dep("fdl-cmmn", ["fdl-logging"]), dep("ptl-mvc")], G["4.3.x"])).toEqual({
			status: "transitive",
			via: ["ptl-mvc", "fdl-cmmn", "fdl-logging"],
		})
		expect(reachRequiredLibrary("fdl-cmmn", [dep("ptl-mvc", ["*"])], G["4.3.x"])).toMatchObject({ status: "excluded" })
	})

	it("3.10.x·4.0.x 그래프 사실", () => {
		expect(G["3.10.x"]["psl-data-jpa"]).toEqual(["psl-dataaccess", "ptl-mvc"])
		expect(G["4.0.x"]["bat-core"]).toContain("fdl-logging")
		expect(G["4.3.x"]["bat-core"]).not.toContain("fdl-logging")
	})
})
