# eGovFrame VSCode Initializr

## 개요

**eGovFrame VSCode Initializr**는 전자정부 표준프레임워크(eGovFrame) 프로젝트 생성 및 설정을 위한 Visual Studio Code 확장 프로그램입니다. 개발자가 eGovFrame 기반 프로젝트를 쉽고 빠르게 시작할 수 있도록 도와주는 통합 도구입니다.

가이드 문서들 목록은 다음과 같습니다.
- **README.md**: Extension 사용자를 위한 기능 활용 방법 소개
- **[CONTRIBUTING.md](https://github.com/eGovFramework/egovframe-vscode-initializr?tab=contributing-ov-file#contributing-guide)**: 컨트리뷰션 참여자를 위한 컨트리뷰션 참여 방법 소개
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)**: Extension 개발자를 위한 아키텍쳐, 폴더 구조 소개
- **[GettingStarted.md](./docs/GettingStarted.md)**: eGovFrame VSCode Initializr를 처음 개발하는 분들을 위한 소개
- **[DEVELOPER.md](./docs/DEVELOPER.md)**: eGovFrame VSCode Initializr 개발을 위한 기능, 시스템, 기술스택 소개

## 주요 기능

- **프로젝트 생성 기능**: eGovFrame 템플릿 기반 프로젝트 자동 생성
- **CRUD 코드 생성 기능**: DDL 기반 CRUD 코드 자동 생성
  - **실시간 미리보기**: DDL 변경시 템플릿 미리보기 자동 업데이트 (11개 템플릿 지원)
  - **성능 최적화**: 병렬 렌더링 및 지연 로딩으로 빠른 응답성
- **설정 코드 생성 기능**: Spring Framework 설정 파일 (XML, Java Config, YAML, Properties) 생성
- **VSCode 네이티브 UI**: VSCode 테마 통합 커스텀 React 컴포넌트 기반 사용자 인터페이스
- **다크/라이트 테마**: VSCode 테마 자동 연동 및 실시간 전환 지원

## 주요 기능별 상세 설명

### 1. 프로젝트 생성 (Projects)

#### 기능 개요
- eGovFrame 표준 템플릿 기반 프로젝트 자동 생성
- Maven/Gradle 프로젝트 구조 지원
- 다양한 카테고리별 템플릿 제공

### 2. 코드 생성 (CodeView)

#### 기능 개요
- DDL 기반 CRUD 코드 자동 생성
- 11개 템플릿 타입 지원 (VO, DefaultVO, Service, ServiceImpl, Controller, Mapper, Mapper Interface, JSP, Thymeleaf 등)
- 실시간 DDL 검증 및 파싱

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
1. **DDL 입력**: MySQL/PostgreSQL DDL 문법으로 테이블 정의
2. **빠른 검증**: 500ms 디바운스로 DDL 유효성 검사 완료
3. **미리보기 생성**: "미리보기 생성" 버튼 클릭
4. **템플릿 선택**: 드롭다운에서 원하는 템플릿 선택
5. **코드 확인**: 실제 바인딩된 코드 미리보기
6. **ERD 확인**: 유효한 DDL이면 Code Generator 화면에서 ERD Preview 확인
7. **자동 업데이트**: 체크박스로 DDL 변경시 자동 미리보기 업데이트 설정

##### 성능 최적화
- **지연 로딩**: 필요시에만 미리보기 생성 (기본 동작)
- **병렬 처리**: Promise.all()을 사용한 11개 템플릿 동시 렌더링
- **디바운싱**: 500ms 디바운스로 불필요한 요청 방지
- **캐시 무효화**: DDL 변경시 기존 미리보기 자동 초기화

##### 지원 템플릿 목록
| 템플릿 | 설명 | 파일 확장자 |
|--------|------|-------------|
| **VO** | Value Object 클래스 | `.java` |
| **DefaultVO** | 기본 VO 클래스 | `.java` |
| **Controller** | Spring MVC 컨트롤러 | `.java` |
| **Service** | 서비스 인터페이스 | `.java` |
| **ServiceImpl** | 서비스 구현체 | `.java` |
| **Mapper** | MyBatis XML 매퍼 | `.xml` |
| **Mapper Interface** | MyBatis 인터페이스 | `.java` |
| **JSP List** | 목록 페이지 | `.jsp` |
| **JSP Register** | 등록/수정 페이지 | `.jsp` |
| **Thymeleaf List** | 목록 페이지 | `.html` |
| **Thymeleaf Register** | 등록/수정 페이지 | `.html` |

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
- 미리보기 확인 후 "Generate Code" 버튼 클릭
- 선택된 출력 경로(프로젝트)에 미리 정의된 디렉터리 구조에 맞춰 CRUD 파일 생성

## 라이선스

이 프로젝트는 Apache-2.0 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 개발팀

- **eGovFrame Center**: 주관 기관
- **기여자**: [기여자 목록](#)

## 지원 및 문의

- **이슈 트래킹**: [GitHub Issues](https://github.com/egovframework/egovframe-vscode-initializr/issues)
- **공식 홈페이지**: https://www.egovframe.go.kr
- **문서**: [Wiki 페이지](https://www.egovframe.go.kr/wiki/doku.php) / [GitHub Docs 페이지](https://egovframework.github.io/egovframe-docs/)
