# Developer Guide

## 개요

eGovFrame VSCode Initializr를 기반으로 개발하려는 개발자를 위한 기능 및 시스템 소개 문서입니다.

- 아키텍쳐 및 폴더 구조는 [ARCHITECTURE 가이드 문서](./ARCHITECTURE.md)에서 확인 가능합니다.

## 기술 스택

### Backend (Extension Host)
- **런타임**: Node.js
- **언어**: TypeScript 5.4+
- **빌드**: ESBuild 0.25+
- **템플릿 엔진**: Handlebars 4.7+
- **파일 처리**:
  - fs-extra 11.2+ (파일 시스템 유틸리티)
  - extract-zip 2.0+ (ZIP 압축 해제)
  - archiver 7.0+ (파일 압축)

### Frontend (Webview UI)
- **프레임워크**: React 18.3+
- **언어**: TypeScript 5.7+
- **빌드**: Vite 6.3+ + SWC
- **스타일링**:
  - TailwindCSS 4.1+ (유틸리티 우선 CSS)
  - VSCode CSS 변수 통합 (테마 시스템)
- **코드 에디터**:
  - Monaco Editor 0.31+ (코어)
  - @monaco-editor/react 4.7+ (React 래퍼)
  - monaco-sql-languages 0.15+ (MySQL/PostgreSQL 언어 지원)
- **UI 컴포넌트**:
  - 커스텀 React 컴포넌트 (VSCode 네이티브 스타일)
  - lucide-react 0.511+ (아이콘)
  - clsx 2.1+ (조건부 클래스명 유틸리티)
- **상태 관리**: React Context API + 커스텀 훅
- **폼 처리**: 네이티브 HTML 폼 + React 상태 관리
- **테스트**: Vitest 3.0+ + Testing Library + JSdom

### 개발 도구
- **린터**: ESLint 8.57+ + TypeScript ESLint 8.18+
- **포매터**: Prettier 3.3+
- **타입 체킹**: TypeScript (strict mode)
- **Git Hooks**: Husky 9.1+ + lint-staged 16.1+
- **패키징**: @vscode/vsce 3.6+

## UI 컴포넌트 시스템

### VSCode 테마 통합 아키텍처

프로젝트는 VSCode의 네이티브 디자인 시스템과 완전히 통합된 커스텀 React 컴포넌트 라이브러리를 구축했습니다.

#### 핵심 설계 원칙
- **네이티브 VSCode 스타일**: 모든 UI 컴포넌트가 VSCode 기본 테마와 일관성 유지
- **다크/라이트 테마 지원**: VSCode CSS 변수를 활용한 자동 테마 전환
- **타입 안전성**: 완전한 TypeScript 지원

#### 커스텀 UI 컴포넌트 라이브러리

| 컴포넌트 | 설명 | VSCode 테마 변수 |
|----------|------|------------------|
| **Button** | Primary, Secondary, Ghost 버튼 | `--vscode-button-*` |
| **TextField** | 텍스트 입력 필드 | `--vscode-input-*` |
| **TextArea** | 멀티라인 텍스트 입력 | `--vscode-input-*` |
| **Select** | 드롭다운 선택 박스 | `--vscode-input-*` |
| **RadioGroup** | 라디오 버튼 그룹 | `--vscode-checkbox-*` |
| **Checkbox** | 체크박스 입력 | `--vscode-checkbox-*` |
| **ProgressRing** | 로딩 인디케이터 | `--vscode-progressBar-*` |
| **Link** | 링크 컴포넌트 | `--vscode-textLink-*` |
| **Divider** | 구분선 | `--vscode-panel-border` |

#### VSCode 테마 변수 활용
```typescript
// 예시: Button 컴포넌트의 테마 스타일
const getButtonStyles = (variant: 'primary' | 'secondary') => ({
  backgroundColor: variant === 'primary'
    ? 'var(--vscode-button-background)'
    : 'var(--vscode-button-secondaryBackground)',
  color: variant === 'primary'
    ? 'var(--vscode-button-foreground)'
    : 'var(--vscode-button-secondaryForeground)',
  border: '1px solid var(--vscode-button-border)',
  // 호버 효과
  '&:hover': {
    backgroundColor: variant === 'primary'
      ? 'var(--vscode-button-hoverBackground)'
      : 'var(--vscode-button-secondaryHoverBackground)'
  }
})
```

