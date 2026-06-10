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

const CacheForm: React.FC<FormComponentProps> = ({ onSubmit, onCancel, template, initialData }) => {
	const { t } = useTranslation()
	const [currentPage, setCurrentPage] = useState(1)
	const [formData, setFormData] = useState<ConfigFormData>({
		// 아래는 입력값들에 대한 초기값
		generationType: ConfigGenerationType.XML,
		txtFileName: "ehcache-default",
		txtDiskStore: "user.dir/second",
		// 기본 캐시 템플릿 설정
		txtDftEternal: "false",
		txtDftLiveTime: "10", // TTL (Time To Live) - 생성 후 만료 시간 (분)
		txtDftHeapEntries: "100", // 힙 엔트리 수 (빈 값이면 미사용)
		txtDftOffheapSize: "", // 오프힙 크기 MB (빈 값이면 미사용)
		txtDftDiskPersistence: "true", // 디스크 영속성
		// 사용자 캐시 설정
		txtCacheName: "cache",
		txtEternal: "false",
		txtIdleTime: "300", // TTI (Time To Idle) - 사용 후 만료 시간 (초)
		txtHeapEntries: "10", // 힙 엔트리 수 (빈 값이면 미사용)
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
					console.log("CacheForm: Received selectedOutputFolderDuplicate message:", message.text)
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
			txtFileName: type === ConfigGenerationType.JAVA_CONFIG ? "EgovEhcacheDefaultConfig" : "ehcache-default",
		}))
		// 타입 변경 시 에러 클리어
		setValidationError("")
	}

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()

		// 1. Package Name 유효성 검증 (JavaConfig일 때만)
		// CacheForm은 txtConfigPackage가 없으므로 생략

		// 2. File Name / Class Name 유효성 검증
		const fileNameError = validateFileName(formData.txtFileName, formData.generationType === ConfigGenerationType.JAVA_CONFIG)
		if (fileNameError) {
			setValidationError(fileNameError)
			return
		}

		// 3. Missing Fields 유효성 검증
		const requiredFields: Array<{ field: string; label: string }> = [
			{ field: "generationType", label: "Generation Type" },
			{ field: "txtFileName", label: "File Name" },
			{ field: "txtDftEternal", label: "Default Cache Eternal" },
		]
		if (currentPage === 2) {
			requiredFields.push({ field: "txtCacheName", label: "Cache Name" }, { field: "txtEternal", label: "Eternal" })
		}
		const missingFieldsMessage = validateRequiredFields(requiredFields, formData)
		if (missingFieldsMessage) {
			setValidationError(missingFieldsMessage)
			return
		}

		// 4. 특수문자 유효성 검증
		const notSpecialCharactersFields: Array<{ field: string; label: string }> = [
			{ field: "txtDftEternal", label: "Default Cache Eternal" },
			{ field: "txtDftDiskPersistence", label: "Use Disk Storage" },
			{ field: "txtCacheName", label: "Cache Name" },
			{ field: "txtEternal", label: "Eternal" },
		]
		const specialCharacterMessage = validateSpecialCharacters(notSpecialCharactersFields, formData)
		if (specialCharacterMessage) {
			setValidationError(specialCharacterMessage)
			return
		}

		// 5. 숫자 유효성 검증
		const numberFields: Array<{ field: string; label: string }> = [
			{ field: "txtDftLiveTime", label: "Default Cache Live Time" },
			{ field: "txtDftHeapEntries", label: "Heap Entries" },
			{ field: "txtDftOffheapSize", label: "Offheap Size" },
			{ field: "txtIdleTime", label: "Idle Time" },
			{ field: "txtHeapEntries", label: "Heap Entries" },
		]
		const numberMessage = validateNumber(numberFields, formData)
		if (numberMessage) {
			setValidationError(numberMessage)
			return
		}

		// 성공 시 에러 클리어
		setValidationError("")

		// Check if vscode API is available
		if (!vscode) {
			console.error("VSCode API is not available")
			return
		}

		// Store form data and request folder selection
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
			<h2 style={{ color: "var(--vscode-foreground)", marginBottom: "20px" }}>Set Cache</h2>

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
						href="https://www.egovframe.go.kr/docs/5.0/egovframe-runtime/foundation-layer/cache/ehCache/"
						style={{ display: "inline", fontSize: "12px" }}>
						{t("forms.cache.guideLink")}
					</Link>
				</div>
				<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", marginTop: "8px" }}>
					<strong>{t("forms.common.requirements")}:</strong>
					<ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
						<li>Spring Framework 6.x</li>
						<li>JDK 17+</li>
						<li>Ehcache 3.10.8+ (jakarta classifier)</li>
						<li>jakarta.cache-api 3.1.1+ (JCache/JSR-107)</li>
					</ul>
				</div>
				<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", marginTop: "8px" }}>
					<strong>{t("forms.common.requiredDependencies")}:</strong>
					<ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
						<li>org.ehcache:ehcache:3.10.8:jakarta</li>
						<li>jakarta.cache:jakarta.cache-api:3.1.1</li>
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
				{currentPage === 1 && (
					<div>
						<div style={{ marginBottom: "20px" }}>
							<h3 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>Generation File</h3>

							{/* XML 설정만 제공(JavaConfig 미사용)
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
							*/}

							<div style={{ width: "calc(100% - 24px)", marginBottom: "20px" }}>
								<TextField
									label="File Name"
									value={formData.txtFileName}
									onChange={(e) => handleInputChange("txtFileName", e.target.value)}
									placeholder="Enter file name"
									isRequired
								/>
								<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
									Ehcache 3.x XML 설정 파일 이름
								</div>
							</div>
						</div>

						<div style={{ marginBottom: "20px" }}>
							<h3 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>Disk Store</h3>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Disk Store Path"
									value={formData.txtDiskStore}
									onChange={(e) => handleInputChange("txtDiskStore", e.target.value)}
									placeholder="Enter disk store path"
									isRequired
								/>
								<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
									디스크 캐시를 저장할 경로 (예: user.dir/second 또는 /tmp/cache)
								</div>
							</div>
						</div>

						<div style={{ marginBottom: "20px" }}>
							<h3 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>Set Default Cache</h3>
							<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", marginBottom: "10px" }}>
								모든 캐시에 기본적으로 적용될 설정입니다
							</div>

							{/* Expiry 설정 */}
							<div style={{ marginBottom: "15px" }}>
								<Select
									label="Default Cache Eternal"
									options={[
										{ value: "true", label: "True" },
										{ value: "false", label: "False" },
									]}
									value={formData.txtDftEternal}
									onChange={(e) => handleInputChange("txtDftEternal", e.target.value)}
									isRequired
								/>
								<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
									True: 만료되지 않음 (none), False: TTL 적용
								</div>
							</div>

							{formData.txtDftEternal === "false" && (
								<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
									<TextField
										label="Default Cache Live Time (Minutes)"
										value={formData.txtDftLiveTime}
										onChange={(e) => handleInputChange("txtDftLiveTime", e.target.value)}
										placeholder="Enter default cache live time (sec)"
									/>
									<div
										style={{
											fontSize: "10px",
											color: "var(--vscode-descriptionForeground)",
											marginTop: "2px",
										}}>
										TTL (Time To Live): 생성 후 만료 시간 (분)
									</div>
								</div>
							)}

							{/* Resources 설정 */}
							<h4 style={{ color: "var(--vscode-foreground)", marginBottom: "10px", marginTop: "20px" }}>
								Storage Resources
							</h4>
							<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginBottom: "10px" }}>
								값을 입력하면 해당 저장소가 활성화됩니다. 빈 값이면 미사용.
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Heap Entries"
									value={formData.txtDftHeapEntries}
									onChange={(e) => handleInputChange("txtDftHeapEntries", e.target.value)}
									placeholder="Enter heap max entries (e.g. 10000)"
								/>
								<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
									힙 메모리에 저장할 최대 엔트리 수 (빈 값이면 미사용)
								</div>
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="OffHeap Size (MB)"
									value={formData.txtDftOffheapSize}
									onChange={(e) => handleInputChange("txtDftOffheapSize", e.target.value)}
									placeholder="Enter offheap size in MB (e.g. 50)"
								/>
								<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
									오프힙 메모리 크기 MB (빈 값이면 미사용)
								</div>
							</div>

							{/* Resources 설정 - Disk */}
							<div style={{ marginBottom: "15px" }}>
								<Select
									label="Use Disk Storage"
									options={[
										{ value: "true", label: "True" },
										{ value: "false", label: "False" },
									]}
									value={formData.txtDftDiskPersistence}
									onChange={(e) => handleInputChange("txtDftDiskPersistence", e.target.value)}
								/>
								<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
									디스크 저장소 사용 여부
								</div>
							</div>
						</div>

						<div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
							<Button variant="secondary" onClick={onCancel}>
								{t("common.cancel")}
							</Button>
							<Button onClick={() => setCurrentPage(2)}>{t("common.next")}</Button>
						</div>
					</div>
				)}

				{currentPage === 2 && (
					<div>
						<div style={{ marginBottom: "20px" }}>
							<h3 style={{ color: "var(--vscode-foreground)", marginBottom: "10px" }}>Set Custom Cache</h3>
							<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", marginBottom: "10px" }}>
								특정 용도에 맞는 커스텀 캐시 설정입니다. (defaultCache 템플릿을 상속받음)
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Cache Name (alias)"
									value={formData.txtCacheName}
									onChange={(e) => handleInputChange("txtCacheName", e.target.value)}
									placeholder="Enter cache name"
									isRequired
								/>
								<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
									애플리케이션에서 사용할 캐시 이름 (예: userCache, productCache)
								</div>
							</div>

							{/* Expiry 설정 */}
							<div style={{ marginBottom: "15px" }}>
								<Select
									label="Eternal"
									options={[
										{ value: "true", label: "True" },
										{ value: "false", label: "False" },
									]}
									value={formData.txtEternal}
									onChange={(e) => handleInputChange("txtEternal", e.target.value)}
									isRequired
								/>
								<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
									True: 만료되지 않음 (none), False: TTI 적용
								</div>
							</div>

							{formData.txtEternal === "false" && (
								<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
									<TextField
										label="Idle Time (sec)"
										value={formData.txtIdleTime}
										onChange={(e) => handleInputChange("txtIdleTime", e.target.value)}
										placeholder="Enter idle time (sec)"
									/>
									<div
										style={{
											fontSize: "10px",
											color: "var(--vscode-descriptionForeground)",
											marginTop: "2px",
										}}>
										TTI (Time To Idle): 마지막 접근 후 만료 시간 (초)
									</div>
								</div>
							)}

							{/* Resources 설정 */}
							<h4 style={{ color: "var(--vscode-foreground)", marginBottom: "10px", marginTop: "20px" }}>
								Storage Resources
							</h4>
							<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginBottom: "10px" }}>
								값을 입력하면 해당 저장소가 활성화됩니다. 빈 값이면 미사용.
							</div>

							<div style={{ width: "calc(100% - 24px)", marginBottom: "15px" }}>
								<TextField
									label="Heap Entries"
									value={formData.txtHeapEntries}
									onChange={(e) => handleInputChange("txtHeapEntries", e.target.value)}
									placeholder="Enter heap max entries (e.g. 100)"
								/>
								<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginTop: "2px" }}>
									힙 메모리에 저장할 최대 엔트리 수 (빈 값이면 미사용)
								</div>
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

export default CacheForm
