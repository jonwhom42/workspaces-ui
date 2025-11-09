import type { Session, User } from '@supabase/supabase-js';
import { createServerSupabase, type WithServerAuthContext } from './supabaseServer';

/**
 * Server-only helper that keeps all authentication checks consistent with Supabase SSR cookies.
 */
export type AuthenticatedUser = {
  user: User;
  session: Session | null;
};

export const getAuthenticatedUser = async (
  context: WithServerAuthContext,
): Promise<AuthenticatedUser | null> => {
  const supabase = createServerSupabase(context);
  const [
    {
      data: { user },
    },
    {
      data: { session },
    },
  ] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);

  if (!user) {
    return null;
  }

  return {
    user,
    session: session ?? null,
  };
};
