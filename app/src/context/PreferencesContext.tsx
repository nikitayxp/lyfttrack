import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from '@/i18n';
import { isSupportedLanguage, resolveSupportedLanguage, type AppLanguage } from '@/i18n/resources';

type StoredPreferences = {
  language?: AppLanguage;
};

type PreferencesContextValue = {
  language: AppLanguage;
  isHydrated: boolean;
  setLanguage: (language: AppLanguage) => Promise<void>;
};

const PREFERENCES_STORAGE_KEY = 'lyfttrack:preferences:v1';

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function getInitialLanguage(): AppLanguage {
  const locale = getLocales()[0];
  return resolveSupportedLanguage(locale?.languageCode ?? null);
}

export function PreferencesProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<AppLanguage>(getInitialLanguage);
  const [isHydrated, setIsHydrated] = useState(false);

  const persistLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    const payload: StoredPreferences = {
      language: nextLanguage,
    };

    await AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(payload));
  }, []);

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);

    await Promise.all([
      i18n.changeLanguage(nextLanguage),
      persistLanguage(nextLanguage),
    ]);
  }, [persistLanguage]);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const rawStoredPreferences = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);

        if (!isMounted || !rawStoredPreferences) {
          return;
        }

        const parsed = JSON.parse(rawStoredPreferences) as StoredPreferences;
        const storedLanguage = parsed.language;

        if (!isSupportedLanguage(storedLanguage)) {
          return;
        }

        setLanguageState(storedLanguage);
        await i18n.changeLanguage(storedLanguage);
      } catch (error) {
        console.warn('Unable to load preferences:', error);
      } finally {
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  const contextValue = useMemo<PreferencesContextValue>(() => ({
    language,
    isHydrated,
    setLanguage,
  }), [isHydrated, language, setLanguage]);

  return <PreferencesContext.Provider value={contextValue}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error('usePreferences must be used inside a PreferencesProvider.');
  }

  return context;
}
