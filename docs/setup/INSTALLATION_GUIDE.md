# 설치와 설정 가이드

이 문서는 eGovFrame VSCode Initializr 확장을 설치하고, 화면 구성과 설정 항목을 확인하는 방법을 설명합니다. 기능별 사용법은 [reference/](../reference/) 폴더의 문서에 있고, 소스 코드에서 직접 빌드해서 실행하는 방법은 [개발 시작 가이드](../development/GETTING_STARTED.md)에 있습니다.

## 요구 사항

| 항목 | 내용 |
|------|------|
| Visual Studio Code | 1.84.0 이상 |
| 운영체제 | VS Code가 지원하는 Windows, macOS, Linux |
| 네트워크 | 최신 버전(5.1.0) 템플릿은 확장에 내장되어 있어 네트워크 없이 동작합니다. 이전 버전(4.3.2) 템플릿으로 프로젝트를 생성할 때에만 GitHub에 접속합니다. |

확장 자체는 Java나 Maven을 요구하지 않습니다. 생성된 프로젝트를 빌드하고 실행할 때에는 그 프로젝트가 요구하는 JDK와 빌드 도구가 필요합니다.

## 설치

### Marketplace에서 설치

1. Activity Bar의 **Extensions** 아이콘을 클릭하거나 `Ctrl+Shift+X`(macOS는 `Cmd+Shift+X`)로 Extensions 뷰를 엽니다.
2. 검색창에 `eGovFrame Initializr in VSCode`를 입력합니다.
3. 게시자가 **egovframework**인 항목에서 **Install**을 클릭합니다.

