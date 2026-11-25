// CRUD 코드 템플릿(.hbs)별 출력 경로·파일명·미리보기 언어 설정
// vscode 에 의존하지 않으므로 단위 테스트에서 직접 불러올 수 있다.

// Template file mapping
export interface TemplateFileInfo {
	templateFile: string
	outputPath: string
	fileName: string
	// 미리보기/에디터를 위한 추천 언어 정보 (Monaco Editor language id)
	language?: string
}

// egovframe-web / egovframe-boot-web 프로젝트 템플릿이 실제로 읽는 위치.
// 매퍼 XML 은 mapperLocations(classpath:/egovframework/sqlmap/example/mappers/*.xml),
// JSP 는 뷰 리졸버 접두어(/WEB-INF/jsp/egovframework/example/) 아래에 있어야 생성 직후 동작한다.
// 두 위치 모두 패키지명과 무관하게 고정되어 있다.
const WEB_TEMPLATE_MAPPER_DIR = "src/main/resources/egovframework/sqlmap/example/mappers"
const WEB_TEMPLATE_JSP_DIR = "src/main/webapp/WEB-INF/jsp/egovframework/example"

// Get template files configuration
// 고정된 값이 아니어서 다른 기능들의 환경설정 파일과 달리 templates 폴더 안에 json 파일로 넣기 어려움
export function getTemplateFilesConfig(context: { tableName: string; packagePath: string }): TemplateFileInfo[] {
	const { tableName, packagePath } = context

	const tableNameCamelCase = tableName[0]?.toLowerCase() + tableName?.slice(1)

	return [
		{
			templateFile: "sample-vo-template.hbs",
			outputPath: `src/main/java/${packagePath}/service/${tableName}VO.java`,
			fileName: `${tableName}VO.java`,
			language: "java",
		},
		{
			templateFile: "sample-default-vo-template.hbs",
			outputPath: `src/main/java/${packagePath}/service/${tableName}DefaultVO.java`,
			fileName: `${tableName}DefaultVO.java`,
			language: "java",
		},
		{
			templateFile: "sample-controller-template.hbs",
			outputPath: `src/main/java/${packagePath}/web/${tableName}Controller.java`,
			fileName: `${tableName}Controller.java`,
			language: "java",
		},
		{
			templateFile: "sample-service-template.hbs",
			outputPath: `src/main/java/${packagePath}/service/${tableName}Service.java`,
			fileName: `${tableName}Service.java`,
			language: "java",
		},
		{
			templateFile: "sample-service-impl-template.hbs",
			outputPath: `src/main/java/${packagePath}/service/impl/${tableName}ServiceImpl.java`,
			fileName: `${tableName}ServiceImpl.java`,
			language: "java",
		},
		{
			templateFile: "sample-mapper-interface-template.hbs",
			outputPath: `src/main/java/${packagePath}/service/impl/${tableName}Mapper.java`,
			fileName: `${tableName}Mapper.java`,
			language: "java",
		},
		{
			templateFile: "sample-mapper-template.hbs",
			outputPath: `${WEB_TEMPLATE_MAPPER_DIR}/${tableName}_SQL.xml`,
			fileName: `${tableName}_SQL.xml`,
			language: "xml",
		},
		{
			templateFile: "sample-thymeleaf-list.hbs",
			outputPath: `src/main/resources/templates/thymeleaf/${tableNameCamelCase}/${tableNameCamelCase}List.html`,
			fileName: `${tableNameCamelCase}List.html`,
			language: "html",
		},
		{
			templateFile: "sample-thymeleaf-register.hbs",
			outputPath: `src/main/resources/templates/thymeleaf/${tableNameCamelCase}/${tableNameCamelCase}Register.html`,
			fileName: `${tableNameCamelCase}Register.html`,
			language: "html",
		},
		{
			templateFile: "sample-jsp-list.hbs",
			outputPath: `${WEB_TEMPLATE_JSP_DIR}/${tableNameCamelCase}/${tableNameCamelCase}List.jsp`,
			fileName: `${tableNameCamelCase}List.jsp`,
			language: "html",
		},
		{
			templateFile: "sample-jsp-register.hbs",
			outputPath: `${WEB_TEMPLATE_JSP_DIR}/${tableNameCamelCase}/${tableNameCamelCase}Register.jsp`,
			fileName: `${tableNameCamelCase}Register.jsp`,
			language: "html",
		},
	]
}
