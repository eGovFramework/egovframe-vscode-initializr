# eGovFrame VS Code Extension 개발 시작 가이드

이 문서는 eGovFrame VS Code Extension을 처음 개발하는 분들을 위한 가이드입니다.

## 목차

1. [사전 준비](#1-사전-준비)
2. [프로젝트 구조 이해](#2-프로젝트-구조-이해)
3. [개발 환경 설정](#3-개발-환경-설정)
4. [Extension 실행 및 디버깅](#4-extension-실행-및-디버깅)
5. [주요 개념](#5-주요-개념)
6. [빌드 및 패키징](#6-빌드-및-패키징)
7. [자주 발생하는 문제](#7-자주-발생하는-문제)

---

## 1. 사전 준비

### 필수 설치 항목

| 도구 | 버전 | 설치 방법 |
|------|------|----------|
| **Node.js** | 20.x 이상 | [nodejs.org](https://nodejs.org) |
| **VS Code** | 1.84.0 이상 | [code.visualstudio.com](https://code.visualstudio.com) |
| **Git** | 최신 버전 | [git-scm.com](https://git-scm.com) |
| **Git LFS** | 최신 버전 | `brew install git-lfs` (macOS) |

### Node.js 버전 확인

```bash
node --version  # v20.x.x 이상
npm --version   # 10.x.x 이상
```

---

## 2. 프로젝트 구조 이해

```
egovframe-vscode-initializr/
├── src/                    # Extension 백엔드 (Node.js)
│   ├── extension.ts        # Extension 진입점 (activate/deactivate)
│   ├── core/               # 핵심 로직
│   │   ├── webview/        # Webview Provider
│   │   └── controller/     # 메시지 처리
│   └── utils/              # 유틸리티 함수
├── webview-ui/             # Extension 프론트엔드 (React)
│   ├── src/
│   │   ├── App.tsx         # React 앱 진입점
│   │   ├── components/     # React 컴포넌트
│   │   └── i18n/           # 다국어 지원
│   └── build/              # 빌드 결과물
├── templates/              # 프로젝트/코드 템플릿
├── assets/                 # 아이콘 등 리소스
├── .vscode/                # VS Code 설정
│   ├── launch.json         # 디버깅 설정
│   └── tasks.json          # 빌드 태스크
├── package.json            # Extension 매니페스트 + npm 설정
├── esbuild.js              # Extension 빌드 설정
└── tsconfig.json           # TypeScript 설정
```

### 핵심 파일 설명

| 파일 | 역할 |
|------|------|
| `package.json` | Extension 메타데이터, 명령어, 뷰, 설정 정의 |
| `src/extension.ts` | Extension 활성화/비활성화 로직 |
| `src/core/webview/index.ts` | Webview 생성 및 관리 |
| `webview-ui/src/App.tsx` | React UI 메인 컴포넌트 |

---

## 3. 개발 환경 설정

### 3.1 프로젝트 클론 및 의존성 설치

```bash
# 1. 저장소 클론
git clone https://github.com/eGovFramework/egovframe-vscode-initializr.git
cd egovframe-vscode-initializr

# 2. Git LFS 설정 (ZIP 템플릿 파일 다운로드)
git lfs install
git lfs pull

# 3. 전체 의존성 설치 (루트 + webview-ui)
npm run install:all
```

### 3.2 개발 서버 실행

**터미널 2개**가 필요합니다:

```bash
# 터미널 1: Extension 백엔드 감시 빌드
npm run watch

# 터미널 2: Webview UI 개발 서버
npm run dev:webview
```

### 주요 npm 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run install:all` | 루트 + webview-ui 의존성 설치 |
| `npm run watch` | Extension 백엔드 감시 빌드 |
| `npm run dev:webview` | Webview UI 개발 서버 (HMR) |
| `npm run build:webview` | Webview UI 프로덕션 빌드 |
| `npm run compile` | 타입체크 + 린트 + 빌드 |
| `npm run package` | 프로덕션 빌드 (배포용) |
| `npm run lint` | ESLint 실행 |
| `npm run format:fix` | Prettier 코드 포맷팅 |

---

## 4. Extension 실행 및 디버깅

### 4.1 F5 디버깅 (권장)

1. VS Code에서 프로젝트 폴더 열기
2. 개발 서버 실행 (`npm run watch` + `npm run dev:webview`)
3. **F5** 키 누르기
4. **Extension Development Host** 창이 새로 열림
5. 왼쪽 사이드바에서 eGovFrame 아이콘 클릭

### 4.2 Extension Development Host란?

- Extension 테스트용 **별도의 VS Code 인스턴스**
- 개발 중인 Extension이 설치된 상태로 실행됨
- 일반 VS Code 창에서는 개발 중인 Extension이 보이지 않음

### 4.3 디버깅 팁

```bash
# Extension 로그 확인
View > Output > "eGovFrame Initializr" 선택

# Webview 개발자 도구
Help > Toggle Developer Tools > Console
```

### 4.4 VSIX 패키지로 설치 테스트

F5가 작동하지 않을 때 사용:

```bash
# 1. VSIX 패키지 생성
npx vsce package

# 2. 생성된 파일 설치
code --install-extension egovframe-vscode-initializr-5.0.2.vsix

# 또는 VS Code에서:
# Cmd+Shift+P > "Extensions: Install from VSIX..." > 파일 선택
```

---

## 5. 주요 개념

### 5.1 Extension 구조

```
┌─────────────────────────────────────────────────────────┐
│                    VS Code                               │
├─────────────────────────────────────────────────────────┤
│  Extension Host (Node.js)    │  Webview (브라우저 환경)   │
│  ├── extension.ts            │  ├── React App            │
│  ├── WebviewProvider         │  ├── HTML/CSS/JS          │
│  └── 파일 시스템 접근 가능    │  └── 파일 시스템 접근 불가  │
├─────────────────────────────────────────────────────────┤
│              postMessage() 로 양방향 통신                 │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Extension ↔ Webview 통신

**Extension → Webview:**
```typescript
// Extension 측 (src/core/controller/index.ts)
this.webview.postMessage({ type: "projectTemplates", templates: [...] })
```

**Webview → Extension:**
```typescript
// Webview 측 (webview-ui/src/utils/vscode.ts)
vscode.postMessage({ type: "getProjectTemplates" })
```

**Webview에서 메시지 수신:**
```typescript
// Webview 측
window.addEventListener("message", (event) => {
  const message = event.data
  if (message.type === "projectTemplates") {
    // 처리
  }
})
```

### 5.3 package.json 주요 설정

```json
{
  "activationEvents": ["onStartupFinished"],  // 언제 Extension 활성화?
  "main": "./dist/extension.js",              // 진입점
  "contributes": {
    "viewsContainers": {                      // 사이드바 아이콘
      "activitybar": [...]
    },
    "views": {                                // Webview 등록
      "egovframe-ActivityBar": [...]
    },
    "commands": [...],                        // 명령어 등록
    "configuration": {...}                    // 설정 항목
  }
}
```

### 5.4 Webview UI 개발

- **프레임워크**: React 18 + TypeScript
- **빌드 도구**: Vite
- **스타일링**: TailwindCSS + VS Code 테마 변수
- **상태 관리**: React Context

**VS Code 테마 변수 사용 예시:**
```css
background-color: var(--vscode-input-background);
color: var(--vscode-foreground);
border: 1px solid var(--vscode-panel-border);
```

---

## 6. 빌드 및 패키징

### 6.1 개발 빌드

```bash
# Webview UI만 빌드
npm run build:webview

# Extension 전체 빌드
npm run compile
```

### 6.2 프로덕션 빌드 및 패키징

```bash
# 1. 프로덕션 빌드
npm run package

# 2. VSIX 패키지 생성
npx vsce package

# 결과: egovframe-vscode-initializr-{version}.vsix
```

### 6.3 빌드 결과물

| 경로 | 설명 |
|------|------|
| `dist/extension.js` | Extension 백엔드 번들 |
| `webview-ui/build/` | Webview UI 번들 |
| `*.vsix` | 배포용 패키지 |

---

## 7. 자주 발생하는 문제

### Q1. 사이드바에 아이콘이 안 보여요

**원인**: 일반 VS Code 창에서는 개발 중인 Extension이 로드되지 않음

**해결**:
1. F5로 Extension Development Host 실행
2. 또는 VSIX 패키지로 설치

### Q2. F5 눌러도 아무 반응이 없어요

**확인 사항**:
1. `npm run watch` 실행 중인지 확인
2. `.vscode/launch.json` 파일 존재 확인
3. Output 패널에서 에러 확인

### Q3. `Invalid problemMatcher reference: $esbuild-watch` 에러

**원인**: VS Code에 `$esbuild-watch` problemMatcher가 없음

**해결**: `.vscode/tasks.json`에서 커스텀 problemMatcher로 교체 (이미 수정됨)

### Q4. Webview 변경사항이 반영 안 돼요

**해결**:
```bash
# Webview UI 다시 빌드
npm run build:webview

# 그 다음 F5로 재실행 또는 VSIX 재설치
```

### Q5. Git LFS 파일이 다운로드 안 돼요

```bash
git lfs install
git lfs pull
```

### Q6. 타입 에러가 발생해요

```bash
# 타입 체크
npm run check-types

# 린트 확인
npm run lint
```

---

## 추가 리소스

- [VS Code Extension API 공식 문서](https://code.visualstudio.com/api)
- [Webview API 가이드](https://code.visualstudio.com/api/extension-guides/webview)
- [Extension 배포 가이드](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [eGovFrame 공식 사이트](https://www.egovframe.go.kr)

---

## 빠른 시작 요약

```bash
# 1. 클론 및 설정
git clone https://github.com/eGovFramework/egovframe-vscode-initializr.git
cd egovframe-vscode-initializr
git lfs install && git lfs pull

# 2. 의존성 설치
npm run install:all

# 3. 개발 서버 시작 (터미널 2개)
npm run watch          # 터미널 1
npm run dev:webview    # 터미널 2

# 4. VS Code에서 F5 눌러서 Extension 실행
```
