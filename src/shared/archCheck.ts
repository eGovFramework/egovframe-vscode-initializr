/**
 * archCheck.ts
 *
 * 아키텍처 점검(Architecture Check) 결과 타입.
 *
 * 점검 로직은 src/utils/archChecker.ts에 있고, 결과 구조는 웹뷰(CheckArchView)와
 * 메시지 계약(WebviewMessage의 exportArchResults)에서도 쓰이므로 순수 타입만 이 파일에 둔다.
 */

/** 점검 대상 레이어 */
export type ArchLayer = "Controller" | "Service" | "DAO"

/** DAO 레이어 안에서의 구현 방식 — iBatis DAO / MyBatis DAO / Mapper 인터페이스 */
export type DaoStyle = "ibatisDao" | "mybatisDao" | "mapperInterface"

/** 세부 점검 항목의 3상태 판정 — skipped는 해당 구현 방식에 적용되지 않아 건너뛴 항목 */
export type CheckState = "pass" | "fail" | "skipped"

/** eGovFrame 실행환경 세대 */
export type RuntimeGeneration = "3.x" | "4.x" | "5.x"

/** 실행환경 필수 라이브러리 4종의 모듈 키 */
export type RequiredLibraryName = "ptl-mvc" | "fdl-cmmn" | "fdl-logging" | "psl-dataaccess"

/** 단일 파일 점검 결과 */
export interface ArchCheckResult {
	filePath: string
	fileName: string
	parentPath: string
	check1: boolean
	check2: boolean
	/** DAO의 check3는 check3State !== "fail" */
	check3: boolean
	result: "OK" | "NotFound"
	/** 점검 레이어 — Mapper 레이어는 DAO로 통합(2026-10-28) */
	type: ArchLayer
	/** Controller 전용: 매핑 어노테이션이 붙은 public 메서드 수 (check2 상세 표시용) */
	mappedMethodCount?: number
	/** Controller 전용: 점검 대상 public 메서드 수 */
	methodCount?: number
	/** Controller 전용: 클래스 레벨 @RequestMapping이 있어 메서드 매핑 없이도 통과했는지 */
	hasClassLevelMapping?: boolean
	/** DAO 전용: 구현 방식 */
	daoStyle?: DaoStyle
	/** DAO 전용: check1 판정의 상세 설명 */
	check1Detail?: string
	/** DAO 전용: check2 판정의 상세 설명 */
	check2Detail?: string
	/** DAO 전용: check3의 3상태 판정 */
	check3State?: CheckState
	/** DAO 전용: check3 판정의 상세 설명 */
	check3Detail?: string
	/** DAO 전용: 경유한 중간 클래스의 단순 이름 목록 (직접 상속이면 빈 배열) */
	inheritancePath?: string[]
	/** DAO 전용: Mapper 인터페이스의 어노테이션 원문 (툴팁용, 예: '@EgovMapper("sampleMapper")') */
	annotationText?: string
}

/** 점검 대상에서 제외한 사유 */
export type SkippedReason =
	| "abstract"
	| "configuration"
	| "not-data-access"
	| "spring-data"
	| "mapstruct"
	| "base-class"
	| "not-a-class"

/** 점검 대상에서 제외된 파일 */
export interface SkippedFile {
	filePath: string
	fileName: string
	reason: SkippedReason
	detail?: string
}

/** 레이어(Controller/Service/DAO)별 점검 요약 */
export interface ArchCheckSummary {
	totalFiles: number
	passedFiles: number
	failedFiles: number
	results: ArchCheckResult[]
	/** 점검 대상에서 제외된 파일 목록 */
	skipped?: SkippedFile[]
}

/** 전체 점검 결과 — 점검한 레이어만 채워진다 (project는 빌드 파일 점검, 2단계) */
export interface ArchCheckResults {
	Controller?: ArchCheckSummary
	Service?: ArchCheckSummary
	DAO?: ArchCheckSummary
	project?: ProjectCheckSummary
}

/** 필수 라이브러리 판정 — unknown은 해석 불가(실패로 집계하지 않음) */
export type RequiredLibraryStatus = "direct" | "transitive" | "excluded" | "missing" | "unknown"

/** 실행환경 세대·버전을 정한 근거 */
export type RuntimeSource = "property" | "bom" | "dependency-version" | "artifact-pattern" | "manual" | "none"

/** 필수 라이브러리 1종의 판정 */
export interface RequiredLibraryCheck {
	name: RequiredLibraryName
	status: RequiredLibraryStatus
	/** transitive·excluded만: 직접 선언 → … → 대상 모듈 키 경로 */
	via?: string[]
	evidence: string
}

/** 빌드 파일(모듈) 1개의 점검 결과 */
export interface BuildModuleCheck {
	/** 프로젝트 루트 기준 상대 경로 (구분자 "/") */
	buildFile: string
	buildTool: "maven" | "gradle" | "gradle-kts"
	/** 집계 pom(packaging pom + modules) — 판정하지 않고 Skipped */
	aggregate: boolean
	runtime: { generation: RuntimeGeneration | "unknown"; version?: string; source: RuntimeSource; evidence: string }
	/** REQUIRED_LIBRARIES 순서로 4개 (aggregate면 []) */
	requiredLibraries: RequiredLibraryCheck[]
	result: "OK" | "NotFound" | "Unknown" | "Skipped"
	notes?: string[]
}

/** 프로젝트 빌드 점검 종합 */
export interface ProjectCheckSummary {
	generation: RuntimeGeneration | "unknown"
	version?: string
	versionConsistency: { state: CheckState; versions: string[]; evidence: string }
	modules: BuildModuleCheck[]
	result: "OK" | "NotFound" | "Unknown"
	/** 스프링 데이터 접근 설정 정보 (3단계, 정보 항목 — 판정에는 영향 없음) */
	dataAccessConfig?: DataAccessConfigInfo
	/** DAO / Mapper 수집 글롭 밖에서 데이터 접근 타입을 직접 쓰는 파일 (정보 항목) */
	unclassifiedDataAccessFiles?: UnclassifiedDataAccessFile[]
}

/** 데이터 접근 설정 항목의 종류 */
export type DataAccessConfigKind =
	| "sqlMapClientFactoryBean"
	| "sqlSessionFactoryBean"
	| "mapperConfigurer"
	| "mapperScan"
	| "mybatisStarter"
	| "mapperLocations"

/** 설정 파일(XML·Java·yml·properties·빌드 파일)에서 찾은 데이터 접근 설정 1건 — 같은 파일·같은 kind는 한 번만 */
export interface DataAccessConfigFinding {
	kind: DataAccessConfigKind
	filePath: string
	fileName: string
	evidence: string
}

/** 데이터 접근 설정 정보 — findings와 교차 경고 (판정에는 영향 없음) */
export interface DataAccessConfigInfo {
	findings: DataAccessConfigFinding[]
	warnings: string[]
}

/** DAO / Mapper 레이어로 수집되지 않았지만 데이터 접근 타입을 직접 쓰는 파일 */
export interface UnclassifiedDataAccessFile {
	filePath: string
	fileName: string
	/** 프로젝트 루트 기준 상대 경로 (구분자 "/") — 보고 행에 쓴다 */
	relativePath: string
	/** 처음 맞은 데이터 접근 타입 토큰 (예: JdbcTemplate) */
	evidence: string
}
