// Stub i18n configuration - keeps everything in English
// No actual translation happens, just returns the English text

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Simple pass-through translation
i18n
  .use(initReactI18next)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
      en: {
        translation: {}
      }
    },
    interpolation: {
      escapeValue: false
    },
    // Return the key itself if no translation found (keeps English text)
    returnEmptyString: false,
    returnNull: false,
    saveMissing: false,
  });

export default i18n;