#### 테마 시스템 구조
```typescript
// VSCode 테마 컨텍스트
interface VSCodeTheme {
  colors: {
    // 배경색
    background: string
    inputBackground: string
    buttonBackground: string

    // 전경색
    foreground: string
    inputForeground: string
    buttonForeground: string

    // 테두리
    inputBorder: string
    focusBorder: string
  }
  spacing: { xs: string, sm: string, md: string, lg: string }
  borderRadius: { sm: string, md: string, lg: string }
  fontSize: { xs: string, sm: string, md: string, lg: string }
}
```

#### 네이티브 HTML 엘리먼트 활용
성능 최적화와 브라우저 호환성을 위해 핵심 입력 컴포넌트들은 네이티브 HTML 엘리먼트를 직접 사용:

- **CodeView DDL TextArea**: `<textarea>` + VSCode 테마 인라인 스타일
- **Select 박스들**: `<select>` + `appearance: none` + VSCode 테마 스타일
- **모든 버튼들**: `<button>` + 동적 이벤트 핸들러

#### Monaco Editor 활용

**DDL 입력 및 코드 미리보기**에서 Monaco Editor를 사용하여 고급 편집 기능을 제공합니다.

##### 주요 기능
- **SQL 문법 강조 (Syntax Highlighting)**:
  - `monaco-sql-languages` 라이브러리를 통한 MySQL/PostgreSQL DDL 문법 강조
  - `monaco-sql-languages` 라이브러리를 통한 실시간 SQL 문법 검증 및 오류 표시
  - `monaco-sql-languages` 라이브러리를 통한 자동 완성 및 인텔리센스 지원

- **멀티 SQL 방언 지원**:
  - MySQL과 PostgreSQL DDL 문법 전환 지원
  - 각 방언별 전용 Language Worker 사용
  - 동적 언어 모드 전환

- **실시간 DDL 검증**:
  - Monaco Editor의 마커(Marker) API를 통한 실시간 오류 감지
  - 500ms 디바운스로 최적화된 검증 성능
  - Worker 기반 백그라운드 검증으로 UI 블로킹 방지

- **코드 미리보기**:
  - 생성될 코드를 Monaco Editor로 표시
  - Java, XML, JSP, HTML 등 언어별 문법 강조
  - 읽기 전용 모드로 안전한 미리보기 제공

##### 기술 구현
```typescript
// Monaco Editor 설정
import Editor, { loader } from "@monaco-editor/react"
import * as monaco from "monaco-editor"
import "monaco-sql-languages/esm/languages/mysql/mysql.contribution"
import "monaco-sql-languages/esm/languages/pgsql/pgsql.contribution"

// Worker를 Vite를 이용해 inline으로 Import
import MySQLWorker from "monaco-sql-languages/esm/languages/mysql/mysql.worker?worker&inline"
import PgSQLWorker from "monaco-sql-languages/esm/languages/pgsql/pgsql.worker?worker&inline"
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker&inline"

// 커스텀한 Monaco 설정을 등록 (@monaco-editor/react가 monaco 설정을 CDN으로 로드하여 커스텀한 Monaco 설정이 등록되지 않는 문제 방지)
loader.config({ monaco })

// Worker 설정 (Vite inline 번들링으로 CORS 문제 해결)
window.MonacoEnvironment = {
  getWorker(_: any, label: string) {
    if (label === "mysql") return new MySQLWorker()
    if (label === "pgsql") return new PgSQLWorker()
    return new EditorWorker()
  }
}

// 실시간 검증: 모델 내용이 변경될 때마다 디바운스 후 검증 (테이블 이름 변경 등 모든 변경사항 감지)
editor.onDidChangeModelContent()
// 실시간 검증: 언어 변경 시 즉시 재검증 (SQL 방언 변경: MySQL ↔ PostgreSQL)
editor.onDidChangeModelLanguage()
// 실시간 검증: Monaco Worker가 마커(에러 내용)를 업데이트할 때마다 즉시 검증
monacoInstance.editor.onDidChangeMarkers()
```

