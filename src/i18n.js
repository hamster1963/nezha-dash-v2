import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { safeLocalStorage } from "@/lib/storage";

import deTranslation from "./locales/de/translation.json";
import enTranslation from "./locales/en/translation.json";
import esTranslation from "./locales/es/translation.json";
import frTranslation from "./locales/fr/translation.json";
import glTranslation from "./locales/gl/translation.json";
import idTranslation from "./locales/id/translation.json";
import jaTranslation from "./locales/ja/translation.json";
import ptBRTranslation from "./locales/pt_BR/translation.json";
import roTranslation from "./locales/ro/translation.json";
import ruTranslation from "./locales/ru/translation.json";
import taTranslation from "./locales/ta/translation.json";
import ukTranslation from "./locales/uk/translation.json";
import zhCNTranslation from "./locales/zh-CN/translation.json";
import zhTWTranslation from "./locales/zh-TW/translation.json";

const resources = {
	"en-US": {
		translation: enTranslation,
	},
	"zh-CN": {
		translation: zhCNTranslation,
	},
	"zh-TW": {
		translation: zhTWTranslation,
	},
	"de-DE": {
		translation: deTranslation,
	},
	"es-ES": {
		translation: esTranslation,
	},
	fr: {
		translation: frTranslation,
	},
	gl: {
		translation: glTranslation,
	},
	id: {
		translation: idTranslation,
	},
	ja: {
		translation: jaTranslation,
	},
	pt_BR: {
		translation: ptBRTranslation,
	},
	ro: {
		translation: roTranslation,
	},
	"ru-RU": {
		translation: ruTranslation,
	},
	"ta-IN": {
		translation: taTranslation,
	},
	uk: {
		translation: ukTranslation,
	},
};

const getStoredLanguage = () => {
	return safeLocalStorage.getItem("language") || "en-US";
};

i18n.use(initReactI18next).init({
	resources,
	lng: getStoredLanguage(), // 使用localStorage中存储的语言或默认值
	fallbackLng: "en-US", // 当前语言的翻译没有找到时，使用的备选语言
	interpolation: {
		escapeValue: false, // react已经安全地转义
	},
});

// 添加语言改变时的处理函数
i18n.on("languageChanged", (lng) => {
	safeLocalStorage.setItem("language", lng);
});

export default i18n;
