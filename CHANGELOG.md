# Changelog

## Unreleased

- Code Generation
  - DDL 입력 내용을 기반으로 테이블, 컬럼, PK/FK, 1:N 관계를 표시하는 ERD Preview 추가
- Project Generation
  - POM 생성 시 입력값(프로젝트명·groupId 등)에 `$`가 포함되면 `String.replace`의 치환 특수 시퀀스로 해석되어 pom.xml이 손상되던 문제 수정
- Refactoring
  - 불필요한 try/catch(no-useless-catch) 제거 (codeGenerator.ts)

## v5.0.0 Beta (2025-12-04)

- v5.0.x Initial Beta Release

## v5.0.1 Beta (2026-01-06)

- sample-controller-template.hbs 핸들바 파싱 오류 수정

## v5.0.2 Beta (2026-01-06)

- sample-thymeleaf-register.hbs 핸들바 파싱 오류 수정

## v5.0.3 (2026-03-31)

- v5.0.x Initial official Release
- Project Generation
  - AI 카테고리에 **RAG Project (LangChain4j) 템플릿 추가**
  - 표준프레임워크 실행환경 5.0 정식버전이 적용된 템플릿으로 최신화
- Code Generation
  - 기본적인 SQL Validation만 수행하는 "generic" dialect 옵션 추가
  - Thymeleaf 핸들바 템플릿 2종 생성 경로 수정
  - PackageName 검증 기능 강화
  - 선택한 dialect에 따른 sample DDL 필터링 개선
- Config Generation
  - 입력 필드의 특수문자 및 숫자에 대한 검증 기능 추가
  - Handlebars 템플릿 비교 연산자 오류 수정
- Egov Settings
  - **언어 선택 옵션** 추가
  - 입력값 검증 기능 추가
  - Save Settings 버튼 클릭 시 저장 성공 또는 실패 여부를 시각적으로 확인할 수 있도록 개선

## v5.0.4 (2026-04-10)

- Project Generation 
    - egovframe-boot-simple-backend 템플릿 KISA 보안 취약점(KVE-2026-0588) 업데이트
    - 기타 템플릿 오류 수정

## v5.0.5 (2026-05-18)

- Project Generation
  - 템플릿 보안 취약점 업데이트: Common Components, Boot Simple Homepage (Backend/Frontend), MSA Portal (Backend)
