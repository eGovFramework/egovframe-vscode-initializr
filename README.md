# eGovFrame VSCode Initializr

[![eGovFrame](https://img.shields.io/badge/eGovFrame-5.1-134F8C?labelColor=white&logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzMuMjgyIDE3My4yODIiPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0xNzMuMjgyIDg2LjY1YzAgNDcuODQ0LTM4Ljc5NCA4Ni42MzItODYuNjQ2IDg2LjYzMkMzOC43OTkgMTczLjI4MiAwIDEzNC40OTQgMCA4Ni42NSAwIDM4Ljc4OCAzOC43OTkgMCA4Ni42MzYgMGM0Ny44NTIgMCA4Ni42NDYgMzguNzg4IDg2LjY0NiA4Ni42NSIvPjxwYXRoIGZpbGw9IiMwMDM3NjQiIGQ9Ik0xMjcuMzg5IDgwLjU5OGMtMTMuNzkxLTkuMzY1LTMxLjQzOS01LjU0Mi00MC43MTcgOC41MzMtNy43MiAxMS43NjctMTkuNDA1IDEzLjIzNS0yMy45MDYgMTMuMjM1LTE0Ljc1MSAwLTI0LjgyNC0xMC4zNjctMjcuODE4LTIxLjA5NWgtLjAxYy0uMDM5LS4xMDgtLjA1OS0uMi0uMDktLjMwNy0uMDI1LS4xMi0uMDU2LS4yMzMtLjA4OS0uMzY2LTEuMTc3LTQuNDY3LTEuNDY3LTYuNjA5LTEuNDY3LTExLjM2OCAwLTI1LjY1IDI2LjMyMS01NC4yMTMgNjQuMjE1LTU0LjIxMyAzOC44MjkgMCA2MS4wNSAyOS41NDUgNjYuNzggNDUuOTc5LS4xMDctLjI5NS0uMjA5LS41ODEtLjI5MS0uODc3LTExLjAxNS0zMi4xMjUtNDEuNDc0LTU1LjIxNi03Ny4zNTctNTUuMjE2LTQ1LjEzIDAtODEuNzI5IDM2LjU5LTgxLjcyOSA4MS43MzkgMCA0MC4zNTEgMjkuMTA4IDc0Ljg5MSA2OS40NzkgNzQuODkxIDMyLjE5NyAwIDUzLjg0Mi0xOC4wNTIgNjMuNzU3LTQyLjkzIDUuNDUtMTMuNjE0IDEuNTk1LTI5LjYwNS0xMC43NTctMzguMDA1Ii8%2BPHBhdGggZmlsbD0iI2U0MDMyZSIgZD0iTTE2NC43ODggNjIuNTg5Yy00Ljc3Ny0xNi4wMjYtMjcuMTUzLTQ3LjU3MS02Ny4yODItNDcuNTcxLTM3Ljg5NCAwLTY0LjIxNCAyOC41NjMtNjQuMjE0IDU0LjIxMiAwIDQuNzU5LjI5IDYuOTAxIDEuNDY2IDExLjM2OC0uNDg5LTEuOTUxLS43NC0zLjkwOC0uNzQtNS44MjMgMC0yNi43MjEgMjYuNzQxLTQ1LjIyNyA1NC4yNDgtNDUuMjI3IDM3LjIxOCAwIDY3LjM4OCAzMC4xNzQgNjcuMzg4IDY3LjM5IDAgMjkuMTczLTE2Ljc4NSA1NC40MzctNDEuMTc5IDY2LjU2NXYuMDIzYzMxLjQ1NS0xMS4zOTEgNTMuOTA4LTQxLjUxMiA1My45MDgtNzYuODg0IDAtOC4zNzgtMS4xMjctMTUuNzU5LTMuNTk1LTI0LjA1MyIvPjwvc3ZnPg%3D%3D)](https://www.egovframe.go.kr)
[![VS Code](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FeGovFramework%2Fegovframe-vscode-initializr%2Fdevelop%2Fpackage.json&query=%24.engines.vscode&label=VS%20Code&color=007ACC)](https://code.visualstudio.com/)

## 개요

**eGovFrame VSCode Initializr**는 전자정부 표준프레임워크(eGovFrame) 프로젝트의 생성, CRUD 코드 생성, 설정 파일 생성, 그리고 아키텍처 점검을 Visual Studio Code 안에서 수행하는 확장 프로그램입니다. 개발자가 eGovFrame 기반 프로젝트를 쉽고 빠르게 시작하고, 이미 작성된 프로젝트가 표준프레임워크 아키텍처 가이드를 따르는지 확인할 수 있도록 도와주는 통합 도구입니다.

가이드 문서들 목록은 다음과 같습니다.
- **README.md**: Extension 사용자를 위한 기능 활용 방법 소개
- **[CHANGELOG.md](./CHANGELOG.md)**: 버전별 변경 이력
- **[CONTRIBUTING.md](https://github.com/eGovFramework/egovframe-vscode-initializr?tab=contributing-ov-file#contributing-guide)**: 컨트리뷰션 참여자를 위한 컨트리뷰션 참여 방법 소개
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)**: Extension 개발자를 위한 아키텍쳐, 폴더 구조 소개
- **[GettingStarted.md](./docs/GettingStarted.md)**: eGovFrame VSCode Initializr를 처음 개발하는 분들을 위한 소개
- **[DEVELOPER.md](./docs/DEVELOPER.md)**: eGovFrame VSCode Initializr 개발을 위한 기능, 시스템, 기술스택 소개

## 주요 기능

- **프로젝트 생성 기능 (Projects)**: 8개 카테고리 23종의 템플릿으로 eGovFrame 프로젝트 자동 생성
  - **프레임워크 버전 선택**: 최신 버전(5.1.0) 템플릿은 확장에 내장되어 있고, 이전 버전(4.3.1) 템플릿은 선택 시 [eGovFramework/egovframe-templates-download](https://github.com/eGovFramework/egovframe-templates-download/releases) 저장소의 GitHub Releases에서 내려받아 sha256 해시를 검증한 뒤 사용
  - **다운로드 캐시**: 한 번 내려받은 이전 버전 템플릿은 VS Code 전역 저장소에 캐시되어 다음 생성부터 재사용
- **CRUD 코드 생성 기능 (Code Generator)**: `CREATE TABLE` DDL 기반 CRUD 코드 자동 생성
  - **실시간 미리보기**: DDL 변경 시 템플릿 미리보기 자동 업데이트 (11개 템플릿 지원)
  - **ERD 미리보기**: DDL의 테이블, 컬럼, PK/FK 관계를 다이어그램으로 시각화
  - **성능 최적화**: 병렬 렌더링 및 지연 로딩으로 빠른 응답성
- **설정 코드 생성 기능 (Configuration)**: 7개 카테고리 21종의 Spring Framework 설정 파일 (XML, Java Config, YAML, Properties) 생성
- **아키텍처 점검 기능 (Architecture Check)**: 기존 Java 프로젝트의 Controller / Service / DAO / Mapper 레이어와 빌드 파일(Project)이 표준프레임워크(egovframework) 아키텍처 가이드를 따르는지 점검하고 결과를 CSV로 내보내기
- **VSCode 네이티브 UI**: VSCode 테마 통합 커스텀 React 컴포넌트 기반 사용자 인터페이스
- **다크/라이트 테마**: VSCode 테마 자동 연동 및 실시간 전환 지원
- **다국어 지원**: 영어/한국어 UI (`egovframeInitializr.language` 설정으로 전환)

## 시작하기

### 요구 사항

- Visual Studio Code 1.84.0 이상

### 설치

#### Extensions 뷰의 Marketplace에서 설치

Extensions 뷰의 Marketplace에서 설치할 수 있습니다.

1. Activity Bar의 **Extensions** 아이콘을 클릭하거나 `Ctrl+Shift+X`(macOS는 `Cmd+Shift+X`)로 Extensions 뷰를 엽니다.
2. 검색창에 `eGovFrame Initializr in VSCode`를 입력합니다.
3. 게시자가 **egovframework**인 항목에서 **Install**을 클릭합니다.

Marketplace 페이지는 [eGovFrame Initializr in VSCode](https://marketplace.visualstudio.com/items?itemName=egovframework.egovframe-vscode-initializr)입니다.

#### VSIX 파일로 설치

VSIX 파일로 설치하려면 Extensions 뷰의 "Install from VSIX..." 메뉴를 사용하거나 아래 명령을 실행합니다.

```bash
code --install-extension egovframe-vscode-initializr-<version>.vsix
```

소스 코드에서 직접 빌드하여 실행하는 방법은 [GettingStarted.md](./docs/GettingStarted.md)를 참고하세요.

### 화면 구성

설치 후 Activity Bar의 **eGov-Initializr** 아이콘을 클릭하면 사이드바에 네 개의 탭이 표시됩니다.

| 탭                            | 기능                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| 프로젝트 (Projects)           | eGovFrame 템플릿 기반 프로젝트 생성                           |
| 코드 생성기 (Code Generator)  | DDL 기반 CRUD 코드 생성과 미리보기                            |
| 설정 (Configuration)          | Spring 설정 파일 생성                                         |
| 아키텍쳐 (Architecture Check) | 표준프레임워크(egovframework) 아키텍처 가이드 준수 여부 점검  |

사이드바 상단의 톱니바퀴 버튼을 누르면 언어, 프로젝트 생성 기본값, CRUD 코드 생성 기본값을 바꿀 수 있는 설정 화면이 열립니다. 자세한 내용은 [설정](#설정-settings) 절을 참고하세요.

## 주요 기능별 상세 설명

### 1. 프로젝트 생성 (Projects)

#### 기능 개요
- eGovFrame 표준 템플릿 기반 프로젝트 자동 생성
- Maven/Gradle 프로젝트 구조 지원
- 8개 카테고리, 23종의 템플릿 제공

| 카테고리   | 템플릿                                                                                       |
| ---------  | -------------------------------------------------------------------------------------------- |
| Web        | Web Project                                                                                  |
| Template   | Simple Homepage, Portal Site, Enterprise Business, Common Components                         |
| Boot       | Web Project, Simple Homepage (Backend), Simple Homepage (Frontend)                           |
| MSA        | Common Components, Portal (Backend), Portal (Frontend)                                       |
| Modulith   | Common Components                                                                            |
| Mobile     | Web Project, Common Components, DeviceAPI Web Project                                        |
| Boot Batch | Scheduler (File), CommandLine (File), Web (File), Scheduler (DB), CommandLine (DB), Web (DB) |
| AI         | RAG Project (Spring AI), RAG Project (Langchain4j)                                           |

#### 사용 방법
1. **템플릿 카테고리**와 **템플릿**을 선택합니다.
2. **Framework Version** 드롭다운에서 생성할 프레임워크 버전을 선택합니다. 내장 버전과 다운로드 버전의 차이는 아래 [프레임워크 버전 선택과 이전 버전 템플릿 다운로드](#프레임워크-버전-선택과-이전-버전-템플릿-다운로드)를 참고하세요.
3. **프로젝트 이름**, **그룹 ID**, **아티팩트 ID**, **출력 경로**를 입력합니다. 그룹 ID와 아티팩트 ID의 기본값은 설정 화면에서 바꿀 수 있습니다.
4. **프로젝트 생성** 버튼을 클릭하면 탭 안에 진행 상황이 단계별로 표시됩니다.
5. 생성이 끝나면 "Open project in new window" 버튼이 있는 알림이 표시되고, 버튼을 누르면 생성된 프로젝트가 새 창에서 열립니다.

POM 템플릿이 있는 템플릿은 선택 정보에 "포함: Maven POM 설정"이 표시되며, 입력한 프로젝트 이름, 그룹 ID, 아티팩트 ID가 반영된 `pom.xml`을 생성합니다. 출력 경로 아래에 같은 이름의 폴더가 이미 있으면 생성이 중단됩니다.

#### 프레임워크 버전 선택과 이전 버전 템플릿 다운로드

템플릿마다 여러 프레임워크 버전을 제공하며, 버전마다 제공 방식이 다릅니다.

| 버전  | 드롭다운 표기                   | 제공 방식                     | 대상 템플릿                                                  |
| ----- | ------------------------------- | ----------------------------- | ------------------------------------------------------------ |
| 5.1.0 | `v5.1.0 (Latest) - Included`    | 확장에 내장된 ZIP을 바로 사용 | 23종 전체                                                    |
| 4.3.1 | `v4.3.1 - Download from GitHub` | GitHub에서 다운로드 후 캐시   | Modulith > Common Components와 AI 카테고리 2종을 제외한 20종 |

다운로드 버전을 선택하면 드롭다운 아래에 **Download Required** 안내와 파일 크기가 표시됩니다. 이 상태에서 프로젝트를 생성하면 다음 순서로 진행됩니다.

1. 템플릿 ZIP(그리고 POM 템플릿이 있으면 POM 파일)을 [eGovFramework/egovframe-templates-download](https://github.com/eGovFramework/egovframe-templates-download/releases) 저장소의 GitHub Releases에서 내려받습니다. 다운로드 경로와 파일 이름은 확장에 내장된 템플릿 목록에서 정해지며, https 연결만 허용합니다.
2. 파일을 임시 파일에 받으면서 sha256 해시를 계산하고, 확장에 기록된 해시와 일치할 때만 캐시로 옮깁니다. 해시가 기록되지 않은 항목은 다운로드하지 않습니다.
3. 캐시된 파일로 프로젝트를 생성합니다. 다음부터는 같은 버전을 선택해도 다시 내려받지 않고 캐시를 사용하며, 캐시를 사용할 때마다 해시를 다시 검증합니다. 캐시 파일이 해시와 다르면 삭제한 뒤 한 번 다시 내려받습니다.

진행 상황은 탭 안에 "Downloading... 45%", "Download verified: ...", "Using cached template: ..." 같은 메시지로 표시됩니다.

캐시는 확장 설치 폴더가 아니라 VS Code 전역 저장소(globalStorage) 아래 `template-cache/{examples,pom}/<version>/`에 저장됩니다. 그래서 확장을 업데이트해도 캐시가 유지되고, 확장을 제거하면 VS Code가 함께 삭제합니다. 캐시는 명령 팔레트의 다음 명령으로 관리합니다.

| 명령                                | 동작                                            |
| ----------------------------------- | ----------------------------------------------- |
| eGovFrame: Show Template Cache Info | 캐시 위치, 전체 크기, 파일 목록 표시            |
| eGovFrame: Clear Template Cache     | 확인 대화상자 후 내려받은 템플릿 파일 전체 삭제 |

내려받은 템플릿이 확장에 기록된 해시와 일치하지 않으면 압축을 풀지 않고 Projects 탭에 안내가 표시됩니다. 이 경우 확장을 최신 버전으로 업데이트하거나, **eGovFrame: Clear Template Cache** 명령으로 캐시를 삭제한 뒤 다시 시도하세요.

### 2. CRUD 코드 생성 (Code Generator)

#### 기능 개요
- DDL 기반 CRUD 코드 자동 생성
- 11개 템플릿 타입 지원 (VO, DefaultVO, Service, ServiceImpl, Controller, Mapper, Mapper Interface, JSP, Thymeleaf 등)
- 실시간 DDL 검증 및 파싱
- **SQL 방언 선택**: MySQL, PostgreSQL, Generic 중 선택합니다. Generic은 기본적인 SQL 구문 검증만 수행합니다.
- **샘플 DDL**: Board, User, Product, Order, Comment 테이블 샘플을 MySQL과 PostgreSQL 방언별로 제공합니다.
- **DDL COMMENT 반영**: 컬럼 COMMENT가 생성되는 VO 필드의 주석에 반영됩니다.
- **타입 매핑**: NUMBER는 정밀도/스케일에 따라, TEXT/BLOB/BYTE는 각각 String/byte[]/byte[]로 Java 타입을 결정합니다.

#### 미리보기 기능
- 생성될 코드를 미리 확인

##### 주요 특징
- **DDL 문법 검증**: `monaco-sql-languages` 라이브러리를 통한 실시간 SQL 문법 검증 및 오류 표시
- **11개 템플릿 미리보기**: VO, DefaultVO, Controller, Service, ServiceImpl, Mapper, Mapper Interface, JSP List/Register, Thymeleaf List/Register
- **미리보기 선택적 자동 업데이트**: 사용자가 원할 때만 자동 미리보기 생성
- **ERD 미리보기**: 입력된 `CREATE TABLE` DDL을 테이블/컬럼/PK/FK 관계 다이어그램으로 시각화
- **병렬 렌더링**: 11개 템플릿을 동시에 처리하여 빠른 미리보기 생성
- **Handlebars 바인딩**: 실제 데이터가 바인딩된 완성된 코드 미리보기

##### 사용 방법
1. **DDL 입력**: 직접 입력하거나 샘플 DDL을 선택하고, SQL 방언을 지정합니다.
2. **빠른 검증**: 500ms 디바운스로 DDL 유효성 검사가 완료됩니다.
3. **미리보기 생성**: "미리보기 생성" 버튼을 클릭합니다.
4. **템플릿 선택**: 드롭다운에서 원하는 템플릿을 선택합니다.
5. **코드 확인**: 실제 바인딩된 코드를 미리 확인합니다.
6. **ERD 확인**: 유효한 DDL이면 Code Generator 화면에서 ERD Preview를 확인합니다.
7. **자동 업데이트**: 체크박스로 DDL 변경 시 자동 미리보기 업데이트를 설정합니다.

##### 성능 최적화
- **지연 로딩**: 필요시에만 미리보기 생성 (기본 동작)
- **병렬 처리**: Promise.all()을 사용한 11개 템플릿 동시 렌더링
- **디바운싱**: 500ms 디바운스로 불필요한 요청 방지
- **캐시 무효화**: DDL 변경시 기존 미리보기 자동 초기화

##### 지원 템플릿 목록

생성 파일은 선택한 출력 경로 아래의 다음 위치에 만들어집니다. `<Table>`은 테이블 이름에서 만든 클래스 이름이고, `<table>`은 첫 글자를 소문자로 바꾼 이름이며, `<package>`는 패키지 이름을 디렉터리 경로로 바꾼 것입니다.

| 템플릿             | 설명                | 생성 위치                                                             |
| ------------------ | ------------------- | --------------------------------------------------------------------- |
| VO                 | Value Object 클래스 | `src/main/java/<package>/service/<Table>VO.java`                      |
| DefaultVO          | 기본 VO 클래스      | `src/main/java/<package>/service/<Table>DefaultVO.java`               |
| Controller         | Spring MVC 컨트롤러 | `src/main/java/<package>/web/<Table>Controller.java`                  |
| Service            | 서비스 인터페이스   | `src/main/java/<package>/service/<Table>Service.java`                 |
| ServiceImpl        | 서비스 구현체       | `src/main/java/<package>/service/impl/<Table>ServiceImpl.java`        |
| Mapper Interface   | MyBatis 인터페이스  | `src/main/java/<package>/service/impl/<Table>Mapper.java`             |
| Mapper             | MyBatis XML 매퍼    | `src/main/resources/mapper/<Table>_SQL.xml`                           |
| Thymeleaf List     | 목록 페이지         | `src/main/resources/templates/thymeleaf/<table>/<table>List.html`     |
| Thymeleaf Register | 등록/수정 페이지    | `src/main/resources/templates/thymeleaf/<table>/<table>Register.html` |
| JSP List           | 목록 페이지         | `src/main/webapp/WEB-INF/jsp/<package>/<table>List.jsp`               |
| JSP Register       | 등록/수정 페이지    | `src/main/webapp/WEB-INF/jsp/<package>/<table>Register.jsp`           |

DAO 템플릿은 제공하지 않으며, 데이터 접근은 Mapper Interface(MyBatis) 방식만 지원합니다.

##### 커스텀 템플릿
- **템플릿 컨텍스트 다운로드**: 현재 DDL로 만든 템플릿 컨텍스트를 `<Table>_TemplateContext.json` 파일로 저장합니다. 커스텀 Handlebars 템플릿을 작성할 때 사용할 수 있는 변수 목록을 확인하는 용도입니다.
- **커스텀 템플릿으로 생성**: 직접 작성한 `.hbs` 템플릿 파일을 선택하면 현재 DDL 컨텍스트로 렌더링한 결과를 `.generated` 파일로 저장합니다. `eq`, `concat`, `lowercase`, `unless`, `setVar` 등의 헬퍼를 사용할 수 있습니다.

### 3. 설정 파일 생성 (Configuration)

#### 기능 개요
- eGovFrame 프로젝트에서 사용하는 Spring 설정 파일을 폼 입력으로 생성
- 7개 카테고리, 21종의 설정 유형 제공

| 카테고리      | 설정 유형                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Cache         | New Cache, New Ehcache Configuration                                                                                        |
| Datasource    | New Datasource, New JNDI Datasource                                                                                         |
| ID Generation | New Sequence ID Generation, New Table ID Generation, New UUID Generation                                                    |
| Logging       | New Console Appender, New File Appender, New Rolling File Appender, New Time-Based Rolling File Appender, New JDBC Appender |
| Property      | New Property                                                                                                                |
| Scheduling    | New Detail Bean Job, New Method Invoking Job, New Simple Trigger, New Cron Trigger, New Scheduler                           |
| Transaction   | New Datasource Transaction, New JPA Transaction, New JTA Transaction                                                        |

#### 출력 형식
- **XML**: 모든 설정 유형에서 지원합니다.
- **Java Config**: Cache > New Cache를 제외한 모든 설정 유형에서 지원합니다.
- **YAML**, **Properties**: Logging 카테고리의 설정 유형에서 지원합니다.

#### 사용 방법
1. **카테고리**와 **Configuration 타입**을 선택하고 **구성** 버튼을 클릭합니다.
2. 폼에서 출력 형식을 고르고 필요한 값을 입력합니다. Java Config를 선택하면 파일 이름 대신 클래스 이름을 입력합니다.
3. 출력 폴더를 지정하고 **설정 생성** 버튼을 클릭하면 선택한 폴더에 설정 파일이 생성됩니다.

### 4. 아키텍처 점검 (Architecture Check)

#### 기능 개요

기존 Java 프로젝트의 소스와 빌드 파일을 읽어 eGovFrame 아키텍처 가이드를 따르는지 점검합니다. 빌드 도구를 실행하지 않고 파일만 읽으므로 빌드 환경이 없어도 점검할 수 있습니다. 점검 항목은 다음 네 가지입니다.

| 항목         | 점검 대상                                     | 내용                                                                   |
| ------------ | --------------------------------------------- | ---------------------------------------------------------------------- |
| Project      | `pom.xml`, `build.gradle`, `build.gradle.kts` | 실행환경 세대·버전, 필수 라이브러리 4종 적용 여부, 모듈 간 버전 일관성 |
| Controller   | `*Controller.java`                            | 어노테이션, 요청 매핑, DAO 직접 주입 금지                              |
| Service      | `*ServiceImpl.java`                           | 상속, 어노테이션, 인터페이스 구현                                      |
| DAO / Mapper | `*DAO.java`, `*Dao.java`, `*Mapper.java`      | 기반 클래스·어노테이션, 빈 등록, 실행환경 세대와의 정합                |

#### 사용 방법
1. **Project Path**에 점검할 프로젝트의 루트 디렉터리를 지정합니다. 기본값은 현재 워크스페이스 폴더이며 **Browse** 버튼으로 바꿀 수 있습니다.
2. **Runtime** 드롭다운에서 실행환경 세대를 지정합니다. **Auto**를 두면 빌드 파일에서 세대를 판정하고, 빌드 파일이 없거나 판정이 어려우면 3.x / 4.x / 5.x를 직접 선택합니다.
3. **Start Architecture Check** 버튼을 클릭하면 진행 상황이 표시되고, 끝나면 결과 요약과 상세 결과가 나타납니다.
4. **Check Results Summary**에서 Project 카드, 전체 파일 수(Total Files), 통과(Passed), 실패(Failed), 통과율과 레이어별 집계를 확인합니다. 점검 대상에서 제외된 파일은 **Skipped** 목록을 펼쳐 사유와 함께 볼 수 있습니다.
5. **Detailed Results**에서 Controller, Service, DAO / Mapper, Project 중 하나를 선택해 파일별 판정을 확인합니다. 파일 이름을 클릭하면 에디터에서 열리고, 각 칸에 마우스를 올리면 판정 사유가 툴팁으로 표시됩니다.
6. **Export Results** 버튼을 클릭하면 결과가 CSV 파일로 저장됩니다.

#### 점검 기준

Controller, Service, DAO / Mapper 레이어는 세 항목을 모두 만족할 때만 `OK`로 판정하고, 하나라도 어긋나면 `NotFound`로 표시합니다. 주석 안에 적힌 어노테이션이나 `extends` 선언은 판정에 쓰지 않습니다.

**Controller 레이어** (`*Controller.java`)

| 항목        | 기준 |
| ----------- | ---- |
| @Controller | 클래스에 `@Controller` 또는 `@RestController` 어노테이션이 있어야 합니다.                                                                                                                                                                                        |
| Mapping     | 클래스 레벨 `@RequestMapping`이 있거나, public 메서드에 `@RequestMapping`, `@GetMapping`, `@PostMapping` 등의 매핑 어노테이션이 있어야 합니다. 클래스 레벨 매핑으로 통과하면 `Class level`, 일부 메서드만 매핑되어 있으면 `매핑된 수/점검 대상 수`로 표시합니다. |
| DAO X       | `*DAO`, `*Dao` 타입과 DAO / Mapper 레이어의 점검 대상인 `*Mapper` 타입을 필드, 매개변수, 지역 변수로 주입받지 않아야 합니다. DAO는 ServiceImpl에서 사용해야 하며, Jackson의 `ObjectMapper` 같은 라이브러리 타입은 실패로 보지 않습니다.                          |

**Service 레이어** (`*ServiceImpl.java`)

| 항목       | 기준                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Extends    | `EgovAbstractServiceImpl`을 상속해야 합니다. 프로젝트 안의 다른 공통 클래스를 거쳐 상속하는 경우도 상속 체인을 최대 5단계까지 추적해 인정합니다. |
| @Service   | 클래스에 `@Service` 어노테이션이 있어야 합니다.                                                                                                  |
| Implements | 이름이 `Service`로 끝나는 인터페이스를 하나 이상 구현해야 합니다.                                                                                |

**DAO / Mapper 레이어** (`*DAO.java`, `*Dao.java`, `*Mapper.java`)

표준프레임워크 적용점검 가이드가 DAO 항목에 iBatis DAO, MyBatis DAO, Mapper 인터페이스 세 방식 중 하나를 택하도록 두므로, 세 패턴의 파일을 한 레이어로 모아 파일 내용으로 방식(Style)을 분류한 뒤 판정합니다.

| 항목    | 기준 |
| ------- | ---- |
| Base    | iBatis DAO는 `EgovAbstractDAO`, MyBatis DAO는 `EgovAbstractMapper`를 상속해야 하며 중간 클래스를 거친 상속도 인정합니다. Mapper 인터페이스는 `@Mapper` 또는 `@EgovMapper` 어노테이션이 있어야 합니다.                      |
| Bean    | DAO 클래스는 구체 클래스에 `@Repository`가 있어야 합니다. Mapper 인터페이스는 어노테이션이 표준프레임워크 패키지에서 import되어야 하며, MyBatis의 `org.apache.ibatis.annotations.Mapper`를 쓰면 실패입니다.                |
| Version | 기반 클래스의 패키지 또는 Mapper 어노테이션이 프로젝트의 실행환경 세대와 일치해야 합니다 (3.x는 `egovframework.rte` 패키지, 4.x는 `@Mapper`, 5.x는 `@EgovMapper`). 세대를 알 수 없으면 `n/a`로 표시하고 판정하지 않습니다. |

다음 파일은 판정에서 제외하고 **Skipped** 목록에 사유와 함께 표시합니다.
- abstract 클래스, `@Configuration` 클래스
- RowMapper처럼 데이터 접근 계층이 아닌 `*Mapper` 클래스, Spring Data 저장소, MapStruct 매퍼
- `@Repository`가 없는 공통 기반 클래스, 클래스 선언이 없는 파일, 읽을 수 없는 파일

**Project** (`pom.xml`, `build.gradle`, `build.gradle.kts`)

| 항목                  | 기준 |
| --------------------- | ---- |
| 실행환경 세대·버전    | 버전 속성 → BOM parent/import → 의존성 버전 → 아티팩트 좌표 패턴 순으로 판정하고 근거(Evidence)를 함께 표시합니다. Runtime 드롭다운으로 수동 지정하면 그 값을 우선합니다. |
| 필수 라이브러리 4종   | `ptl-mvc`, `fdl-cmmn`, `fdl-logging`, `psl-dataaccess`가 직접 선언되어 있거나, 확장에 내장된 실행환경 모듈 의존 그래프(3.9.x ~ 5.1.x)를 따라 전이 의존으로 도달해야 합니다. 모든 모듈에 적용되며, exclusion은 Maven 의미론대로 하위 의존을 끊은 것으로 봅니다. 그래프 밖의 표준프레임워크 아티팩트만 선언한 모듈은 `unknown`으로 표시합니다. |
| 버전 일관성           | 모든 선언과 모듈에서 실행환경 라이브러리 버전이 같아야 합니다. |
| 멀티 모듈             | parent 체인, 내부 모듈 의존, `settings.gradle`의 include를 따라 모듈을 모두 점검합니다. `buildSrc` 빌드 파일과 `packaging pom` 집계 모듈은 판정하지 않고 Skipped로 표시합니다. |
| 데이터 접근 설정 정보 | `SqlMapClientFactoryBean`, `SqlSessionFactoryBean`, `MapperConfigurer`, `@MapperScan`, `mybatis-spring-boot-starter`, `mybatis.mapper-locations`의 존재 여부와 교차 경고(예: Mapper 인터페이스는 있는데 스캔 설정이 없음), 그리고 DAO / Mapper 레이어로 수집되지 않았지만 `JdbcTemplate` 등을 직접 쓰는 미분류 데이터 접근 파일을 정보로 표시합니다. 판정에는 영향을 주지 않습니다. |

Project 항목의 실행환경 세대는 DAO / Mapper 레이어의 Version 판정에 그대로 쓰입니다.

#### 점검 범위
- 숨김 디렉터리(`.`으로 시작)와 `node_modules`, `target`, `build`, `out`, `dist` 디렉터리는 건너뜁니다.
- `src/test`와 `src/it` 아래의 테스트 소스는 점검하지 않습니다.
- 파일 수집에는 VS Code에 내장된 ripgrep을 사용하고, 찾을 수 없으면 파일 시스템 탐색으로 대체합니다. 두 경로는 `.gitignore`와 무관하게 같은 파일 집합을 수집합니다.
- 아키텍처 점검 탭의 화면 문구는 현재 영어로만 제공됩니다.

#### 결과 내보내기

**Export Results**를 누르면 점검한 프로젝트의 루트 디렉터리에 다음 CSV 파일이 저장됩니다. 결과가 있는 항목만 파일이 만들어집니다.

| 파일                           | 열                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `Result_Controller_<날짜>.csv` | Path, FileName, @Controller, Mapping Annotation, DAO X, Result                        |
| `Result_Service_<날짜>.csv`    | Path, FileName, Extends EgovAbstractServiceImpl, @Service, Implements Service, Result |
| `Result_DAO_<날짜>.csv`        | Path, FileName, Style, Base, Bean, Version, Result                                    |
| `Result_Project_<날짜>.csv`    | Module, Item, Status, Evidence                                                        |

셀 값이 스프레드시트에서 수식으로 해석되지 않도록 `=`, `+`, `@` 등으로 시작하는 값에는 `'`를 앞에 붙여 저장합니다.

## 설정 (Settings)

사이드바 상단의 톱니바퀴 버튼을 누르면 설정 화면이 열립니다. 설정 화면에서 바꾼 값은 VS Code 사용자 설정에 저장되므로, VS Code 설정 화면에서 직접 수정해도 됩니다.

| 설정 키                                  | 기본값                         | 설명                                    |
| ---------------------------------------- | ------------------------------ | --------------------------------------- |
| `egovframeInitializr.language`           | `en`                           | UI 표시 언어 (`en`: 영어, `ko`: 한국어) |
| `egovframeInitializr.defaultGroupId`     | `egovframework.com`            | 프로젝트 생성 시 그룹 ID 기본값         |
| `egovframeInitializr.defaultArtifactId`  | `egovframe-project`            | 프로젝트 생성 시 아티팩트 ID 기본값     |
| `egovframeInitializr.defaultPackageName` | `egovframework.example.sample` | CRUD 코드 생성 시 패키지 이름 기본값    |

설정 화면 하단의 About 영역에는 확장 버전과 저장소, 이슈, 전자정부 프레임워크 문서 등으로 이동하는 링크가 있습니다.

## 사용 예시

### 미리보기 기능 사용하기

#### 1. DDL 입력 및 검증
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

#### 2. 미리보기 생성
1. DDL 입력 후 500ms 디바운스로 유효성 검사 완료
2. Code Generator 화면의 "ERD Preview"에서 테이블과 FK 관계 다이어그램 확인
3. "미리보기 생성" 버튼 클릭
4. 드롭다운에서 원하는 템플릿 선택 (예: VO, Controller, Service 등)
5. 실제 바인딩된 코드 미리보기 확인

#### 3. 자동 업데이트 설정
- "DDL 변경시 자동으로 미리보기 업데이트" 체크박스 활성화
- DDL 수정시 자동으로 미리보기 업데이트

#### 4. 코드 생성
- 미리보기 확인 후 "코드 생성" 버튼 클릭
- 선택된 출력 경로(프로젝트)에 미리 정의된 디렉터리 구조에 맞춰 CRUD 파일 생성

### 이전 버전 템플릿으로 프로젝트 생성하기

1. Projects 탭에서 **Boot** 카테고리의 **Web Project** 템플릿을 선택합니다.
2. **Framework Version**에서 `v4.3.1 - Download from GitHub`를 선택하면 Download Required 안내가 표시됩니다.
3. 프로젝트 이름과 출력 경로를 입력하고 **프로젝트 생성**을 클릭합니다.
4. 처음 한 번은 "Downloading... NN%" 진행 메시지가 표시되고, 다운로드와 해시 검증이 끝나면 압축 해제와 POM 생성이 이어집니다.
5. 같은 버전으로 다시 생성하면 "Using cached template: ..." 메시지와 함께 캐시된 파일을 바로 사용합니다.

### 기존 프로젝트 아키텍처 점검하기

1. 점검할 eGovFrame 프로젝트를 VS Code에서 열고 아키텍쳐 탭으로 이동합니다. Project Path에 워크스페이스 폴더가 자동으로 채워집니다.
2. Runtime은 Auto로 두고 **Start Architecture Check**를 클릭합니다.
3. Project 카드에서 판정된 실행환경 세대와 필수 라이브러리 상태를 확인하고, 레이어별 집계에서 실패 파일 수를 확인합니다.
4. Detailed Results에서 실패한 파일을 클릭해 에디터에서 열고 수정합니다.
5. **Export Results**로 CSV를 저장해 점검 결과를 공유합니다.

## 문제 해결

- **동작 로그 확인**: 확장은 **"eGovFrame Initializr"** 출력 채널에 로그를 남깁니다. 생성이나 점검이 실패하면 View → Output에서 이 채널을 선택해 원인을 확인하세요.
- **템플릿 무결성 오류**: 내려받은 템플릿이 확장에 기록된 해시와 다르면 생성이 중단됩니다. 확장을 최신 버전으로 업데이트하거나 **eGovFrame: Clear Template Cache** 명령으로 캐시를 지운 뒤 다시 시도하세요.
- **템플릿 다운로드 실패**: 다운로드는 https 연결만 허용하고 응답 크기는 200MB로 제한됩니다. GitHub에 접근할 수 있는 네트워크인지 확인하고, 프록시 환경이면 VS Code의 프록시 설정을 확인하세요.
- **아키텍처 점검 결과가 비어 있음**: Project Path가 소스가 들어 있는 프로젝트 루트인지 확인하세요. `src/test` 아래의 파일과 빌드 산출물 디렉터리는 점검 대상이 아닙니다.
- **DDL 파싱 실패**: `CREATE TABLE` 문만 지원합니다. 샘플 DDL과 같은 형식으로 입력했는지 확인하세요.

개발 환경에서의 문제 해결 방법은 [DEVELOPER.md](./docs/DEVELOPER.md)의 트러블슈팅 절을 참고하세요.

## 라이선스

이 프로젝트는 Apache-2.0 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 개발팀

- **eGovFrame Center**: 주관 기관
- **기여자**: [기여자 목록](https://github.com/eGovFramework/egovframe-vscode-initializr/graphs/contributors)

## 지원 및 문의

- **이슈 트래킹**: [GitHub Issues](https://github.com/egovframework/egovframe-vscode-initializr/issues)
- **공식 홈페이지**: https://www.egovframe.go.kr
- **문서**: [공식 포털 가이드](https://egovframe.go.kr/docs/) / [GitHub Docs 페이지](https://egovframework.github.io/egovframe-docs/)
