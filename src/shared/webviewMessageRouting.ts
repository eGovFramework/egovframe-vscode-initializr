/**
 * webviewMessageRouting.ts
 *
 * 웹뷰가 익스텐션 메시지를 탭 스코프별로 라우팅하기 위한 순수 유틸리티.
 *
 * 이 파일은 웹뷰(webview-ui)에서도 import 하므로 런타임 의존성을 두지 않는다.
 */

import type { WebviewScope } from "./WebviewMessage"

export type { WebviewScope }

/** 라우팅 판단에 필요한 최소 형태 */
export interface RoutableMessage {
	type?: string
	scope?: WebviewScope
	text?: string
	message?: string
}

export function getMessageText(message: RoutableMessage | null | undefined): string | undefined {
	// 과거 발신부가 text/message를 섞어 보낸 이력이 있어 두 필드를 모두 읽는다.
	if (typeof message?.text === "string" && message.text.trim() !== "") {
		return message.text
	}
	if (typeof message?.message === "string" && message.message.trim() !== "") {
		return message.message
	}
	return undefined
}

export function isMessageForScope(message: RoutableMessage | null | undefined, viewScope: WebviewScope): boolean {
	if (!message) {
		return false
	}
	if (message.scope === undefined) {
		return true
	}
	return message.scope === viewScope
}
