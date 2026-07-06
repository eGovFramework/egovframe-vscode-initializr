/**
 * archCheck.ts
 *
 * 아키텍처 점검(Architecture Check) 결과 타입.
 *
 * 점검 로직은 src/utils/archChecker.ts에 있고, 결과 구조는 웹뷰(CheckArchView)와
 * 메시지 계약(WebviewMessage의 exportArchResults)에서도 쓰이므로 순수 타입만 이 파일에 둔다.
 */

/** 단일 파일 점검 결과 */
export interface ArchCheckResult {
	filePath: string
	fileName: string
	parentPath: string
	check1: boolean
	check2: boolean
	check3: boolean
	result: "OK" | "NotFound"
	type: "Controller" | "Service" | "DAO" | "Mapper"
}

/** 레이어(Controller/Service/DAO/Mapper)별 점검 요약 */
export interface ArchCheckSummary {
	totalFiles: number
	passedFiles: number
	failedFiles: number
	results: ArchCheckResult[]
}

/** 전체 점검 결과 — 점검한 레이어만 채워진다 */
export interface ArchCheckResults {
	Controller?: ArchCheckSummary
	Service?: ArchCheckSummary
	DAO?: ArchCheckSummary
	Mapper?: ArchCheckSummary
}
