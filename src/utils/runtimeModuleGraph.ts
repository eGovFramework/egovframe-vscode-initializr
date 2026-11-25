/**
 * 실행환경(egovframe-runtime) 세대별 정적 모듈 의존 그래프와 전이 도달 판정.
 *
 * 순수 모듈이다: vscode와 파일 시스템을 읽지 않고 외부 라이브러리를 쓰지 않는다.
 *
 * RUNTIME_MODULE_GRAPH 출처: GitHub eGovFramework/egovframe-runtime 각 브랜치(3.9.x, 3.10.x, 4.0.x, 4.1.x, 4.2.x, 4.3.x, 5.0.x)의
 * 모듈 pom.xml에서 추출한 모듈 간 compile 의존 (추출일 2026-10-28).
 * 5.1.x는 실행환경 v5.1.0 **베타** sources jar(egovframe-rte-*-5.1.0-sources.jar)의 META-INF/maven pom.xml에서 추출했다
 * (추출일 2026-11-03). 정식 5.1.0에서 모듈 구성·의존이 바뀔 수 있으므로 정식 릴리스 뒤 다시 추출해 확인해야 한다.
 * 5.0.x와의 차이는 AI 모듈 3개(ai-core, ai-langchain4j, ai-springai)가 추가된 것뿐이고 필수 라이브러리 4종의 도달 경로는 같다.
 * 재생성 방법: 브랜치별 추출 파일(graph-<branch>.txt)을 한 줄씩 읽어
 *  - `artifact=` 줄의 두 번째 `:` 조각(artifactId)을 toModuleKey로 바꿔 모듈 키로 삼는다 (artifactId가 비었거나 키가 null이면 건너뜀)
 *  - `dep ` 줄 중 scope=compile, optional=false이고 의존 artifactId의 toModuleKey가 null이 아닌 것만 간선으로 선언 순서대로 넣는다
 *  - 간선이 없는 모듈도 빈 배열로 넣는다
 * 같은 규칙의 parseFixture가 __tests__/runtimeModuleGraph.spec.ts에 있고, 테스트가 이 상수와 픽스처(__tests__/fixtures/runtime-graph)를 비교해 고정한다.
 */
import type { RequiredLibraryName, RuntimeGeneration } from "../shared/archCheck"

export type RuntimeGraphBranch = "3.9.x" | "3.10.x" | "4.0.x" | "4.1.x" | "4.2.x" | "4.3.x" | "5.0.x" | "5.1.x"
/** 모듈 키 → compile 의존 모듈 키(실행환경 모듈만, 선언 순서) */
export type ModuleGraph = Record<string, string[]>

/** 필수 라이브러리 4종 */
export const REQUIRED_LIBRARIES: readonly RequiredLibraryName[] = ["ptl-mvc", "fdl-cmmn", "fdl-logging", "psl-dataaccess"]

