import * as React from 'react';
import type { Session, User } from '@supabase/supabase-js';
import supabase from '../../lib/supabaseClient';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

const AuthContext = React.createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
});

type AuthProviderProps = {
  initialSession?: Session | null;
  initialUser?: User | null;
  children: React.ReactNode;
};

export function AuthProvider({ initialSession = null, initialUser = null, children }: AuthProviderProps) {
  const [session, setSession] = React.useState<Session | null>(initialSession);
  const [user, setUser] = React.useState<User | null>(initialUser ?? initialSession?.user ?? null);
  const [loading, setLoading] = React.useState<boolean>(!initialUser && !initialSession);

  React.useEffect(() => {
    let isMounted = true;
    const syncSession = async () => {
      const [
        {
          data: { session: currentSession },
        },
        {
          data: { user: freshUser },
        },
      ] = await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);

      if (!isMounted) return;

      if (process.env.NODE_ENV !== 'production') {
        console.log('[AuthContext] Synced session', {
          hasSession: Boolean(currentSession),
          userId: freshUser?.id,
        });
      }

      setSession(currentSession);
      setUser(freshUser ?? null);
      setLoading(false);
    };
    syncSession();
    const { data } = supabase.auth.onAuthStateChange(async () => {
      if (!isMounted) return;
      const [
        {
          data: { session: nextSession },
        },
        {
          data: { user: nextUser },
        },
      ] = await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);
      if (!isMounted) return;

      if (process.env.NODE_ENV !== 'production') {
        console.log('[AuthContext] Auth state change', {
          hasSession: Boolean(nextSession),
          userId: nextUser?.id,
        });
      }

      setSession(nextSession);
      setUser(nextUser ?? null);
      setLoading(false);
    });
    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = React.useMemo(
    () => ({
      user,
      session,
      loading,
    }),
    [user, session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => React.useContext(AuthContext);
