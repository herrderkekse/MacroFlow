import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import en from "./locales/en";
import de from "./locales/de";

export type Language = "en" | "de";
export const SUPPORTED_LANGUAGES: Language[] = ["en", "de"];

const deviceLang = Localization.getLocales()[0]?.languageCode ?? "en";
export const defaultLanguage: Language = SUPPORTED_LANGUAGES.includes(deviceLang as Language)
    ? (deviceLang as Language)
    : "en";

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        de: { translation: de },
    },
    lng: defaultLanguage,
    fallbackLng: "en",
    interpolation: {
        escapeValue: false,
    },
});

export default i18n;
