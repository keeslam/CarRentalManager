import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import translationEN from './locales/en/translation.json';
import translationNL from './locales/nl/translation.json';

const resources = {
  en: {
    translation: translationEN
  },
  nl: {
    translation: translationNL
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'nl', // Default to Dutch
    fallbackLng: 'nl', // Default language is Dutch
    supportedLngs: ['nl', 'en'], // Only support these languages
    load: 'languageOnly', // Only load 'en' not 'en-US'
    interpolation: {
      escapeValue: false
    }
  });

// After initialization, check localStorage and update language if needed
if (typeof window !== 'undefined') {
  const storedLanguage = localStorage.getItem('language');
  if (storedLanguage && (storedLanguage === 'nl' || storedLanguage === 'en')) {
    i18n.changeLanguage(storedLanguage);
  } else {
    // Set Dutch as default in localStorage
    localStorage.setItem('language', 'nl');
  }
}

export default i18n;
