import React, { useState, useEffect } from "react"
import { Button, TextField, TextArea, Select, RadioGroup, ProgressRing, Link, Divider, Checkbox } from "../../ui"
import { ConfigFormData, ConfigGenerationType, FormComponentProps } from "../types/templates"
import { vscode } from "../../../utils/vscode"
import {
	validatePackageName,
	validateFileName,
	validateRequiredFields,
	validateSpecialCharacters,
	validateNumber,
} from "../../../utils/codeUtils"

const SchedulingForm: React.FC<FormComponentProps> = ({ template, onSubmit, onCancel, formType, initialData }) => {
	// Get default file name based on generation type and form type
	function getDefaultFileName(type: ConfigGenerationType) {
		switch (formType) {
			case "beanJob":
				return type === ConfigGenerationType.JAVA_CONFIG
					? "EgovSchedulingJobDetailConfig"
					: "context-scheduling-jobDetail"
			case "methodJob":
				return type === ConfigGenerationType.JAVA_CONFIG
					? "EgovSchedulingMethodInvokingJobDetailConfig"
					: "context-scheduling-methodInvokingJobDetail"
			case "simpleTrigger":
				return type === ConfigGenerationType.JAVA_CONFIG
					? "EgovSchedulingSimpleTriggerConfig"
					: "context-scheduling-simpleTrigger"
			case "cronTrigger":
				return type === ConfigGenerationType.JAVA_CONFIG
					? "EgovSchedulingCronTriggerConfig"
					: "context-scheduling-cronTrigger"
			case "scheduler":
				return type === ConfigGenerationType.JAVA_CONFIG
					? "EgovSchedulingSchedulerConfig"
					: "context-scheduling-scheduler"
			default:
				return "context-scheduling"
		}
	}

	const [formData, setFormData] = useState<ConfigFormData>({
		// 아래는 입력값들에 대한 초기값
		generationType: ConfigGenerationType.XML,
		txtConfigPackage: "egovframework.example.config",
		txtFileName: getDefaultFileName(ConfigGenerationType.XML),

		// Bean Job & Method Invoking Job & Simple Trigger & Cron Trigger 공통
		txtJobName:
			formType === "beanJob"
				? "jobDetail"
				: formType === "methodJob"
					? "methodInvokingJobDetail"
					: formType === "simpleTrigger" || formType === "cronTrigger"
						? "jobDetail"
						: "",
		txtServiceClass: "egovframework.example.schedule.JobService",
		chkProperty: true,
		txtPropertyName: "paramSampleJob",
		txtPropertyValue: "SampleJobValue",

		// Method Invoking Job 전용
		txtServiceName: "jobService",
		txtServiceMethod: "executeSample",
		cboConcurrent: "false",

		// Simple Trigger & Cron Trigger & Scheduler 공통
		cboJobDetailType: "JobDetailFactoryBean",
		txtTriggerName:
			formType === "simpleTrigger"
				? "simpleTrigger"
				: formType === "cronTrigger"
					? "cronTrigger"
					: formType === "scheduler"
						? "simpleTrigger"
						: "",

		// Simple Trigger 전용
		txtStartDelay: "2000",
		txtRepeatInterval: "10000",

		// Cron Trigger 전용
		txtCronExpression: "*/10 * * * * ?",

		// Scheduler 전용
		txtSchedulerName: "scheduler",
		cboTriggerType: "SimpleTriggerFactoryBean",

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
					console.log("SchedulingForm: Received selectedOutputFolderDuplicate message:", message.text)
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
		const requiredFields: Array<{ field: string; label: string }> = [{ field: "generationType", label: "Generation Type" }]
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
			case "beanJob":
				requiredFields.push(
					{ field: "txtJobName", label: "Job Name" },
					{ field: "txtServiceClass", label: "Service Class" },
				)
				break
			case "methodJob":
				requiredFields.push(
					{ field: "txtJobName", label: "Job Name" },
					{ field: "txtServiceClass", label: "Service Class" },
					{ field: "txtServiceName", label: "Service Name" },
					{ field: "txtServiceMethod", label: "Service Method" },
					{ field: "cboConcurrent", label: "Concurrent" },
				)
				break
			case "simpleTrigger":
				requiredFields.push(
					{ field: "txtTriggerName", label: "Trigger Name" },
					{ field: "cboJobDetailType", label: "Job Detail Type" },
					{ field: "txtJobName", label: "Job Name" },
					{ field: "txtStartDelay", label: "Start Delay" },
					{ field: "txtRepeatInterval", label: "Repeat Interval" },
				)
				break
			case "cronTrigger":
				requiredFields.push(
					{ field: "txtTriggerName", label: "Trigger Name" },
					{ field: "cboJobDetailType", label: "Job Detail Type" },
					{ field: "txtJobName", label: "Job Name" },
					{ field: "txtCronExpression", label: "Cron Expression" },
				)
				break
			case "scheduler":
				requiredFields.push(
					{ field: "txtSchedulerName", label: "Scheduler Name" },
					{ field: "cboTriggerType", label: "Trigger Type" },
					{ field: "txtTriggerName", label: "Trigger Name" },
				)
				break
		}
		const missingFieldsMessage = validateRequiredFields(requiredFields, formData)
		if (missingFieldsMessage) {
			setValidationError(missingFieldsMessage)
			return
		}

		// 4. 특수문자 유효성 검증
		const notSpecialCharactersFields: Array<{ field: string; label: string }> = [
			{ field: "txtJobName", label: "Job Name" },
			{ field: "txtPropertyName", label: "Property Name" },
			{ field: "txtPropertyValue", label: "Property Value" },
			{ field: "txtServiceName", label: "Service Name" },
			{ field: "txtServiceMethod", label: "Service Method" },
			{ field: "cboConcurrent", label: "Concurrent" },
			{ field: "txtTriggerName", label: "Trigger Name" },
			{ field: "txtJobDetailType", label: "Job Detail Type" },
			{ field: "txtSchedulerName", label: "Scheduler Name" },
			{ field: "cboTriggerType", label: "Trigger Type" },
		]
		const specialCharacterMessage = validateSpecialCharacters(notSpecialCharactersFields, formData)
		if (specialCharacterMessage) {
			setValidationError(specialCharacterMessage)
			return
		}

		// 5. 숫자 유효성 검증
		const numberFields: Array<{ field: string; label: string }> = [
			{ field: "txtStartDelay", label: "Start Delay" },
			{ field: "txtRepeatInterval", label: "Repeat Interval" },
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
		setFormData((prev) => {
			const newData = { ...prev, [field]: value }

			// Simple Trigger와 Cron Trigger에서 Job Detail Type 변경 시 Job Name 자동 업데이트
			if (field === "cboJobDetailType" && (formType === "simpleTrigger" || formType === "cronTrigger")) {
				if (value === "JobDetailFactoryBean") {
					newData.txtJobName = "jobDetail"
				} else if (value === "MethodInvokingJobDetailFactoryBean") {
					newData.txtJobName = "methodInvokingJobDetail"
				}
			}

			// Scheduler에서 Trigger Type 변경 시 Trigger Name 자동 업데이트
			if (field === "cboTriggerType" && formType === "scheduler") {
				if (value === "SimpleTriggerFactoryBean") {
					newData.txtTriggerName = "simpleTrigger"
				} else if (value === "CronTriggerFactoryBean") {
					newData.txtTriggerName = "cronTrigger"
				}
			}

			return newData
		})
		// 입력 시 에러 클리어
		setValidationError("")
	}

	const getFormTitle = () => {
		switch (formType) {
			case "beanJob":
				return "Create Detail Bean Job"
			case "methodJob":
				return "Create Method Invoking Job"
			case "cronTrigger":
				return "Create Cron Trigger"
			case "simpleTrigger":
				return "Create Simple Trigger"
			case "scheduler":
				return "Create Scheduler"
			default:
				return "Create Scheduling Configuration"
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
						href="https://www.egovframe.go.kr/docs/5.0/egovframe-runtime/foundation-layer/scheduling/"
						style={{ display: "inline", fontSize: "12px" }}>
						Scheduling Guide Here
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
						<li>spring-context-support</li>
						<li>quartz:2.3.2+</li>
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

					{/* Bean Job 필드들 */}
					{formType === "beanJob" && (
						<>
							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Job Name"
									value={formData.txtJobName}
									onChange={(e: any) => handleInputChange("txtJobName", e.target.value)}
									placeholder="Enter job name"
									isRequired
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Service Class (Full Package Name)"
									value={formData.txtServiceClass}
									onChange={(e: any) => handleInputChange("txtServiceClass", e.target.value)}
									placeholder="Enter service class"
									isRequired
								/>
								<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
									QuartzJobBean을 구현하고 실제 서비스 로직이 담긴 클래스를 입력하세요.
								</div>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<Checkbox
									label="Use Property"
									checked={formData.chkProperty}
									onChange={(e) => handleInputChange("chkProperty", e.target.checked)}
									description="Enable property configuration"
								/>
							</div>

							{formData.chkProperty && (
								<>
									<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
										<TextField
											label="Property Name"
											value={formData.txtPropertyName}
											onChange={(e: any) => handleInputChange("txtPropertyName", e.target.value)}
											placeholder="Enter property name"
										/>
									</div>

									<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
										<TextField
											label="Property Value"
											value={formData.txtPropertyValue}
											onChange={(e: any) => handleInputChange("txtPropertyValue", e.target.value)}
											placeholder="Enter property value"
										/>
									</div>
								</>
							)}
						</>
					)}

					{/* Method Invoking Job 필드들 */}
					{formType === "methodJob" && (
						<>
							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Job Name"
									value={formData.txtJobName}
									onChange={(e: any) => handleInputChange("txtJobName", e.target.value)}
									placeholder="Enter job name"
									isRequired
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Service Class (Full Package Name)"
									value={formData.txtServiceClass}
									onChange={(e: any) => handleInputChange("txtServiceClass", e.target.value)}
									placeholder="Enter service class"
									isRequired
								/>
								<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
									Bean(e.g., @Service)으로 등록하고 실제 서비스 로직이 담긴 클래스를 입력하세요.
								</div>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Service Name (Bean Name)"
									value={formData.txtServiceName}
									onChange={(e: any) => handleInputChange("txtServiceName", e.target.value)}
									placeholder="Enter service name"
									isRequired
								/>
								<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
									서비스 로직이 담긴 클래스에서 설정한 Bean(e.g., @Service)의 이름을 입력하세요.
								</div>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Service Method"
									value={formData.txtServiceMethod}
									onChange={(e: any) => handleInputChange("txtServiceMethod", e.target.value)}
									placeholder="Enter service method name"
									isRequired
								/>
								<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
									스케줄러가 실행할 서비스 메소드명을 입력하세요.
								</div>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<Select
									label="Concurrent"
									value={formData.cboConcurrent}
									onChange={(e) => handleInputChange("cboConcurrent", e.target.value)}
									isRequired
									options={[
										{ value: "false", label: "False (Sequential)" },
										{ value: "true", label: "True (Concurrent)" },
									]}
								/>
								<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
									동시 실행 여부 (false: 순차 실행, true: 동시 실행 허용)
								</div>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<Checkbox
									label="Use Property"
									checked={formData.chkProperty}
									onChange={(e) => handleInputChange("chkProperty", e.target.checked)}
									description="Enable property configuration"
								/>
							</div>

							{formData.chkProperty && (
								<>
									<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
										<TextField
											label="Property Name"
											value={formData.txtPropertyName}
											onChange={(e: any) => handleInputChange("txtPropertyName", e.target.value)}
											placeholder="Enter property name"
										/>
									</div>

									<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
										<TextField
											label="Property Value"
											value={formData.txtPropertyValue}
											onChange={(e: any) => handleInputChange("txtPropertyValue", e.target.value)}
											placeholder="Enter property value"
										/>
									</div>
								</>
							)}
						</>
					)}

					{/* Simple Trigger 필드들 */}
					{formType === "simpleTrigger" && (
						<>
							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Trigger Name"
									value={formData.txtTriggerName}
									onChange={(e: any) => handleInputChange("txtTriggerName", e.target.value)}
									placeholder="Enter trigger name"
									isRequired
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<Select
									label="Job Detail Type"
									value={formData.cboJobDetailType}
									onChange={(e) => handleInputChange("cboJobDetailType", e.target.value)}
									isRequired
									options={[
										{ value: "JobDetailFactoryBean", label: "JobDetailFactoryBean" },
										{
											value: "MethodInvokingJobDetailFactoryBean",
											label: "MethodInvokingJobDetailFactoryBean",
										},
									]}
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Job Name"
									value={formData.txtJobName}
									onChange={(e: any) => handleInputChange("txtJobName", e.target.value)}
									placeholder="Enter job name"
									isRequired
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Start Delay (ms)"
									value={formData.txtStartDelay}
									onChange={(e: any) => handleInputChange("txtStartDelay", e.target.value)}
									placeholder="Enter start delay in milliseconds"
									isRequired
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Repeat Interval (ms)"
									value={formData.txtRepeatInterval}
									onChange={(e: any) => handleInputChange("txtRepeatInterval", e.target.value)}
									placeholder="Enter repeat interval in milliseconds"
									isRequired
								/>
							</div>
						</>
					)}

					{/* Cron Trigger 필드들 */}
					{formType === "cronTrigger" && (
						<>
							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Trigger Name"
									value={formData.txtTriggerName}
									onChange={(e: any) => handleInputChange("txtTriggerName", e.target.value)}
									placeholder="Enter trigger name"
									isRequired
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<Select
									label="Job Detail Type"
									value={formData.cboJobDetailType}
									onChange={(e) => handleInputChange("cboJobDetailType", e.target.value)}
									isRequired
									options={[
										{ value: "JobDetailFactoryBean", label: "JobDetailFactoryBean" },
										{
											value: "MethodInvokingJobDetailFactoryBean",
											label: "MethodInvokingJobDetailFactoryBean",
										},
									]}
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Job Name"
									value={formData.txtJobName}
									onChange={(e: any) => handleInputChange("txtJobName", e.target.value)}
									placeholder="Enter job name"
									isRequired
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Cron Expression"
									value={formData.txtCronExpression}
									onChange={(e: any) => handleInputChange("txtCronExpression", e.target.value)}
									placeholder="Enter cron expression (e.g., */10 * * * * ?)"
									isRequired
								/>
							</div>
						</>
					)}

					{/* Scheduler 필드들 */}
					{formType === "scheduler" && (
						<>
							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Scheduler Name"
									value={formData.txtSchedulerName}
									onChange={(e: any) => handleInputChange("txtSchedulerName", e.target.value)}
									placeholder="Enter scheduler name"
									isRequired
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<Select
									label="Trigger Type"
									value={formData.cboTriggerType}
									onChange={(e) => handleInputChange("cboTriggerType", e.target.value)}
									isRequired
									options={[
										{ value: "SimpleTriggerFactoryBean", label: "SimpleTriggerFactoryBean" },
										{ value: "CronTriggerFactoryBean", label: "CronTriggerFactoryBean" },
									]}
								/>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Trigger Name"
									value={formData.txtTriggerName}
									onChange={(e: any) => handleInputChange("txtTriggerName", e.target.value)}
									placeholder="Enter trigger name"
									isRequired
								/>
							</div>
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

export default SchedulingForm
