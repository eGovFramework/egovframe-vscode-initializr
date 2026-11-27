# eGovFrame VSCode Initializr 문서

`egovframe-vscode-initializr`는 전자정부 표준프레임워크(eGovFrame) 프로젝트의 생성, CRUD 코드 생성, 설정 파일 생성, 아키텍처 점검을 VS Code 안에서 수행하는 확장입니다. 이 디렉터리의 문서는 확장의 설치와 기능별 사용법, 내부 구조, 개발과 배포에 필요한 내용을 주제별 폴더로 나누어 다룹니다. 확장의 개요와 빠른 사용법은 저장소 최상위의 [README](../README.md)에 있습니다.

이 문서들은 확장 5.1.0을 기준으로 작성되었습니다.

## 폴더 구성

| 폴더 | 주제 | 주요 독자 |
|------|------|-----------|
| [setup/](./setup/) | 확장 설치, 화면 구성, 설정, 문제 해결 | 사용자 |
| [reference/](./reference/) | 네 가지 기능의 입력과 동작, 생성되는 결과물, 점검 규칙 | 사용자, 생성 결과와 점검 결과를 해석하는 사람 |
| [architecture/](./architecture/) | 확장의 구성과 메시지 흐름, 아키텍처 점검 엔진 | 개발자 |
| [development/](./development/) | 개발 환경, 빌드와 테스트, 코드 수정 규칙 | 개발자, 컨트리뷰터 |
| [operations/](./operations/) | VSIX 패키징과 배포, 프로젝트 템플릿 갱신 | 유지보수자 |
| [release-notes/](./release-notes/) | 버전별 릴리스 노트 | 모든 독자 |

## 사용자 문서

| 문서 | 설명 |
|------|------|
| [setup/INSTALLATION_GUIDE.md](./setup/INSTALLATION_GUIDE.md) | Marketplace와 VSIX로 설치하는 방법, 화면 구성, 설정 항목, 명령, 문제 해결 |
| [reference/PROJECT_GENERATION.md](./reference/PROJECT_GENERATION.md) | 프로젝트 템플릿 23종과 프레임워크 버전, 입력값 규칙, 이전 버전 템플릿의 다운로드와 캐시 |
| [reference/CODE_GENERATION.md](./reference/CODE_GENERATION.md) | 받아들이는 DDL 문법, 컬럼 타입의 매핑, 생성되는 파일 11종과 위치, 미리보기와 ERD, 커스텀 템플릿 |
| [reference/CONFIG_GENERATION.md](./reference/CONFIG_GENERATION.md) | 설정 유형 21종과 출력 형식(XML, Java Config, YAML, Properties), 파일 이름 규칙 |
| [reference/ARCHITECTURE_CHECK.md](./reference/ARCHITECTURE_CHECK.md) | Project(빌드 파일), Controller, Service, DAO / Mapper의 점검 항목과 판정 규칙, 결과 화면과 CSV, 점검 범위의 한계 |
| [release-notes/v5.1.0.md](./release-notes/v5.1.0.md) | 5.1.0 릴리스 노트 |

## 개발자와 유지보수자 문서

| 문서 | 설명 |
|------|------|
| [architecture/ARCHITECTURE.md](./architecture/ARCHITECTURE.md) | 확장 호스트와 웹뷰의 구성, 메시지 계약, 기능별 처리 흐름, 폴더 구조, 웹뷰 UI와 보안 설정(CSP) |
| [architecture/ARCH_CHECK_ENGINE.md](./architecture/ARCH_CHECK_ENGINE.md) | 아키텍처 점검 엔진의 모듈 구성과 의존 방향, 파일 수집, ripgrep 탐색, 실행환경 모듈 그래프 |
| [development/GETTING_STARTED.md](./development/GETTING_STARTED.md) | 저장소를 처음 받아서 확장을 실행하고 디버깅하기까지의 절차 |
| [development/DEVELOPMENT_GUIDE.md](./development/DEVELOPMENT_GUIDE.md) | 명령, 코드 규칙, 메시지와 템플릿을 추가하는 절차, 결과 계약 동기화, Git LFS 문제 해결 |
| [development/TESTING_GUIDE.md](./development/TESTING_GUIDE.md) | 확장 호스트와 웹뷰의 테스트 실행 방법과 구성, 생성 코드의 실제 동작 확인 절차 |
| [operations/RELEASE_GUIDE.md](./operations/RELEASE_GUIDE.md) | VSIX의 구성과 제작, 점검, 프로젝트 템플릿과 매니페스트의 갱신, 릴리스 절차 |

## 제공 기능

| 탭 | 기능 |
|----|------|
| 프로젝트 (Projects) | 표준프레임워크 템플릿으로 Maven/Gradle 프로젝트를 생성 |
| 코드 생성기 (Code Generator) | `CREATE TABLE` DDL로 CRUD 코드 11종을 생성하고, 미리보기와 ERD를 표시 |
| 설정 (Configuration) | 폼 입력으로 Spring 설정 파일을 생성 |
| 아키텍쳐 (Check Arch) | 기존 Java 프로젝트가 표준프레임워크 아키텍처 가이드를 따르는지 점검 |

이 확장의 기능을 AI 클라이언트에서 쓰도록 만든 MCP 서버가 따로 있습니다. 코드 생성은 [egovframe-mcp-codegen](https://github.com/eGovFramework/egovframe-mcp-codegen) 서버가, 아키텍처 준수 점검은 [egovframe-mcp-check](https://github.com/eGovFramework/egovframe-mcp-check) 서버가, 가이드와 공통컴포넌트 등의 자료 검색은 [egovframe-mcp-search](https://github.com/eGovFramework/egovframe-mcp-search) 서버가 제공합니다.
