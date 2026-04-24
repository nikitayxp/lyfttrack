import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import {
  DEFAULT_LANGUAGE,
  resolveSupportedLanguage,
  resources,
} from './resources';

function getDeviceLanguage() {
  const locale = getLocales()[0];
  return resolveSupportedLanguage(locale?.languageCode ?? null);
}

const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

export default i18n;
