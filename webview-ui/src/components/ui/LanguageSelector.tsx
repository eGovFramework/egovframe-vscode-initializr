import { useTranslation } from "react-i18next"
import { changeLanguage } from "../../i18n"
import { useVSCodeTheme } from "./theme"

interface LanguageSelectorProps {
	value?: string // value가 주어지면 해당 값을 드롭다운에 표시. 주어지지 않으면 i18n.language를 사용.
	onChange?: (lang: string) => void // onChange가 주어지면 즉시 언어를 변경하는 대신 해당 함수를 호출. 주어지지 않으면 changeLanguage를 사용하여 언어 변경.
}

export const LanguageSelector = ({ value, onChange }: LanguageSelectorProps = {}) => {
	const { t, i18n } = useTranslation()
	const theme = useVSCodeTheme()

	const currentValue = value ?? i18n.language

	const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		if (onChange) {
			onChange(e.target.value)
		} else {
			changeLanguage(e.target.value)
		}
	}

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: "8px",
			}}>
			<label
				style={{
					fontSize: theme.fontSize.sm,
					color: theme.colors.descriptionForeground,
				}}>
				{t("language.select")}:
			</label>
			<select
				value={currentValue}
				onChange={handleLanguageChange}
				style={{
					padding: "4px 8px",
					backgroundColor: theme.colors.inputBackground,
					color: theme.colors.inputForeground,
					border: `1px solid ${theme.colors.inputBorder}`,
					borderRadius: "4px",
					fontSize: theme.fontSize.sm,
					fontFamily: "inherit",
					outline: "none",
					cursor: "pointer",
				}}
				onFocus={(e) => {
					e.currentTarget.style.border = `1px solid ${theme.colors.focusBorder}`
				}}
				onBlur={(e) => {
					e.currentTarget.style.border = `1px solid ${theme.colors.inputBorder}`
				}}>
				<option value="en">{t("language.en")}</option>
				<option value="ko">{t("language.ko")}</option>
			</select>
		</div>
	)
}

export default LanguageSelector
