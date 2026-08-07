import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { ConfirmModalTone } from '@/components/common/ConfirmModal';

export type ConfirmRequest = {
  title: string;
  description?: string | null;
  confirmLabel: string;
  cancelLabel: string;
  tone?: ConfirmModalTone;
  icon?: keyof typeof Ionicons.glyphMap;
};

type PendingConfirm = ConfirmRequest & { resolve: (value: boolean) => void };

type ConfirmContextValue = {
  pending: PendingConfirm | null;
  requestConfirm: (request: ConfirmRequest) => Promise<boolean>;
  settlePending: (value: boolean) => void;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

// Lets confirmAction() stay a plain importable function (used outside
// components, same as window.confirm/Alert.alert were) while still rendering
// through the provider's modal state.
let showConfirmDialog: ((request: ConfirmRequest) => Promise<boolean>) | null = null;

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const requestConfirm = useCallback((request: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...request, resolve });
    });
  }, []);

  const settlePending = useCallback((value: boolean) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  useEffect(() => {
    showConfirmDialog = requestConfirm;
    return () => {
      showConfirmDialog = null;
    };
  }, [requestConfirm]);

  const value = useMemo(
    () => ({ pending, requestConfirm, settlePending }),
    [pending, requestConfirm, settlePending]
  );

  return <ConfirmContext.Provider value={value}>{children}</ConfirmContext.Provider>;
}

export function useConfirmDialog(): ConfirmContextValue {
  const value = useContext(ConfirmContext);

  if (!value) {
    throw new Error('useConfirmDialog must be used within ConfirmProvider');
  }

  return value;
}

export async function requestConfirmation(request: ConfirmRequest): Promise<boolean> {
  if (!showConfirmDialog) {
    return true;
  }

  return showConfirmDialog(request);
}
