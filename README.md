# eGovFrame VSCode Initializr

> 전자정부 표준프레임워크(eGovFrame) 프로젝트의 생성, CRUD 코드 생성, 설정 파일 생성, 아키텍처 점검을 Visual Studio Code 안에서 수행하는 확장

[![eGovFrame](https://img.shields.io/badge/eGovFrame-5.1.0-134F8C?labelColor=white&logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzMuMjgyIDE3My4yODIiPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0xNzMuMjgyIDg2LjY1YzAgNDcuODQ0LTM4Ljc5NCA4Ni42MzItODYuNjQ2IDg2LjYzMkMzOC43OTkgMTczLjI4MiAwIDEzNC40OTQgMCA4Ni42NSAwIDM4Ljc4OCAzOC43OTkgMCA4Ni42MzYgMGM0Ny44NTIgMCA4Ni42NDYgMzguNzg4IDg2LjY0NiA4Ni42NSIvPjxwYXRoIGZpbGw9IiMwMDM3NjQiIGQ9Ik0xMjcuMzg5IDgwLjU5OGMtMTMuNzkxLTkuMzY1LTMxLjQzOS01LjU0Mi00MC43MTcgOC41MzMtNy43MiAxMS43NjctMTkuNDA1IDEzLjIzNS0yMy45MDYgMTMuMjM1LTE0Ljc1MSAwLTI0LjgyNC0xMC4zNjctMjcuODE4LTIxLjA5NWgtLjAxYy0uMDM5LS4xMDgtLjA1OS0uMi0uMDktLjMwNy0uMDI1LS4xMi0uMDU2LS4yMzMtLjA4OS0uMzY2LTEuMTc3LTQuNDY3LTEuNDY3LTYuNjA5LTEuNDY3LTExLjM2OCAwLTI1LjY1IDI2LjMyMS01NC4yMTMgNjQuMjE1LTU0LjIxMyAzOC44MjkgMCA2MS4wNSAyOS41NDUgNjYuNzggNDUuOTc5LS4xMDctLjI5NS0uMjA5LS41ODEtLjI5MS0uODc3LTExLjAxNS0zMi4xMjUtNDEuNDc0LTU1LjIxNi03Ny4zNTctNTUuMjE2LTQ1LjEzIDAtODEuNzI5IDM2LjU5LTgxLjcyOSA4MS43MzkgMCA0MC4zNTEgMjkuMTA4IDc0Ljg5MSA2OS40NzkgNzQuODkxIDMyLjE5NyAwIDUzLjg0Mi0xOC4wNTIgNjMuNzU3LTQyLjkzIDUuNDUtMTMuNjE0IDEuNTk1LTI5LjYwNS0xMC43NTctMzguMDA1Ii8%2BPHBhdGggZmlsbD0iI2U0MDMyZSIgZD0iTTE2NC43ODggNjIuNTg5Yy00Ljc3Ny0xNi4wMjYtMjcuMTUzLTQ3LjU3MS02Ny4yODItNDcuNTcxLTM3Ljg5NCAwLTY0LjIxNCAyOC41NjMtNjQuMjE0IDU0LjIxMiAwIDQuNzU5LjI5IDYuOTAxIDEuNDY2IDExLjM2OC0uNDg5LTEuOTUxLS43NC0zLjkwOC0uNzQtNS44MjMgMC0yNi43MjEgMjYuNzQxLTQ1LjIyNyA1NC4yNDgtNDUuMjI3IDM3LjIxOCAwIDY3LjM4OCAzMC4xNzQgNjcuMzg4IDY3LjM5IDAgMjkuMTczLTE2Ljc4NSA1NC40MzctNDEuMTc5IDY2LjU2NXYuMDIzYzMxLjQ1NS0xMS4zOTEgNTMuOTA4LTQxLjUxMiA1My45MDgtNzYuODg0IDAtOC4zNzgtMS4xMjctMTUuNzU5LTMuNTk1LTI0LjA1MyIvPjwvc3ZnPg%3D%3D)](https://www.egovframe.go.kr)
[![VS Code](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FeGovFramework%2Fegovframe-vscode-initializr%2Fmain%2Fpackage.json&query=%24.engines.vscode&label=VS%20Code&color=007ACC)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

## 개요

**eGovFrame VSCode Initializr**는 전자정부 표준프레임워크(eGovFrame) 기반 프로젝트를 쉽고 빠르게 시작하고, 이미 작성된 프로젝트가 표준프레임워크 아키텍처 가이드를 따르는지 확인할 수 있도록 도와주는 Visual Studio Code 확장입니다. Activity Bar의 **eGov-Initializr** 아이콘을 클릭하면 사이드바에 네 개의 탭이 표시되고, 탭마다 하나의 기능을 제공합니다.

프로젝트와 코드의 생성, 아키텍처 점검의 판정은 모두 확장의 코드가 정해진 규칙에 따라 수행합니다. 그래서 같은 입력으로 실행하면 항상 같은 결과가 나옵니다. 최신 버전의 템플릿은 확장에 내장되어 있어 네트워크가 없는 환경에서도 사용할 수 있습니다.

## 주요 기능

| 기능 | 탭 | 설명 |
|------|-----|------|
| 프로젝트 생성 | 프로젝트 (Projects) | 8개 카테고리 23종의 템플릿으로 표준프레임워크 프로젝트를 생성합니다. 템플릿마다 프레임워크 버전(5.1.0, 4.3.2)을 고를 수 있습니다. |
| CRUD 코드 생성 | 코드 생성기 (Code Generator) | `CREATE TABLE` DDL로 Controller, Service, MyBatis Mapper, VO, 화면(Thymeleaf, JSP)의 코드 11종을 생성합니다. 생성하기 전에 코드 미리보기와 ERD를 확인할 수 있습니다. |
| 설정 파일 생성 | 설정 (Configuration) | 7개 카테고리 21종의 Spring 설정을 폼 입력으로 생성합니다. 출력 형식은 XML, Java Config, YAML, Properties입니다. |
| 아키텍처 점검 | 아키텍쳐 (Check Arch) | 기존 Java 프로젝트의 빌드 파일과 Controller, Service, DAO / Mapper 레이어가 표준프레임워크 아키텍처 가이드를 따르는지 점검하고 결과를 CSV로 내보냅니다. |

- **내장 템플릿**: 최신 버전(5.1.0)의 프로젝트 템플릿이 확장에 들어 있어서 폐쇄망에서도 프로젝트를 생성할 수 있습니다.
- **검증된 다운로드**: 이전 버전(4.3.2) 템플릿은 GitHub Releases에서 내려받고, sha256 해시가 확장에 기록된 값과 일치할 때에만 사용합니다. 한 번 내려받은 템플릿은 캐시해서 다시 사용합니다.
- **바로 동작하는 코드**: 생성한 CRUD 코드는 이 확장으로 만든 Web Project와 Boot > Web Project에서 위치를 옮기지 않고 동작합니다.
- **빌드 도구 불필요**: 아키텍처 점검은 Maven이나 Gradle을 실행하지 않고 파일을 읽기만 합니다.
- **VS Code 통합**: VS Code의 테마를 그대로 따르고, 주요 화면을 영어와 한국어로 제공합니다.

## 설치

### 요구 사항

- Visual Studio Code 1.84.0 이상

### Marketplace에서 설치

1. Activity Bar의 **Extensions** 아이콘을 클릭하거나 `Ctrl+Shift+X`(macOS는 `Cmd+Shift+X`)로 Extensions 뷰를 엽니다.
2. 검색창에 `eGovFrame Initializr in VSCode`를 입력합니다.
3. 게시자가 **egovframework**인 항목에서 **Install**을 클릭합니다.

Marketplace 페이지는 [eGovFrame Initializr in VSCode](https://marketplace.visualstudio.com/items?itemName=egovframework.egovframe-vscode-initializr)입니다.

### VSIX 파일로 설치

Extensions 뷰의 `...` 메뉴에서 **Install from VSIX...**를 선택하거나 아래 명령을 실행합니다.

```bash
code --install-extension egovframe-vscode-initializr-5.1.0.vsix
```

설정 항목, 명령, 문제 해결은 [`docs/setup/INSTALLATION_GUIDE.md`](docs/setup/INSTALLATION_GUIDE.md)에 있습니다. 소스 코드에서 직접 빌드해서 실행하는 방법은 [`docs/development/GETTING_STARTED.md`](docs/development/GETTING_STARTED.md)에 있습니다.

### 화면 구성

설치한 뒤 Activity Bar의 **eGov-Initializr** 아이콘을 클릭하면 사이드바에 네 개의 탭이 표시됩니다. 사이드바 상단의 톱니바퀴 버튼을 누르면 [설정](#설정) 화면이 열립니다.

| 탭 (한국어 / 영어) | 기능 |
|--------------------|------|
| 프로젝트 / Projects | 표준프레임워크 템플릿으로 프로젝트를 생성 |
| 코드 생성기 / Code Generator | DDL로 CRUD 코드를 생성하고 미리보기와 ERD를 표시 |
| 설정 / Configuration | Spring 설정 파일을 생성 |
| 아키텍쳐 / Check Arch | 표준프레임워크 아키텍처 가이드의 준수 여부를 점검 |

## 프로젝트 생성 (Projects)

표준프레임워크 템플릿을 출력 경로 아래에 풀어서 새 프로젝트를 만듭니다. POM 템플릿이 있는 템플릿은 입력한 프로젝트 이름, 그룹 ID, 아티팩트 ID를 반영한 `pom.xml`을 함께 만듭니다.

| 카테고리 | 템플릿 |
|----------|--------|
| Web | Web Project |
| Template | Simple Homepage, Portal Site, Enterprise Business, Common Components |
| Boot | Web Project, Simple Homepage (Backend), Simple Homepage (Frontend) |
| MSA | Common Components, Portal (Backend), Portal (Frontend) |
| Modulith | Common Components |
| Mobile | Web Project, Common Components, DeviceAPI Web Project |
| Batch | Scheduler (File), CommandLine (File), Web (File), Scheduler (DB), CommandLine (DB), Web (DB) |
| AI | RAG Project (Spring AI), RAG Project (Langchain4j) |

화면의 템플릿 목록에는 `Boot > Web Project`처럼 분류 접두어가 붙은 이름으로 표시됩니다. Batch 카테고리의 접두어는 `Boot Batch`입니다.

### 프레임워크 버전

| 버전 | 드롭다운 표기 | 제공 방식 | 대상 템플릿 |
|------|---------------|-----------|-------------|
| 5.1.0 | `v5.1.0 (Latest) - Included` | 확장에 내장된 ZIP을 바로 사용 | 23종 전체 |
| 4.3.2 | `v4.3.2 - Download from GitHub` | GitHub Releases에서 내려받아 캐시 | Modulith와 AI 카테고리를 제외한 20종 |

### 사용 방법

1. **템플릿 카테고리**와 **템플릿**을 선택합니다.
2. **Framework Version** 드롭다운에서 프레임워크 버전을 선택합니다.
3. **프로젝트 이름**, **그룹 ID**, **아티팩트 ID**, **출력 경로**를 입력합니다.
4. **프로젝트 생성** 버튼을 클릭하면 탭 안에 진행 상황이 단계별로 표시됩니다.
5. 생성이 끝나면 "Open project in new window" 버튼이 있는 알림이 표시되고, 버튼을 누르면 생성된 프로젝트가 새 창에서 열립니다.

출력 경로 아래에 같은 이름의 폴더가 이미 있으면 덮어쓰지 않고 생성을 중단합니다.

### 이전 버전 템플릿의 다운로드

다운로드가 필요한 버전을 선택하면 [eGovFramework/egovframe-templates-download](https://github.com/eGovFramework/egovframe-templates-download/releases) 저장소의 GitHub Releases에서 템플릿을 내려받습니다. 내려받은 파일은 sha256 해시가 확장에 기록된 값과 일치할 때에만 사용하고, VS Code 전역 저장소(globalStorage)에 캐시해서 다음 생성부터 다시 사용합니다. 캐시는 확장을 업데이트해도 유지되며, 명령 팔레트의 다음 명령으로 관리합니다.

| 명령 | 동작 |
|------|------|
| eGovFrame: Show Template Cache Info | 캐시 위치, 전체 크기, 파일 목록을 표시 (캐시가 비어 있으면 비어 있다는 안내만 표시) |
| eGovFrame: Clear Template Cache | 확인 대화상자를 거친 뒤 내려받은 템플릿 파일을 모두 삭제 |

입력값의 규칙, 다운로드의 안전 장치, 캐시의 위치는 [`docs/reference/PROJECT_GENERATION.md`](docs/reference/PROJECT_GENERATION.md)에 있습니다.

## CRUD 코드 생성 (Code Generator)

`CREATE TABLE` 문 하나를 읽어서 그 테이블의 CRUD 코드 11종을 생성합니다.

### 사용 방법

1. `CREATE TABLE` 문을 직접 입력하거나 샘플 DDL을 선택하고, **SQL 방언**(MySQL, PostgreSQL, Generic)을 지정합니다.
2. 입력을 멈추면 DDL이 검증되고, 유효하면 **ERD 미리보기**가 표시됩니다.
3. **미리보기 열기** 버튼을 클릭한 뒤 드롭다운에서 템플릿을 골라 생성될 코드를 확인합니다. **항상 미리보기 열기**를 선택하면 DDL이 바뀔 때마다 미리보기를 다시 만듭니다.
4. **패키지 이름**과 **출력 경로**(대상 프로젝트의 루트)를 지정합니다.
5. **CRUD 코드 생성** 버튼을 클릭하고, 표시되는 목록에서 생성할 파일을 고릅니다.

### 생성되는 파일

`<Table>`은 테이블 이름에서 만든 클래스 이름이고, `<table>`은 그 첫 글자를 소문자로 바꾼 이름이며, `<package>`는 패키지 이름을 디렉터리 경로로 바꾼 것입니다.

| 템플릿 | 생성 위치 |
|--------|-----------|
| VO | `src/main/java/<package>/service/<Table>VO.java` |
| DefaultVO | `src/main/java/<package>/service/<Table>DefaultVO.java` |
| Controller | `src/main/java/<package>/web/<Table>Controller.java` |
| Service | `src/main/java/<package>/service/<Table>Service.java` |
| ServiceImpl | `src/main/java/<package>/service/impl/<Table>ServiceImpl.java` |
| Mapper Interface | `src/main/java/<package>/service/impl/<Table>Mapper.java` |
| Mapper (XML) | `src/main/resources/egovframework/sqlmap/example/mappers/<Table>_SQL.xml` |
| Thymeleaf List | `src/main/resources/templates/thymeleaf/<table>/<table>List.html` |
| Thymeleaf Register | `src/main/resources/templates/thymeleaf/<table>/<table>Register.html` |
| JSP List | `src/main/webapp/WEB-INF/jsp/egovframework/example/<table>/<table>List.jsp` |
| JSP Register | `src/main/webapp/WEB-INF/jsp/egovframework/example/<table>/<table>Register.jsp` |

Mapper XML과 JSP의 생성 위치는 패키지 이름과 관계없이 고정되어 있습니다. Web Project(`egovframe-web`)와 Boot > Web Project(`egovframe-boot-web`) 템플릿이 Mapper XML과 JSP를 이 위치에서 읽기 때문입니다.

### 주요 동작

- **타입 매핑**: 컬럼 타입을 Java 타입으로 바꿉니다. 날짜·시간 타입은 `java.time` 타입으로, Oracle의 `NUMBER`는 정밀도와 스케일에 따라 `Integer`, `Long`, `BigDecimal`로 매핑합니다.
- **화면 입력란**: 등록/수정 화면의 입력란을 컬럼 타입에 맞게 생성합니다(숫자, 날짜, 시간, Boolean 선택란). NOT NULL 컬럼은 필수 입력으로 표시합니다.
- **COMMENT 반영**: 컬럼의 COMMENT를 VO 필드의 주석에 반영합니다.
- **ERD 미리보기**: 입력한 모든 `CREATE TABLE` 문의 테이블, 컬럼, 기본 키, 외래키 관계를 다이어그램으로 표시합니다.
- **커스텀 템플릿**: 템플릿 컨텍스트를 JSON으로 내려받아 변수를 확인하고, 직접 작성한 Handlebars 템플릿(`.hbs`)으로 코드를 만들 수 있습니다.

데이터 접근은 Mapper 인터페이스(MyBatis) 방식만 지원하며 DAO 클래스 템플릿은 제공하지 않습니다. 받아들이는 DDL 문법, 타입 매핑 표, 템플릿 컨텍스트의 변수는 [`docs/reference/CODE_GENERATION.md`](docs/reference/CODE_GENERATION.md)에 있습니다.

## 설정 파일 생성 (Configuration)

표준프레임워크 프로젝트에서 사용하는 Spring 설정 파일을 폼 입력으로 생성합니다.

| 카테고리 | 설정 유형 |
|----------|-----------|
| Cache | New Cache, New Ehcache Configuration |
| Datasource | New Datasource, New JNDI Datasource |
| ID Generation | New Sequence ID Generation, New Table ID Generation, New UUID Generation |
| Logging | New Console Appender, New File Appender, New Rolling File Appender, New Time-Based Rolling File Appender, New JDBC Appender |
| Property | New Property |
| Scheduling | New Detail Bean Job, New Method Invoking Job, New Simple Trigger, New Cron Trigger, New Scheduler |
| Transaction | New Datasource Transaction, New JPA Transaction, New JTA Transaction |

- **XML**: 모든 설정 유형에서 지원합니다.
- **Java Config**: Cache > New Cache와 Logging 카테고리를 제외한 15종에서 지원합니다.
- **YAML**: Logging 카테고리의 5종에서 지원합니다.
- **Properties**: Logging 카테고리에서 New JDBC Appender를 제외한 4종에서 지원합니다.

### 사용 방법

1. **카테고리**와 **Configuration 타입**을 선택하고 **구성** 버튼을 클릭합니다.
2. 폼에서 출력 형식을 고르고 필요한 값을 입력합니다. Java Config를 선택하면 파일 이름 대신 클래스 이름을 입력합니다.
3. **생성** 버튼을 클릭하면 출력 폴더를 고르는 대화상자가 열리고, 폴더를 선택하면 그 폴더에 설정 파일이 만들어집니다. 선택한 폴더에 같은 이름의 파일이 이미 있으면 생성하지 않습니다.

파일 이름의 규칙과 권장 위치는 [`docs/reference/CONFIG_GENERATION.md`](docs/reference/CONFIG_GENERATION.md)에 있습니다.

## 아키텍처 점검 (Check Arch)

기존 Java 프로젝트의 빌드 파일과 Java 소스를 읽어 표준프레임워크 아키텍처 가이드를 따르는지 점검합니다. 빌드 도구를 실행하지 않고 파일만 읽으므로 빌드 환경이 없어도 점검할 수 있습니다.

### 점검 항목

| 영역 | 대상 파일 | 점검 항목 |
|------|-----------|-----------|
| Project | `pom.xml`, `build.gradle`, `build.gradle.kts` | 모듈별 실행환경 세대(3.x / 4.x / 5.x)와 버전, 필수 라이브러리 4종(`ptl-mvc`, `fdl-cmmn`, `fdl-logging`, `psl-dataaccess`)의 적용 여부, 모듈 간 버전 일관성 |
| Controller | `*Controller.java` | `@Controller` 또는 `@RestController` 선언, 요청 매핑 어노테이션 선언, DAO를 직접 주입받지 않음 |
| Service | `*ServiceImpl.java` | `EgovAbstractServiceImpl` 상속, `@Service` 선언, `*Service` 인터페이스 구현 |
| DAO / Mapper | `*DAO.java`, `*Dao.java`, `*Mapper.java` | 파일 내용으로 구현 방식(iBatis DAO, MyBatis DAO, Mapper 인터페이스)을 분류한 뒤 기반 클래스(Base), Bean 등록(Bean), 실행환경 세대와의 정합(Version) |

Controller, Service, DAO / Mapper 레이어는 세 항목을 모두 만족할 때만 `OK`로 판정하고, 하나라도 어긋나면 `NotFound`로 표시합니다. 주석 안에 적힌 어노테이션이나 `extends` 선언은 판정에 쓰지 않습니다.

Project 점검은 참고 정보도 함께 모읍니다. 데이터 접근 설정(`SqlSessionFactoryBean`, `MapperConfigurer`, `@MapperScan` 등)이 있는지와, 점검 대상 밖에서 `JdbcTemplate` 등으로 데이터에 직접 접근하는 파일의 목록입니다. 이 정보는 판정에 반영하지 않습니다.

### 사용 방법

1. **Project Path**에 점검할 프로젝트의 루트 디렉터리를 지정합니다. 기본값은 현재 워크스페이스 폴더입니다.
2. **Runtime** 드롭다운에서 실행환경 세대를 지정합니다. **Auto**로 두면 빌드 파일에서 세대를 판정하고, 판정할 수 없는 프로젝트는 3.x, 4.x, 5.x 가운데 하나를 직접 선택합니다.
3. **Start Architecture Check** 버튼을 클릭합니다.
4. **Check Results Summary**에서 Project 카드와 레이어별 집계를 확인합니다. 판정에서 제외된 파일은 **Skipped** 목록에 사유와 함께 표시됩니다.
5. **Detailed Results**에서 파일별 판정을 확인합니다. 파일 이름을 클릭하면 에디터에서 열립니다. 열 머리글에 마우스를 올리면 그 체크의 규칙이, DAO / Mapper의 칸에 마우스를 올리면 실패 사유가 표시됩니다.
6. **Export Results** 버튼을 클릭하면 프로젝트의 루트 디렉터리에 `Result_Controller_<날짜>.csv`, `Result_Service_<날짜>.csv`, `Result_DAO_<날짜>.csv`, `Result_Project_<날짜>.csv`가 저장됩니다.

숨김 디렉터리와 `node_modules`, `target`, `build`, `out`, `dist` 디렉터리, `src/test`와 `src/it` 아래의 테스트 소스는 점검하지 않습니다. 항목별 판정 조건, 필수 라이브러리의 상태 값, CSV의 열은 [`docs/reference/ARCHITECTURE_CHECK.md`](docs/reference/ARCHITECTURE_CHECK.md)에 있습니다.

## 설정

사이드바 상단의 톱니바퀴 버튼을 누르면 설정 화면이 열리고, 설정 화면의 **완료** 버튼을 누르면 탭 화면으로 돌아옵니다. 설정 화면에서 저장한 값은 VS Code 사용자 설정에 기록되므로, VS Code의 설정 화면에서 직접 수정해도 됩니다. 언어를 VS Code의 설정에서 직접 바꾼 경우에는 창을 다시 불러와야 적용됩니다.

| 설정 키 | 기본값 | 설명 |
|---------|--------|------|
| `egovframeInitializr.language` | `en` | UI 표시 언어 (`en`: 영어, `ko`: 한국어) |
| `egovframeInitializr.defaultGroupId` | `egovframework.com` | 프로젝트를 생성할 때 그룹 ID의 기본값 |
| `egovframeInitializr.defaultArtifactId` | `egovframe-project` | 프로젝트를 생성할 때 아티팩트 ID의 기본값 |
| `egovframeInitializr.defaultPackageName` | `egovframework.example.sample` | CRUD 코드를 생성할 때 패키지 이름의 기본값 |

## 사용 예시

### 예시 1. Boot 프로젝트를 만들고 CRUD 코드 추가

1. 프로젝트 탭에서 **Boot** 카테고리의 **Web Project**를 선택하고, 프레임워크 버전은 `v5.1.0 (Latest) - Included`로 둡니다.
2. 프로젝트 이름과 출력 경로를 입력하고 **프로젝트 생성**을 클릭한 뒤, 생성된 프로젝트를 새 창에서 엽니다.
3. 코드 생성기 탭에 DDL을 입력합니다.

   ```sql
   CREATE TABLE board (
     board_id   INT           NOT NULL AUTO_INCREMENT COMMENT '게시글 번호',
     title      VARCHAR(200)  NOT NULL COMMENT '제목',
     content    TEXT                   COMMENT '내용',
     view_count INT           DEFAULT 0 COMMENT '조회수',
     created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP COMMENT '등록일시',
     PRIMARY KEY (board_id)
   );
   ```

4. **미리보기 열기**로 생성될 코드를 확인하고, 출력 경로를 프로젝트의 루트로 지정한 뒤 **CRUD 코드 생성**을 클릭합니다. 파일 선택 목록에서 JSP 화면 2개의 선택을 해제합니다.
5. 프로젝트의 DB에 `board` 테이블을 만들고 실행하면 `/board/boardList.do`에서 목록 화면을 볼 수 있습니다.

### 예시 2. 이전 버전 템플릿으로 프로젝트 생성

1. 프로젝트 탭에서 **Boot** 카테고리의 **Web Project**를 선택합니다.
2. **Framework Version**에서 `v4.3.2 - Download from GitHub`를 선택하면 Download Required 안내가 표시됩니다.
3. 프로젝트 이름과 출력 경로를 입력하고 **프로젝트 생성**을 클릭합니다.
4. 처음 한 번은 "Downloading... NN%" 진행 메시지가 표시됩니다. 템플릿 ZIP의 다운로드와 해시 검증, 압축 해제, POM 파일의 다운로드와 해시 검증, `pom.xml` 생성이 차례로 진행됩니다.
5. 같은 버전으로 다시 생성하면 "Using cached template: ..." 메시지와 함께 캐시된 파일을 바로 사용합니다.

### 예시 3. 여러 테이블의 관계를 ERD로 확인

코드 생성기 탭에 외래키로 연결된 테이블을 함께 입력하면 ERD 미리보기에 관계가 표시됩니다. 코드는 첫 번째 테이블에 대해서만 생성되므로, 테이블마다 DDL의 순서를 바꾸어 생성을 반복합니다.

```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 예시 4. 기존 프로젝트의 아키텍처 점검

1. 점검할 프로젝트를 VS Code에서 열고 아키텍쳐 탭으로 이동합니다. Project Path에 워크스페이스 폴더가 자동으로 채워집니다.
2. Runtime은 Auto로 두고 **Start Architecture Check**를 클릭합니다.
3. Project 카드에서 판정된 실행환경 세대와 필수 라이브러리의 상태를 확인하고, 레이어별 집계에서 실패한 파일의 수를 확인합니다.
4. Detailed Results에서 실패한 파일을 클릭해 에디터에서 열고 수정합니다.
5. **Export Results**로 CSV를 저장해 점검 결과를 공유합니다.

## 제약 사항

- CRUD 코드는 한 번에 테이블 하나에 대해서만 생성하며, 같은 경로에 파일이 이미 있으면 확인 없이 덮어씁니다.
- 생성되는 CRUD 코드는 실행환경 5.x를 기준으로 합니다(`@EgovMapper`, `jakarta.*`). 4.3.2 템플릿으로 만든 프로젝트에 넣을 때에는 해당 부분을 고쳐야 합니다.
- 이전 버전(4.3.2) 템플릿으로 처음 프로젝트를 생성할 때에는 GitHub에 접속할 수 있는 네트워크가 필요합니다.
- 아키텍처 점검은 Java 소스와 표준프레임워크의 어노테이션·기반 클래스를 대상으로 하는 정적 분석입니다. Kotlin 소스, Mapper XML의 SQL, 런타임의 Bean 등록 여부는 판정하지 않습니다.
- 아키텍쳐 탭과 설정 탭의 입력 폼, 일부 안내 문구는 영어로만 제공됩니다.
- 워크스페이스에 폴더가 여러 개 열려 있으면 첫 번째 폴더를 기본 경로로 사용합니다.

## 문제 해결

생성이나 점검이 실패하면 실패 사유가 해당 탭의 오류 영역과 VS Code 알림에 표시됩니다. 버튼을 눌러도 반응이 없을 때에는 View → Output에서 **"eGovFrame Initializr"** 출력 채널을 선택합니다. 이 채널에는 확장의 활성화 기록과, 검증에서 거부된 화면의 요청이 남습니다.

- **템플릿 무결성 안내가 표시됨**: 내려받은 템플릿이 확장에 기록된 해시와 다릅니다. 확장을 최신 버전으로 업데이트하거나 **eGovFrame: Clear Template Cache** 명령으로 캐시를 지운 뒤 다시 시도합니다.
- **템플릿 다운로드가 실패함**: 다운로드는 https 연결만 허용하고 응답 크기는 200MB로 제한됩니다. GitHub에 접속할 수 있는 네트워크인지 확인하고, 프록시 환경이면 VS Code의 프록시 설정을 확인합니다.
- **DDL이 유효하지 않다고 표시됨**: 입력이 `CREATE TABLE`로 시작하는지 확인하고, 샘플 DDL과 같은 형식으로 입력합니다.
- **아키텍처 점검 결과가 비어 있음**: Project Path가 소스가 들어 있는 프로젝트의 루트인지 확인합니다.

증상별 확인 방법은 [`docs/setup/INSTALLATION_GUIDE.md`](docs/setup/INSTALLATION_GUIDE.md#문제-해결)에 있습니다.

## 기술 스택

| 구분 | 내용 |
|------|------|
| Platform | VS Code Extension API (`engines.vscode` ^1.84.0) |
| Extension Host | TypeScript v5.4.5, esbuild v0.25.0 |
| Webview UI | React v18.3.1, Vite v6.4.3, Tailwind CSS v4.1 |
| Editor | `monaco-editor` v0.31.1, `monaco-sql-languages` v0.15.2 |
| Template Engine | `handlebars` v4.7.9 |
| ZIP | `adm-zip` v0.6.0 |
| Schema Validation | `zod` v4.4.3 |
| i18n | `i18next` v25.8, `react-i18next` v16.5 |
| Test | Vitest v3.0.9, Testing Library |

## 폴더 구조

```text
egovframe-vscode-initializr/
├── src/                              # 확장 호스트 (Node.js)
│   ├── extension.ts                  #   진입점 (웹뷰와 명령 등록)
│   ├── core/
│   │   ├── webview/index.ts          #   WebviewProvider (웹뷰 HTML, CSP)
│   │   └── controller/index.ts       #   웹뷰 메시지 검증과 분기
│   ├── commands/                     #   템플릿 캐시 명령
│   ├── shared/                       #   확장과 웹뷰가 함께 쓰는 타입, DDL 파서, 메시지 스키마
│   └── utils/                        #   생성기와 점검 엔진
│       ├── projectGenerator.ts       #     프로젝트 생성
│       ├── templateManifest.ts 등    #     템플릿 매니페스트, 검증된 다운로드, 캐시
│       ├── codeGenerator.ts 등       #     CRUD 코드 생성과 미리보기
│       ├── configGenerator.ts        #     설정 파일 생성
│       └── archChecker.ts 등         #     아키텍처 점검 엔진
│
├── webview-ui/                       # 웹뷰 (React, 별도 npm 패키지)
│   └── src/
│       ├── components/egov/tabs/     #   ProjectsView, CodeView, ConfigView, CheckArchView
│       ├── components/egov/forms/    #   설정 유형별 폼
│       ├── components/ui/            #   VS Code 스타일의 공통 컴포넌트
│       └── i18n/locales/             #   en.json, ko.json
│
├── templates/                        # 템플릿과 메타데이터
│   ├── templates-projects.json       #   프로젝트 템플릿 매니페스트
│   ├── templates-context-xml.json    #   설정 유형 메타데이터
│   ├── projects/examples/            #   프로젝트 템플릿 ZIP 23개 (Git LFS)
│   ├── projects/pom/                 #   POM 템플릿 19개
│   ├── code/                         #   CRUD 코드 템플릿 11개 (.hbs)
│   └── config/                       #   설정 템플릿 52개 (.hbs)
│
├── docs/                             # 상세 문서 (아래 "문서" 참조)
│   ├── setup/                        #   설치와 설정
│   ├── reference/                    #   기능별 입력과 동작, 점검 규칙
│   ├── architecture/                 #   확장의 구성과 점검 엔진
│   ├── development/                  #   개발 환경, 테스트, 코드 수정 규칙
│   ├── operations/                   #   패키징과 릴리스
│   └── release-notes/                #   버전별 릴리스 노트
│
├── assets/icons/                     # 아이콘
├── package.json                      # 확장 매니페스트
├── esbuild.js                        # 확장 호스트 빌드 설정
├── vitest.config.ts                  # 확장 호스트 테스트 설정
├── CHANGELOG.md
├── CONTRIBUTING.md
└── LICENSE
```

확장 호스트와 웹뷰는 `postMessage()`로만 통신하며, 웹뷰가 보낸 메시지는 zod 스키마 검증을 통과한 것만 처리합니다. 구성 요소와 메시지의 흐름은 [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md)에 있습니다.

## 빌드와 테스트

```bash
git lfs install && git clone https://github.com/eGovFramework/egovframe-vscode-initializr.git
cd egovframe-vscode-initializr
npm run install:all    # 루트와 webview-ui 의 의존성 설치
```

VS Code에서 저장소를 열고 **F5**를 누르면 Extension Development Host에서 확장이 실행됩니다.

| 명령 | 동작 |
|------|------|
| `npm run watch` | 확장 호스트의 감시 빌드와 타입 검사 |
| `npm run build:webview` | 웹뷰 빌드 |
| `npm run check-types` | 확장 호스트의 타입 검사 |
| `npm run lint` | ESLint |
| `npm run test` | 확장 호스트 테스트 |
| `cd webview-ui && npm run test` | 웹뷰 테스트 |
| `npm run package` | 타입 검사, 웹뷰 빌드, 린트를 거친 프로덕션 번들 |
| `npx vsce package` | VSIX 생성 |

프로젝트 템플릿 ZIP은 Git LFS로 관리하므로 클론하기 전에 `git lfs install`을 실행해야 합니다. 자세한 내용은 [`docs/development/GETTING_STARTED.md`](docs/development/GETTING_STARTED.md)에 있습니다.

## 문서

상세 문서는 [`docs/`](docs/README.md)에 주제별 폴더로 나뉘어 있습니다.

| 문서 | 설명 |
|------|------|
| [`docs/setup/INSTALLATION_GUIDE.md`](docs/setup/INSTALLATION_GUIDE.md) | 설치, 화면 구성, 설정 항목, 명령, 문제 해결 |
| [`docs/reference/PROJECT_GENERATION.md`](docs/reference/PROJECT_GENERATION.md) | 프로젝트 템플릿과 프레임워크 버전, 입력값 규칙, 다운로드와 캐시 |
| [`docs/reference/CODE_GENERATION.md`](docs/reference/CODE_GENERATION.md) | DDL 입력 규칙, 타입 매핑, 생성되는 파일, 커스텀 템플릿 |
| [`docs/reference/CONFIG_GENERATION.md`](docs/reference/CONFIG_GENERATION.md) | 설정 유형과 출력 형식, 파일 이름 규칙 |
| [`docs/reference/ARCHITECTURE_CHECK.md`](docs/reference/ARCHITECTURE_CHECK.md) | 점검 항목과 판정 규칙, 결과 화면과 CSV |
| [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) | 확장의 구성, 메시지 계약, 기능별 처리 흐름, 폴더 구조 |
| [`docs/architecture/ARCH_CHECK_ENGINE.md`](docs/architecture/ARCH_CHECK_ENGINE.md) | 아키텍처 점검 엔진의 모듈 구성과 동작 방식 |
| [`docs/development/GETTING_STARTED.md`](docs/development/GETTING_STARTED.md) | 저장소를 받아 확장을 실행하고 디버깅하는 절차 |
| [`docs/development/DEVELOPMENT_GUIDE.md`](docs/development/DEVELOPMENT_GUIDE.md) | 명령, 코드 규칙, 메시지와 템플릿을 추가하는 절차 |
| [`docs/development/TESTING_GUIDE.md`](docs/development/TESTING_GUIDE.md) | 테스트 실행 방법과 구성, 생성 코드의 동작 확인 |
| [`docs/operations/RELEASE_GUIDE.md`](docs/operations/RELEASE_GUIDE.md) | VSIX 패키징과 점검, 프로젝트 템플릿 갱신, 릴리스 절차 |
| [`docs/release-notes/v5.1.0.md`](docs/release-notes/v5.1.0.md) | 5.1.0 릴리스 노트 |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | 컨트리뷰션 참여 방법 |

## 변경 이력

| 버전 | 배포일 | 내용 |
|------|--------|------|
| v5.1.0 | 2026-11-26 | 아키텍처 점검 탭 신설, 프레임워크 버전 선택과 검증된 템플릿 다운로드, ERD 미리보기, 실행환경 5.1 템플릿 적용 ([릴리스 노트](docs/release-notes/v5.1.0.md)) |
| v5.0.7 | 2026-10-16 | DDL 파싱과 생성 코드의 오류 수정, adm-zip 보안 업데이트 |
| v5.0.6 | 2026-07-15 | 웹뷰 메시지의 런타임 검증과 CSP 적용, 템플릿 보안 취약점 업데이트 |
| v5.0.3 | 2026-03-31 | 5.0.x 정식 릴리스 |

버전별 전체 변경 내용은 [`CHANGELOG.md`](CHANGELOG.md)에 있습니다.

## 함께 쓰는 MCP 서버

이 확장의 기능을 AI 클라이언트(Claude Code, Codex, Cursor, VS Code 등)에서 쓰도록 만든 MCP 서버가 있습니다.

- **[egovframe-mcp-codegen](https://github.com/eGovFramework/egovframe-mcp-codegen)**: DDL로부터 표준프레임워크 프로젝트와 엔티티의 CRUD 코드를 생성
- **[egovframe-mcp-check](https://github.com/eGovFramework/egovframe-mcp-check)**: 표준프레임워크 프로젝트의 아키텍처 준수 점검. 이 확장의 아키텍처 점검 엔진을 이식한 것이며 판정 규칙이 같습니다.
- **[egovframe-mcp-search](https://github.com/eGovFramework/egovframe-mcp-search)**: 공식 가이드, 개발자 지식, 공통컴포넌트, 호환 소프트웨어의 통합 검색

## 라이선스

Apache-2.0 라이선스를 따릅니다. 전문은 [`LICENSE`](LICENSE)에 있습니다.

## 지원 및 문의

- **이슈**: [GitHub Issues](https://github.com/eGovFramework/egovframe-vscode-initializr/issues)
- **기여자**: [기여자 목록](https://github.com/eGovFramework/egovframe-vscode-initializr/graphs/contributors)
- **공식 홈페이지**: <https://www.egovframe.go.kr>
- **표준프레임워크 문서**: [공식 포털 가이드](https://egovframe.go.kr/docs/) / [GitHub Docs 페이지](https://egovframework.github.io/egovframe-docs/)
