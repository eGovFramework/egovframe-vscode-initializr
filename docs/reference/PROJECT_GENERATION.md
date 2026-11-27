# 프로젝트 생성 (Projects)

이 문서는 프로젝트 탭이 제공하는 템플릿과 프레임워크 버전, 입력값의 규칙, 생성되는 결과물, 이전 버전 템플릿의 다운로드와 캐시를 설명합니다. 확장 내부의 처리 흐름은 [ARCHITECTURE.md](../architecture/ARCHITECTURE.md#프로젝트-생성)에 있습니다.

## 개요

프로젝트 탭은 표준프레임워크 템플릿(ZIP)을 출력 경로 아래에 풀어서 새 프로젝트를 만듭니다. POM 템플릿이 있는 템플릿은 입력한 프로젝트 이름, 그룹 ID, 아티팩트 ID를 반영한 `pom.xml`을 함께 만듭니다.

- 템플릿은 8개 카테고리의 23종이며, 템플릿마다 프레임워크 버전을 고를 수 있습니다.
- 최신 버전(5.1.0) 템플릿은 확장에 내장되어 있어서 네트워크 없이 생성됩니다.
- 이전 버전(4.3.2) 템플릿은 선택했을 때 GitHub Releases에서 내려받고, sha256 해시가 확장에 기록된 값과 일치할 때에만 사용합니다.
- 기존 폴더는 덮어쓰지 않습니다. 출력 경로 아래에 같은 이름의 폴더가 이미 있으면 생성을 중단합니다.

## 템플릿 목록

| 카테고리 | 템플릿 | 템플릿 파일 | POM 템플릿 | 4.3.2 제공 |
|----------|--------|-------------|------------|------------|
| Web | Web Project | `egovframe-web.zip` | 있음 | 제공 |
| Template | Simple Homepage | `egovframe-template-simple.zip` | 있음 | 제공 |
| Template | Portal Site | `egovframe-template-portal.zip` | 있음 | 제공 |
| Template | Enterprise Business | `egovframe-template-enterprise.zip` | 있음 | 제공 |
| Template | Common Components | `egovframe-template-common-components.zip` | 있음 | 제공 |
| Boot | Web Project | `egovframe-boot-web.zip` | 있음 | 제공 |
| Boot | Simple Homepage (Backend) | `egovframe-boot-simple-backend.zip` | 있음 | 제공 |
| Boot | Simple Homepage (Frontend) | `egovframe-boot-simple-frontend.zip` | 없음 | 제공 |
| MSA | Common Components | `egovframe-msa-common-components.zip` | 없음 | 제공 |
| MSA | Portal (Backend) | `egovframe-msa-portal-backend.zip` | 없음 | 제공 |
| MSA | Portal (Frontend) | `egovframe-msa-portal-frontend.zip` | 없음 | 제공 |
| Modulith | Common Components | `egovframe-modulith-common-components.zip` | 있음 | 없음 |
| Mobile | Web Project | `egovframe-mobile-web.zip` | 있음 | 제공 |
| Mobile | Common Components | `egovframe-mobile-common-components.zip` | 있음 | 제공 |
| Mobile | DeviceAPI Web Project | `egovframe-mobile-deviceapi.zip` | 있음 | 제공 |
| Batch | Scheduler (File) | `egovframe-boot-batch-file-scheduler.zip` | 있음 | 제공 |
| Batch | CommandLine (File) | `egovframe-boot-batch-file-commandline.zip` | 있음 | 제공 |
| Batch | Web (File) | `egovframe-boot-batch-file-web.zip` | 있음 | 제공 |
| Batch | Scheduler (DB) | `egovframe-boot-batch-db-scheduler.zip` | 있음 | 제공 |
| Batch | CommandLine (DB) | `egovframe-boot-batch-db-commandline.zip` | 있음 | 제공 |
| Batch | Web (DB) | `egovframe-boot-batch-db-web.zip` | 있음 | 제공 |
| AI | RAG Project (Spring AI) | `egovframe-ai-rag-springai.zip` | 있음 | 없음 |
| AI | RAG Project (Langchain4j) | `egovframe-ai-rag-langchain4j.zip` | 있음 | 없음 |

- 화면의 템플릿 목록에는 `Template > Simple Homepage`, `Boot > Web Project`처럼 분류 접두어가 붙은 이름으로 표시됩니다. Web Project만 접두어가 없고, Batch 카테고리의 접두어는 `Boot Batch`입니다.
- POM 템플릿이 없는 4종(Boot > Simple Homepage (Frontend)와 MSA 카테고리 3종)은 ZIP에 들어 있는 빌드 파일을 그대로 사용하며, 그룹 ID와 아티팩트 ID를 반영하지 않습니다.
- Modulith > Common Components와 AI 카테고리 2종은 5.1.0 버전만 제공합니다.
- 템플릿의 목록과 버전 정보는 확장에 내장된 `templates/templates-projects.json`(매니페스트)에서 읽습니다.

## 프레임워크 버전

| 버전 | 드롭다운 표기 | 제공 방식 | 대상 템플릿 |
|------|---------------|-----------|-------------|
| 5.1.0 | `v5.1.0 (Latest) - Included` | 확장에 내장된 ZIP을 바로 사용 | 23종 전체 |
| 4.3.2 | `v4.3.2 - Download from GitHub` | GitHub Releases에서 내려받아 캐시 | 20종 |

5.1.0 템플릿은 표준프레임워크 실행환경 5.1을(POM의 parent 버전은 5.1.0), 4.3.2 템플릿은 실행환경 4.3.2를 사용합니다. 템플릿을 고르면 최신 버전이 기본으로 선택됩니다.

## 사용 방법

1. **템플릿 카테고리**와 **템플릿**을 선택합니다.
2. **Framework Version** 드롭다운에서 프레임워크 버전을 선택합니다. 다운로드가 필요한 버전을 선택하면 드롭다운 아래에 **Download Required** 안내와 파일 크기가 표시됩니다.
3. **프로젝트 이름**, **그룹 ID**, **아티팩트 ID**, **출력 경로**를 입력합니다.
4. **프로젝트 생성** 버튼을 클릭하면 탭 안에 진행 상황이 단계별로 표시됩니다.
5. 생성이 끝나면 "Open project in new window" 버튼이 있는 알림이 표시되고, 버튼을 누르면 생성된 프로젝트가 새 창에서 열립니다.

## 입력값 규칙

| 입력 | 규칙 | 쓰이는 곳 |
|------|------|-----------|
| 프로젝트 이름 | 영문자, 숫자, 하이픈(`-`), 밑줄(`_`)로 된 구간을 점(`.`) 하나로 이은 형태 (예: `egov-web`, `com.example.app`). 연속된 점, 앞뒤의 점, 경로 구분자는 허용하지 않습니다. | 프로젝트 폴더 이름, `pom.xml`의 `<name>` |
| 그룹 ID | 점으로 구분한 구간마다 영문 소문자로 시작하고, 영문 소문자와 숫자만 사용 (예: `egovframework.com`) | `pom.xml`의 `<groupId>` |
| 아티팩트 ID | 영문 소문자로 시작하고, 영문 소문자, 숫자, 하이픈만 사용 (예: `egovframe-project`) | `pom.xml`의 `<artifactId>` |
| 출력 경로 | 프로젝트 폴더를 만들 상위 디렉터리. 기본값은 현재 워크스페이스 폴더입니다. | `<출력 경로>/<프로젝트 이름>/`에 생성 |

- 그룹 ID와 아티팩트 ID는 POM 템플릿이 있는 템플릿에서만 검사합니다.
- 프로젝트 이름을 입력하면 그룹 ID와 아티팩트 ID가 자동으로 채워집니다. 이름에 점이 있으면 마지막 점의 앞부분이 그룹 ID가, 뒷부분이 아티팩트 ID가 됩니다. 점이 없으면 그룹 ID는 설정의 기본값이, 아티팩트 ID는 프로젝트 이름이 됩니다. 채워진 값은 직접 고칠 수 있습니다.
- 그룹 ID와 아티팩트 ID의 기본값은 [설정](../setup/INSTALLATION_GUIDE.md#설정)에서 바꿉니다.

## 생성되는 결과물

- `<출력 경로>/<프로젝트 이름>/` 폴더에 템플릿 ZIP의 내용이 풀립니다.
- POM 템플릿이 있으면 그 내용으로 프로젝트 루트에 `pom.xml`을 씁니다. ZIP에 같은 이름의 파일이 들어 있으면 덮어씁니다. POM 템플릿의 다음 자리에 입력값이 들어갑니다.

| POM 템플릿의 자리 | 들어가는 값 |
|-------------------|-------------|
| `###NAME###` | 프로젝트 이름 |
| `###GROUP_ID###` | 그룹 ID |
| `###ARTIFACT_ID###` | 아티팩트 ID |
| `###VERSION###` | `1.0.0` |
| `###URL###` | `https://www.egovframe.go.kr` |

Java 패키지 이름과 소스 파일의 내용은 바꾸지 않습니다. 템플릿의 기본 패키지를 그대로 사용하므로, 패키지를 바꾸려면 생성한 뒤에 IDE의 리팩터링 기능을 사용합니다.

## 이전 버전 템플릿의 다운로드와 캐시

### 다운로드 절차

다운로드가 필요한 버전을 선택하고 프로젝트를 생성하면 다음 순서로 진행됩니다.

1. 템플릿 ZIP을 [eGovFramework/egovframe-templates-download](https://github.com/eGovFramework/egovframe-templates-download/releases) 저장소의 GitHub Releases에서 내려받습니다. 주소는 `https://github.com/egovframework/egovframe-templates-download/releases/download/v4.3.2/<파일 이름>` 형태입니다.
2. 파일을 임시 파일(`<파일 이름>.<프로세스 ID>.part`)에 받으면서 sha256 해시를 계산하고, 확장에 기록된 해시와 일치할 때에만 캐시로 옮깁니다.
3. 캐시된 ZIP의 압축을 프로젝트 폴더에 풉니다.
4. POM 템플릿이 있는 템플릿이면 POM 파일을 같은 방법으로 내려받아 검증한 뒤 `pom.xml`을 만듭니다.

같은 버전을 다시 선택하면 내려받지 않고 캐시를 사용합니다. 캐시를 사용할 때마다 해시를 다시 검증하며, 캐시 파일이 해시와 다르면 삭제한 뒤 한 번 다시 내려받습니다.

진행 상황은 탭 안에 다음과 같은 메시지로 표시됩니다. 일부 메시지의 앞에는 그림 문자가 붙습니다.

| 메시지 | 의미 |
|--------|------|
| `Downloading... 45%` | 내려받는 중 |
| `Download verified: egovframe-boot-web.zip` | 내려받은 파일의 해시가 일치함 |
| `Using cached template: egovframe-boot-web.zip` | 캐시된 파일을 사용함 |
| `Extracting template...` | 템플릿의 압축을 푸는 중 |
| `Generating Maven POM file...` | `pom.xml`을 만드는 중 |

### 다운로드의 안전 장치

- 다운로드 주소와 파일 이름은 확장에 내장된 매니페스트에서만 정해집니다. 화면에서 보낸 값은 템플릿과 버전을 고르는 용도로만 쓰입니다.
- https 연결만 허용하고, 리다이렉트는 https 주소로 5회까지만 따라갑니다.
- 응답 크기는 200MB로 제한하고, 60초 동안 응답이 없으면 중단합니다.
- 해시가 기록되지 않은 항목은 내려받지 않습니다.
- 내려받은 버전의 POM 파일을 받지 못했을 때, 같은 이름의 내장 POM 템플릿으로 대신하지 않습니다. 내장 POM은 다른 버전의 것이기 때문입니다.

### 캐시의 위치와 관리

캐시는 확장의 설치 폴더가 아니라 VS Code 전역 저장소(globalStorage) 아래에 저장됩니다.

```text
<globalStorage>/egovframework.egovframe-vscode-initializr/template-cache/
├── examples/4.3.2/egovframe-boot-web.zip
└── pom/4.3.2/egovframe-boot-web-pom.xml
```

`<globalStorage>`는 운영체제에 따라 다음 위치입니다(VS Code 안정 버전 기준). 캐시에 파일이 있을 때에는 **eGovFrame: Show Template Cache Info** 명령이 실제 위치를 보여 줍니다. 캐시가 비어 있으면 이 명령은 비어 있다는 안내만 표시합니다.

| 운영체제 | 위치 |
|----------|------|
| Windows | `%APPDATA%\Code\User\globalStorage` |
| macOS | `~/Library/Application Support/Code/User/globalStorage` |
| Linux | `~/.config/Code/User/globalStorage` |

- 확장을 업데이트해도 캐시는 유지되고, 확장을 제거하면 VS Code가 함께 삭제합니다.
- 다운로드가 중단되어 남은 임시 파일은 만든 지 24시간이 지나면 다음 다운로드 때 정리됩니다.
- 캐시는 [명령 팔레트의 두 명령](../setup/INSTALLATION_GUIDE.md#명령)으로 조회하고 삭제합니다.

### 무결성 검증에 실패했을 때

내려받은 템플릿 ZIP이 확장에 기록된 해시와 일치하지 않으면 압축을 풀지 않고 프로젝트 탭에 안내가 표시됩니다. 릴리스의 파일이 교체되어 확장에 기록된 해시가 오래된 경우가 대부분이므로, 확장을 최신 버전으로 업데이트한 뒤 다시 시도합니다. 그래도 같으면 **eGovFrame: Clear Template Cache** 명령으로 캐시를 삭제하고 다시 시도합니다.

POM 파일은 ZIP의 압축을 푼 뒤에 내려받습니다. 그래서 POM 파일의 다운로드나 해시 검증에서 실패하면 `pom.xml`이 만들어지지 않은 프로젝트 폴더가 남습니다. 이 경우에는 남은 폴더를 지운 뒤에 다시 시도해야 합니다. 폴더를 그대로 두면 같은 이름의 폴더가 있다는 이유로 생성이 중단됩니다.

## 제약 사항

- 워크스페이스에 폴더가 여러 개 열려 있으면 첫 번째 폴더를 출력 경로의 기본값으로 사용합니다.
- 이전 버전 템플릿의 최초 생성에는 GitHub에 접속할 수 있는 네트워크가 필요합니다. 폐쇄망에서는 최신 버전 템플릿만 사용할 수 있습니다.
- 템플릿의 내용(소스, 설정, 의존성)은 표준프레임워크 템플릿 프로젝트의 것을 그대로 사용합니다. 템플릿별 구성과 실행 방법은 [표준프레임워크 포털](https://www.egovframe.go.kr)의 가이드를 참고합니다.
