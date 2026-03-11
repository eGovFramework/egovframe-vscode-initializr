import { Column } from "./ddlParser"

// 템플릿 렌더링에 필요한 컨텍스트 정보를 담는 인터페이스
export interface TemplateContext {
	//namespace: string
	//resultMapId: string
	//resultMapType: string
	//parameterType: string
	//resultType: string
	tableName: string
	attributes: Column[]
	pkAttributes: Column[]
	//sortOrder: string
	//searchKeyword: string
	//searchCondition: number
	packageName: string
	className: string
	classNameFirstCharLower: string
	author: string
	date: string
	version: string
}

// 템플릿 렌더링에 필요한 컨텍스트 정보를 생성
export function getTemplateContext(
	tableName: string,
	attributes: Column[],
	pkAttributes: Column[],
	packageName: string = "egovframework.example.sample", // vscode.workspace.getConfiguration("egovframeInitializr").get<string>("defaultPackageName", "egovframework.example.sample")
): TemplateContext {
	return {
		// MyBatis 설정
		//namespace: `${packageName}.service.impl.${tableName}Mapper`, // MyBatis 네임스페이스
		//resultMapId: `${tableName[0].toLowerCase()}${tableName.slice(1)}Result`, // ResultMap ID
		//resultMapType: `${packageName}.service.${tableName}VO`, // ResultMap 타입
		//parameterType: `${packageName}.service.${tableName}VO`,      // 파라미터 타입
		//resultType: "egovMap",                                       // 결과 타입 (전자정부 표준)

		// 테이블 및 컬럼 정보
		tableName, // 테이블명
		attributes, // 전체 컬럼 정보
		pkAttributes, // 기본키 컬럼 정보

		// 검색 및 정렬 관련 기본값
		//sortOrder: pkAttributes[0]?.columnName || attributes[0]?.columnName || "", // 정렬 필드
		//searchKeyword: "",  // 검색 키워드 초기값
		//searchCondition: 0, // 검색 조건 초기값

		// Java 클래스 관련 정보
		packageName: packageName, // 패키지명
		className: tableName, // 클래스명 (테이블명과 동일)
		classNameFirstCharLower: `${tableName[0].toLowerCase()}${tableName.slice(1)}`, // 클래스명 첫 글자를 소문자로 변환

		// 메타데이터
		author: "author", // 작성자 기본값
		date: new Date().toISOString().split("T")[0], // 날짜 기본값
		version: "1.0.0", // 버전 기본값
	}
}
