import React, { useState, useEffect } from "react"
import { Button, TextField, RadioGroup, Link } from "../../ui"
import { ConfigFormData, ConfigGenerationType, FormComponentProps } from "../types/templates"
import { vscode } from "../../../utils/vscode"
import { createSelectConfigFilePathMessage } from "../../../utils/egovUtils"
import {
	validatePackageName,
	validateFileName,
	validateRequiredFields,
	validateSpecialCharacters,
} from "../../../utils/codeUtils"

const EhcacheForm: React.FC<FormComponentProps> = ({ onSubmit, onCancel, template, initialData }) => {
	const [formData, setFormData] = useState<ConfigFormData>({
		// 아래는 입력값들에 대한 초기값
		generationType: ConfigGenerationType.XML,
		txtConfigPackage: "egovframework.example.config",
		txtComponentScanBasePackage: "egovframework.example",
		txtFileName: "context-cache",
		txtConfigLocation: "",
		...initialData,
	})
	//const [selectedOutputFolder, setSelectedOutputFolder] = useState<string | null>(null) // 지금은 없어도 됨
	const [pendingFormData, setPendingFormData] = useState<ConfigFormData | null>(null)

	const [validationError, setValidationError] = useState<string>("")

	// Message listener for folder selection response
	useEffect(() => {
		const handleMessage = (event: any) => {
			const message = event.data
			switch (message.type) {
				// Generate 버튼 클릭 - 중복 파일 검사 통과 시
				case "selectedOutputFolder":
					//setSelectedOutputFolder(message.text)
					if (pendingFormData) {
						onSubmit({
							...pendingFormData,
							outputFolder: message.text,
						})
						setPendingFormData(null)
					}
					break

				// Generate 버튼 클릭 - 중복 파일 검사 실패 시
				case "selectedOutputFolderDuplicate":
					console.log("EhcacheForm: Received selectedOutputFolderDuplicate message:", message.text)
					setValidationError(message.text) // Duplicate file exists: + formData.txtFileName
					break

				// Browse 버튼 클릭 시
				case "selectedConfigFilePath":
					if (message.text) {
						handleInputChange("txtConfigLocation", message.text)
					}
					break
			}
			/*
			if (message.type === "selectedOutputFolder") {
				setSelectedOutputFolder(message.text)
				if (pendingFormData) {
					onSubmit({
						...pendingFormData,
						outputFolder: message.text,
					})
					setPendingFormData(null)
				}
			}
			*/
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [pendingFormData, onSubmit])

	const handleSelectConfigFilePath = () => {
		vscode.postMessage(createSelectConfigFilePathMessage()) // = return {type: "selectConfigFilePath" as const}
	}

	const handleGenerationTypeChange = (type: ConfigGenerationType) => {
		setFormData((prev) => ({
			...prev,
			generationType: type,
			txtFileName: type === ConfigGenerationType.JAVA_CONFIG ? "EgovEhcacheSpringConfig" : "context-cache",
		}))
		// 타입 변경 시 에러 클리어
		setValidationError("")
	}

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()

		// 1. Package Name 유효성 검증 (JavaConfig일 때만)
		if (formData.generationType === ConfigGenerationType.JAVA_CONFIG) {
			const packageNameError = validatePackageName(formData.txtConfigPackage || "")
			if (packageNameError) {
				setValidationError(packageNameError)
				return
			}
		}

		// 2. File Name / Class Name 유효성 검증
		const fileNameError = validateFileName(
			formData.txtFileName || "",
			formData.generationType === ConfigGenerationType.JAVA_CONFIG,
		)
		if (fileNameError) {
			setValidationError(fileNameError)
			return
		}

		// 3. Missing Fields 유효성 검증
		const requiredFields: Array<{ field: string; label: string }> = [
			{ field: "generationType", label: "Generation Type" },
			{ field: "txtComponentScanBasePackage", label: "Component Scan Base Package" },
			{ field: "txtConfigLocation", label: "Config Location" },
		]
		// 조건부로 txtFileName, txtConfigPackage 필드 추가
		if (formData.generationType === ConfigGenerationType.JAVA_CONFIG) {
			requiredFields.push(
				{ field: "txtFileName", label: "Class Name" },
				{ field: "txtConfigPackage", label: "Package Name" },
			)
		} else {
			requiredFields.push({ field: "txtFileName", label: "File Name" })
		}
		const missingFieldsMessage = validateRequiredFields(requiredFields, formData)
		if (missingFieldsMessage) {
			setValidationError(missingFieldsMessage)
			return
		}

		// 4. 특수문자 유효성 검증
		const notSpecialCharactersFields: Array<{ field: string; label: string }> = []
		const specialCharacterMessage = validateSpecialCharacters(notSpecialCharactersFields, formData)
		if (specialCharacterMessage) {
			setValidationError(specialCharacterMessage)
			return
		}

		// 성공 시 에러 클리어
		setValidationError("")

		// Check if vscode API is available
		if (!vscode) {
			console.error("VSCode API is not available")
			return
		}

		setPendingFormData(formData)

		try {
			vscode.postMessage({
				type: "selectOutputFolder",
				formData: formData, // formData를 전달하여 파일명 중복 검사
			})
		} catch (error) {
			console.error("Error sending message:", error)
		}
	}

	const handleInputChange = (field: string, value: string | boolean) => {
		setFormData((prev) => ({ ...prev, [field]: value }))
		// 입력 시 에러 클리어
		setValidationError("")
	}

	return (
		<div style={{ padding: "20px", maxWidth: "600px" }}>
			<h2 style={{ color: "var(--vscode-foreground)", marginBottom: "20px" }}>Create Ehcache Configuration</h2>

			{/* Info */}
			<div
				style={{
					backgroundColor: "var(--vscode-editor-background)",
					border: "1px solid var(--vscode-panel-border)",
					borderRadius: "3px",
					padding: "15px",
					marginTop: "20px",
				}}>
				<h4 style={{ color: "var(--vscode-foreground)", marginBottom: "10px", marginTop: 0 }}>Guide:</h4>
				<div style={{ marginBottom: "10px" }}>
					<Link
						href="https://www.egovframe.go.kr/docs/5.0/egovframe-runtime/foundation-layer/cache/ehCache/"
						style={{ display: "inline", fontSize: "12px" }}>
						Cache Guide Here
					</Link>
				</div>
				<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", marginTop: "8px" }}>
					<strong>Requirements:</strong>
					<ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
						<li>Ehcache 3.x</li>
						<li>Spring Framework 6.x with JCache (JSR-107)</li>
						<li>Jakarta EE 9+</li>
						<li>JDK 17+</li>
					</ul>
				</div>
				<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", marginTop: "8px" }}>
					<strong>Required Dependencies:</strong>
					<ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
						<li>org.ehcache:ehcache:3.10.8</li>
						<li>javax.cache:cache-api:1.1.1</li>
						<li>javax.xml.bind:jaxb-api:2.3.1</li>
						<li>org.glassfish.jaxb:jaxb-runtime:2.3.9</li>
						<li>spring-context-support</li>
					</ul>
				</div>
			</div>

			{/* Validation Errors */}
			{validationError && (
				<div style={{ marginBottom: "20px" }}>
					<div
						style={{
							backgroundColor: "var(--vscode-inputValidation-errorBackground)",
							border: "1px solid var(--vscode-inputValidation-errorBorder)",
							color: "var(--vscode-inputValidation-errorForeground)",
							padding: "10px",
							borderRadius: "3px",
							fontWeight: "bold",
							fontSize: "12px",
						}}>
						{validationError}
					</div>
				</div>
			)}

			<form onSubmit={handleSubmit}>
				<div style={{ marginBottom: "20px" }}>
					<RadioGroup
						label="Generation Type"
						name="generationType"
						value={formData.generationType}
						onChange={(value) => handleGenerationTypeChange(value as ConfigGenerationType)}
						orientation="horizontal"
						options={[
							{ value: ConfigGenerationType.XML, label: "XML" },
							{ value: ConfigGenerationType.JAVA_CONFIG, label: "JavaConfig" },
						]}
					/>
					<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "5px" }}>
						Spring 캐시 설정을 XML 또는 Java Config 방식으로 생성합니다. (Spring 6.x + JCache 표준 사용)
					</div>
				</div>

				{formData.generationType === ConfigGenerationType.JAVA_CONFIG && (
					<div style={{ width: "calc(100% - 24px)", marginBottom: "20px" }}>
						<TextField
							label="Package Name"
							value={formData.txtConfigPackage}
							onChange={(e) => handleInputChange("txtConfigPackage", e.target.value)}
							placeholder="Enter package name"
							isRequired
						/>
						<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
							Java Config 클래스의 패키지명 (예: egovframework.example.config)
						</div>
					</div>
				)}

				<div style={{ width: "calc(100% - 24px)", marginBottom: "20px" }}>
					<TextField
						label="Component Scan Base Package"
						value={formData.txtComponentScanBasePackage}
						onChange={(e) => handleInputChange("txtComponentScanBasePackage", e.target.value)}
						placeholder="Enter component scan base package"
						isRequired
					/>
					<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
						@Cacheable 어노테이션을 스캔할 베이스 패키지 (예: egovframework.example)
					</div>
				</div>

				<div style={{ width: "calc(100% - 24px)", marginBottom: "20px" }}>
					<TextField
						label={formData.generationType === ConfigGenerationType.JAVA_CONFIG ? "Class Name" : "File Name"}
						value={formData.txtFileName}
						onChange={(e) => handleInputChange("txtFileName", e.target.value)}
						placeholder={
							formData.generationType === ConfigGenerationType.JAVA_CONFIG
								? "Enter class name (PascalCase)"
								: "Enter file name"
						}
						isRequired
					/>
					<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
						{formData.generationType === ConfigGenerationType.JAVA_CONFIG
							? "Java Config 클래스명 (예: EgovEhcacheSpringConfig)"
							: "Spring 설정 파일명 (예: context-cache.xml)"}
					</div>
				</div>

				<div style={{ marginBottom: "15px" }}>
					<div style={{ display: "flex", gap: "10px", alignItems: "end" }}>
						<div style={{ flex: 1, marginRight: "10px" }}>
							<TextField
								label="Config Location"
								value={formData.txtConfigLocation}
								onChange={(e: any) => handleInputChange("txtConfigLocation", e.target.value)}
								placeholder="Select cache config file"
								isRequired
							/>
						</div>
						<button
							type="button" // 버튼의 기본 동작(type="submit")을 방지 => <form onSubmit={handleSubmit}> 실행 방지 => validationError 발생 방지
							style={{
								backgroundColor: "var(--vscode-button-secondaryBackground)",
								color: "var(--vscode-button-secondaryForeground)",
								border: "1px solid var(--vscode-button-border)",
								borderRadius: "4px",
								padding: "8px 12px",
								cursor: "pointer",
								display: "inline-flex",
								alignItems: "center",
								fontSize: "13px",
								fontFamily: "inherit",
								outline: "none",
							}}
							onMouseOver={(e) => {
								;(e.target as HTMLButtonElement).style.backgroundColor =
									"var(--vscode-button-secondaryHoverBackground)"
							}}
							onMouseOut={(e) => {
								;(e.target as HTMLButtonElement).style.backgroundColor =
									"var(--vscode-button-secondaryBackground)"
							}}
							onFocus={(e) => {
								;(e.target as HTMLButtonElement).style.outline = "1px solid var(--vscode-focusBorder)"
							}}
							onBlur={(e) => {
								;(e.target as HTMLButtonElement).style.outline = "none"
							}}
							onClick={handleSelectConfigFilePath}>
							<span className="codicon codicon-folder-opened" style={{ marginRight: "6px" }}></span>
							Browse
						</button>
					</div>
					<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
						<strong>중요:</strong> Ehcache 3.x XML 형식의 설정 파일을 선택해주세요. (예: 'New Cache'로 생성한 파일)
						<br />
						Ehcache 2.x 형식의 파일은 호환되지 않습니다.
					</div>
				</div>

				<div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
					<Button variant="secondary" onClick={onCancel}>
						Cancel
					</Button>
					<Button type="submit" variant="primary">
						Generate
					</Button>
				</div>
			</form>
		</div>
	)
}

export default EhcacheForm
