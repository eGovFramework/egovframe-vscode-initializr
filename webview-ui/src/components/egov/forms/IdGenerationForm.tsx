import React, { useState, useEffect } from "react"
import { Button, TextField, TextArea, Select, RadioGroup, Checkbox, ProgressRing, Link, Divider } from "../../ui"
import { ConfigFormData, ConfigGenerationType, FormComponentProps } from "../types/templates"
import { vscode } from "../../../utils/vscode"
import {
	validatePackageName,
	validateFileName,
	validateRequiredFields,
	validateSpecialCharacters,
	validateNumber,
} from "../../../utils/codeUtils"

const IdGenerationForm: React.FC<FormComponentProps> = ({ onSubmit, onCancel, template, formType, initialData }) => {
	const getDefaultFileName = (type: ConfigGenerationType) => {
		const baseNames = {
			sequence: { xml: "context-idgn-sequence", java: "EgovIdgnSequenceConfig" },
			table: { xml: "context-idgn-table", java: "EgovIdgnTableConfig" },
			uuid: { xml: "context-idgn-uuid", java: "EgovIdgnUuidConfig" },
		}
		const names = baseNames[formType as keyof typeof baseNames]
		switch (type) {
			case ConfigGenerationType.XML:
				return names.xml // = If (names === baseNames.sequence) => names.xml은 "context-idgn-sequence"
			case ConfigGenerationType.JAVA_CONFIG:
				return names.java // = If (names === baseNames.sequence) => names.java은 "EgovIdgnSequenceConfig"
			default:
				return names.xml
		}
	}

	const [formData, setFormData] = useState<ConfigFormData>({
		// 아래는 입력값들에 대한 초기값
		// 전체 공통
		generationType: ConfigGenerationType.XML,
		txtConfigPackage: "egovframework.example.config",
		txtFileName: getDefaultFileName(ConfigGenerationType.XML),
		txtIdServiceName: "idGnrService",
		// sequence, table 공통
		txtDatasourceName: "dataSource",
		// sequence, uuid 공통
		rdoIdType: "Base", // sequence에서 가능한 값은 Base 또는 BigDecimal, uuid에서 가능한 값은 base 또는 Address
		// 1. sequence Only
		txtQuery: "SELECT SEQ_SAMPLE.NEXTVAL FROM DUAL",
		// 2. table Only
		txtTable: "IDS", // ID Generation을 위한 별도의 테이블 명
		txtTableNameFieldValue: "SAMPLE", // 위 "ID Generation을 위한 별도의 테이블" 내 컬럼명으로서, DB에서 해당 컬럼에 들어갈 데이터의 값은 ID Generation Table을 적용할 테이블 명이다.
		txtBlockSize: "10",
		chkStrategy: false,
		txtStrategyName: "prefixIdGnrStrategy", // chkStrategy가 true일 때만 사용
		txtPrefix: "egov-", // chkStrategy가 true일 때만 사용
		txtCipers: "10", // chkStrategy가 true일 때만 사용
		txtFillChar: "0", // chkStrategy가 true일 때만 사용
		// 3. uuid Only
		txtAddress: "12:34:56:78:9A:AB", // rdoType이 Address일 때만 사용
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
					console.log("IdGenerationForm: Received selectedOutputFolderDuplicate message:", message.text)
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
			txtFileName: getDefaultFileName(type), // = If (type === ConfigGenerationType.XML) => getDefaultFileName(type)은 "context-idgn-sequence"
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
		const requiredFields: Array<{ field: string; label: string }> = []
		// 조건부로 txtFileName, txtConfigPackage 필드 추가
		if (formData.generationType === ConfigGenerationType.JAVA_CONFIG) {
			requiredFields.push(
				{ field: "txtFileName", label: "Class Name" },
				{ field: "txtConfigPackage", label: "Package Name" },
			)
		} else {
			requiredFields.push({ field: "txtFileName", label: "File Name" })
		}

		switch (formType) {
			case "sequence":
				requiredFields.push(
					{ field: "generationType", label: "Generation Type" },
					{ field: "txtIdServiceName", label: "Bean Name" },
					{ field: "txtDatasourceName", label: "Data Source Name" },
					{ field: "txtQuery", label: "Query" },
					{ field: "rdoIdType", label: "ID Type" },
				)
				break
			case "table":
				requiredFields.push(
					{ field: "generationType", label: "Generation Type" },
					{ field: "txtIdServiceName", label: "Bean Name" },
					{ field: "txtDatasourceName", label: "Data Source Name" },
					{ field: "txtTable", label: "Table Name" },
					{ field: "txtTableNameFieldValue", label: "TABLE_NAME Column's Value" },
					{ field: "txtBlockSize", label: "Block Size" },
				)
				// Strategy 관련 필드는 chkStrategy가 true일 때만 필수
				if (formData.chkStrategy) {
					requiredFields.push(
						{ field: "txtStrategyName", label: "Strategy Name" },
						{ field: "txtPrefix", label: "Prefix" },
						{ field: "txtCipers", label: "Cipers" },
						{ field: "txtFillChar", label: "Fill Char" },
					)
				}
				break
			case "uuid":
				requiredFields.push(
					{ field: "generationType", label: "Generation Type" },
					{ field: "txtIdServiceName", label: "Bean Name" },
				)
				// Address는 rdoIdType이 Address일 때만 필수
				if (formData.rdoIdType === "Address") {
					requiredFields.push({ field: "txtAddress", label: "Address" })
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
			{ field: "txtIdServiceName", label: "Bean Name" },
			{ field: "txtDatasourceName", label: "Data Source Name" },
			{ field: "txtTable", label: "Table Name" },
			{ field: "txtTableNameFieldValue", label: "TABLE_NAME Column's Value" },
			{ field: "txtStrategyName", label: "Strategy Name" },
		]
		// 조건부로 다른 label을 가지는 rdoIdType 필드 추가
		if (formType === "sequence") {
			notSpecialCharactersFields.push({ field: "rdoIdType", label: "ID Type" })
		} else if (formType === "uuid") {
			notSpecialCharactersFields.push({ field: "rdoIdType", label: "UUID Type" })
		}
		const specialCharacterMessage = validateSpecialCharacters(notSpecialCharactersFields, formData)
		if (specialCharacterMessage) {
			setValidationError(specialCharacterMessage)
			return
		}

		// 5. 숫자 유효성 검증
		const numberFields: Array<{ field: string; label: string }> = [
			{ field: "txtBlockSize", label: "Block Size" },
			{ field: "txtCipers", label: "Cipers" },
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
			case "sequence":
				return "Create Sequence ID Generation"
			case "table":
				return "Create Table ID Generation"
			case "uuid":
				return "Create UUID Generation"
			default:
				return "Create SequenceID Generation"
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
						href="https://www.egovframe.go.kr/docs/5.0/egovframe-runtime/foundation-layer/id-generated/"
						style={{ display: "inline", fontSize: "12px" }}>
						ID Generation Guide Here
					</Link>
				</div>

				{formType === "table" && (
					<>
						<h4 style={{ color: "var(--vscode-foreground)", marginBottom: "10px", marginTop: "12px" }}>DB Schema:</h4>
						<div
							style={{
								fontSize: "11px",
								color: "var(--vscode-foreground)",
								marginBottom: "10px",
								fontFamily: "monospace",
								backgroundColor: "var(--vscode-textCodeBlock-background)",
								padding: "10px",
								borderRadius: "3px",
							}}>
							<div>{`CREATE TABLE ${formData.txtTable} (`}</div>
							<div style={{ paddingLeft: "20px" }}>{`TABLE_NAME varchar(16) NOT NULL,`}</div>
							<div style={{ paddingLeft: "20px" }}>NEXT_ID INTEGER NOT NULL,</div>
							<div style={{ paddingLeft: "20px" }}>PRIMARY KEY (TABLE_NAME)</div>
							<div>);</div>
							<div
								style={{
									marginTop: "8px",
								}}>{`INSERT INTO ${formData.txtTable} VALUES('${formData.txtTableNameFieldValue}','1');`}</div>
						</div>
					</>
				)}

				<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", marginTop: "8px" }}>
					<strong>Requirements:</strong>
					<ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
						<li>Spring Framework 6.x</li>
						<li>JDK 17+</li>
						<li>Jakarta EE 9</li>
						{(formType === "sequence" || formType === "table") && <li>DataSource configured</li>}
					</ul>
				</div>
				<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", marginTop: "8px" }}>
					<strong>Required Dependencies:</strong>
					<ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
						<li>egovframework-rte-fdl-idgnr (eGov ID Generation Service)</li>
						<li>spring-context (Spring Framework 6.x)</li>
						{(formType === "sequence" || formType === "table") && (
							<li>Database driver (e.g., H2, MySQL, Oracle, PostgreSQL)</li>
						)}
						{(formType === "sequence" || formType === "table") && <li>spring-jdbc (for DataSource)</li>}
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
							label="Bean Name (ID Generation Service Name)"
							value={formData.txtIdServiceName}
							onChange={(e: any) => handleInputChange("txtIdServiceName", e.target.value)}
							placeholder="Enter bean name"
							isRequired
						/>
					</div>

					{(formType === "sequence" || formType === "table") && (
						<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
							<TextField
								label="Data Source Name"
								value={formData.txtDatasourceName}
								onChange={(e: any) => handleInputChange("txtDatasourceName", e.target.value)}
								placeholder="Enter data source name"
								isRequired
							/>
						</div>
					)}

					{formType === "sequence" && (
						<>
							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Query"
									value={formData.txtQuery}
									onChange={(e: any) => handleInputChange("txtQuery", e.target.value)}
									placeholder="Enter query"
									isRequired
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<RadioGroup
									label="ID Type"
									name="idType"
									value={formData.rdoIdType}
									onChange={(value: string) => handleInputChange("rdoIdType", value)}
									options={[
										{ value: "Base", label: "Default" },
										{ value: "BigDecimal", label: "BigDecimal" },
									]}
								/>
							</div>
						</>
					)}

					{formType === "table" && (
						<>
							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Table Name"
									value={formData.txtTable}
									onChange={(e: any) => handleInputChange("txtTable", e.target.value)}
									placeholder="Enter table name"
									isRequired
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="TABLE_NAME Column's Value"
									value={formData.txtTableNameFieldValue}
									onChange={(e: any) => handleInputChange("txtTableNameFieldValue", e.target.value)}
									placeholder="Enter TABLE_NAME Column's Value"
									isRequired
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Block Size"
									value={formData.txtBlockSize}
									onChange={(e: any) => handleInputChange("txtBlockSize", e.target.value)}
									placeholder="Enter block size"
									isRequired
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<Checkbox
									label="Use Strategy"
									checked={formData.chkStrategy}
									onChange={(e) => handleInputChange("chkStrategy", e.target.checked)}
									description="Enable ID Generation Strategy"
								/>
							</div>

							{formData.chkStrategy && (
								<>
									<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
										<TextField
											label="Strategy Name"
											value={formData.txtStrategyName}
											onChange={(e: any) => handleInputChange("txtStrategyName", e.target.value)}
											placeholder="Enter strategy name"
											isRequired
										/>
									</div>

									<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
										<TextField
											label="Prefix"
											value={formData.txtPrefix}
											onChange={(e: any) => handleInputChange("txtPrefix", e.target.value)}
											placeholder="Enter prefix"
											isRequired
										/>
									</div>

									<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
										<TextField
											label="Cipers"
											value={formData.txtCipers}
											onChange={(e: any) => handleInputChange("txtCipers", e.target.value)}
											placeholder="Enter cipers"
											isRequired
										/>
									</div>

									<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
										<TextField
											label="Fill Char"
											value={formData.txtFillChar}
											onChange={(e: any) => handleInputChange("txtFillChar", e.target.value)}
											placeholder="Enter fill char"
											isRequired
										/>
									</div>
								</>
							)}
						</>
					)}

					{formType === "uuid" && (
						<>
							<div style={{ marginBottom: "15px" }}>
								<RadioGroup
									label="UUID Type"
									name="uuidType"
									value={formData.rdoIdType}
									onChange={(value: string) => handleInputChange("rdoIdType", value)}
									options={[
										{ value: "Base", label: "Default" },
										{ value: "Address", label: "Address" },
									]}
								/>
							</div>

							{formData.rdoIdType === "Address" && (
								<>
									<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
										<TextField
											label="Address"
											value={formData.txtAddress}
											onChange={(e: any) => handleInputChange("txtAddress", e.target.value)}
											placeholder="Enter address (e.g., 12:34:56:78:9A:AB)"
											isRequired
										/>
									</div>
									<div
										style={{
											fontSize: "10px",
											color: "var(--vscode-descriptionForeground)",
											marginTop: "2px",
										}}>
										Address is MAC Address or IP Address.
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

export default IdGenerationForm
