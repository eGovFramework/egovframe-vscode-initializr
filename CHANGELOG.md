# Changelog

## v5.0.0 Beta (2025-12-04)

- v5.0.x Initial Beta Release

## v5.0.1 Beta (2026-01-06)

- sample-controller-template.hbs 핸들바 파싱 오류 수정

## v5.0.2 Beta (2026-01-06)

- sample-thymeleaf-register.hbs 핸들바 파싱 오류 수정

## v5.0.3 (2026-03-XX)

- v5.0.x Initial official Release
- Project Generation
  - AI 카테고리에 **RAG Project (LangChain4j) 템플릿 추가**
  - 표준프레임워크 실행환경 5.0 정식버전이 적용된 템플릿으로 최신화
- Code Generation
  - 기본적인 SQL Validation만 수행하는 "generic" dialect 옵션 추가
  - PackageName 검증 기능 강화
  - 선택한 dialect에 따른 sample DDL 필터링 개선
- Config Generation
  - 입력 필드의 특수문자 및 숫자에 대한 검증 기능 추가
  - Handlebars 템플릿 비교 연산자 오류 수정
- Egov Settings
  - **언어 선택 옵션** 추가
  - 입력값 검증 기능 추가
  - Save Settings 버튼 클릭 시 저장 성공 또는 실패 여부를 시각적으로 확인할 수 있도록 개선