import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type AppToastTone = 'info' | 'error';

export type AppToastPayload = {
  message: string;
  tone?: AppToastTone;
};

type ToastContextValue = {
  toast: AppToastPayload | null;
  showToast: (payload: AppToastPayload) => void;
  dismissToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<AppToastPayload | null>(null);

  const showToast = useCallback((payload: AppToastPayload) => {
    setToast({ message: payload.message, tone: payload.tone ?? 'info' });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const value = useMemo(
    () => ({ toast, showToast, dismissToast }),
    [dismissToast, showToast, toast]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useAppToast(): ToastContextValue {
  const value = useContext(ToastContext);

  if (!value) {
    throw new Error('useAppToast must be used within ToastProvider');
  }

  return value;
}
