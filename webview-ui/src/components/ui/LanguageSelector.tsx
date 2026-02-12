import { useTranslation } from "react-i18next"
import { changeLanguage } from "../../i18n"
import { useVSCodeTheme } from "./theme"

export const LanguageSelector = () => {
	const { t, i18n } = useTranslation()
	const theme = useVSCodeTheme()

	const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		changeLanguage(e.target.value)
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
				value={i18n.language}
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