export const RUNTIME_MODULE_GRAPH: Record<RuntimeGraphBranch, ModuleGraph> = {
	"3.9.x": {
		"bat-core": ["fdl-logging", "fdl-cmmn", "psl-dataaccess"],
		"fdl-access": ["fdl-logging", "fdl-property"],
		"fdl-cmmn": ["fdl-logging"],
		"fdl-crypto": ["fdl-logging", "fdl-property"],
		"fdl-excel": ["fdl-cmmn", "fdl-filehandling", "psl-dataaccess"],
		"fdl-filehandling": ["fdl-string"],
		"fdl-idgnr": ["fdl-cmmn"],
		"fdl-logging": [],
		"fdl-property": ["fdl-cmmn"],
		"fdl-security": ["fdl-string"],
		"fdl-string": ["fdl-logging"],
		"fdl-xml": ["fdl-logging"],
		"itl-integration": ["fdl-logging"],
		"itl-webservice": ["itl-integration"],
		"psl-data-jpa": ["psl-dataaccess", "ptl-mvc"],
		"psl-data-mongodb": ["fdl-cmmn"],
		"psl-dataaccess": ["fdl-logging"],
		"ptl-mvc": ["fdl-cmmn"],
	},
	"3.10.x": {
		"bat-core": ["fdl-logging", "fdl-cmmn", "psl-dataaccess"],
		"fdl-access": ["fdl-logging", "fdl-property"],
		"fdl-cmmn": ["fdl-logging"],
		"fdl-crypto": ["fdl-logging", "fdl-property"],
		"fdl-excel": ["fdl-cmmn", "fdl-filehandling", "psl-dataaccess"],
		"fdl-filehandling": ["fdl-string"],
		"fdl-idgnr": ["fdl-cmmn"],
		"fdl-logging": [],
		"fdl-property": ["fdl-cmmn"],
		"fdl-security": ["fdl-string"],
		"fdl-string": ["fdl-logging"],
		"fdl-xml": ["fdl-logging"],
		"itl-integration": ["fdl-logging"],
		"itl-webservice": ["itl-integration"],
		"psl-data-jpa": ["psl-dataaccess", "ptl-mvc"],
		"psl-data-mongodb": ["fdl-cmmn"],
		"psl-dataaccess": ["fdl-logging"],
		"ptl-mvc": ["fdl-cmmn"],
	},
	"4.0.x": {
		"bat-core": ["fdl-logging", "fdl-cmmn", "psl-dataaccess"],
		"fdl-access": ["fdl-logging", "fdl-property"],
		"fdl-cmmn": ["fdl-logging"],
		"fdl-crypto": ["fdl-logging", "fdl-property"],
		"fdl-excel": ["fdl-cmmn", "fdl-filehandling", "psl-dataaccess"],
		"fdl-filehandling": ["fdl-string"],
		"fdl-idgnr": ["fdl-cmmn"],
		"fdl-logging": [],
		"fdl-property": ["fdl-cmmn"],
		"fdl-security": ["fdl-string"],
		"fdl-string": ["fdl-logging"],
		"fdl-xml": ["fdl-logging"],
		"itl-integration": ["fdl-logging"],
		"itl-webservice": ["itl-integration"],
		"psl-data-jpa": ["psl-dataaccess", "ptl-mvc"],
		"psl-data-mongodb": ["fdl-cmmn"],
		"psl-dataaccess": ["fdl-logging"],
		"ptl-mvc": ["fdl-cmmn"],
	},
	"4.1.x": {
		"bat-core": ["fdl-logging", "fdl-cmmn", "psl-dataaccess"],
		"fdl-access": ["fdl-logging", "fdl-property"],
		"fdl-cmmn": ["fdl-logging"],
		"fdl-crypto": ["fdl-logging", "fdl-property"],
		"fdl-excel": ["fdl-cmmn", "fdl-filehandling", "psl-dataaccess"],
		"fdl-filehandling": ["fdl-string"],
		"fdl-idgnr": ["fdl-cmmn"],
		"fdl-logging": [],
		"fdl-property": ["fdl-cmmn"],
		"fdl-security": ["fdl-string"],
		"fdl-string": ["fdl-logging"],
		"fdl-xml": ["fdl-logging"],
		"itl-integration": ["fdl-logging"],
		"itl-webservice": ["itl-integration"],
		"psl-data-jpa": ["psl-dataaccess", "ptl-mvc"],
		"psl-data-mongodb": ["fdl-cmmn"],
		"psl-dataaccess": ["fdl-logging"],
		"ptl-mvc": ["fdl-cmmn"],
	},
	"4.2.x": {
		"bat-core": ["fdl-cmmn", "psl-dataaccess"],
		"fdl-access": ["fdl-property"],
		"fdl-cmmn": ["fdl-logging"],
		"fdl-crypto": ["fdl-property"],
		"fdl-excel": ["fdl-cmmn", "fdl-filehandling", "psl-dataaccess"],
		"fdl-filehandling": ["fdl-string"],
		"fdl-idgnr": ["fdl-cmmn"],
		"fdl-logging": [],
		"fdl-property": ["fdl-cmmn"],
		"fdl-reactive": [],
		"fdl-security": ["fdl-string"],
		"fdl-string": ["fdl-logging"],
		"fdl-xml": ["fdl-logging"],
		"itl-integration": ["fdl-logging"],
		"itl-webservice": ["itl-integration"],
		"psl-data-jpa": ["psl-dataaccess", "ptl-mvc"],
		"psl-data-mongodb": ["fdl-cmmn"],
		"psl-dataaccess": ["fdl-logging"],
		"psl-reactive-cassandra": [],
		"psl-reactive-mongodb": [],
		"psl-reactive-r2dbc": [],
		"psl-reactive-redis": [],
		"ptl-mvc": ["fdl-cmmn"],
		"ptl-reactive": [],
	},
	"4.3.x": {
		"bat-core": ["fdl-cmmn", "psl-dataaccess"],
		"fdl-access": ["fdl-property"],
		"fdl-cmmn": ["fdl-logging"],
		"fdl-crypto": ["fdl-property"],
		"fdl-excel": ["fdl-cmmn", "psl-dataaccess", "fdl-filehandling"],
		"fdl-filehandling": ["fdl-string"],
		"fdl-idgnr": ["fdl-cmmn"],
		"fdl-logging": [],
		"fdl-property": ["fdl-cmmn"],
		"fdl-reactive": [],
		"fdl-security": ["fdl-string"],
		"fdl-string": ["fdl-logging"],
		"fdl-xml": ["fdl-logging"],
		"itl-integration": ["fdl-logging"],
		"itl-webservice": ["itl-integration"],
		"psl-data-jpa": ["psl-dataaccess"],
		"psl-data-mongodb": ["fdl-cmmn"],
		"psl-dataaccess": ["fdl-logging"],
		"psl-reactive-cassandra": ["fdl-logging"],
		"psl-reactive-mongodb": ["fdl-logging"],
		"psl-reactive-r2dbc": ["fdl-logging"],
		"psl-reactive-redis": ["fdl-logging"],
		"ptl-mvc": ["fdl-cmmn"],
		"ptl-reactive": ["fdl-logging"],
	},
	"5.0.x": {
		"bat-core": ["fdl-cmmn", "psl-dataaccess"],
		"fdl-access": ["fdl-cmmn"],
		"fdl-cmmn": ["fdl-logging"],
		"fdl-crypto": ["fdl-property"],
		"fdl-excel": ["fdl-cmmn", "fdl-filehandling", "psl-dataaccess"],
		"fdl-filehandling": ["fdl-string"],
		"fdl-idgnr": ["fdl-cmmn"],
		"fdl-logging": [],
		"fdl-property": ["fdl-cmmn"],
		"fdl-reactive": ["fdl-logging"],
		"fdl-security": ["fdl-string"],
		"fdl-string": ["fdl-logging"],
		"fdl-xml": ["fdl-logging"],
		"itl-integration": ["fdl-logging"],
		"itl-webservice": ["itl-integration"],
		"psl-data-jpa": ["psl-dataaccess"],
		"psl-data-mongodb": ["fdl-cmmn"],
		"psl-dataaccess": ["fdl-logging"],
		"psl-reactive-cassandra": ["fdl-logging"],
		"psl-reactive-mongodb": ["fdl-cmmn"],
		"psl-reactive-r2dbc": ["fdl-cmmn"],
		"psl-reactive-redis": ["fdl-cmmn"],
		"ptl-mvc": ["fdl-cmmn", "fdl-filehandling"],
		"ptl-reactive": ["fdl-logging"],
	},
	"5.1.x": {
		"ai-core": [],
		"ai-langchain4j": ["ai-core"],
		"ai-springai": ["ai-core"],
		"bat-core": ["fdl-cmmn", "psl-dataaccess"],
		"fdl-access": ["fdl-cmmn"],
		"fdl-cmmn": ["fdl-logging"],
		"fdl-crypto": ["fdl-property"],
		"fdl-excel": ["fdl-cmmn", "fdl-filehandling", "psl-dataaccess"],
		"fdl-filehandling": ["fdl-string"],
		"fdl-idgnr": ["fdl-cmmn"],
		"fdl-logging": [],
		"fdl-property": ["fdl-cmmn"],
		"fdl-reactive": ["fdl-logging"],
		"fdl-security": ["fdl-string"],
		"fdl-string": ["fdl-logging"],
		"fdl-xml": ["fdl-logging"],
		"itl-integration": ["fdl-logging"],
		"itl-webservice": ["itl-integration"],
		"psl-data-jpa": ["psl-dataaccess"],
		"psl-data-mongodb": ["fdl-cmmn"],
		"psl-dataaccess": ["fdl-logging"],
		"psl-reactive-cassandra": ["fdl-logging"],
		"psl-reactive-mongodb": ["fdl-cmmn"],
		"psl-reactive-r2dbc": ["fdl-cmmn"],
		"psl-reactive-redis": ["fdl-cmmn"],
		"ptl-mvc": ["fdl-cmmn", "fdl-filehandling"],
		"ptl-reactive": ["fdl-logging"],
	},
}

