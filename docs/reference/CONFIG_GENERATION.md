# 설정 파일 생성 (Configuration)

이 문서는 설정 탭이 제공하는 설정 유형과 출력 형식, 파일 이름의 규칙을 설명합니다. 확장 내부의 처리 흐름은 [ARCHITECTURE.md](../architecture/ARCHITECTURE.md#설정-파일-생성)에 있습니다.

## 개요

설정 탭은 표준프레임워크 프로젝트에서 사용하는 Spring 설정 파일을 폼 입력으로 생성합니다. 설정 유형을 고르고 폼에 값을 입력하면, 확장에 내장된 Handlebars 템플릿으로 설정 파일 하나를 만들어 지정한 폴더에 저장합니다.

- 설정 유형은 7개 카테고리의 21종입니다.
- 출력 형식은 XML, Java Config, YAML, Properties 가운데 설정 유형이 지원하는 것을 고릅니다.
- 설정 유형의 목록은 확장에 내장된 `templates/templates-context-xml.json`에서 읽습니다.

## 설정 유형과 출력 형식

| 카테고리 | 설정 유형 | XML | Java Config | YAML | Properties |
|----------|-----------|:---:|:-----------:|:----:|:----------:|
| Cache | New Cache | O | | | |
| Cache | New Ehcache Configuration | O | O | | |
| Datasource | New Datasource | O | O | | |
| Datasource | New JNDI Datasource | O | O | | |
| ID Generation | New Sequence ID Generation | O | O | | |
| ID Generation | New Table ID Generation | O | O | | |
| ID Generation | New UUID Generation | O | O | | |
| Logging | New Console Appender | O | | O | O |
| Logging | New File Appender | O | | O | O |
| Logging | New Rolling File Appender | O | | O | O |
| Logging | New Time-Based Rolling File Appender | O | | O | O |
| Logging | New JDBC Appender | O | | O | |
| Property | New Property | O | O | | |
| Scheduling | New Detail Bean Job | O | O | | |
| Scheduling | New Method Invoking Job | O | O | | |
| Scheduling | New Simple Trigger | O | O | | |
| Scheduling | New Cron Trigger | O | O | | |
| Scheduling | New Scheduler | O | O | | |
| Transaction | New Datasource Transaction | O | O | | |
| Transaction | New JPA Transaction | O | O | | |
| Transaction | New JTA Transaction | O | O | | |

- XML은 모든 설정 유형에서 지원합니다.
- Java Config는 Cache > New Cache와 Logging 카테고리를 제외한 15종에서 지원합니다.
- YAML은 Logging 카테고리의 5종에서, Properties는 그 가운데 New JDBC Appender를 제외한 4종에서 지원합니다. 둘 다 Log4j2 설정 파일의 형식입니다.
- 이 표는 화면의 폼에서 고를 수 있는 형식을 기준으로 합니다. 메타데이터(`templates-context-xml.json`)에는 Logging의 Java Config 템플릿도 등록되어 있지만, 5.1.0의 Logging 폼은 Java Config를 선택지로 제공하지 않습니다.

## 사용 방법

1. **카테고리**와 **Configuration 타입**을 선택하고 **구성** 버튼을 클릭합니다.
2. 폼에서 출력 형식을 고르고 필요한 값을 입력합니다. 폼의 안내 링크를 누르면 해당 설정을 설명하는 표준프레임워크 가이드가 열립니다.
3. **생성** 버튼을 클릭합니다. 입력값의 검사를 통과하면 출력 폴더를 고르는 대화상자가 열립니다.
4. 폴더를 선택하면 파일이 만들어지고 에디터에서 열립니다. 선택한 폴더에 같은 이름의 파일이 이미 있으면 생성하지 않고 중복 안내를 표시합니다.

## 파일 이름과 위치

| 출력 형식 | 입력하는 이름 | 생성되는 파일 |
|-----------|---------------|---------------|
| XML | 파일 이름 | `<파일 이름>.xml` |
| Java Config | 클래스 이름 | `<클래스 이름>.java` |
| YAML | 파일 이름 | `<파일 이름>.yaml` |
| Properties | 파일 이름 | `<파일 이름>.properties` |

- 이름에는 확장자를 붙이지 않습니다. 출력 형식에 맞는 확장자가 자동으로 붙습니다.
- 파일 이름에는 영문자, 숫자, 하이픈(`-`), 밑줄(`_`)만 쓸 수 있고, 점이나 경로 구분자는 폼에서 거부됩니다. Java Config의 클래스 이름은 영문 대문자로 시작하고 영문자와 숫자만 씁니다.
- 파일은 항상 선택한 출력 폴더 바로 아래에 만들어집니다.
- 출력 폴더를 고르는 대화상자는 현재 워크스페이스 폴더에서 시작하고, 워크스페이스가 없으면 홈 디렉터리에서 시작합니다.

Java Config는 클래스 파일 하나를 만듭니다. 폼에 입력한 패키지 이름이 `package` 선언에 들어가므로, 출력 폴더는 그 패키지에 해당하는 소스 디렉터리(예: `src/main/java/egovframework/example/config`)로 지정합니다.

## 권장 위치

생성한 설정 파일을 프로젝트가 읽으려면 프로젝트의 설정 구조에 맞는 위치에 두어야 합니다. 이 확장으로 만든 프로젝트 템플릿의 기본 위치는 다음과 같습니다.

| 형식 | 프로젝트 템플릿 | 위치 |
|------|-----------------|------|
| XML (Spring 컨텍스트) | Web Project (`egovframe-web`) | `src/main/resources/egovframework/spring/` (`context-*.xml`) |
| Java Config | Boot > Web Project (`egovframe-boot-web`) | `src/main/java/egovframework/example/config/` (`EgovConfig*.java`) |
| Logging (XML, YAML, Properties) | 두 템플릿 공통 | `src/main/resources/` (`log4j2.xml`) |

프로젝트가 설정 파일을 읽는 위치는 템플릿마다 다를 수 있으므로, 대상 프로젝트의 `web.xml`이나 설정 클래스에서 컨텍스트 설정의 위치를 먼저 확인합니다.

## 제약 사항

- 한 번에 설정 파일 하나만 생성합니다.
- 기존 설정 파일에 내용을 덧붙이거나 병합하지 않습니다. 이미 있는 파일과 같은 이름으로는 생성하지 않으므로, 생성한 내용을 기존 파일에 옮기는 일은 직접 해야 합니다.
- 설정이 요구하는 의존성(예: Ehcache, Quartz, JDBC 드라이버)을 빌드 파일에 추가하지 않습니다. 폼에 표시되는 필수 의존성 안내를 참고해 직접 추가합니다.
- 입력한 값이 대상 환경에서 유효한지(예: DB 접속 정보)는 검사하지 않습니다.
