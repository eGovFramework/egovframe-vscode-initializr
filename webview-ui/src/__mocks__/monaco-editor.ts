/**
 * monaco-editor 스텁 (테스트 전용)
 *
 * monaco-editor 0.31은 package.json에 main 필드가 없어 Vitest 해석 단계에서 실패한다.
 * 에디터 자체는 테스트 대상이 아니므로 vite.config.ts의 test.alias로 이 빈 모듈을 대신 쓴다.
 */

export {}