##### 성능 최적화
- **Worker 번들링**: Vite의 `?worker&inline` 플래그로 Worker를 base64 인라인 번들링
- **CORS 문제 해결**: VSCode Webview 환경에서 외부 Worker 로딩 문제 해결
- **지연 검증**: 입력 후 500ms 디바운스로 불필요한 검증 방지
- **백그라운드 처리**: Web Worker를 통한 비동기 문법 분석

## 빌드 시스템

### Extension 빌드 (ESBuild)

**설정 파일**: `esbuild.js`

#### 주요 특징
- **번들링**: 모든 소스를 단일 `dist/extension.js` 파일로 번들
- **타입스크립트 컴파일**: 네이티브 TS 지원
- **경로 별칭**: `@core`, `@utils`, `@shared` 등 단축 경로
- **감시 모드**: 개발 중 자동 리빌드
- **WASM 파일 복사**: Tree-sitter 언어 파서용

#### 빌드 명령어
```bash
# 개발 빌드 + 감시
npm run watch

# 프로덕션 빌드
npm run package

# 타입 체크
npm run check-types

# 린팅
npm run lint
```

### Webview UI 빌드 (Vite)

**설정 파일**: `webview-ui/vite.config.ts`

#### 주요 특징
- **React + SWC**: 빠른 개발 서버 및 빌드
- **TailwindCSS + VSCode 테마**: 유틸리티 우선 CSS + VSCode 네이티브 스타일
- **커스텀 UI 라이브러리**: VSCode 테마 통합 React 컴포넌트
- **HMR**: Hot Module Replacement로 빠른 개발
- **타입스크립트**: 완전한 타입 안정성 (UI 컴포넌트 포함)
- **테스트**: Vitest + JSdom 환경

#### 빌드 명령어
```bash
# 개발 서버 시작
cd webview-ui && npm run dev

# 프로덕션 빌드
cd webview-ui && npm run build

# 테스트 실행
cd webview-ui && npm run test

# 테스트 커버리지
cd webview-ui && npm run test:coverage
```

## 트러블슈팅

### 일반적인 문제들

#### 1. Extension이 활성화되지 않는 경우
```bash
# 빌드 상태 확인
npm run check-types
npm run compile

# VS Code 개발자 도구에서 오류 확인
Ctrl+Shift+I (또는 Cmd+Option+I)
```

#### 2. Webview가 로드되지 않는 경우
```bash
# Webview UI 빌드 확인
cd webview-ui
npm run build

# 개발 서버 포트 확인 (25463)
npm run dev
```

#### 3. 템플릿 생성 오류

##### 프로젝트 템플릿 생성 실패
- **ZIP 파일 문제**:
  - `templates/projects/examples/` 폴더의 ZIP 파일 존재 확인
  - Git LFS 설정 확인 (ZIP 파일이 포인터 파일이 아닌지 확인)
  - ZIP 파일 손상 여부 확인 (`unzip -t <파일명>`)
- **POM 파일 문제**:
  - `templates/projects/pom/` 폴더의 POM 템플릿 존재 확인
  - 선택한 템플릿에 맞는 POM 파일 존재 확인 (예: `egovframe-boot-web-pom.xml`)
- **출력 경로 문제**:
  - 프로젝트 생성 대상 디렉토리의 쓰기 권한 확인
  - 디스크 공간 부족 여부 확인
  - 경로에 특수문자나 한글이 포함되어 있는지 확인

##### CRUD 코드 템플릿 생성 실패
- **Handlebars 템플릿 문제**:
  - `templates/code/` 폴더의 11개 템플릿 파일 존재 확인
  - Handlebars 문법 오류 검토 (중괄호 매칭, 헬퍼 함수 등)
  - 템플릿 메타데이터: `src/utils/codeGenerator.ts`의 `getTemplateFilesConfig()` 함수 확인
