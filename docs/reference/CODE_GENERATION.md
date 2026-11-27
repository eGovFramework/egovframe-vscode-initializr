# CRUD 코드 생성 (Code Generator)

이 문서는 코드 생성기 탭이 받아들이는 DDL 문법, 컬럼 타입의 매핑, 생성되는 파일과 위치, 미리보기와 ERD, 커스텀 템플릿을 설명합니다. 확장 내부의 처리 흐름은 [ARCHITECTURE.md](../architecture/ARCHITECTURE.md#crud-코드-생성)에 있습니다.

## 개요

코드 생성기 탭은 `CREATE TABLE` 문 하나를 읽어서 그 테이블의 CRUD 코드 11종을 생성합니다. DDL 해석과 템플릿 렌더링은 모두 확장의 코드가 정해진 규칙에 따라 수행하므로, 같은 DDL과 같은 패키지 이름으로 생성하면 항상 같은 코드가 만들어집니다.

- 생성되는 코드는 Controller, Service, ServiceImpl, MyBatis Mapper 인터페이스와 XML, VO, 그리고 Thymeleaf와 JSP 화면입니다.
- 생성한 파일은 이 확장으로 만든 5.1.0 버전의 **Web Project**(`egovframe-web`)와 **Boot > Web Project**(`egovframe-boot-web`)에서 위치를 옮기지 않고 동작하도록 배치됩니다.
- 데이터 접근은 Mapper 인터페이스(MyBatis) 방식만 지원하며, DAO 클래스 템플릿은 제공하지 않습니다.

## 사용 방법

1. **DDL 입력**: `CREATE TABLE` 문을 직접 입력하거나 샘플 DDL을 선택하고, **SQL 방언**을 지정합니다.
2. **검증 확인**: 입력을 멈추면 500ms 뒤에 DDL이 검증되고, 유효하면 파싱된 테이블과 컬럼 수, ERD 미리보기가 표시됩니다.
3. **미리보기**: **미리보기 열기** 버튼을 클릭한 뒤 드롭다운에서 템플릿을 골라 생성될 코드를 확인합니다.
4. **설정 입력**: **패키지 이름**과 **출력 경로**를 지정합니다. 출력 경로는 생성 대상 프로젝트의 루트 디렉터리입니다.
5. **코드 생성**: **CRUD 코드 생성** 버튼을 클릭하면 생성할 파일의 목록이 표시됩니다. 필요한 파일만 남기고 확인하면 파일이 만들어지고, 앞의 3개 파일이 에디터에서 열립니다.

같은 경로에 파일이 이미 있으면 **묻지 않고 덮어씁니다.** 기존 파일을 고쳐 쓴 뒤라면 파일 선택 목록에서 해당 파일의 선택을 해제하거나, 생성하기 전에 변경 사항을 커밋해 둡니다.

## DDL 입력 규칙

### 기본 규칙

- 입력은 `CREATE TABLE`로 시작해야 합니다. 앞에 주석이나 다른 문장이 있으면 유효하지 않은 DDL로 판정합니다.
- 코드는 **첫 번째 `CREATE TABLE` 문의 테이블 하나**에 대해서만 생성합니다. 여러 문장을 넣으면 나머지 테이블은 ERD 미리보기에만 쓰입니다.
- 테이블 이름과 컬럼 이름은 영문자, 숫자, 밑줄로 작성합니다. 백틱과 큰따옴표로 감싼 식별자는 감싼 문자를 떼고 읽습니다.
- 컬럼 정의는 `컬럼이름 타입 [제약 조건...]` 순서로 작성합니다.

권장하는 형태는 다음과 같습니다.

```sql
CREATE TABLE board (
  board_id   INT           NOT NULL AUTO_INCREMENT COMMENT '게시글 번호',
  title      VARCHAR(200)  NOT NULL COMMENT '제목',
  content    TEXT                   COMMENT '내용',
  view_count INT           DEFAULT 0 COMMENT '조회수',
  created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP COMMENT '등록일시',
  PRIMARY KEY (board_id)
) COMMENT='게시판';
```

### SQL 방언

| 방언 | 편집기의 문법 검사 | 샘플 DDL |
|------|--------------------|----------|
| MySQL | MySQL 문법으로 실시간 검사 | Board, User, Product, Order, Comment |
| PostgreSQL | PostgreSQL 문법으로 실시간 검사 | Board, User, Product, Order, Comment |
| Generic | 기본적인 SQL 구문 검사만 수행 | 제공하지 않음 |

방언은 편집기의 문법 검사와 샘플 DDL의 목록에만 영향을 줍니다. 코드 생성에 쓰는 DDL 파서는 방언과 관계없이 같은 규칙으로 동작합니다. Oracle 등 다른 DBMS의 DDL은 Generic으로 두고 입력합니다.

### 파싱 방식

DDL은 외부 SQL 파서를 쓰지 않고 정규식 기반의 파서로 해석합니다.

1. `CREATE TABLE [IF NOT EXISTS] 테이블이름 (` 을 찾아 테이블 이름과 본문을 추출합니다.
2. 본문을 최상위 쉼표로 나누어 컬럼 정의와 제약 조건으로 구분합니다. 문자열 리터럴(COMMENT, DEFAULT의 값) 안에 있는 쉼표, 괄호, 세미콜론은 구분자로 보지 않습니다.
3. 정의마다 첫 단어를 컬럼 이름으로, 두 번째 단어를 타입으로 읽습니다.

`KEY`, `UNIQUE KEY`, `CONSTRAINT`, `FOREIGN KEY`로 시작하는 정의는 컬럼으로 보지 않고 건너뜁니다.

### 이름 변환

| 대상 | 규칙 | 예 |
|------|------|-----|
| 클래스 이름 | 테이블 이름을 PascalCase로 변환 | `board_comment` → `BoardComment` |
| 필드 이름 | 컬럼 이름을 camelCase로 변환 | `created_at` → `createdAt`, `addr_1` → `addr1` |
| SQL의 테이블 이름 | DDL에 적힌 원본을 그대로 사용 | `board_comment` |

밑줄이 없는 이름은 단어의 경계를 알 수 없으므로 첫 글자만 바뀝니다. 예를 들어 테이블 이름 `BOARDCOMMENT`는 클래스 이름 `Boardcomment`가 됩니다.

### 제약 조건

| 구문 | 지원 내용 |
|------|-----------|
| 기본 키 | 컬럼에 붙인 `PRIMARY KEY`와 별도의 `PRIMARY KEY (...)` 절을 모두 인식합니다. 복합 기본 키는 모든 컬럼이 SQL의 조건절에 반영됩니다. |
| `NOT NULL` | 인식합니다. 기본 키가 아닌 NOT NULL 컬럼은 등록/수정 화면의 필수 입력 항목이 됩니다. 기본 키 컬럼도 NOT NULL로 보지만 화면에서는 따로 처리합니다. |
| `DEFAULT`, `AUTO_INCREMENT`, `IDENTITY`, `SERIAL` 계열 타입 | 값을 비워도 DB가 채우는 컬럼으로 인식합니다. |
| 외래키 | 코드 생성에는 쓰지 않고 ERD 미리보기에만 표시합니다. |

기본 키가 없는 테이블은 첫 번째 컬럼을 조회·수정·삭제 SQL의 조건으로 사용합니다. 첫 번째 컬럼이 행을 유일하게 가리키지 않으면 여러 행이 함께 수정되거나 삭제되므로, 기본 키를 선언한 DDL을 사용합니다.

### COMMENT

| 구문 | 예 | 반영되는 곳 |
|------|-----|-------------|
| 컬럼 정의 안의 COMMENT | `title VARCHAR(200) COMMENT '제목'` | VO 필드의 주석 |
| PostgreSQL의 COMMENT 문 | `COMMENT ON COLUMN board.title IS '제목';` | VO 필드의 주석 |

COMMENT가 없는 컬럼은 컬럼 이름을 주석으로 씁니다. COMMENT의 내용에 `primary key`나 `references` 같은 문구가 있어도 제약 조건으로 오인하지 않습니다.

## 컬럼 타입

### Java 타입 매핑

| SQL 타입 | Java 타입 |
|----------|-----------|
| `VARCHAR`, `VARCHAR2`, `NVARCHAR`, `NVARCHAR2`, `CHAR`, `NCHAR`, `TEXT`, `TINYTEXT`, `MEDIUMTEXT`, `LONGTEXT`, `CLOB`, `NCLOB`, `ENUM`, `SET` | `java.lang.String` |
| `INT`, `INTEGER`, `MEDIUMINT`, `SERIAL` | `java.lang.Integer` |
| `BIGINT`, `BIGSERIAL` | `java.lang.Long` |
| `SMALLINT`, `SMALLSERIAL` | `java.lang.Short` |
| `TINYINT` | `java.lang.Byte` |
| `DECIMAL`, `NUMERIC` | `java.math.BigDecimal` |
| `FLOAT` | `java.lang.Float` |
| `REAL`, `DOUBLE` | `java.lang.Double` |
| `NUMBER` | 정밀도와 스케일에 따라 결정 (아래 표) |
| `DATE` | `java.time.LocalDate` |
| `TIME` | `java.time.LocalTime` |
| `DATETIME`, `TIMESTAMP` | `java.time.LocalDateTime` |
| `TIMESTAMP WITH TIME ZONE` | `java.sql.Timestamp` |
| `TIME WITH TIME ZONE` | `java.sql.Time` |
| `BOOLEAN`, `BOOL`, `BIT` | `java.lang.Boolean` |
| `BLOB`, `TINYBLOB`, `MEDIUMBLOB`, `LONGBLOB`, `BINARY`, `VARBINARY`, `BYTEA`, `RAW` | `byte[]` |

표에 없는 타입은 거부하지 않고 `java.lang.Object`로 매핑합니다. 이 경우 생성된 화면과 SQL이 의도대로 동작하지 않을 수 있으므로 표에 있는 타입으로 바꾸어 쓰는 것을 권장합니다.

Oracle의 `NUMBER`는 다음과 같이 매핑합니다.

| 선언 | Java 타입 |
|------|-----------|
| `NUMBER` (크기 없음) | `java.math.BigDecimal` |
| 스케일이 1 이상 (예: `NUMBER(15,2)`) | `java.math.BigDecimal` |
| 스케일이 0이고 정밀도가 9 이하 | `java.lang.Integer` |
| 스케일이 0이고 정밀도가 10 이상 18 이하 | `java.lang.Long` |
| 스케일이 0이고 정밀도가 19 이상 | `java.math.BigDecimal` |

### 화면에 영향을 주는 타입과 제약

등록/수정 화면(Thymeleaf, JSP)의 입력란은 컬럼의 Java 타입과 제약 조건에 따라 달라집니다. 아래의 표는 기본 키가 아닌 컬럼에 해당합니다. 기본 키 컬럼은 등록 화면에 입력란이 나오지 않고, 수정 화면에는 읽기 전용 입력란으로 표시됩니다. 그래서 기본 키의 값은 `AUTO_INCREMENT`나 시퀀스처럼 DB가 채우는 방식이어야 하며, 그렇지 않으면 생성된 ServiceImpl이나 화면을 고쳐서 값을 넣어야 합니다.

| 조건 | 화면에서의 처리 |
|------|-----------------|
| 정수 타입 (`Integer`, `Long`, `Short`, `Byte`) | `type="number"`, `step="1"` 입력란 |
| 소수 타입 (`BigDecimal`, `Float`, `Double`) | `type="number"`, `step="any"` 입력란 |
| `LocalDate` | `type="date"` 입력란. VO 필드에 `@DateTimeFormat(pattern = "yyyy-MM-dd")` |
| `LocalDateTime` | `type="datetime-local"` 입력란. VO 필드에 `@DateTimeFormat(pattern = "yyyy-MM-dd'T'HH:mm")` |
| `LocalTime` | `type="time"` 입력란. VO 필드에 `@DateTimeFormat(pattern = "HH:mm")` |
| `Boolean` | 빈 값, true, false 가운데 고르는 선택란 |
| 그 밖의 타입 | `type="text"` 입력란 |
| `NOT NULL`이고 DEFAULT가 없는 컬럼 | 등록 화면과 수정 화면에서 필수 입력(`required`) |
| `NOT NULL`이고 DEFAULT가 있는 컬럼 | 수정 화면에서만 필수 입력. 등록 화면에서 비우면 DB의 DEFAULT가 적용됩니다. |

- 화면은 저장하기 전에 브라우저의 입력 검사(`reportValidity()`)를 실행합니다.
- Controller는 비운 입력란을 빈 문자열이 아니라 `null`로 받습니다(`@InitBinder`의 `StringTrimmerEditor`). 그래서 NULL을 허용하는 숫자, 날짜, 외래키 컬럼을 비운 채 저장할 수 있습니다.
- Mapper의 INSERT 문은 값이 있는 컬럼만 포함하므로, 비운 컬럼에는 DDL의 DEFAULT가 적용됩니다.

## 생성되는 파일

생성 파일은 출력 경로 아래의 다음 위치에 만들어집니다. `<Table>`은 테이블 이름에서 만든 클래스 이름이고, `<table>`은 그 첫 글자를 소문자로 바꾼 이름이며, `<package>`는 패키지 이름을 디렉터리 경로로 바꾼 것입니다.

| 템플릿 | 설명 | 생성 위치 |
|--------|------|-----------|
| VO | 컬럼을 필드로 갖는 Value Object | `src/main/java/<package>/service/<Table>VO.java` |
| DefaultVO | 검색 조건과 페이징 필드를 갖는 기본 VO | `src/main/java/<package>/service/<Table>DefaultVO.java` |
| Controller | Spring MVC 컨트롤러 | `src/main/java/<package>/web/<Table>Controller.java` |
| Service | 서비스 인터페이스 | `src/main/java/<package>/service/<Table>Service.java` |
| ServiceImpl | 서비스 구현체 | `src/main/java/<package>/service/impl/<Table>ServiceImpl.java` |
| Mapper Interface | MyBatis Mapper 인터페이스 | `src/main/java/<package>/service/impl/<Table>Mapper.java` |
| Mapper | MyBatis Mapper XML | `src/main/resources/egovframework/sqlmap/example/mappers/<Table>_SQL.xml` |
| Thymeleaf List | 목록 화면 | `src/main/resources/templates/thymeleaf/<table>/<table>List.html` |
| Thymeleaf Register | 등록/수정 화면 | `src/main/resources/templates/thymeleaf/<table>/<table>Register.html` |
| JSP List | 목록 화면 | `src/main/webapp/WEB-INF/jsp/egovframework/example/<table>/<table>List.jsp` |
| JSP Register | 등록/수정 화면 | `src/main/webapp/WEB-INF/jsp/egovframework/example/<table>/<table>Register.jsp` |

Mapper XML과 JSP의 생성 위치는 패키지 이름과 관계없이 고정되어 있습니다. Web Project(`egovframe-web`)와 Boot > Web Project(`egovframe-boot-web`) 템플릿이 Mapper XML을 `classpath:/egovframework/sqlmap/example/mappers/*.xml`에서, JSP를 `/WEB-INF/jsp/egovframework/example/` 아래에서 읽기 때문입니다. 프로젝트의 Mapper 위치나 뷰 리졸버의 접두어를 바꾸었다면 생성된 파일을 해당 위치로 옮겨야 합니다.

### 화면의 URL

생성된 Controller는 다음 주소를 처리합니다. `Board` 테이블을 예로 들면 목록 화면의 주소는 `/board/boardList.do`입니다.

| 주소 | 메서드 | 동작 |
|------|--------|------|
| `/<table>/<table>List.do` | GET | 목록 조회 (검색, 페이징) |
| `/<table>/add<Table>View.do` | POST | 등록 화면 |
| `/<table>/add<Table>.do` | POST | 등록 |
| `/<table>/update<Table>View.do` | POST | 수정 화면 |
| `/<table>/update<Table>.do` | POST | 수정 |
| `/<table>/delete<Table>.do` | POST | 삭제 |

### 생성한 뒤에 할 일

- JSP 프로젝트에는 Thymeleaf 화면이, Thymeleaf 프로젝트에는 JSP 화면이 필요하지 않습니다. 파일 선택 목록에서 쓰지 않는 화면의 선택을 해제합니다.
- 대상 DB에 DDL의 테이블을 만듭니다. 프로젝트 템플릿의 내장 DB(HSQL)를 쓴다면 초기화 스크립트에 테이블 정의를 추가합니다.
- 목록 조회 SQL의 페이징은 `LIMIT ... OFFSET ...` 구문을 사용합니다. 이 구문을 지원하지 않는 DBMS(Oracle 11g 등)에서는 페이징 구문을 고쳐야 합니다.

## 미리보기와 ERD

| 기능 | 동작 |
|------|------|
| DDL 검증 | 입력 후 500ms가 지나면 편집기의 문법 검사 결과와 확장의 DDL 파서로 유효성을 판정합니다. |
| 미리보기 열기 | **미리보기 열기** 버튼을 클릭했을 때 11개 템플릿을 병렬로 렌더링합니다. DDL이 바뀌면 이전 미리보기는 무효가 됩니다. **미리보기 닫기** 버튼으로 미리보기를 접습니다. |
| 항상 미리보기 열기 | **항상 미리보기 열기**를 선택하면 DDL이 바뀔 때마다 미리보기를 다시 만듭니다. |
| 템플릿 선택 | 드롭다운에서 고른 템플릿의 렌더링 결과를 언어별 문법 강조와 함께 읽기 전용으로 표시합니다. |
| ERD 미리보기 | 입력한 모든 `CREATE TABLE` 문의 테이블, 컬럼, 기본 키, 외래키 관계를 다이어그램으로 표시합니다. |

ERD의 외래키 관계는 컬럼에 붙인 `REFERENCES`와 `FOREIGN KEY (...) REFERENCES ...` 절에서 읽습니다. 별도의 `ALTER TABLE` 문으로 추가한 외래키는 표시하지 않습니다.

## 커스텀 템플릿

기본 템플릿 대신 직접 작성한 Handlebars 템플릿으로 코드를 만들 수 있습니다.

1. **템플릿 컨텍스트 다운로드**를 클릭하고 폴더를 선택하면, 현재 DDL로 만든 템플릿 컨텍스트가 `<Table>_TemplateContext.json`으로 저장됩니다. 이 파일에서 템플릿에 쓸 수 있는 변수를 확인합니다.
2. 변수를 사용해 `.hbs` 템플릿을 작성합니다.
3. **커스텀 템플릿으로 생성**을 클릭해 `.hbs` 파일을 선택하면, 현재 DDL의 컨텍스트로 렌더링한 결과가 `<템플릿 파일 이름>.generated` 파일로 저장됩니다.

### 템플릿 컨텍스트

| 변수 | 내용 | 예 |
|------|------|-----|
| `tableName`, `className` | 클래스 이름 (PascalCase) | `Board` |
| `classNameFirstCharLower` | 첫 글자를 소문자로 바꾼 클래스 이름 | `board` |
| `dbTableName` | DDL에 적힌 원본 테이블 이름 | `board` |
| `packageName` | 패키지 이름 | `egovframework.example.sample` |
| `attributes` | 전체 컬럼의 배열 | |
| `pkAttributes` | 기본 키 컬럼의 배열 | |
| `author`, `date`, `version` | 파일 머리 주석에 쓰는 값 | `author`, 생성일, `1.0.0` |

`attributes`와 `pkAttributes`의 각 항목은 다음 필드를 갖습니다.

| 필드 | 내용 | 예 |
|------|------|-----|
| `columnName` | 원본 컬럼 이름 | `created_at` |
| `ccName` | camelCase 이름 | `createdAt` |
| `pcName` | PascalCase 이름 | `CreatedAt` |
| `dataType` | 크기를 뗀 SQL 타입 | `TIMESTAMP` |
| `javaType` | Java 타입 | `java.time.LocalDateTime` |
| `comment` | 컬럼의 COMMENT (없으면 컬럼 이름) | `등록일시` |
| `isPrimaryKey` | 기본 키 여부 | `false` |
| `isNotNull` | NOT NULL 여부 (기본 키 포함) | `false` |
| `hasDefault` | 값을 비워도 DB가 채우는 컬럼인지 여부 | `true` |
| `inputType` | 입력란 종류 (`text`, `number`, `boolean`, `date`, `datetime-local`, `time`) | `datetime-local` |
| `inputStep` | 숫자 입력란의 `step` (정수 `1`, 소수 `any`, 그 밖에는 빈 문자열) | |
| `dateTimePattern` | `@DateTimeFormat`의 패턴 (날짜·시간 타입이 아니면 빈 문자열) | `yyyy-MM-dd'T'HH:mm` |

### 헬퍼

| 헬퍼 | 동작 |
|------|------|
| `eq a b` | 두 값이 같은지 비교 |
| `concat a b ...` | 인자를 이어 붙인 문자열 |
| `lowercase str` | 소문자로 변환 |
| `unless`, `empty` | 조건 분기, 빈 값 검사 |
| `setVar name value` | 템플릿 안에서 쓸 변수를 설정 |
| `add a b` | 두 수의 합 |

Handlebars는 mustache에 붙은 중괄호를 삼키므로, `${...}`나 `#{...}`처럼 중괄호가 들어가는 문자열은 `{{concat "#{" ccName "}"}}`와 같이 `concat`으로 만듭니다.

## 제약 사항

- 한 번에 테이블 하나의 코드만 생성합니다. 여러 테이블의 코드가 필요하면 테이블마다 반복합니다.
- 같은 경로의 기존 파일은 확인 없이 덮어씁니다.
- 외래키로 연결된 테이블의 조회(JOIN), 첨부파일, 권한 처리는 생성하지 않습니다.
- 생성되는 화면의 문구는 영문이고, 항목 이름에는 컬럼 이름을 PascalCase로 바꾼 값(예: `created_at`은 `CreatedAt`)을 씁니다. 컬럼의 COMMENT는 VO의 주석에만 반영됩니다.
- 생성된 코드는 표준프레임워크 실행환경 5.x를 기준으로 합니다. Mapper 인터페이스에 `@EgovMapper`를 쓰고 `jakarta.*` 패키지를 import하므로, 실행환경 4.x 프로젝트(`@Mapper`, `javax.*`)에서는 해당 부분을 고쳐야 컴파일됩니다.
