/**
 * 템플릿 문자열의 플레이스홀더를 치환하는 유틸리티.
 *
 * `String.prototype.replace`에 문자열 replacement를 넘기면 `$&`, `$1`, `$$`,
 * `` $` `` 등이 특수 시퀀스로 해석된다. 치환값(사용자 입력 등)에 `$`가
 * 포함되면 의도치 않게 매치 문자열이 다시 삽입되어 결과가 손상된다.
 * 함수형 replacement를 사용하면 치환값이 항상 문자 그대로 삽입된다.
 *
 * @param content 원본 문자열
 * @param replacements 플레이스홀더 → 치환값 매핑
 * @returns 모든 플레이스홀더가 치환된 문자열
 */
export function replacePlaceholders(content: string, replacements: Record<string, string>): string {
	let result = content
	for (const [placeholder, value] of Object.entries(replacements)) {
		result = result.replace(new RegExp(placeholder, "g"), () => value ?? "")
	}
	return result
}
