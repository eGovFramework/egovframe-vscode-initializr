import { ConfigFormData } from "../components/egov/types/templates"

export interface CodeConfig {
	packageName: string
	outputPath: string
}

/**
 * CodeView에서 사용되는 설정에 대한 validation을 수행합니다.
 * packageName은 점으로 구분된 각 세그먼트가 소문자로 시작하는 Java package name 규칙을 따릅니다.
 */
export function validateCodeConfig(config: Partial<CodeConfig>): string[] {
	const errors: string[] = []

	if (!config.packageName || config.packageName.trim() === "") {
		errors.push("Package name is required")
	} else if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/.test(config.packageName)) {
		errors.push(
			"Package name must start with a lowercase letter and consist of dot-separated segments, where each segment starts with a lowercase letter and contains only lowercase letters or numbers",
		)
	}

	if (!config.outputPath || config.outputPath.trim() === "") {
		errors.push("Output path is required")
	}

	return errors
}

/**
 * 문자열에 하이픈(-)과 언더스코어(_)를 제외한 특수문자가 있는지 체크합니다.
 * @param value - 검사할 문자열
 * @returns 특수문자가 있으면 true, 없으면 false
 */
export function hasSpecialCharacters(value: string): boolean {
	const specialCharPattern = /[^a-zA-Z0-9\-_]/
	return specialCharPattern.test(value)
}

/**
 * Java 패키지명 유효성을 검사합니다.
 * 패키지명은 점으로 구분된 각 세그먼트가 소문자로 시작하고, 소문자와 숫자만 포함할 수 있습니다.
 * @param packageName - 검사할 패키지명
 * @returns 에러 메시지 (유효하면 null)
 */
export function validatePackageName(packageName: string): string | null {
	if (!packageName || packageName.trim() === "") {
		return "Package name is required"
	}

	if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/.test(packageName)) {
		return "Package name must start with a lowercase letter and consist of dot-separated segments, where each segment starts with a lowercase letter and contains only lowercase letters or numbers"
	}

	return null
}

/**
 * File Name 또는 Class Name의 유효성을 검사합니다.
 * @param fileName - 검사할 파일명/클래스명
 * @param isJavaConfig - Java Config 모드인지 여부 (true면 Class Name 규칙, false면 File Name 규칙)
 * @returns 에러 메시지 (유효하면 null)
 */
export function validateFileName(fileName: string, isJavaConfig: boolean): string | null {
	if (!fileName || fileName.trim() === "") {
		return isJavaConfig ? "Class name is required" : "File name is required"
	}

	if (isJavaConfig) {
		// Java Class Name 규칙: 대문자로 시작, 영문자와 숫자만 허용 (PascalCase)
		if (!/^[A-Z][a-zA-Z0-9]*$/.test(fileName)) {
			return "Class name must start with an uppercase letter and contain only alphanumeric characters"
		}
	} else {
		// File Name 규칙: 영문자, 숫자, 하이픈(-), 언더스코어(_)만 허용
		if (hasSpecialCharacters(fileName)) {
			return "File name can only contain alphanumeric characters, hyphen (-), and underscore (_)"
		}
	}

	return null
}

/**
 * 여러 필드의 필수 입력 유효성을 한 번에 검사합니다.
 * @param fields - 검사할 필드 배열 [{ field: string, label: string }]
 * @param formData - 폼 데이터 객체
 * @returns 에러 메시지 (유효하면 null)
 */
export function validateRequiredFields(fields: Array<{ field: string; label: string }>, formData: ConfigFormData): string | null {
	// 값이 누락된 필드들을 필터링
	const missingFields = fields.filter(({ field }) => !formData[field]?.toString().trim())

	if (missingFields.length > 0) {
		const fieldNames = missingFields.map(({ label }) => label).join(", ")
		return `Please fill in the following required fields: ${fieldNames}`
	}

	return null
}

/**
 * 여러 필드의 특수문자 유효성을 한 번에 검사합니다.
 * 영문자, 숫자, 하이픈(-), 언더스코어(_)만 허용됩니다.
 * @param fields - 검사할 필드 배열 [{ field: string, label: string }]
 * @param formData - 폼 데이터 객체
 * @returns 에러 메시지 (유효하면 null)
 */
export function validateSpecialCharacters(
	fields: Array<{ field: string; label: string }>,
	formData: ConfigFormData,
): string | null {
	// 허용되지 않는 특수문자가 있는 필드들을 필터링
	const invalidFields = fields.filter(({ field }) => {
		const value = formData[field]

		// 빈 값은 제외 (필수 체크는 별도로 수행)
		if (!value || value.toString().trim() === "") {
			return false
		}

		return hasSpecialCharacters(value.toString())
	})

	if (invalidFields.length > 0) {
		const fieldNames = invalidFields.map(({ label }) => label).join(", ")
		return `The following fields must contain only alphanumeric characters, hyphen (-), and underscore (_): ${fieldNames}.`
	}

	return null
}

/**
 * 여러 필드의 숫자 유효성을 한 번에 검사합니다.
 * 숫자만 허용됩니다.
 * @param fields - 검사할 필드 배열 [{ field: string, label: string }]
 * @param formData - 폼 데이터 객체
 * @returns 에러 메시지 (유효하면 null)
 */
export function validateNumber(fields: Array<{ field: string; label: string }>, formData: ConfigFormData): string | null {
	// 숫자가 아닌 필드들을 필터링
	const invalidFields = fields.filter(({ field }) => {
		const value = formData[field]

		// 빈 값은 제외 (필수 체크는 별도로 수행)
		if (!value || value.toString().trim() === "") {
			return false
		}

		// 숫자인지 확인 (숫자가 아니면 true 반환)
		return isNaN(Number(value.toString()))
	})

	if (invalidFields.length > 0) {
		const fieldNames = invalidFields.map(({ label }) => label).join(", ")
		return `The following fields must contain only numeric values: ${fieldNames}`
	}

	return null
}