Marketplace 페이지는 [eGovFrame Initializr in VSCode](https://marketplace.visualstudio.com/items?itemName=egovframework.egovframe-vscode-initializr)입니다.

### VSIX 파일로 설치

Marketplace에 접속할 수 없는 환경에서는 VSIX 파일로 설치합니다. Extensions 뷰의 `...` 메뉴에서 **Install from VSIX...**를 선택하거나 아래 명령을 실행합니다.

```bash
code --install-extension egovframe-vscode-initializr-5.1.0.vsix
```

VSIX에는 최신 버전의 프로젝트 템플릿 23종과 CRUD 코드 템플릿, 설정 템플릿이 모두 들어 있습니다. 그래서 폐쇄망에서도 최신 버전 템플릿을 사용하는 프로젝트 생성, CRUD 코드 생성, 설정 파일 생성, 아키텍처 점검을 모두 쓸 수 있습니다.

### 설치 확인

설치가 끝나면 Activity Bar에 **eGov-Initializr** 아이콘이 생깁니다. 아이콘을 클릭했을 때 사이드바에 네 개의 탭이 표시되면 정상입니다. 확장은 VS Code가 시작된 뒤에 자동으로 활성화되므로 별도의 활성화 명령은 없습니다.

## 화면 구성

| 탭 (한국어 / 영어) | 기능 | 상세 문서 |
|--------------------|------|-----------|
| 프로젝트 / Projects | 표준프레임워크 템플릿으로 프로젝트를 생성 | [PROJECT_GENERATION.md](../reference/PROJECT_GENERATION.md) |
| 코드 생성기 / Code Generator | DDL로 CRUD 코드를 생성하고 미리보기와 ERD를 표시 | [CODE_GENERATION.md](../reference/CODE_GENERATION.md) |
| 설정 / Configuration | Spring 설정 파일을 생성 | [CONFIG_GENERATION.md](../reference/CONFIG_GENERATION.md) |
| 아키텍쳐 / Check Arch | 기존 프로젝트의 아키텍처 준수 여부를 점검 | [ARCHITECTURE_CHECK.md](../reference/ARCHITECTURE_CHECK.md) |

사이드바 상단의 톱니바퀴 버튼을 누르면 탭 화면이 설정 화면으로 바뀌고, 설정 화면의 **완료** 버튼을 누르면 탭 화면으로 돌아옵니다.

## 설정

설정 화면에서 바꾼 값은 **설정 저장** 버튼을 눌러야 저장되며, VS Code 사용자 설정(전역)에 기록됩니다. 그래서 VS Code의 설정 화면이나 `settings.json`에서 같은 키를 직접 수정해도 됩니다. 다만 언어를 이 방법으로 바꾼 경우에는 **Developer: Reload Window** 명령으로 창을 다시 불러와야 화면에 적용됩니다.

| 설정 키 | 기본값 | 설명 |
|---------|--------|------|
| `egovframeInitializr.language` | `en` | UI 표시 언어 (`en`: 영어, `ko`: 한국어) |
| `egovframeInitializr.defaultGroupId` | `egovframework.com` | 프로젝트를 생성할 때 그룹 ID 입력란에 채워지는 기본값 |
| `egovframeInitializr.defaultArtifactId` | `egovframe-project` | 프로젝트를 생성할 때 아티팩트 ID 입력란에 채워지는 기본값 |
| `egovframeInitializr.defaultPackageName` | `egovframework.example.sample` | CRUD 코드를 생성할 때 패키지 이름 입력란에 채워지는 기본값 |

```json
{
	"egovframeInitializr.language": "ko",
	"egovframeInitializr.defaultGroupId": "kr.go.sample",
	"egovframeInitializr.defaultPackageName": "kr.go.sample.board"
}
```

- 언어 설정은 탭의 이름, 프로젝트 탭과 코드 생성기 탭, 설정 탭의 유형 선택 화면, 설정 화면의 주요 문구에 적용됩니다. 아키텍쳐 탭, 설정 탭의 입력 폼, 프로젝트 탭의 프레임워크 버전 영역과 입력값 오류 문구, 확장이 띄우는 일부 알림은 현재 영어로만 제공됩니다. 설정 화면에는 언어 설정이 프로젝트 탭에만 적용된다는 안내가 표시되지만, 5.1.0에서는 위의 범위에 적용됩니다.
- 코드 생성기 탭에서 사용자가 직접 입력한 패키지 이름은 기본값이 바뀌어도 덮어쓰지 않습니다. 기본값으로 되돌리려면 입력란 옆의 **기본값** 버튼을 사용합니다.
- 설정 화면 왼쪽 메뉴의 **정보**(About) 항목에는 확장의 버전과 저장소, 이슈, 표준프레임워크 문서로 이동하는 링크가 있습니다.

## 명령

명령 팔레트(`Ctrl+Shift+P`, macOS는 `Cmd+Shift+P`)에서 다음 명령을 실행할 수 있습니다.

| 명령 | 동작 |
|------|------|
| eGovFrame: Show Template Cache Info | 내려받은 이전 버전 템플릿의 캐시 위치, 전체 크기, 파일 목록을 표시합니다. 캐시가 비어 있으면 비어 있다는 안내만 표시합니다. |
| eGovFrame: Clear Template Cache | 확인 대화상자를 거친 뒤 내려받은 템플릿 파일을 모두 삭제합니다. |

캐시의 위치와 동작은 [PROJECT_GENERATION.md](../reference/PROJECT_GENERATION.md#이전-버전-템플릿의-다운로드와-캐시)에 있습니다.

## 업데이트와 제거

- Marketplace로 설치한 확장은 VS Code가 자동으로 업데이트합니다. VSIX로 설치한 확장은 새 버전의 VSIX를 같은 방법으로 다시 설치합니다.
- 확장을 업데이트해도 설정과 템플릿 캐시는 유지됩니다.
- 확장을 제거하면 VS Code가 템플릿 캐시도 함께 삭제합니다. 사용자 설정에 남은 `egovframeInitializr.*` 항목은 직접 지웁니다.

## 문제 해결

생성이나 점검이 실패하면 실패 사유가 해당 탭의 오류 영역과 VS Code 알림에 표시됩니다. 버튼을 눌러도 반응이 없을 때에는 View → Output에서 **"eGovFrame Initializr"** 출력 채널을 선택합니다. 이 채널에는 확장의 활성화 기록과, 검증에서 거부된 화면의 요청이 남습니다.

| 증상 | 확인할 것 |
|------|-----------|
| Activity Bar에 아이콘이 보이지 않음 | Extensions 뷰에서 확장이 설치되고 활성화(Enabled)되어 있는지 확인합니다. Activity Bar를 마우스 오른쪽 버튼으로 클릭했을 때 **eGov-Initializr** 항목이 숨김 상태인지도 확인합니다. |
| 사이드바가 비어 있거나 로딩에서 멈춤 | Help → Toggle Developer Tools의 Console에서 오류를 확인하고, **Developer: Reload Window** 명령으로 창을 다시 불러옵니다. |
| 프로젝트 생성이 "Project directory already exists"로 실패 | 출력 경로 아래에 프로젝트 이름과 같은 폴더가 이미 있습니다. 기존 폴더는 덮어쓰지 않으므로 이름이나 출력 경로를 바꿉니다. |
| 이전 버전 템플릿의 다운로드가 실패 | 다운로드는 https 연결만 허용하고, 응답이 60초 동안 없으면 중단하며, 파일 크기는 200MB로 제한됩니다. GitHub에 접속할 수 있는 네트워크인지 확인하고, 프록시 환경이면 VS Code의 프록시 설정(`http.proxy`)을 확인합니다. |
| 템플릿 무결성 안내가 표시됨 | 내려받은 파일이 확장에 기록된 해시와 다릅니다. 확장을 최신 버전으로 업데이트하거나 **eGovFrame: Clear Template Cache** 명령으로 캐시를 지운 뒤 다시 시도합니다. |
| DDL이 유효하지 않다고 표시됨 | 입력이 `CREATE TABLE`로 시작하는지, 선택한 SQL 방언이 DDL과 맞는지 확인합니다. 받아들이는 문법은 [CODE_GENERATION.md](../reference/CODE_GENERATION.md#ddl-입력-규칙)에 있습니다. |
| 아키텍처 점검 결과가 비어 있음 | Project Path가 소스가 들어 있는 프로젝트의 루트인지 확인합니다. `src/test` 아래의 파일과 빌드 산출물 디렉터리는 점검 대상이 아닙니다. |

해결되지 않는 문제는 화면에 표시된 오류 문구, 출력 채널의 내용과 함께 [GitHub Issues](https://github.com/eGovFramework/egovframe-vscode-initializr/issues)에 알려 주세요.
