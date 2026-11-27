# 패키징과 릴리스 가이드

이 문서는 배포 파일(`egovframe-vscode-initializr-<버전>.vsix`)을 만들고 점검하는 방법, 프로젝트 템플릿과 매니페스트를 갱신하는 방법, 릴리스 절차를 설명합니다. 만들어진 VSIX를 설치하는 방법은 [설치와 설정 가이드](../setup/INSTALLATION_GUIDE.md)에 있습니다.

## 배포 파일의 구성

배포 파일은 `vsce package`가 만드는 VSIX입니다. 다음 내용이 들어가야 합니다.

| 경로 | 내용 |
|------|------|
| `dist/extension.js` | 확장 호스트의 프로덕션 번들. 런타임 의존성(`handlebars`, `adm-zip`, `fs-extra`, `zod`)이 포함되어 있어 `node_modules`는 들어가지 않습니다. |
| `webview-ui/build/` | 웹뷰의 빌드 결과 (`assets/index.js`, `assets/index.css`, 폰트) |
| `templates/` | 프로젝트 템플릿 ZIP 23개와 POM 템플릿 19개, CRUD 코드 템플릿 11개, 설정 템플릿 52개, 메타데이터 JSON 2개 |
| `assets/icons/` | 아이콘 |
| `package.json`, `README.md`, `CHANGELOG.md`, `LICENSE` | 매니페스트와 Marketplace에 표시되는 문서 |

- VSIX의 크기는 80MB 안팎이며, 대부분이 프로젝트 템플릿 ZIP입니다.
- 무엇이 들어가는지는 `.vscodeignore`가 결정합니다. `src/`, `docs/`, `node_modules/`, 웹뷰의 소스는 제외되어 있습니다.
- `README.md`는 Marketplace의 확장 페이지에 그대로 표시됩니다. README의 상대 링크는 `package.json`의 `repository`를 기준으로 GitHub 주소로 바뀝니다.

## 만드는 방법

```bash
npx vsce package
```

`vsce package`는 먼저 `vscode:prepublish` 스크립트(`npm run package`)를 실행합니다. 이 스크립트는 타입 검사, 웹뷰 빌드, 린트, esbuild 프로덕션 번들을 차례로 수행하며, 하나라도 실패하면 VSIX가 만들어지지 않습니다. 결과물은 저장소 루트에 `egovframe-vscode-initializr-<버전>.vsix`로 생기고, 버전은 `package.json`의 `version`에서 옵니다. `*.vsix`는 `.gitignore`에 등록되어 있어 저장소에 들어가지 않습니다.

### 묶기 전에 확인할 것

- **템플릿 ZIP이 실제 파일인지 확인합니다.** Git LFS 포인터(130바이트 안팎)인 채로 묶으면 그대로 VSIX에 들어가고, 설치한 사용자의 프로젝트 생성이 압축 해제에서 실패합니다.

  ```bash
  git lfs pull
  find templates/projects/examples -name "*.zip" -size -2k    # 출력이 없어야 합니다
  ```

- **테스트를 통과시킵니다.** `npm run package`는 테스트를 실행하지 않습니다.

  ```bash
  npm run test
  (cd webview-ui && npm run test)
  ```

- **작업 디렉터리에 로컬 전용 파일이 없는지 확인합니다.** `vsce`는 Git이 추적하지 않는 파일도 `.vscodeignore`에 없으면 VSIX에 넣습니다. 5.1.0 기준의 `.vscodeignore`는 AI 도구의 설정 디렉터리(`.claude/`, `.cursor/`, `.cline/`, `.clinerules/`, `.agents/`), `openspec/`, `.husky/`, `.github/`, `webview-ui/`의 설정 파일을 제외하지 않습니다. 이런 파일이 있는 작업 디렉터리에서 묶으면 개인 설정(`.claude/settings.local.json` 등)이 배포 파일에 섞여 들어가므로, 새로 클론한 디렉터리에서 묶거나 아래의 목록 확인으로 걸러 냅니다.

## 만든 파일 점검

### 포함되는 파일 목록

`vsce ls`는 VSIX에 들어갈 파일의 목록을 출력합니다. 묶기 전에 실행해서 들어가면 안 되는 파일이 있는지 확인합니다.

```bash
npx vsce ls | grep -vE "^(templates|assets|dist|webview-ui/build)/"
```

