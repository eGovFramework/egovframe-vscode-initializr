import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import en from "./locales/en.json"
import ko from "./locales/ko.json"

declare global {
	interface Window {
		__EGOV_INIT_LANGUAGE__?: string
	}
}

const resources = {
	en: { translation: en },
	ko: { translation: ko },
}

// Read language injected by WebviewProvider from VSCode settings (egovframeInitializr.language)
const getSavedLanguage = (): string => {
	const lang = window.__EGOV_INIT_LANGUAGE__
	if (lang === "en" || lang === "ko") {
		return lang
	}
	return "en"

	/*
	// Get saved language from localStorage or default to 'en'
	try {
		const saved = localStorage.getItem("egovframe-language")
		if (saved && (saved === "en" || saved === "ko")) {
			return saved
		}
	} catch {
		// localStorage not available
		console.error("localStorage not available. Using default language: en")
	}
	return "en"
	*/
}

i18n.use(initReactI18next).init({
	resources,
	lng: getSavedLanguage(),
	fallbackLng: "en",
	interpolation: {
		escapeValue: false,
	},
})

// Apply language change (VSCode settings is the source of truth)
export const changeLanguage = (lang: string) => {
	i18n.changeLanguage(lang)

	/*
	i18n.changeLanguage(lang)

	// save language to localStorage
	try {
		localStorage.setItem("egovframe-language", lang)
	} catch {
		// localStorage not available
	}
	*/
}

export default i18n
