'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as api from './api';
import type { Role } from './types';
import type { Session } from './views';

interface SessionContextValue {
  session: Session | null;
  ready: boolean;
  refresh: () => Promise<Session | null>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export const HOME_BY_ROLE: Record<Role, string> = { farmer: '/farmer', company: '/company', admin: '/admin' };

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const s = await api.getSession();
    setSession(s);
    setReady(true);
    return s;
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    setSession(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ session, ready, refresh, signOut }), [session, ready, refresh, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
