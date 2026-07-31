export interface EgovSettings {
	defaultGroupId: string
	defaultArtifactId: string
	defaultPackageName: string
}

/**
 * EgovSettings에 대한 validation을 수행합니다.
 * groupId와 packageName은 점으로 구분된 각 세그먼트가 소문자로 시작하는 규칙을 따릅니다.
 */
export function validateEgovSettings(settings: Partial<EgovSettings>): string[] {
	const errors: string[] = []

	// defaultGroupId validation
	if (!settings.defaultGroupId || settings.defaultGroupId.trim() === "") {
		errors.push("Default Group ID is required")
	} else if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/.test(settings.defaultGroupId)) {
		errors.push(
			"Default Group ID must start with a lowercase letter and consist of dot-separated segments, where each segment starts with a lowercase letter and contains only lowercase letters or numbers",
		)
	}

	// defaultArtifactId validation
	if (!settings.defaultArtifactId || settings.defaultArtifactId.trim() === "") {
		errors.push("Default Artifact ID is required")
	} else if (!/^[a-z][a-z0-9-]*$/.test(settings.defaultArtifactId)) {
		errors.push(
			"Default Artifact ID must start with a lowercase letter and contain only lowercase letters, numbers, or hyphens",
		)
	}

	// defaultPackageName validation
	if (!settings.defaultPackageName || settings.defaultPackageName.trim() === "") {
		errors.push("Default Package Name is required")
	} else if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/.test(settings.defaultPackageName)) {
		errors.push(
			"Default Package Name must start with a lowercase letter and consist of dot-separated segments, where each segment starts with a lowercase letter and contains only lowercase letters or numbers",
		)
	}

	return errors
}
