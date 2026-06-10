import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Button, TextField, RadioGroup, Select, Checkbox, Link } from "../../ui"
import { ConfigFormData, ConfigGenerationType, FormComponentProps } from "../types/templates"
import { vscode } from "../../../utils/vscode"
import {
	validatePackageName,
	validateFileName,
	validateRequiredFields,
	validateSpecialCharacters,
	validateNumber,
} from "../../../utils/codeUtils"

const TransactionForm: React.FC<FormComponentProps> = ({ onSubmit, onCancel, template, formType, initialData }) => {
	const { t } = useTranslation()
	// Get default file name based on generation type and form type
	function getDefaultFileName(type: ConfigGenerationType) {
		switch (formType) {
			case "datasource":
				return type === ConfigGenerationType.JAVA_CONFIG ? "EgovTransactionConfig" : "context-transaction"
			case "jpa":
				return type === ConfigGenerationType.JAVA_CONFIG ? "EgovTransactionJpaConfig" : "context-transaction-jpa"
			case "jta":
				return type === ConfigGenerationType.JAVA_CONFIG ? "EgovTransactionJtaConfig" : "context-transaction-jta"
			default:
				return "context-transaction"
		}
	}

	const [currentPage, setCurrentPage] = useState(1)
	const [formData, setFormData] = useState<ConfigFormData>({
		// 아래는 입력값들에 대한 초기값
		generationType: ConfigGenerationType.XML,
		txtConfigPackage: "egovframework.example.config",
		txtFileName: getDefaultFileName(ConfigGenerationType.XML),

		// Datasource Transaction 전용
		txtTransactionTemplateName: "transactionTemplate",

		// 공통 필드
		txtTransactionName: formType === "datasource" ? "txManager" : "transactionManager",
		txtDataSourceName: "dataSource",
		chkAopConfigTransaction: true,
		chkAnnotationTransaction: true,

		// JPA 전용
		txtEntityManagerFactory: "entityManagerFactory",
		txtPackagesToScan: "egovframework.example.sample.domain",
		cmbDialectName: "org.hibernate.dialect.H2Dialect",
		txtSpringDataJpaRepositoriesPackage: "egovframework.example.sample.repository",

		// JTA 전용
		txtJtaImplementation: "Atomikos",
		txtGlobalTimeout: "20",

		// 공통 필드 - AOP Config (aopConfigTransaction일 때만 사용)
		txtPointCutName: "requiredTx",
		txtPointCutExpression:
			"execution(* egovframework.example..*Impl.*(..)) || execution(* org.egovframe.rte.fdl.excel.impl.*Impl.*(..))",

		// 공통 필드 - Advice (aopConfigTransaction일 때만 사용)
		txtAdviceName: "txAdvice",
		txtMethodName: "*",
		chkReadOnly: false,
		txtRollbackFor: "Exception",
		txtNoRollbackFor: "RuntimeException",
		txtTimeout: "20",
		cmbPropagation: "REQUIRED",
		cmbIsolation: "DEFAULT",

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
					console.log("TransactionForm: Received selectedOutputFolderDuplicate message:", message.text)
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

		// 0. 추가 비즈니스 검증 (트랜잭션 관리 방식 선택 확인)
		if (!formData.chkAopConfigTransaction && !formData.chkAnnotationTransaction) {
			setValidationError("Please select at least one transaction management type (AOP Config or Annotation)")
			return
		}

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
			{ field: "txtTransactionName", label: "Transaction Manager Name" },
			{ field: "txtDataSourceName", label: "Data Source Name" },
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
		// formType별 필수 필드 추가
		switch (formType) {
			case "datasource":
				//requiredFields.push({ field: "txtTransactionTemplateName", label: "Transaction Template" })
				break
			case "jpa":
				requiredFields.push(
					{ field: "txtEntityManagerFactory", label: "Entity Manager Factory" },
					{ field: "txtPackagesToScan", label: "Packages to Scan" },
					{ field: "txtSpringDataJpaRepositoriesPackage", label: "Repository Package" },
				)
				break
			case "jta":
				requiredFields.push({ field: "txtGlobalTimeout", label: "Global Timeout" })
				break
		}
		// AOP Config, Advice 관련 필드 (aopConfigTransaction일 때만)
		if (formData.chkAopConfigTransaction) {
			requiredFields.push(
				{ field: "txtPointCutExpression", label: "Pointcut Expression" },
				{ field: "txtAdviceName", label: "Advice Name" },
				{ field: "txtMethodName", label: "Method Name" },
			)
			// JavaConfig가 아닐 때에만 Pointcut Name 필수
			if (formData.generationType !== ConfigGenerationType.JAVA_CONFIG) {
				requiredFields.push({ field: "txtPointCutName", label: "Pointcut Name" })
			}
		}
		const missingFieldsMessage = validateRequiredFields(requiredFields, formData)
		if (missingFieldsMessage) {
			setValidationError(missingFieldsMessage)
			return
		}

		// 4. 특수문자 유효성 검증
		const notSpecialCharactersFields: Array<{ field: string; label: string }> = [
			{ field: "txtTransactionTemplateName", label: "Transaction Template" },
			{ field: "txtTransactionName", label: "Transaction Manager Name" },
			{ field: "txtDataSourceName", label: "Data Source Name" },
			{ field: "txtPointCutName", label: "Pointcut Name" },
			{ field: "txtAdviceName", label: "Advice Name" },
			{ field: "txtRollbackFor", label: "Rollback For" },
			{ field: "txtNoRollbackFor", label: "No Rollback For" },
			{ field: "cmbPropagation", label: "Propagation" },
			{ field: "cmbIsolation", label: "Isolation" },
			{ field: "txtEntityManagerFactory", label: "Entity Manager Factory" },
			{ field: "txtJtaImplementation", label: "JTA Implementation" },
		]
		const specialCharacterMessage = validateSpecialCharacters(notSpecialCharactersFields, formData)
		if (specialCharacterMessage) {
			setValidationError(specialCharacterMessage)
			return
		}

		// 5. 숫자 유효성 검증
		const numberFields: Array<{ field: string; label: string }> = [
			{ field: "txtTimeout", label: "Timeout" },
			{ field: "txtGlobalTimeout", label: "Global Timeout" },
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
			case "datasource":
				return "Create Datasource Transaction"
			case "jpa":
				return "Create JPA Transaction"
			case "jta":
				return "Create JTA Transaction"
			default:
				return "Create Transaction"
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
				<h4 style={{ color: "var(--vscode-foreground)", marginBottom: "10px", marginTop: 0 }}>
					{t("forms.common.guide")}:
				</h4>
				<div style={{ marginBottom: "10px" }}>
					<Link
						href="https://www.egovframe.go.kr/docs/5.0/egovframe-runtime/persistence-layer/transaction/"
						style={{ display: "inline", fontSize: "12px" }}>
						{t("forms.transaction.guideLink")}
					</Link>
				</div>
				<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", marginTop: "8px" }}>
					<strong>{t("forms.common.requirements")}:</strong>
					<ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
						<li>Spring Framework 6.x</li>
						<li>JDK 17+</li>
						<li>Jakarta EE 9+</li>
					</ul>
				</div>
				<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", marginTop: "8px" }}>
					<strong>{t("forms.common.requiredDependencies")}:</strong>
					<ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
						<li>Datasource: spring-jdbc (Spring Framework 6.x)</li>
						<li>JPA: spring-orm, hibernate-core (Jakarta Persistence 3.x)</li>
						<li>JTA: spring-tx, atomikos (Jakarta Transaction API)</li>
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
				{currentPage === 1 && (
					<div>
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
									label={
										formData.generationType === ConfigGenerationType.JAVA_CONFIG ? "Class Name" : "File Name"
									}
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

						{/* Datasource Transaction 전용 필드 */}
						{formType === "datasource" && (
							<div style={{ marginBottom: "20px" }}>
								<h3 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>
									Transaction Template Management
								</h3>

								<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
									<TextField
										label="Transaction Template"
										value={formData.txtTransactionTemplateName}
										onChange={(e: any) => handleInputChange("txtTransactionTemplateName", e.target.value)}
										placeholder="Enter transaction template name"
									/>
								</div>
							</div>
						)}

						{/* JPA 전용 필드 */}
						{formType === "jpa" && (
							<div style={{ marginBottom: "20px" }}>
								<h3 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>Entity Manager</h3>

								<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
									<TextField
										label="Entity Manager Factory"
										value={formData.txtEntityManagerFactory}
										onChange={(e: any) => handleInputChange("txtEntityManagerFactory", e.target.value)}
										placeholder="Enter entity manager factory name"
										isRequired
									/>
								</div>

								<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
									<TextField
										label="Data Source Name"
										value={formData.txtDataSourceName}
										onChange={(e: any) => handleInputChange("txtDataSourceName", e.target.value)}
										placeholder="Enter data source name"
										isRequired
									/>
								</div>

								<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
									<TextField
										label="Packages to Scan"
										value={formData.txtPackagesToScan}
										onChange={(e: any) => handleInputChange("txtPackagesToScan", e.target.value)}
										placeholder="Enter packages to scan"
										isRequired
									/>
								</div>

								<div style={{ marginBottom: "15px" }}>
									<Select
										label="Dialect Name"
										value={formData.cmbDialectName}
										onChange={(e) => handleInputChange("cmbDialectName", e.target.value)}
										isRequired
										options={[
											{ value: "org.hibernate.dialect.H2Dialect", label: "H2Dialect" },
											{ value: "org.hibernate.dialect.MySQL5Dialect", label: "MySQL5Dialect" },
											{ value: "org.hibernate.dialect.MySQL5InnoDBDialect", label: "MySQL5InnoDBDialect" },
											{ value: "org.hibernate.dialect.MySQL8Dialect", label: "MySQL8Dialect" },
											{ value: "org.hibernate.dialect.MariaDBDialect", label: "MariaDBDialect" },
											{ value: "org.hibernate.dialect.MariaDB53Dialect", label: "MariaDB53Dialect" },
											{ value: "org.hibernate.dialect.MariaDB102Dialect", label: "MariaDB102Dialect" },
											{ value: "org.hibernate.dialect.MariaDB103Dialect", label: "MariaDB103Dialect" },
											{ value: "org.hibernate.dialect.PostgreSQL9Dialect", label: "PostgreSQL9Dialect" },
											{ value: "org.hibernate.dialect.PostgreSQL10Dialect", label: "PostgreSQL10Dialect" },
											{ value: "org.hibernate.dialect.PostgreSQL11Dialect", label: "PostgreSQL11Dialect" },
											{ value: "org.hibernate.dialect.PostgreSQL12Dialect", label: "PostgreSQL12Dialect" },
											{ value: "org.hibernate.dialect.Oracle10gDialect", label: "Oracle10gDialect" },
											{ value: "org.hibernate.dialect.Oracle11gDialect", label: "Oracle11gDialect" },
											{ value: "org.hibernate.dialect.Oracle12cDialect", label: "Oracle12cDialect" },
											{ value: "org.hibernate.dialect.Oracle21cDialect", label: "Oracle21cDialect" },
											{
												value: "org.hibernate.dialect.SQLServer2008Dialect",
												label: "SQLServer2008Dialect",
											},
											{
												value: "org.hibernate.dialect.SQLServer2012Dialect",
												label: "SQLServer2012Dialect",
											},
											{
												value: "org.hibernate.dialect.SQLServer2016Dialect",
												label: "SQLServer2016Dialect",
											},
											{ value: "org.hibernate.dialect.DB2Dialect", label: "DB2Dialect" },
											{ value: "org.hibernate.dialect.DB2400Dialect", label: "DB2400Dialect" },
											{ value: "org.hibernate.dialect.DB2390Dialect", label: "DB2390Dialect" },
											{ value: "org.hibernate.dialect.HSQLDialect", label: "HSQLDialect" },
											{ value: "org.hibernate.dialect.DerbyDialect", label: "DerbyDialect" },
											{
												value: "org.hibernate.dialect.DerbyTenSevenDialect",
												label: "DerbyTenSevenDialect",
											},
											{ value: "org.hibernate.dialect.DerbyTenFiveDialect", label: "DerbyTenFiveDialect" },
											{ value: "org.hibernate.dialect.DerbyTenSixDialect", label: "DerbyTenSixDialect" },
											{ value: "org.hibernate.dialect.InformixDialect", label: "InformixDialect" },
											{ value: "org.hibernate.dialect.FirebirdDialect", label: "FirebirdDialect" },
											{ value: "org.hibernate.dialect.SybaseASE15Dialect", label: "SybaseASE15Dialect" },
											{ value: "org.hibernate.dialect.SQLAnywhereDialect", label: "SQLAnywhereDialect" },
											{ value: "org.hibernate.dialect.SQLiteDialect", label: "SQLiteDialect" },
											{ value: "org.hibernate.dialect.TeradataDialect", label: "TeradataDialect" },
											{ value: "org.hibernate.dialect.HANARowStoreDialect", label: "HANARowStoreDialect" },
											{ value: "org.hibernate.dialect.HANACalcViewDialect", label: "HANACalcViewDialect" },
										]}
									/>
								</div>

								<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
									<TextField
										label="Spring Data JPA Repositories Package"
										value={formData.txtSpringDataJpaRepositoriesPackage}
										onChange={(e: any) =>
											handleInputChange("txtSpringDataJpaRepositoriesPackage", e.target.value)
										}
										placeholder="Enter repository package"
										isRequired
									/>
								</div>
							</div>
						)}

						{/* JTA 전용 필드 */}
						{formType === "jta" && (
							<div style={{ marginBottom: "20px" }}>
								<h3 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>JTA Implementation</h3>

								<div style={{ marginBottom: "15px" }}>
									<Select
										label="JTA Implementation"
										value={formData.txtJtaImplementation}
										onChange={(e) => handleInputChange("txtJtaImplementation", e.target.value)}
										isRequired
										options={[{ value: "Atomikos", label: "Atomikos" }]}
									/>
								</div>

								<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
									<TextField
										label="Global Timeout"
										value={formData.txtGlobalTimeout}
										onChange={(e: any) => handleInputChange("txtGlobalTimeout", e.target.value)}
										placeholder="Enter global timeout"
										isRequired
									/>
								</div>
							</div>
						)}

						<div style={{ marginBottom: "20px" }}>
							<h3 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>Transaction Settings</h3>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Transaction Manager Name"
									value={formData.txtTransactionName}
									onChange={(e: any) => handleInputChange("txtTransactionName", e.target.value)}
									placeholder="Enter transaction manager name"
									isRequired
								/>
							</div>

							{formType === "datasource" && (
								<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
									<TextField
										label="Data Source Name"
										value={formData.txtDataSourceName}
										onChange={(e: any) => handleInputChange("txtDataSourceName", e.target.value)}
										placeholder="Enter data source name"
										isRequired
									/>
								</div>
							)}

							<div style={{ marginBottom: "15px" }}>
								<Checkbox
									label="AOP Config Transaction"
									checked={formData.chkAopConfigTransaction}
									onChange={(e) => handleInputChange("chkAopConfigTransaction", e.target.checked)}
									description="Enable AOP-based transaction management"
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<Checkbox
									label="Annotation Transaction"
									checked={formData.chkAnnotationTransaction}
									onChange={(e) => handleInputChange("chkAnnotationTransaction", e.target.checked)}
									description="Enable annotation-based transaction management"
								/>
							</div>
						</div>

						<div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
							<Button variant="secondary" onClick={onCancel}>
								{t("common.cancel")}
							</Button>
							{/* aopConfigTransaction일 때에만 Next 버튼 표시 */}
							{formData.chkAopConfigTransaction ? (
								<Button onClick={() => setCurrentPage(2)}>{t("common.next")}</Button>
							) : (
								<Button type="submit" variant="primary">
									{t("common.generate")}
								</Button>
							)}
						</div>
					</div>
				)}

				{currentPage === 2 && formData.chkAopConfigTransaction && (
					<div>
						<div style={{ marginBottom: "20px" }}>
							<h3 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>AOP Config</h3>

							{formData.generationType !== ConfigGenerationType.JAVA_CONFIG && (
								<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
									<TextField
										label="Pointcut Name"
										value={formData.txtPointCutName}
										onChange={(e: any) => handleInputChange("txtPointCutName", e.target.value)}
										placeholder="Enter pointcut name"
										isRequired
									/>
								</div>
							)}

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Pointcut Expression"
									value={formData.txtPointCutExpression}
									onChange={(e: any) => handleInputChange("txtPointCutExpression", e.target.value)}
									placeholder="Enter pointcut expression"
									isRequired
								/>
							</div>
						</div>

						<div style={{ marginBottom: "20px" }}>
							<h3 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>Advice</h3>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Advice Name"
									value={formData.txtAdviceName}
									onChange={(e: any) => handleInputChange("txtAdviceName", e.target.value)}
									placeholder="Enter advice name"
									isRequired
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Method Name"
									value={formData.txtMethodName}
									onChange={(e: any) => handleInputChange("txtMethodName", e.target.value)}
									placeholder="Enter method name"
									isRequired
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<Checkbox
									label="Read Only"
									checked={formData.chkReadOnly}
									onChange={(e) => handleInputChange("chkReadOnly", e.target.checked)}
									description="Mark transaction as read-only"
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Rollback For"
									value={formData.txtRollbackFor}
									onChange={(e: any) => handleInputChange("txtRollbackFor", e.target.value)}
									placeholder="Enter rollback exception"
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="No Rollback For"
									value={formData.txtNoRollbackFor}
									onChange={(e: any) => handleInputChange("txtNoRollbackFor", e.target.value)}
									placeholder="Enter no rollback exception"
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Timeout"
									value={formData.txtTimeout}
									onChange={(e: any) => handleInputChange("txtTimeout", e.target.value)}
									placeholder="Enter timeout value"
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<Select
									label="Propagation"
									value={formData.cmbPropagation}
									onChange={(e) => handleInputChange("cmbPropagation", e.target.value)}
									isRequired
									options={[
										{ value: "REQUIRED", label: "REQUIRED" },
										{ value: "SUPPORTS", label: "SUPPORTS" },
										{ value: "MANDATORY", label: "MANDATORY" },
										{ value: "REQUIRES_NEW", label: "REQUIRES_NEW" },
										{ value: "NOT_SUPPORTED", label: "NOT_SUPPORTED" },
										{ value: "NEVER", label: "NEVER" },
										{ value: "NESTED", label: "NESTED" },
									]}
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<Select
									label="Isolation"
									value={formData.cmbIsolation}
									onChange={(e) => handleInputChange("cmbIsolation", e.target.value)}
									isRequired
									options={[
										{ value: "DEFAULT", label: "DEFAULT" },
										{ value: "READ_UNCOMMITTED", label: "READ_UNCOMMITTED" },
										{ value: "READ_COMMITTED", label: "READ_COMMITTED" },
										{ value: "REPEATABLE_READ", label: "REPEATABLE_READ" },
										{ value: "SERIALIZABLE", label: "SERIALIZABLE" },
									]}
								/>
							</div>
						</div>

						<div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
							<Button variant="secondary" onClick={() => setCurrentPage(1)}>
								{t("common.previous")}
							</Button>
							<Button variant="secondary" onClick={onCancel}>
								{t("common.cancel")}
							</Button>
							<Button type="submit" variant="primary">
								{t("common.generate")}
							</Button>
						</div>
					</div>
				)}
			</form>
		</div>
	)
}

export default TransactionForm