const ARTIFACT_PREFIXES: ReadonlyArray<{ prefix: string; generation: RuntimeGeneration }> = [
	{ prefix: "egovframework.rte.", generation: "3.x" },
	{ prefix: "org.egovframe.rte.", generation: "4.x" },
	{ prefix: "egovframe-rte-", generation: "5.x" },
]

/** 실행환경 아티팩트 이름을 모듈 키로 바꾼다. 실행환경 접두어가 없으면 null (예: spring-modules-validation, egovframe-boot-starter-*) */
export function toModuleKey(artifactId: string): string | null {
	for (const { prefix } of ARTIFACT_PREFIXES) {
		if (artifactId.startsWith(prefix) && artifactId.length > prefix.length) {
			return artifactId.slice(prefix.length).replace(/\./g, "-")
		}
	}
	return null
}

/** 아티팩트 이름 접두어로 실행환경 세대를 판정한다. 접두어가 없으면 null */
export function generationOfArtifactId(artifactId: string): RuntimeGeneration | null {
	for (const { prefix, generation } of ARTIFACT_PREFIXES) {
		if (artifactId.startsWith(prefix)) {
			return generation
		}
	}
	return null
}

/**
 * 세대와 (알면) 버전으로 쓸 그래프 브랜치를 고른다.
 * 5.x는 버전이 5.1.으로 시작할 때만 5.1.x(베타 기준 그래프)를 쓰고, 버전을 모르거나 5.0.이면 정식 릴리스인 5.0.x를 쓴다
 * (4.x처럼 최신 브랜치를 기본값으로 두지 않는 이유: 5.1.x 그래프가 베타 소스에서 추출된 것이기 때문).
 */
