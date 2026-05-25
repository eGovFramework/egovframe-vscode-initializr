import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Button, TextField, Select, RadioGroup, Link } from "../../ui"
import { ConfigGenerationType, ConfigFormData, FormComponentProps } from "../types/templates"
import { vscode } from "../../../utils/vscode"
import {
	validatePackageName,
	validateFileName,
	validateRequiredFields,
	validateSpecialCharacters,
} from "../../../utils/codeUtils"

const DatasourceForm: React.FC<FormComponentProps> = ({ onSubmit, onCancel, template, initialData }) => {
	const { t } = useTranslation()
	const [formData, setFormData] = useState<ConfigFormData>({
		generationType: ConfigGenerationType.XML,
		txtConfigPackage: "egovframework.example.config",
		txtFileName: "context-datasource",
		txtDatasourceName: "dataSource",
		rdoType: "DBCP",
		txtDriver: "com.mysql.cj.jdbc.Driver",
		txtUrl: "jdbc:mysql://127.0.0.1:3306/myDB",
		txtUser: "root",
		txtPasswd: "",
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
					console.log("DatasourceForm: Received selectedOutputFolderDuplicate message:", message.text)
					setValidationError(message.text) // Duplicate file exists: + formData.txtFileName
					break
			}
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [pendingFormData, onSubmit])

	const handleGenerationTypeChange = (type: ConfigGenerationType) => {
		setFormData((prev) => ({
			...prev,
			generationType: type,
			txtFileName: type === ConfigGenerationType.JAVA_CONFIG ? "EgovDataSourceConfig" : "context-datasource",
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
		const fileNameError = validateFileName(formData.txtFileName, formData.generationType === ConfigGenerationType.JAVA_CONFIG)
		if (fileNameError) {
			setValidationError(fileNameError)
			return
		}

		// 3. Missing Fields 유효성 검증
		const requiredFields: { field: string; label: string }[] = [
			{ field: "generationType", label: "Generation Type" },
			{ field: "txtDatasourceName", label: "DataSource Name" },
			{ field: "rdoType", label: "Driver Type" },
			{ field: "txtDriver", label: "Driver" },
			{ field: "txtUrl", label: "URL" },
			{ field: "txtUser", label: "User" },
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
		const notSpecialCharactersFields: { field: string; label: string }[] = [
			{ field: "txtDatasourceName", label: "DataSource Name" },
			{ field: "rdoType", label: "Driver Type" },
		]
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

	const handleInputChange = (field: string, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }))
		// 입력 시 에러 클리어
		setValidationError("")
	}

	return (
		<div style={{ padding: "20px", maxWidth: "600px" }}>
			<h2 style={{ color: "var(--vscode-foreground)", marginBottom: "20px" }}>Create DataSource</h2>

			{/* Info */}
			<div
				style={{
					backgroundColor: "var(--vscode-editor-background)",
					border: "1px solid var(--vscode-panel-border)",
					borderRadius: "3px",
					padding: "15px",
					marginTop: "20px",
				}}>
				<h4 style={{ color: "var(--vscode-foreground)", marginBottom: "10px", marginTop: 0 }}>
					{t("forms.common.guide")}:
				</h4>
				<div style={{ marginBottom: "10px" }}>
					<Link
						href="https://www.egovframe.go.kr/docs/5.0/egovframe-runtime/persistence-layer/data-source/"
						style={{ display: "inline", fontSize: "12px" }}>
						{t("forms.datasource.guideLink")}
					</Link>
				</div>
				<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", marginTop: "8px" }}>
					<strong>{t("forms.common.requirements")}:</strong>
					<ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
						<li>Spring Framework 6.x</li>
						<li>JDK 17+</li>
						<li>Jakarta EE 9</li>
					</ul>
				</div>
				<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", marginTop: "8px" }}>
					<strong>{t("forms.common.requiredDependencies")}:</strong>
					<ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
						<li>DBCP: commons-dbcp2:2.13.0</li>
						<li>C3P0: c3p0:0.10.1</li>
						<li>JDBC Driver: mysql-connector-j, mariadb-java-client, postgresql, etc.</li>
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
					</div>
				)}

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
				</div>

				<div style={{ marginBottom: "20px" }}>
					<h3 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>Configuration</h3>

					<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
						<TextField
							label="DataSource Name"
							value={formData.txtDatasourceName}
							placeholder="Enter datasource name"
							onChange={(e) => handleInputChange("txtDatasourceName", e.target.value)}
							isRequired
						/>
					</div>

					<div style={{ marginBottom: "15px" }}>
						<Select
							label="Driver Type"
							value={formData.rdoType}
							onChange={(e) => handleInputChange("rdoType", e.target.value)}
							isRequired
							options={[
								{ value: "DBCP", label: "DBCP" },
								{ value: "C3P0", label: "C3P0" },
								{ value: "JDBC", label: "JDBC" },
							]}
						/>
					</div>

					<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
						<TextField
							label="Driver"
							value={formData.txtDriver}
							placeholder="Enter driver class name"
							onChange={(e) => handleInputChange("txtDriver", e.target.value)}
							isRequired
						/>
					</div>

					<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
						<TextField
							label="URL"
							value={formData.txtUrl}
							placeholder="Enter database URL"
							onChange={(e) => handleInputChange("txtUrl", e.target.value)}
							isRequired
						/>
					</div>

					<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
						<TextField
							label="User"
							value={formData.txtUser}
							placeholder="Enter username"
							onChange={(e) => handleInputChange("txtUser", e.target.value)}
							isRequired
						/>
					</div>

					<div style={{ width: "calc(100% - 24px)", marginBottom: "20px" }}>
						<TextField
							label="Password"
							//type="password"
							value={formData.txtPasswd}
							placeholder="Enter password"
							onChange={(e) => handleInputChange("txtPasswd", e.target.value)}
						/>
					</div>
				</div>

				<div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
					<Button variant="secondary" onClick={onCancel}>
						{t("common.cancel")}
					</Button>
					<Button type="submit" variant="primary">
						{t("common.generate")}
					</Button>
				</div>
			</form>
		</div>
	)
}

export default DatasourceForm
