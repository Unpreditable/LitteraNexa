import i18next from "i18next";
import { getLanguage } from "obsidian";
import en from "./locales/en.json";

void i18next.init({
  lng: getLanguage() ?? "en",
  fallbackLng: "en",
  resources: {
    en: { translation: en },
  },
  interpolation: { escapeValue: false },
});

export const t = i18next.t.bind(i18next) as (key: string, options?: Record<string, unknown>) => string;
export { i18next };