이 명령의 출력에는 `package.json`, `README.md`, `CHANGELOG.md`, `LICENSE`가 나와야 합니다. 5.1.0 기준으로는 저장소가 추적하는 개발용 설정 파일(`.changie.yaml`, `.codespellrc`, `.mocharc.json`, `.husky/`, `.github/`, `webview-ui/`의 설정 파일)과, `npm install`이 만드는 `.husky/_/`, 개발 서버가 만드는 `webview-ui/.vite-port`도 함께 나옵니다. 이 파일들에는 개인 정보가 없어 문제가 되지 않습니다. 그 밖의 파일, 특히 AI 도구의 설정 디렉터리처럼 Git이 추적하지 않는 디렉터리의 파일이 보이면 `.vscodeignore`에 추가하거나 작업 디렉터리에서 치운 뒤에 다시 묶습니다.

이미 만든 VSIX는 ZIP 형식이므로 다음과 같이 확인합니다.

```bash
unzip -l egovframe-vscode-initializr-<버전>.vsix | grep -vE "extension/(templates|assets|dist|webview-ui/build)/"
```

### 설치해서 확인

```bash
code --install-extension egovframe-vscode-initializr-<버전>.vsix
```

평소에 쓰는 설정이나 다른 확장과 섞이지 않게 하려면 새 프로필을 만들어 그 프로필에 설치합니다. `.vscode/launch.json`의 실행 구성은 작업 디렉터리의 개발 빌드를 띄우므로 VSIX의 확인에는 쓸 수 없습니다. 설치한 뒤에는 [TESTING_GUIDE.md](../development/TESTING_GUIDE.md#직접-확인해야-하는-부분)의 항목을 확인합니다. 특히 다음은 VSIX로 설치했을 때에만 드러나는 문제입니다.

- 프로젝트 생성이 내장 템플릿을 찾는지 (LFS 포인터가 섞여 있지 않은지)
- 웹뷰가 표시되고 Monaco 편집기의 문법 검사가 동작하는지 (빌드 결과와 CSP)
- 아키텍처 점검의 진행 문구에 `with ripgrep`이 붙는지 (VS Code에 내장된 ripgrep을 찾는지)

## 프로젝트 템플릿 갱신

### 매니페스트의 구조

프로젝트 템플릿의 목록은 `templates/templates-projects.json`에 있습니다.

```json
{
	"templateId": "boot-web-project",
	"displayName": "Boot > Web Project",
	"category": "Boot",
	"projectName": "egov-boot-web",
	"latestVersion": "5.1.0",
	"versions": [
		{
			"version": "5.1.0",
			"fileName": "egovframe-boot-web.zip",
			"pomFile": "egovframe-boot-web-pom.xml",
			"releaseDate": "2026-11-26",
			"isLatest": true,
			"included": true,
			"fileSize": "1.2MB"
		},
		{
			"version": "4.3.2",
			"fileName": "egovframe-boot-web.zip",
			"pomFile": "egovframe-boot-web-pom.xml",
			"releaseDate": "2026-11-26",
			"isLatest": false,
			"included": false,
			"downloadUrl": "v4.3.2/egovframe-boot-web.zip",
			"sha256": "<ZIP의 sha256, 16진수 64자리>",
			"pomDownloadUrl": "v4.3.2/egovframe-boot-web-pom.xml",
			"pomSha256": "<POM의 sha256, 16진수 64자리>",
			"fileSize": "1.2MB"
		}
	]
}
```

| 규칙 | 내용 |
|------|------|
| 최신 버전 | `isLatest: true`인 버전은 항상 `included: true`이며 `downloadUrl`, `pomDownloadUrl`을 두지 않습니다. ZIP은 `templates/projects/examples/`에, POM은 `templates/projects/pom/`에 둡니다. |
| 이전 버전 | `included: false`이고, `downloadUrl`은 `repository.baseUrl`에 이어 붙는 상대 경로(`v<버전>/<파일 이름>`)입니다. 절대 URL은 허용하지 않습니다. |
| 해시 | 다운로드 대상 버전에는 `sha256`을, `pomFile`이 있으면 `pomSha256`도 기록합니다. 해시가 없는 항목은 확장이 내려받지 않습니다. |
| 파일 이름 | `fileName`과 `pomFile`은 경로 구분자가 없는 파일 이름입니다. 버전마다 같은 파일 이름을 쓰며, 캐시는 버전별 디렉터리로 구분합니다. |
| POM | POM 템플릿이 없는 템플릿은 `pomFile`을 빈 문자열(`""`)로 둡니다. 내려받은 버전은 같은 이름의 내장 POM으로 대신하지 않으므로, POM이 필요한 이전 버전은 POM도 릴리스에 올리고 `pomDownloadUrl`과 `pomSha256`을 기록해야 합니다. |

`src/utils/__tests__/templatesProjectsManifest.spec.ts`가 실제 매니페스트를 검증하므로, 매니페스트를 고쳤으면 `npm run test`를 실행합니다. 테스트가 잡아내는 것은 템플릿 ID와 버전의 중복, 버전과 파일 이름의 형식, 상대 경로가 아닌 다운로드 경로, 해시의 누락과 형식입니다. "최신 버전" 행의 규칙과 내장 ZIP, POM 파일이 실제로 있는지는 테스트가 검증하지 않으므로 직접 확인합니다.

### 최신 버전 템플릿을 교체할 때

1. `templates/projects/examples/`의 ZIP과, POM 템플릿이 있으면 `templates/projects/pom/`의 파일을 교체합니다.
2. 매니페스트의 `releaseDate`와 `fileSize`를 실제 값으로 고칩니다.
3. 템플릿의 `pom.xml`에 `###NAME###`, `###GROUP_ID###`, `###ARTIFACT_ID###`, `###VERSION###`, `###URL###` 자리 표시자가 남아 있는지 확인합니다.
4. ZIP은 Git LFS로 커밋됩니다. 푸시할 때 `.husky/pre-push` 훅이 LFS 객체를 함께 올립니다.

템플릿의 구조가 바뀌면 CRUD 코드의 생성 위치가 맞지 않게 될 수 있습니다. Mapper XML의 위치(`egovframework/sqlmap/example/mappers/`)와 JSP의 위치(`WEB-INF/jsp/egovframework/example/`)가 유지되는지 확인하고, 바뀌었으면 `src/utils/codeTemplateFiles.ts`를 함께 고칩니다.

### 이전 버전 템플릿을 올릴 때

이전 버전의 파일은 [eGovFramework/egovframe-templates-download](https://github.com/eGovFramework/egovframe-templates-download) 저장소의 GitHub Releases에 올립니다.

1. 릴리스 태그(`v<버전>`)에 ZIP과 POM 파일을 자산으로 올립니다. 자산의 이름은 매니페스트의 `fileName`, `pomFile`과 같아야 합니다.
2. 로컬에서 해시를 계산합니다.

   ```bash
   shasum -a 256 egovframe-boot-web.zip egovframe-boot-web-pom.xml
   ```

3. GitHub가 기록한 자산의 digest와 대조합니다.

   ```bash
   gh api repos/egovframework/egovframe-templates-download/releases/tags/v4.3.2 --jq '.assets[] | "\(.name) \(.digest)"'
   ```

4. 두 값이 같으면 매니페스트의 `sha256`, `pomSha256`, `fileSize`에 기록합니다.
5. `npm run test`로 매니페스트를 검증하고, Extension Development Host에서 해당 버전으로 프로젝트를 실제로 생성해 봅니다.

이미 공개한 릴리스의 자산을 교체하면, 이전 해시가 기록된 확장을 쓰는 사용자의 다운로드가 무결성 검증에서 실패합니다. 자산을 교체해야 한다면 새 해시를 기록한 확장을 함께 배포합니다.

## 릴리스 절차 요약

1. `package.json`과 `package-lock.json`의 `version`을 올립니다.
2. `CHANGELOG.md`에 해당 버전의 항목을 정리하고, `docs/release-notes/`에 릴리스 노트를 추가합니다.
3. README와 `docs/`의 문서에서 버전에 따라 달라지는 내용(템플릿 목록, 프레임워크 버전, 테스트 수)을 고칩니다.
4. `npm run check-types`, `npm run lint`, 두 패키지의 테스트를 통과시킵니다.
5. `npx vsce ls`로 포함되는 파일을 확인한 뒤 `npx vsce package`로 VSIX를 만듭니다.
6. VSIX를 설치해서 네 탭의 기능을 확인합니다.
7. `develop`을 `main`으로 병합하고 `v<버전>` 태그를 만듭니다.
8. VSIX를 Marketplace에 게시합니다. 게시 방법은 VS Code의 [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) 문서를 따릅니다.
