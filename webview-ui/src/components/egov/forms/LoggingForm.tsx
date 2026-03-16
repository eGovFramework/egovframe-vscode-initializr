import { useState, useEffect } from "react"
import { Button, TextField, TextArea, Select, RadioGroup, Checkbox, ProgressRing, Link, Divider } from "../../ui"
import { ConfigGenerationType, ConfigFormData, FormComponentProps } from "../types/templates"
import { vscode } from "../../../utils/vscode"
import {
	validatePackageName,
	validateFileName,
	validateRequiredFields,
	validateSpecialCharacters,
	validateNumber,
} from "../../../utils/codeUtils"

const LoggingForm: React.FC<FormComponentProps> = ({ onSubmit, onCancel, template, initialData, formType }) => {
	const getDefaultFileName = (type: ConfigGenerationType) => {
		switch (formType) {
			case "console":
				return type === ConfigGenerationType.JAVA_CONFIG ? "EgovLog4j2ConsoleConfig" : "log4j2-console"
			case "file":
				return type === ConfigGenerationType.JAVA_CONFIG ? "EgovLog4j2FileConfig" : "log4j2-file"
			case "rollingFile":
				return type === ConfigGenerationType.JAVA_CONFIG ? "EgovLog4j2RollingFileConfig" : "log4j2-rollingFile"
			case "timeBasedRollingFile":
				return type === ConfigGenerationType.JAVA_CONFIG
					? "EgovLog4j2TimeBasedRollingFileConfig"
					: "log4j2-timeBasedRollingFile"
			case "jdbc":
				return type === ConfigGenerationType.JAVA_CONFIG ? "EgovLog4j2JdbcConfig" : "log4j2-jdbc"
			default:
				return "log4j2"
		}
	}

	const [formData, setFormData] = useState<ConfigFormData>({
		// 아래는 입력값들에 대한 초기값
		generationType: ConfigGenerationType.XML,
		txtConfigPackage: "egovframework.example.config",
		txtFileName: getDefaultFileName(ConfigGenerationType.XML),

		// 공통 필드
		txtAppenderName:
			formType === "console"
				? "console"
				: formType === "file"
					? "file"
					: formType === "rollingFile"
						? "rolling-file"
						: formType === "timeBasedRollingFile"
							? "rolling-file-time"
							: formType === "jdbc"
								? "jdbc"
								: "console",

		// JDBC 제외 Console, File, Rolling File, Time-Based Rolling File 관련 필드
		txtConversionPattern: "%d %5p [%c] %m%n",

		// File 관련 필드
		txtLogFileName:
			formType === "file"
				? "./logs/file/sample.log"
				: formType === "rollingFile"
					? "./logs/rolling/rollingSample.log"
					: formType === "timeBasedRollingFile"
						? "./logs/time/timeBasedRollingSample.log"
						: "",
		cboAppend: true, // File 타입에서 사용, boolean 타입

		// Rolling File 관련 필드
		txtLogFileNamePattern:
			formType === "rollingFile"
				? "./logs/rolling/rollingSample.%i.log"
				: formType === "timeBasedRollingFile"
					? "./logs/time/timeBasedRollingSample.%d{yyyy-MM-dd_HH-mm}.log"
					: "",
		txtMaxIndex: "20", // Rolling File에서 사용
		txtMaxFileSize: "3000", // Rolling File에서 사용

		// Time-Based Rolling File 관련 필드
		txtInterval: "1",
		cboModulate: true,

		// JDBC 관련 필드
		txtTableName: "LOG",
		rdoConnectionType: "DriverManager", // DriverManager 또는 ConnectionFactory
		txtDriver: "com.mysql.cj.jdbc.Driver",
		txtUrl: "jdbc:mysql://localhost:3306/log",
		txtUser: "log",
		txtPasswrd: "log01",
		txtConnectionFactoryClass: "org.egovframe.rte.fdl.logging.db.EgovConnectionFactory",
		txtConnectionFactoryMethod: "getDatabaseConnection",

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
					console.log("LoggingForm: Received selectedOutputFolderDuplicate message:", message.text)
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
			{ field: "txtAppenderName", label: "Appender Name" },
		]
		// JDBC 제외 Conversion Pattern 필드
		if (formType !== "jdbc") {
			requiredFields.push({ field: "txtConversionPattern", label: "Conversion Pattern" })
		}
		// 조건부로 txtFileName, txtConfigPackage 필드 추가
		if (formData.generationType === ConfigGenerationType.JAVA_CONFIG) {
			requiredFields.push(
				{ field: "txtFileName", label: "Class Name" },
				{ field: "txtConfigPackage", label: "Package Name" },
			)
		} else {
			requiredFields.push({ field: "txtFileName", label: "File Name" })
		}
		// formType별 필수 필드 추가
		switch (formType) {
			case "file":
				requiredFields.push({ field: "txtLogFileName", label: "Log File Name" })
				break
			case "rollingFile":
				requiredFields.push(
					{ field: "txtLogFileName", label: "Log File Name" },
					{ field: "txtLogFileNamePattern", label: "Log File Name Pattern" },
					{ field: "txtMaxIndex", label: "Max Index" },
					{ field: "txtMaxFileSize", label: "Max File Size" },
				)
				break
			case "timeBasedRollingFile":
				requiredFields.push(
					{ field: "txtLogFileName", label: "Log File Name" },
					{ field: "txtLogFileNamePattern", label: "Log File Name Pattern" },
					{ field: "txtInterval", label: "Interval" },
				)
				break
			case "jdbc":
				requiredFields.push(
					{ field: "txtTableName", label: "Table Name" },
					{ field: "rdoConnectionType", label: "Connection Type" },
				)
				if (formData.rdoConnectionType === "DriverManager") {
					requiredFields.push(
						{ field: "txtDriver", label: "Driver" },
						{ field: "txtUrl", label: "URL" },
						{ field: "txtUser", label: "User" },
						{ field: "txtPasswrd", label: "Password" },
					)
				} else if (formData.rdoConnectionType === "ConnectionFactory") {
					requiredFields.push(
						{ field: "txtConnectionFactoryClass", label: "Connection Factory Class" },
						{ field: "txtConnectionFactoryMethod", label: "Connection Factory Method" },
					)
				}
				break
		}
		const missingFieldsMessage = validateRequiredFields(requiredFields, formData)
		if (missingFieldsMessage) {
			setValidationError(missingFieldsMessage)
			return
		}

		// 4. 특수문자 유효성 검증
		const notSpecialCharactersFields: Array<{ field: string; label: string }> = [
			{ field: "txtAppenderName", label: "Appender Name" },
			{ field: "txtTableName", label: "Table Name" },
			{ field: "rdoConnectionType", label: "Connection Type" },
		]
		const specialCharacterMessage = validateSpecialCharacters(notSpecialCharactersFields, formData)
		if (specialCharacterMessage) {
			setValidationError(specialCharacterMessage)
			return
		}

		// 5. 숫자 유효성 검증
		const numberFields: Array<{ field: string; label: string }> = [
			{ field: "txtMaxIndex", label: "Max Index" },
			{ field: "txtMaxFileSize", label: "Max File Size" },
			{ field: "txtInterval", label: "Interval" },
		]
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

	const getFormTitle = () => {
		switch (formType) {
			case "console":
				return "Create Console Appender"
			case "file":
				return "Create File Appender"
			case "rollingFile":
				return "Create Rolling File Appender"
			case "timeBasedRollingFile":
				return "Create Time Based Rolling File Appender"
			case "jdbc":
				return "Create JDBC Appender"
			default:
				return "Create Logging Configuration"
		}
	}

	return (
		<div style={{ padding: "20px", maxWidth: "600px" }}>
			<h2 style={{ color: "var(--vscode-foreground)", marginBottom: "20px" }}>{getFormTitle()}</h2>

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
						href="https://www.egovframe.go.kr/docs/5.0/egovframe-runtime/foundation-layer/logging/logging-log4j2/logging-log4j2-configuration_file/"
						style={{ display: "inline", fontSize: "12px" }}>
						Logging Guide Here
					</Link>
				</div>
				<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", marginTop: "8px" }}>
					<strong>Requirements:</strong>
					<ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
						<li>Spring Framework 6.x</li>
						<li>JDK 17+</li>
						<li>Log4j 2.x (2.20.0+)</li>
						{formType === "jdbc" && <li>Database driver (e.g., MySQL, Oracle, PostgreSQL)</li>}
					</ul>
				</div>
				<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", marginTop: "8px" }}>
					<strong>Required Dependencies:</strong>
					<ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
						<li>log4j-api (Log4j 2.x)</li>
						<li>log4j-core (Log4j 2.x)</li>
						<li>log4j-slf4j2-impl (SLF4J bridge for Log4j 2.x)</li>
						{formType === "jdbc" && <li>log4j-jdbc-appender (for JDBC logging)</li>}
						{formType === "jdbc" && <li>Database JDBC driver</li>}
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
						onChange={(value: string) => handleGenerationTypeChange(value as ConfigGenerationType)}
						orientation="horizontal"
						options={
							formType === "jdbc"
								? [
										{ value: ConfigGenerationType.XML, label: "XML" },
										{ value: ConfigGenerationType.YAML, label: "YAML" },
									]
								: [
										{ value: ConfigGenerationType.XML, label: "XML" },
										{ value: ConfigGenerationType.YAML, label: "YAML" },
										{ value: ConfigGenerationType.PROPERTIES, label: "Properties" },
										//{ value: ConfigGenerationType.JAVA_CONFIG, label: "JavaConfig" },
									]
						}
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
							onChange={(e: any) => handleInputChange("txtFileName", e.target.value)}
							placeholder={
								formData.generationType === ConfigGenerationType.JAVA_CONFIG
									? "Enter class name (PascalCase)"
									: "Enter file name"
							}
							isRequired
						/>
					</div>
				</div>

				<div style={{ marginBottom: "20px" }}>
					<h3 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>Configuration</h3>

					<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
						<TextField
							label="Appender Name"
							value={formData.txtAppenderName}
							placeholder="Enter appender name"
							onChange={(e: any) => handleInputChange("txtAppenderName", e.target.value)}
							isRequired
						/>
					</div>

					{/* JDBC 제외 Conversion Pattern 필드 */}
					{formType !== "jdbc" && (
						<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
							<TextField
								label="Conversion Pattern"
								value={formData.txtConversionPattern}
								placeholder="Enter conversion pattern"
								onChange={(e: any) => handleInputChange("txtConversionPattern", e.target.value)}
								isRequired
							/>
						</div>
					)}

					{/* File 타입 특화 필드들 */}
					{formType === "file" && (
						<>
							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Log File Name"
									value={formData.txtLogFileName}
									placeholder="Enter log file name"
									onChange={(e: any) => handleInputChange("txtLogFileName", e.target.value)}
									isRequired
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<Checkbox
									label="Append"
									checked={formData.cboAppend}
									onChange={(e) => handleInputChange("cboAppend", e.target.checked)}
									description="Append to existing log file"
								/>
							</div>
						</>
					)}

					{/* Rolling File 타입 특화 필드들 */}
					{formType === "rollingFile" && (
						<>
							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Log File Name"
									value={formData.txtLogFileName}
									placeholder="Enter log file name"
									onChange={(e: any) => handleInputChange("txtLogFileName", e.target.value)}
									isRequired
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Log File Name Pattern"
									value={formData.txtLogFileNamePattern}
									placeholder="Enter log file name pattern"
									onChange={(e: any) => handleInputChange("txtLogFileNamePattern", e.target.value)}
									isRequired
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Max Index"
									value={formData.txtMaxIndex}
									placeholder="Enter max index"
									onChange={(e: any) => handleInputChange("txtMaxIndex", e.target.value)}
									isRequired
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Max File Size"
									value={formData.txtMaxFileSize}
									placeholder="Enter max file size"
									onChange={(e: any) => handleInputChange("txtMaxFileSize", e.target.value)}
									isRequired
								/>
							</div>
						</>
					)}

					{/* Time-Based Rolling File 타입 특화 필드들 */}
					{formType === "timeBasedRollingFile" && (
						<>
							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Log File Name"
									value={formData.txtLogFileName}
									placeholder="Enter log file name"
									onChange={(e: any) => handleInputChange("txtLogFileName", e.target.value)}
									isRequired
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Log File Name Pattern"
									value={formData.txtLogFileNamePattern}
									placeholder="Enter log file name pattern"
									onChange={(e: any) => handleInputChange("txtLogFileNamePattern", e.target.value)}
									isRequired
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Interval"
									value={formData.txtInterval}
									placeholder="Enter interval"
									onChange={(e: any) => handleInputChange("txtInterval", e.target.value)}
									isRequired
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<Checkbox
									label="Modulate"
									checked={formData.cboModulate}
									onChange={(e) => handleInputChange("cboModulate", e.target.checked)}
									description="Enable modulation"
								/>
							</div>
						</>
					)}

					{/* JDBC 타입 특화 필드들 */}
					{formType === "jdbc" && (
						<>
							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Table Name"
									value={formData.txtTableName}
									placeholder="Enter table name"
									onChange={(e: any) => handleInputChange("txtTableName", e.target.value)}
									isRequired
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<RadioGroup
									label="Connection Type"
									name="connectionType"
									value={formData.rdoConnectionType}
									onChange={(value: string) => handleInputChange("rdoConnectionType", value)}
									options={[
										{ value: "DriverManager", label: "DriverManager" },
										{ value: "ConnectionFactory", label: "ConnectionFactory" },
									]}
								/>
							</div>

							{formData.rdoConnectionType === "DriverManager" && (
								<>
									<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
										<TextField
											label="Driver"
											value={formData.txtDriver}
											placeholder="Enter driver class name"
											onChange={(e: any) => handleInputChange("txtDriver", e.target.value)}
											isRequired
										/>
									</div>

									<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
										<TextField
											label="URL"
											value={formData.txtUrl}
											placeholder="Enter database URL"
											onChange={(e: any) => handleInputChange("txtUrl", e.target.value)}
											isRequired
										/>
									</div>

									<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
										<TextField
											label="User"
											value={formData.txtUser}
											placeholder="Enter username"
											onChange={(e: any) => handleInputChange("txtUser", e.target.value)}
											isRequired
										/>
									</div>

									<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
										<TextField
											label="Password"
											//type="password" // 마스킹 표시 안 함 (입력값 그대로 노출)
											value={formData.txtPasswrd}
											placeholder="Enter password"
											onChange={(e: any) => handleInputChange("txtPasswrd", e.target.value)}
											isRequired
										/>
									</div>
								</>
							)}

							{formData.rdoConnectionType === "ConnectionFactory" && (
								<>
									<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
										<TextField
											label="Connection Factory Class"
											value={formData.txtConnectionFactoryClass}
											placeholder="Enter connection factory class"
											onChange={(e: any) => handleInputChange("txtConnectionFactoryClass", e.target.value)}
											isRequired
										/>
									</div>

									<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
										<TextField
											label="Connection Factory Method"
											value={formData.txtConnectionFactoryMethod}
											placeholder="Enter connection factory method"
											onChange={(e: any) => handleInputChange("txtConnectionFactoryMethod", e.target.value)}
											isRequired
										/>
									</div>
								</>
							)}
						</>
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

export default LoggingForm
