import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from '@/i18n';
import { isSupportedLanguage, resolveSupportedLanguage, type AppLanguage } from '@/i18n/resources';

type StoredPreferences = {
  language?: AppLanguage;
  countWorkingSetsOnly?: boolean;
};

type PreferencesContextValue = {
  language: AppLanguage;
  countWorkingSetsOnly: boolean;
  isHydrated: boolean;
  setLanguage: (language: AppLanguage) => Promise<void>;
  setCountWorkingSetsOnly: (countWorkingSetsOnly: boolean) => Promise<void>;
};

/**
 * Off by default: turning it on would silently redraw the set count on every
 * workout someone already logged. Opting in is a choice; being surprised is not.
 */
const DEFAULT_COUNT_WORKING_SETS_ONLY = false;

const PREFERENCES_STORAGE_KEY = 'lyfttrack:preferences:v1';

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function getInitialLanguage(): AppLanguage {
  const locale = getLocales()[0];
  return resolveSupportedLanguage(locale?.languageCode ?? null);
}

export function PreferencesProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<AppLanguage>(getInitialLanguage);
  const [countWorkingSetsOnly, setCountWorkingSetsOnlyState] = useState(DEFAULT_COUNT_WORKING_SETS_ONLY);
  const [isHydrated, setIsHydrated] = useState(false);

  // Writes the whole payload: persisting one key at a time would drop the other
  // preference every time either one changed.
  const persistPreferences = useCallback(async (payload: StoredPreferences) => {
    await AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(payload));
  }, []);

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);

    await Promise.all([
      i18n.changeLanguage(nextLanguage),
      persistPreferences({ language: nextLanguage, countWorkingSetsOnly }),
    ]);
  }, [countWorkingSetsOnly, persistPreferences]);

  const setCountWorkingSetsOnly = useCallback(async (nextValue: boolean) => {
    setCountWorkingSetsOnlyState(nextValue);

    await persistPreferences({ language, countWorkingSetsOnly: nextValue });
  }, [language, persistPreferences]);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const rawStoredPreferences = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);

        if (!isMounted || !rawStoredPreferences) {
          return;
        }

        const parsed = JSON.parse(rawStoredPreferences) as StoredPreferences;
        if (typeof parsed.countWorkingSetsOnly === 'boolean') {
          setCountWorkingSetsOnlyState(parsed.countWorkingSetsOnly);
        }

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
    countWorkingSetsOnly,
    isHydrated,
    setLanguage,
    setCountWorkingSetsOnly,
  }), [countWorkingSetsOnly, isHydrated, language, setCountWorkingSetsOnly, setLanguage]);

  return <PreferencesContext.Provider value={contextValue}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error('usePreferences must be used inside a PreferencesProvider.');
  }

  return context;
}
