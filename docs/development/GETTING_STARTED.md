# 개발 시작 가이드

이 문서는 저장소를 처음 받아서 확장을 실행하고 디버깅하기까지의 절차를 설명합니다. 명령과 코드 수정 규칙은 [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)에, 확장의 구조는 [ARCHITECTURE.md](../architecture/ARCHITECTURE.md)에 있습니다.

## 1. 사전 준비

| 도구 | 버전 | 비고 |
|------|------|------|
| Node.js | 22 | 저장소의 `.nvmrc`가 22를 가리킵니다. nvm을 쓰는 경우 `nvm use`로 맞춥니다. |
| npm | Node.js에 포함된 버전 | |
| Visual Studio Code | 1.84.0 이상 | |
| Git | 최신 버전 | |
| Git LFS | 최신 버전 | 프로젝트 템플릿 ZIP을 받는 데 필요합니다. |

Git LFS의 운영체제별 설치 방법은 [CONTRIBUTING.md](../../CONTRIBUTING.md)에 있습니다.

## 2. 저장소 받기

Git LFS를 먼저 설정한 뒤에 클론합니다. `templates/projects/examples/`의 ZIP 23개가 모두 Git LFS로 관리되기 때문입니다.

```bash
git lfs install
git clone https://github.com/eGovFramework/egovframe-vscode-initializr.git
cd egovframe-vscode-initializr
```

`git lfs install`보다 클론을 먼저 했다면 ZIP을 따로 받습니다.

```bash
git lfs pull
```

ZIP이 제대로 받아졌는지는 파일 크기로 확인합니다. 크기가 130바이트 안팎이면 실제 파일이 아니라 LFS 포인터입니다.

```bash
ls -lh templates/projects/examples/
```

## 3. 의존성 설치

저장소에는 npm 패키지가 두 개 있습니다. 루트는 확장 호스트이고 `webview-ui/`는 React 웹뷰입니다. 다음 명령이 두 패키지의 의존성을 모두 설치합니다.

```bash
npm run install:all
```

## 4. 확장 실행

1. VS Code로 저장소 폴더를 엽니다.
2. **F5**를 누릅니다. 기본 빌드 태스크(`watch`)가 웹뷰 빌드(`build:webview`), Vite 개발 서버(`dev:webview`), 타입 검사 감시(`watch:tsc`), esbuild 감시 빌드(`watch:esbuild`)를 실행한 뒤, **Extension Development Host** 창이 새로 열립니다.
3. 새 창의 Activity Bar에서 **eGov-Initializr** 아이콘을 클릭합니다.

Extension Development Host는 개발 중인 확장이 설치된 상태로 실행되는 별도의 VS Code 창입니다. 저장소를 연 원래 창에서는 개발 중인 확장이 보이지 않습니다.

터미널에서 직접 감시 빌드를 실행할 수도 있습니다.

```bash
npm run watch          # 확장 호스트: esbuild 감시 빌드와 tsc 타입 검사
npm run build:webview  # 웹뷰: webview-ui/build/ 에 빌드
```

### 변경 사항을 반영하는 방법

| 고친 곳 | 반영 방법 |
|---------|-----------|
| 확장 호스트 (`src/`) | 감시 빌드가 `dist/extension.js`를 다시 만듭니다. Extension Development Host에서 **Developer: Reload Window**를 실행합니다. |
| 웹뷰 (`webview-ui/src/`) | `npm run build:webview`로 다시 빌드한 뒤 **Developer: Reload Window**를 실행합니다. |
| 템플릿 (`templates/`) | 빌드가 필요하지 않습니다. 생성을 다시 실행하면 반영됩니다. |

확장의 웹뷰는 항상 `webview-ui/build/assets/`의 빌드 결과(`index.js`, `index.css`)를 불러옵니다. `watch` 태스크가 Vite 개발 서버(포트 25463)도 함께 띄우지만 그 화면은 확장의 웹뷰에 연결되지 않으므로, 웹뷰를 고친 뒤에는 반드시 다시 빌드합니다.

## 5. 디버깅

| 대상 | 방법 |
|------|------|
| 확장 호스트 | 저장소를 연 창에서 중단점을 설정하고 F5로 실행합니다. `console.log` 출력은 Debug Console에 나옵니다. |
| 활성화 기록과 거부된 메시지 | Extension Development Host에서 View → Output → **eGovFrame Initializr** 채널을 선택합니다. 생성기와 점검 엔진의 로그는 이 채널이 아니라 Debug Console에 나옵니다. |
| 웹뷰 | Extension Development Host에서 Help → Toggle Developer Tools를 열고 Console과 Elements를 확인합니다. |

웹뷰가 보낸 메시지가 스키마 검증에서 거부되면 출력 채널에 `Rejected invalid webview message`로 시작하는 줄이 남습니다. 버튼을 눌러도 반응이 없을 때 먼저 확인합니다.

## 6. 확인

코드를 고친 뒤에는 다음 명령으로 확인합니다.

```bash
npm run check-types             # 확장 호스트 타입 검사
npm run lint                    # ESLint (확장 호스트와 웹뷰)
npm run test                    # 확장 호스트 테스트
cd webview-ui && npm run test   # 웹뷰 테스트
```

커밋할 때 실행되는 훅은 코드 형식 맞춤과 `eslint --fix`만 수행하고 타입 검사는 하지 않으므로, `npm run check-types`는 직접 실행합니다. 테스트의 구성은 [TESTING_GUIDE.md](./TESTING_GUIDE.md)에 있습니다.

## 7. VSIX로 설치해서 확인

배포되는 형태 그대로 확인하려면 VSIX를 만들어 설치합니다.

```bash
npx vsce package
code --install-extension egovframe-vscode-initializr-5.1.0.vsix
```

`vsce package`는 먼저 `npm run package`(타입 검사, 웹뷰 빌드, 린트, 프로덕션 번들)를 실행합니다. 자세한 내용은 [RELEASE_GUIDE.md](../operations/RELEASE_GUIDE.md)에 있습니다.

## 자주 발생하는 문제

| 증상 | 원인과 해결 |
|------|-------------|
| 사이드바에 아이콘이 보이지 않음 | 저장소를 연 창에는 개발 중인 확장이 로드되지 않습니다. F5로 연 Extension Development Host에서 확인합니다. |
| 웹뷰가 비어 있음 | `webview-ui/build/assets/index.js`가 없는 경우입니다. `npm run build:webview`를 실행합니다. |
| 웹뷰를 고쳤는데 반영되지 않음 | 웹뷰는 빌드 결과를 불러옵니다. `npm run build:webview` 뒤에 창을 다시 불러옵니다. |
| 프로젝트 생성이 압축 해제에서 실패 | ZIP이 LFS 포인터입니다. `git lfs install`과 `git lfs pull`을 실행합니다. |
| F5를 눌러도 창이 열리지 않음 | Terminal 패널에서 `watch` 태스크의 오류를 확인합니다. 의존성이 설치되지 않았으면 `npm run install:all`을 실행합니다. |
| 타입 오류 `TS5090` | tsconfig의 `paths` 값이 상대 경로(`./src/*`)가 아닌 경우입니다. [ARCHITECTURE.md](../architecture/ARCHITECTURE.md#경로-별칭)를 참고합니다. |

Git LFS와 관련된 그 밖의 문제는 [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md#git-lfs-문제-해결)에 있습니다.

## 참고 자료

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Webview API 가이드](https://code.visualstudio.com/api/extension-guides/webview)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [표준프레임워크 포털](https://www.egovframe.go.kr)
