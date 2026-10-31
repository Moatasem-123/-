import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type AppLanguage = 'ar' | 'en';

interface LanguageContextValue {
  lang: AppLanguage;
  isRtl: boolean;
  setLang: (lang: AppLanguage) => void;
  toggleLang: () => void;
  t: (arText: string, enText: string) => string;
}

const LANG_STORAGE_KEY = 'sanad_language_pref_v1';

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'ar',
  isRtl: true,
  setLang: () => {},
  toggleLang: () => {},
  t: (arText) => arText,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [lang, setLangState] = useState<AppLanguage>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      return saved === 'en' ? 'en' : 'ar';
    } catch {
      return 'ar';
    }
  });

  const setLang = useCallback((nextLang: AppLanguage) => {
    setLangState(nextLang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, nextLang);
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'ar' ? 'en' : 'ar');
  }, [lang, setLang]);

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const t = useCallback(
    (arText: string, enText: string) => (lang === 'ar' ? arText : enText),
    [lang]
  );

  return (
    <LanguageContext.Provider
      value={{
        lang,
        isRtl: lang === 'ar',
        setLang,
        toggleLang,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
