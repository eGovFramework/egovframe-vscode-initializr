# Contributing Guide

## 개요

본 문서는 컨트리뷰션 가이드 문서입니다.

목차는 다음과 같습니다.

- 컨트리뷰션 참여 방법
- 코딩 컨벤션
- 새로운 UI 컴포넌트 추가하기
- 새로운 템플릿 추가하기
- 개발 워크플로우

## 컨트리뷰션 참여 방법

### 1. Git LFS 설치(필수)

Git LFS 패키지를 설치합니다.

  -  **Windows**는 [Windows용 Git 배포판](https://gitforwindows.org/)에 Git LFS 패키지도 포함되어 있습니다. 설치 마법사에서 "Use Git from Windows Command Prompt" 옵션을 체크해야 합니다. 만약 Git LFS 패키지를 최신 버전으로 업그레이드 하기를 원한다면, Chocolatey 패키지 관리자를 사용할 수 있습니다.
  ```bash
  # Windows - Git LFS를 최신버전으로 설치하고 싶다면
  choco install git-lfs.install
  ```

  - **macOS**는 Homebrew를 이용해 Git LFS 패키지를 설치할 수 있습니다.
  ```bash
  # macOS - Homebrew(권장)
  brew install git-lfs
  ```

  - **Linux**는 packagecloud 레포지토리에서 제공하는 스크립트를 이용하여 설치합니다. 자세한 내용은 [Git LFS 레포지토리](https://github.com/git-lfs/git-lfs/blob/main/INSTALLING.md)에서 확인 가능합니다.
  ```bash
  # Ubuntu/Debian Linux
  curl -s https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh | sudo bash
  sudo apt-get install git-lfs

  # RPM 계열 Linux
  curl -s https://packagecloud.io/install/repositories/github/git-lfs/script.rpm.sh | sudo bash
  sudo yum install git-lfs
  ```

Git LFS 패키지를 설치한 후, Git LFS 전역설정을 추가합니다. Git LFS 패키지 설치 후 다음 명령어를 최초 1회만 실행하면 됩니다.

```bash
git lfs install
```

위 명령을 실행하면 `.gitconfig` 설정 파일에 다음과 같은 키들이 추가됩니다.
```
[filter "lfs"]
  filter.lfs.clean = git-lfs clean -- %f
  filter.lfs.smudge = git-lfs smudge -- %f
  filter.lfs.process = git-lfs filter-process
  filter.lfs.required = true
```

> [!Important]
> 
> **Git LFS 관리 파일**: `"*.zip"` 파일들은 모두 Git LFS로 관리됩니다. `"*.zip"` 파일들은 모두 `templates/projects/examples/` 폴더에만 존재합니다. 프로젝트 클론 전이라면 `git lfs install` 명령어를 실행 후 클론을 하면 됩니다. 프로젝트 클론을 먼저 했다면 `git lfs pull` 명령어로 다운로드하세요.
> 
> Git LFS와 관련한 Trouble Shooting은 ["Git LFS 문제 해결" 목차](./docs/DEVELOPER.md#git-lfs-문제-해결)를 참고하기 바랍니다.

### 2. Fork & Clone & Upstream

[Github Repository](https://github.com/eGovFramework/egovframe-vscode-initializr) 우측 상단에 "Fork" 버튼을 클릭하여 egovframe-vscode-initializr 레포지토리를 Fork합니다.

Fork하여 생성된 개인 레포지토리를 로컬에 Clone하여 소스를 받아옵니다.

```bash
git clone {Fork하여 생성된 개인 레포지토리의 URL}.git
```

> [!Warning]
> 
> Git LFS 패키지 설치와 전역설정에 문제가 없다면, `templates/projects/examples/` 디렉토리에 zip파일들의 size에 문제가 없어야 합니다.
> Git LFS에 문제가 있다면 해당 zip파일들은 단순 포인터로서 개별 size가 약 매우 작고 압축해제도 오류가 발생합니다.
> 
> Git LFS와 관련한 Trouble Shooting은 ["Git LFS 문제 해결" 목차](./docs/DEVELOPER.md#git-lfs-문제-해결)를 참고하기 바랍니다.

Upstream에 egovframe-vscode-initializr 레포지토리를 연결합니다.

```bash
cd path/to/repo

git remote add upstream https://github.com/eGovFramework/egovframe-vscode-initializr.git
```

### 3. 작업 시작 전

```bash
# 작업 시작 전에 upstream인 egovframe-vscode-initializr 레포지토리의 main 브랜치와 싱크를 맞춥니다.
git fetch upstream main

# 내 로컬의 메인 브랜치(main)로 이동합니다.
git checkout main

# upstream과 병합합니다(또는 리베이스).
# - 병합
git merge upstream/main
# - (또는)리베이스
git rebase upstream/main

# 충돌 발생시 해결

# (선택) 기여자님의 origin 레포지토리에도 동기화
git push origin main

# 작업 브랜치(예: feat/something)로 이동하여 진행
git checkout -b feat/something

# 작업 진행
```

### 4. 작업

워크플로우에 관한 내용은 ["개발 워크플로우" 목차](#개발-워크플로우)를 참고하시기 바랍니다.

### 5. 커밋 및 Push

```bash
# 변경사항을 스테이징한 후 커밋합니다.
git add .
git commit -m "{커밋 메시지}"

# push 하기 전에 upstream인 egovframe-vscode-initializr 레포지토리의 main 브랜치와 다시 한 번 싱크를 맞춥니다(충돌 방지 목적).
git fetch upstream main

# upstream과 병합합니다(또는 리베이스).
# - 병합
git merge upstream/main
# - (또는)리베이스
git rebase upstream/main

# 충돌 해결

# 충돌 해결사항을 스테이징합니다.
git add .

# 스테이징한 사항을 병합합니다(또는 리베이스).
# - 병합
git commit # 자동으로 커밋 메시지가 설정됨
# - (또는) 리베이스
git rebase --continue

# 기여자님의 origin 레포지토리에 작업 브랜치를 push
git push origin feat/something
```

### 6. PR 생성

- Github에서 기여자님의 개인 레포지토리(egovframe-vscode-initializr를 포크한 레포지토리) 페이지로 이동합니다.
- “Compare & pull request” 버튼을 클릭합니다.
- 제목과 설명 입력 후 “Create pull request” 버튼을 클릭합니다.

## 코딩 컨벤션
- **TypeScript**: strict 모드 사용
- **네이밍**: camelCase (변수, 함수), PascalCase (클래스, 인터페이스)
- **파일명**: kebab-case 권장
- **커밋 메시지**: Conventional Commits 규칙 준수

## 새로운 UI 컴포넌트 추가하기

1. **컴포넌트 파일 생성**
   ```tsx
   // webview-ui/src/components/ui/NewComponent.tsx
   import React from 'react'
   import { cn } from '../../utils/cn'
   import { useVSCodeTheme } from './VSCodeThemeProvider'

   export interface NewComponentProps extends React.HTMLAttributes<HTMLDivElement> {
     variant?: 'primary' | 'secondary'
     size?: 'sm' | 'md' | 'lg'
   }

   export const NewComponent: React.FC<NewComponentProps> = ({
     variant = 'primary',
     size = 'md',
     className,
     ...props
   }) => {
     const theme = useVSCodeTheme()

     return (
       <div
         className={cn('custom-component', className)}
         style={{
           backgroundColor: 'var(--vscode-input-background)',
           color: 'var(--vscode-input-foreground)',
           border: '1px solid var(--vscode-input-border)',
           // VSCode 테마 변수 활용
         }}
         {...props}
       />
     )
   }
   ```

2. **컴포넌트 라이브러리 등록**
   ```tsx
   // webview-ui/src/components/ui/index.ts
   export { NewComponent, type NewComponentProps } from './NewComponent'
   ```

3. **네이티브 HTML 엘리먼트 활용 (권장)**
   ```tsx
   // 성능 최적화를 위해 네이티브 엘리먼트 직접 사용
   <input
     style={{
       backgroundColor: 'var(--vscode-input-background)',
       color: 'var(--vscode-input-foreground)',
       border: '1px solid var(--vscode-input-border)',
       appearance: 'none',
       WebkitAppearance: 'none',
       MozAppearance: 'none',
     }}
     onFocus={(e) => {
       (e.target as HTMLInputElement).style.borderColor = 'var(--vscode-focusBorder)'
     }}
   />
   ```

## 새로운 템플릿 추가하기

1. **템플릿 파일 생성**
   ```
   templates/config/{category}/{template}.hbs
   ```

2. **메타데이터 추가**
   ```json
   // templates/templates-context-xml.json
   {
       "displayName": "Category > New Template",
       "templateFolder": "category",
       "templateFile": "template.hbs",
       "webView": "category-template-form.tsx",
       "fileNameProperty": "txtFileName",
       "javaConfigTemplate": "template-java.hbs",
       "yamlTemplate": "template-yaml.hbs",
       "propertiesTemplate": "template-properties.hbs"
   }
   ```

3. **폼 컴포넌트 생성 (커스텀 UI 컴포넌트 사용)**
   ```tsx
   // webview-ui/src/components/egov/forms/CategoryTemplateForm.tsx
   import { Button, TextField, Select, RadioGroup } from "../../ui"

   const CategoryTemplateForm: React.FC<FormProps> = ({ onSubmit }) => {
     return (
       <form onSubmit={onSubmit}>
         <TextField label="Template Name" />
         <Select options={[...]} />
         <RadioGroup options={[...]} />
         <Button variant="primary" type="submit">Generate</Button>
       </form>
     )
   }
   ```

## 개발 워크플로우

이 목차는 [컨트리뷰션 참여 방법 목차에서 "4. 작업"](#4-작업)에 해당하는 내용입니다. 작업 전 후 과정은 [컨트리뷰션 참여 방법](#컨트리뷰션-참여-방법)을 참고 부탁드립니다.

### 1. git lfs 설치

`templates/projects/examples/` 안에 `"*.zip"` 파일들은 모두 git lfs로 관리되고 있습니다. 먼저 git lfs를 설치합니다.

```git
git lfs install
```

### 2. 전체 의존성 설치

프로젝트의 의존성은 백엔드에 해당하는 `./package.json`과 프론트엔드에 해당하는 `./webview-ui/package.json`이 있습니다. 양 쪽 모두의 의존성을 설치합니다.

```bash
# 전체 의존성 설치
cd path/to/repo
npm run install:all
```

### 3. Git Hooks 설정 (자동 코드 형식 맞춤)
프로젝트는 커밋하기 전에 자동으로 코드 형식을 맞추는 Git hooks가 설정되어 있습니다.

#### 설정된 기능
- **husky**: Git hooks 관리
- **lint-staged**: 스테이징된 파일들에만 특정 작업 실행
- **pre-commit hook**: 커밋 전 자동 코드 형식 맞춤

#### 작동 방식
`git commit` 실행 시 자동으로:
1. **JavaScript/TypeScript 파일들**: `prettier --write` + `eslint --fix`
2. **JSON, MD, YAML 파일들**: `prettier --write`
3. 수정된 파일들이 자동으로 스테이징되고 커밋됨

#### 기본 사용법
```bash
# 평소처럼 개발 후
git add .
git commit -m "커밋 메시지"
# → 자동으로 코드 형식이 맞춰지고 커밋됨
```

#### 수동 실행
```bash
# 전체 프로젝트 코드 형식 맞춤
npm run format:fix

# 린팅 오류 수정
npm run lint
```

### 4. 개발 모드 실행
```bash
# Terminal 1: Extension 감시 빌드
npm run watch

# Terminal 2: Webview UI 개발 서버
npm run dev:webview
```

### 5. 디버깅 설정
VS Code에서 F5 키를 눌러 Extension Development Host 실행

**`.vscode/launch.json`** 설정이 필요한 경우:
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Run Extension",
            "type": "extensionHost",
            "request": "launch",
            "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
            "outFiles": ["${workspaceFolder}/dist/**/*.js"],
            "preLaunchTask": "${workspaceFolder}/npm: compile"
        }
    ]
}
```

### 6. 테스트 실행
```bash
# Extension 테스트 (향후 추가 예정)
npm test

# Webview UI 테스트
cd webview-ui && npm run test
```

### 7. 코드 품질 검사
```bash
npm run lint
npm run format:fix
npm run check-types
```
