import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ar from "./locales/ar.json";

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: localStorage.getItem("taqtiq-lang") || "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem("taqtiq-lang", lng);
  document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lng;
});

// Apply on load
document.documentElement.dir = (localStorage.getItem("taqtiq-lang") || "en") === "ar" ? "rtl" : "ltr";
document.documentElement.lang = localStorage.getItem("taqtiq-lang") || "en";

export default i18n;