- **DDL 파싱 문제**:
  - Monaco Editor의 SQL Worker가 정상 작동하는지 확인
  - `dist/tree-sitter-wasms.wasm`, `dist/tree-sitter-sql.wasm` 파일 존재 확인
  - DDL 문법이 MySQL/PostgreSQL 표준에 맞는지 확인
- **출력 경로 문제**:
  - 프로젝트 루트가 올바르게 선택되었는지 확인
  - `src/main/java/` 등 표준 Maven/Gradle 디렉토리 구조 확인
  - 패키지명이 유효한지 확인 (예: `egovframework.example.sample`)

##### 설정 템플릿 생성 실패
- **템플릿 파일 문제**:
  - `templates/config/` 폴더의 하위 디렉토리 확인 (datasource, cache, logging 등)
  - 선택한 설정 유형에 맞는 템플릿 파일 존재 확인
  - 템플릿 메타데이터: `templates/templates-context-xml.json` 파일 확인
- **Handlebars 컨텍스트 문제**:
  - 폼 입력값이 올바르게 전달되는지 확인
  - 필수 입력값 누락 여부 확인
  - 브라우저 개발자 도구의 Console에서 오류 확인

#### 4. 미리보기 기능 문제
- **미리보기가 표시되지 않는 경우**:
  - DDL 유효성 확인 (500ms 디바운스 후 즉시 검증 완료)
  - "미리보기 생성" 버튼 클릭
  - 브라우저 개발자 도구에서 오류 확인
- **미리보기가 업데이트되지 않는 경우**:
  - DDL 변경 후 자동 무효화 확인
  - 자동 업데이트 옵션 활성화 여부 확인
  - 수동으로 "미리보기 생성" 버튼 재클릭
- **미리보기 생성이 느린 경우**:
  - 11개 템플릿 병렬 렌더링 확인
  - 네트워크 상태 및 VSCode 성능 확인

### 로그 확인 방법
```bash
# Extension 로그
VS Code > View > Output(출력) > eGovFrame Initializr

# Webview 로그
VS Code > Help > Toggle Developer Tools > Console
```

### Git LFS 문제 해결

#### 큰 파일 다운로드 실패 시
```bash
# Git LFS 파일들 강제 다운로드
git lfs pull --include="*.zip"

# 특정 파일만 다운로드
git lfs pull --include="templates/projects/examples/*.zip"
```

#### Git LFS 추적 목록 확인
```bash
# LFS로 추적되는 파일 목록 확인
git lfs ls-files

# LFS 설정 확인
git lfs track
```

#### `git lfs install` 명령 실행 전에 clone 한 경우
```bash
# LFS 설정 초기화
git lfs uninstall
git lfs install

# LFS 파일들 다시 다운로드
git lfs pull
```

#### Git LFS 추적 파일들이 변경되거나 추가 시
```bash
# LFS로 추적되는 파일을 Reomte에 Push
git lfs push --all origin main

# 그 후 소스코드를 Remote에 Push 한다
git push origin main
```


## 성능 최적화

### Extension 최적화
- **지연 로딩**: `activationEvents`를 `onStartupFinished`로 설정
- **번들 크기**: ESBuild로 최소화된 번들 (~500KB)
- **메모리 관리**: Webview 인스턴스 적절한 해제
- **템플릿 처리**: Handlebars 템플릿 컴파일 최적화

### Webview UI 최적화
- **코드 분할**: Vite의 동적 import 활용
- **네이티브 HTML 엘리먼트**: 성능 최적화를 위해 textarea, select, button 직접 사용
- **VSCode CSS 변수**: 런타임 테마 전환 최적화
- **리소스 최적화**: 이미지 및 폰트 최적화
- **메모이제이션**: React.memo, useMemo, useCallback 활용
- **경량 UI 라이브러리**: Material-UI 등 제거로 번들 크기 최소화
- **Context 최적화**: 필요한 상태만 선택적으로 구독