export function selectGraphBranch(generation: RuntimeGeneration, version?: string): RuntimeGraphBranch {
	if (generation === "3.x") {
		return version?.startsWith("3.9.") ? "3.9.x" : "3.10.x"
	}
	if (generation === "4.x") {
		if (version?.startsWith("4.0.")) {
			return "4.0.x"
		}
		if (version?.startsWith("4.1.")) {
			return "4.1.x"
		}
		if (version?.startsWith("4.2.")) {
			return "4.2.x"
		}
		return "4.3.x"
	}
	return version?.startsWith("5.1.") ? "5.1.x" : "5.0.x"
}

export interface DirectDependency {
	key: string
	/** 모듈 키 또는 "*"(전부) */
	exclusions: string[]
	evidence: string
}

export interface ReachResult {
	status: "direct" | "transitive" | "excluded" | "missing"
	/** direct면 [key], transitive/excluded면 경로(직접 선언 → … → target), missing이면 [] */
	via: string[]
}

/** start에서 target까지 가장 짧은 경로. blocked에 든 키는 진입하지 않는다("*"면 start 외 아무 곳도 진입하지 않음) */
function shortestPath(start: string, target: string, graph: ModuleGraph, blocked: ReadonlySet<string>): string[] | null {
	const blockAll = blocked.has("*")
	const parent = new Map<string, string | null>([[start, null]])
	const queue: string[] = [start]
	for (let i = 0; i < queue.length; i++) {
		const node = queue[i]
		if (node === target) {
			const path: string[] = []
			let cur: string | null | undefined = node
			while (typeof cur === "string") {
				path.unshift(cur)
				cur = parent.get(cur)
			}
			return path
		}
		for (const child of graph[node] ?? []) {
			if (parent.has(child) || blockAll || blocked.has(child)) {
				continue
			}
			parent.set(child, node)
			queue.push(child)
		}
	}
	return null
}

/** 직접 선언에서 target 모듈에 도달하는지 Maven 의미론(exclusion은 그 선언 아래 하위 트리를 끊음)으로 판정한다 */
export function reachRequiredLibrary(target: string, direct: DirectDependency[], graph: ModuleGraph): ReachResult {
	if (direct.some((d) => d.key === target)) {
		return { status: "direct", via: [target] }
	}
	const best = (useExclusions: boolean): string[] | null => {
		let found: string[] | null = null
		for (const d of direct) {
			const path = shortestPath(d.key, target, graph, useExclusions ? new Set(d.exclusions) : new Set())
			if (path && (!found || path.length < found.length)) {
				found = path
			}
		}
		return found
	}
	const transitive = best(true)
	if (transitive) {
		return { status: "transitive", via: transitive }
	}
	const excluded = best(false)
	if (excluded) {
		return { status: "excluded", via: excluded }
	}
	return { status: "missing", via: [] }
}
