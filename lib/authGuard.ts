/**
 * Pages Router guard that enforces SSR authentication before rendering protected routes.
 * Always prefer wrapping GSSP with withAuth instead of performing client-side checks.
 */
import type {
  GetServerSideProps,
  GetServerSidePropsContext,
  GetServerSidePropsResult,
  PreviewData,
} from 'next';
import type { ParsedUrlQuery } from 'querystring';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { createServerSupabase, type WithServerAuthContext } from './supabaseServer';

export type AuthenticatedGSSPContext<
  Q extends ParsedUrlQuery = ParsedUrlQuery,
  D extends PreviewData = PreviewData,
> = GetServerSidePropsContext<Q, D> &
  WithServerAuthContext & {
    supabase: SupabaseClient;
    user: User;
    session: Session | null;
  };

export type WithAuthInjectedProps = {
  initialSession: Session | null;
  initialUser: User;
  user: User;
};

export function withAuth<P extends Record<string, unknown> = Record<string, unknown>, Q extends ParsedUrlQuery = ParsedUrlQuery, D extends PreviewData = PreviewData>(
  handler?: (
    context: AuthenticatedGSSPContext<Q, D>,
  ) => Promise<GetServerSidePropsResult<P>> | GetServerSidePropsResult<P>,
): GetServerSideProps<P & WithAuthInjectedProps, Q, D> {
  return async (ctx) => {
    const supabase = createServerSupabase(ctx);
    const [
      {
        data: { user },
      },
      {
        data: { session },
      },
    ] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);

    if (!user) {
      const redirectTo = encodeURIComponent(ctx.resolvedUrl ?? '/app');
      return {
        redirect: {
          destination: `/auth/sign-in?redirectTo=${redirectTo}`,
          permanent: false,
        },
      };
    }

    const authContext: AuthenticatedGSSPContext<Q, D> = {
      ...ctx,
      req: ctx.req,
      res: ctx.res,
      supabase,
      user,
      session: session ?? null,
    };

    if (!handler) {
      return {
        props: {
          initialSession: session ?? null,
          initialUser: user,
          user,
        } as WithAuthInjectedProps & P,
      };
    }

    const result = await handler(authContext);

    if ('props' in result) {
      return {
        props: {
          ...result.props,
          initialSession: session ?? null,
          initialUser: user,
          user,
        },
      } as GetServerSidePropsResult<P & WithAuthInjectedProps>;
    }

    return result as GetServerSidePropsResult<P & WithAuthInjectedProps>;
  };
}