### Monaco Editor 최적화
- **Worker 인라인 번들링**: Vite `?worker&inline`으로 CORS 문제 해결 및 로딩 속도 향상
- **지연 검증**: 입력 후 500ms 디바운스로 불필요한 검증 방지
- **백그라운드 파싱**: Web Worker를 통한 비동기 SQL 문법 분석
- **마커 기반 검증**: Monaco의 onDidChangeMarkers 이벤트로 효율적인 오류 감지
- **초기화 최적화**: Editor mount 시 100ms 지연으로 Worker 초기화 대기

### 미리보기 성능 최적화
**미리보기 기능의 성능 최적화 전략**

#### 병렬 렌더링
- `Promise.all()`을 사용하여 11개 템플릿을 병렬로 렌더링하여 11배 속도 향상

#### 지연 미리보기 (Lazy Preview)
- DDL 입력시 빠른 검증만 수행 (500ms 디바운스)
- DDL 입력시마다 모든 템플릿 미리보기 생성하는 대신(느림), 사용자가 "미리보기 생성" 버튼을 클릭할 때만 전체 미리보기 생성
- **목적**: 불필요한 리소스 사용 방지, 사용자 선택권 제공

#### 스마트 캐시 관리
- **DDL 변경 감지**: DDL이 변경되면 기존 미리보기 자동 무효화
- **선택적 자동 업데이트**: 사용자가 원할 때만 자동 미리보기 업데이트
- **디바운싱**: 500ms 디바운스로 불필요한 요청 방지
- **이벤트 최적화**: onDidChangeMarkers 등의 이벤트를 활용하여 불필요한 검증 배제

#### 성능 효과
| 작업 | 성능 최적화 적용 X | 성능 최적화 적용 O | 개선율 |
|------|------|------|--------|
| **DDL 검증** | 즉시 검증 (UI 블로킹) | 500ms 디바운스 (백그라운드) | **UI 반응성 향상** |
| **미리보기 생성** | 매번 자동 생성 | 필요시만 생성 | **선택적 생성** |
| **템플릿 렌더링** | 순차 처리 | 병렬 처리 (Promise.all) | **~11배 속도 향상** |
| **Worker 로딩** | 외부 파일 (CORS 문제) | 인라인 번들 (base64) | **로딩 안정성 향상** |

## 배포 및 퍼블리싱

### 1. Extension 패키징
```bash
# VSIX 파일 생성
npm run package # script : npm run check-types && npm run build:webview && npm run lint && node esbuild.js --production

#vscode 패키지를 전역 설치한 경우
vsce package
#vscode 패키지를 프로젝트 로컬에만 설치한 경우
npx vsce package

# 생성된 파일: egovframe-initializr-{version}.vsix
```

### 2. 마켓플레이스에 배포 및 퍼블리싱
VSCode의 [Publishing Extensions 문서](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)를 참고하시기 바랍니다.

### 3. 배포 전 체크리스트
- [ ] 모든 테스트 통과
- [ ] 린팅 오류 없음
- [ ] `package.json` 버전 업데이트
- [ ] `CHANGELOG.md` 작성
- [ ] 프로덕션 빌드 테스트
- [ ] Extension Host에서 수동 테스트

## 참고 자료

### 공식 문서
- [VS Code Extension API](https://code.visualstudio.com/api)
- [eGovFrame 공식 사이트](https://www.egovframe.go.kr)
- [Spring Framework 문서](https://spring.io/docs)

### 기술 문서
- [React 공식 문서](https://react.dev)
- [TypeScript 문서](https://www.typescriptlang.org/docs/)
- [Vite 문서](https://vitejs.dev)
- [TailwindCSS 문서](https://tailwindcss.com)
- [Handlebars 문서](https://handlebarsjs.com)

## 라이선스

이 프로젝트는 Apache-2.0 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](../LICENSE) 파일을 참조하세요.

## 개발팀

- **eGovFrame Center** - 주관 기관
- **개발자**: [기여자 목록](#)

## 지원 및 문의

- **이슈 트래킹**: [GitHub Issues](https://github.com/egovframework/egovframe-vscode-initializr/issues)
- **공식 홈페이지**: https://www.egovframe.go.kr
- **문서**: [Wiki 페이지](https://www.egovframe.go.kr/wiki/doku.php) / [GitHub Docs 페이지](https://egovframework.github.io/egovframe-docs/)