import React, { useState, useEffect } from "react"
import { Button, TextField, TextArea, Select, RadioGroup, ProgressRing, Link, Divider } from "../../ui"
import { ConfigFormData, ConfigGenerationType, FormComponentProps } from "../types/templates"
import { vscode } from "../../../utils/vscode"
import {
	validatePackageName,
	validateFileName,
	validateRequiredFields,
	validateSpecialCharacters,
	validateNumber,
} from "../../../utils/codeUtils"

const PropertyForm: React.FC<FormComponentProps> = ({ onSubmit, onCancel, template, initialData }) => {
	const [formData, setFormData] = useState<ConfigFormData>({
		// 아래는 입력값들에 대한 초기값
		generationType: ConfigGenerationType.XML,
		txtConfigPackage: "egovframework.example.config",
		txtFileName: "context-properties",
		txtPropertyServiceName: "propertiesService",
		rdoType: "Internal Properties",
		txtKey: "pageUnit",
		txtValue: "20",
		cboEncoding: "UTF-8",
		txtPropertyFile: "classpath*:/egovframework/egovProps/conf/config.properties",
		...initialData,
	})
	const [pendingFormData, setPendingFormData] = useState<ConfigFormData | null>(null)

	const [validationError, setValidationError] = useState<string>("")

	// Message listener for folder selection response
	useEffect(() => {
		const handleMessage = (event: any) => {
			const message = event.data
			switch (message.type) {
				// Generate 버튼 클릭 - 중복 파일 검사 통과 시
				case "selectedOutputFolder":
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
					console.log("PropertyForm: Received selectedOutputFolderDuplicate message:", message.text)
					setValidationError(message.text) // Duplicate file exists: + formData.txtFileName
					break
			}
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [pendingFormData, onSubmit])

	const getDefaultFileName = (type: ConfigGenerationType) => {
		switch (type) {
			case ConfigGenerationType.XML:
				return "context-properties"
			case ConfigGenerationType.JAVA_CONFIG:
				return "EgovPropertiesConfig"
			default:
				return "context-properties"
		}
	}

	const handleGenerationTypeChange = (type: ConfigGenerationType) => {
		setFormData((prev) => ({
			...prev,
			generationType: type,
			txtFileName: getDefaultFileName(type),
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
			{ field: "txtPropertyServiceName", label: "Property Service Name" },
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
		// Property Type별 필수 필드 추가
		if (formData.rdoType === "External File") {
			requiredFields.push({ field: "txtPropertyFile", label: "Property File Name" })
		}
		const missingFieldsMessage = validateRequiredFields(requiredFields, formData)
		if (missingFieldsMessage) {
			setValidationError(missingFieldsMessage)
			return
		}

		// 4. 특수문자 유효성 검증
		const notSpecialCharactersFields: Array<{ field: string; label: string }> = [
			{ field: "txtPropertyServiceName", label: "Property Service Name" },
			{ field: "txtKey", label: "Key" },
		]
		const specialCharacterMessage = validateSpecialCharacters(notSpecialCharactersFields, formData)
		if (specialCharacterMessage) {
			setValidationError(specialCharacterMessage)
			return
		}

		// 5. 숫자 유효성 검증
		const numberFields: Array<{ field: string; label: string }> = [{ field: "txtValue", label: "Value" }]
		const numberMessage = validateNumber(numberFields, formData)
		if (numberMessage) {
			setValidationError(numberMessage)
			return
		}

		// 성공 시 에러 클리어
		setValidationError("")

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
			<h2 style={{ color: "var(--vscode-foreground)", marginBottom: "20px" }}>Create Property</h2>

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
						href="https://www.egovframe.go.kr/docs/5.0/egovframe-runtime/foundation-layer/property/property-service/"
						style={{ display: "inline", fontSize: "12px" }}>
						Property Guide Here
					</Link>
				</div>
				<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", marginTop: "8px" }}>
					<strong>Requirements:</strong>
					<ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
						<li>Spring Framework 6.x</li>
						<li>JDK 17+</li>
					</ul>
				</div>
				<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", marginTop: "8px" }}>
					<strong>Required Dependencies:</strong>
					<ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
						<li>egovframework-rte-fdl-property (eGov Property Service)</li>
						<li>spring-context (Spring Framework 6.x)</li>
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
					<h3 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>Default Settings</h3>

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

					{formData.generationType === ConfigGenerationType.JAVA_CONFIG && (
						<div style={{ width: "calc(100% - 24px)", marginBottom: "20px" }}>
							<TextField
								label="Package Name"
								value={formData.txtConfigPackage}
								onChange={(e) => handleInputChange("txtConfigPackage", e.target.value)}
								placeholder="Enter package name"
								isRequired
							/>
						</div>
					)}

					<div style={{ width: "calc(100% - 24px)", marginBottom: "20px" }}>
						<TextField
							label={formData.generationType === ConfigGenerationType.JAVA_CONFIG ? "Class Name" : "File Name"}
							value={formData.txtFileName}
							placeholder={
								formData.generationType === ConfigGenerationType.JAVA_CONFIG
									? "Enter class name (PascalCase)"
									: "Enter file name"
							}
							onChange={(e) => handleInputChange("txtFileName", e.target.value)}
							isRequired
						/>
					</div>
				</div>

				<div style={{ marginBottom: "20px" }}>
					<h3 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>Configuration</h3>

					<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
						<TextField
							label="Property Service Name"
							value={formData.txtPropertyServiceName}
							placeholder="Enter property service name"
							onChange={(e) => handleInputChange("txtPropertyServiceName", e.target.value)}
							isRequired
						/>
					</div>

					<div style={{ marginBottom: "15px" }}>
						<RadioGroup
							label="Type"
							name="propertyType"
							value={formData.rdoType}
							onChange={(value) => handleInputChange("rdoType", value)}
							orientation="vertical"
							isRequired
							options={[
								{ value: "Internal Properties", label: "Internal Properties" },
								{ value: "External File", label: "External File" },
							]}
						/>
					</div>

					{formData.rdoType === "Internal Properties" && (
						<div>
							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Key"
									value={formData.txtKey}
									placeholder="Enter key"
									onChange={(e) => handleInputChange("txtKey", e.target.value)}
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Value"
									value={formData.txtValue}
									placeholder="Enter value"
									onChange={(e) => handleInputChange("txtValue", e.target.value)}
								/>
							</div>
						</div>
					)}

					{formData.rdoType === "External File" && (
						<div>
							<div style={{ marginBottom: "15px" }}>
								<Select
									label="Encoding"
									value={formData.cboEncoding}
									onChange={(e) => handleInputChange("cboEncoding", e.target.value)}
									options={[
										{ value: "UTF-8", label: "UTF-8" },
										{ value: "UTF-16", label: "UTF-16" },
										{ value: "ASCII", label: "ASCII" },
										{ value: "US-ASCII", label: "US-ASCII" },
										{ value: "MS949", label: "MS949" },
										{ value: "ISO-8859-1", label: "ISO-8859-1" },
									]}
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Property File Name"
									value={formData.txtPropertyFile}
									placeholder="Enter property file name"
									onChange={(e) => handleInputChange("txtPropertyFile", e.target.value)}
									isRequired
								/>
							</div>
						</div>
					)}
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

export default PropertyForm
