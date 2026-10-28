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

/** 전체 점검 결과 — 점검한 레이어만 채워진다 */
export interface ArchCheckResults {
	Controller?: ArchCheckSummary
	Service?: ArchCheckSummary
	DAO?: ArchCheckSummary
}
