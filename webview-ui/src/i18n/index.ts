import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import en from "./locales/en.json"
import ko from "./locales/ko.json"

const resources = {
	en: { translation: en },
	ko: { translation: ko },
}

// Get saved language from localStorage or default to 'en'
const getSavedLanguage = (): string => {
	try {
		const saved = localStorage.getItem("egovframe-language")
		if (saved && (saved === "en" || saved === "ko")) {
			return saved
		}
	} catch {
		// localStorage not available
	}
	return "en"
}

i18n.use(initReactI18next).init({
	resources,
	lng: getSavedLanguage(),
	fallbackLng: "en",
	interpolation: {
		escapeValue: false,
	},
})

// Save language preference
export const changeLanguage = (lang: string) => {
	i18n.changeLanguage(lang)
	try {
		localStorage.setItem("egovframe-language", lang)
	} catch {
		// localStorage not available
	}
}

export default i18n
