import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import en from './locales/en.json';
import hi from './locales/hi.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ja from './locales/ja.json';

export type LocaleCode = 'en' | 'hi' | 'es' | 'fr' | 'de' | 'ja';

type TranslationMap = Record<string, string>;

const STORAGE_KEY = 'app_locale';
const LEGACY_LANGUAGE_KEY = 'app_language';

const dictionaries: Record<LocaleCode, TranslationMap> = { en, hi, es, fr, de, ja };

export const languages: Array<{ code: LocaleCode; label: string; nativeName: string; dir: 'ltr' | 'rtl' }> = [
  { code: 'en', label: 'English', nativeName: 'English', dir: 'ltr' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr' },
  { code: 'es', label: 'Spanish', nativeName: 'Español', dir: 'ltr' },
  { code: 'fr', label: 'French', nativeName: 'Français', dir: 'ltr' },
  { code: 'de', label: 'German', nativeName: 'Deutsch', dir: 'ltr' },
  { code: 'ja', label: 'Japanese', nativeName: '日本語', dir: 'ltr' }
];

const legacyLanguageToLocale = (value?: string | null): LocaleCode | undefined => {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  const matched = languages.find((language) => (
    language.code === normalized
    || language.label.toLowerCase() === normalized
    || language.nativeName.toLowerCase() === normalized
  ));
  return matched?.code;
};

const getInitialLocale = (): LocaleCode => {
  try {
    const storedLocale = localStorage.getItem(STORAGE_KEY) as LocaleCode | null;
    if (storedLocale && storedLocale in dictionaries) return storedLocale;

    const legacyLocale = legacyLanguageToLocale(localStorage.getItem(LEGACY_LANGUAGE_KEY));
    if (legacyLocale) return legacyLocale;
  } catch {}

  return 'en';
};

interface I18nContextValue {
  locale: LocaleCode;
  language: typeof languages[number];
  setLocale: (locale: LocaleCode) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<LocaleCode>(getInitialLocale);

  const setLocale = (nextLocale: LocaleCode) => {
    setLocaleState(nextLocale);
    try {
      const language = languages.find((item) => item.code === nextLocale);
      localStorage.setItem(STORAGE_KEY, nextLocale);
      if (language) localStorage.setItem(LEGACY_LANGUAGE_KEY, language.label);
    } catch {}
  };

  useEffect(() => {
    const language = languages.find((item) => item.code === locale) || languages[0];
    document.documentElement.lang = locale;
    document.documentElement.dir = language.dir;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
      localStorage.setItem(LEGACY_LANGUAGE_KEY, language.label);
    } catch {}
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const language = languages.find((item) => item.code === locale) || languages[0];

    const t = (key: string, values?: Record<string, string | number>) => {
      const dictionary = dictionaries[locale] || dictionaries.en;
      let translated = dictionary[key] || dictionaries.en[key];

      if (!translated) {
        console.warn(`[i18n] Missing translation key: ${key}`);
        translated = key;
      }

      if (!values) return translated;
      return Object.entries(values).reduce(
        (message, [name, replacement]) => message.replaceAll(`{{${name}}}`, String(replacement)),
        translated
      );
    };

    return { locale, language, setLocale, t };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
};
