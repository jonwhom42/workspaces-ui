import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';
import type { IncomingMessage, ServerResponse } from 'http';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

type RequestLike = NextApiRequest | GetServerSidePropsContext['req'] | (IncomingMessage & { cookies?: Record<string, string> });
type ResponseLike = NextApiResponse | GetServerSidePropsContext['res'] | ServerResponse;

const getCookies = (req: RequestLike): Record<string, string> => {
  if ('cookies' in req && req.cookies) {
    return req.cookies as Record<string, string>;
  }
  const cookieHeader = req.headers?.cookie ?? '';
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf('=');
        if (index === -1) {
          return [cookie, ''];
        }
        return [cookie.substring(0, index), decodeURIComponent(cookie.substring(index + 1))];
      }),
  );
};

const appendSetCookie = (res: ResponseLike, cookie: string) => {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookie);
    return;
  }

  const value = Array.isArray(existing) ? existing : [String(existing)];
  res.setHeader('Set-Cookie', [...value, cookie]);
};

export const createSupabaseServerClient = (req: RequestLike, res: ResponseLike): SupabaseClient => {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const cookies = getCookies(req);
        return cookies[name];
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        const cookie = serialize(name, value, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          ...options,
        });
        appendSetCookie(res, cookie);
      },
      remove(name: string, options: Record<string, unknown>) {
        const cookie = serialize(name, '', {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 0,
          ...options,
        });
        appendSetCookie(res, cookie);
      },
    },
  });
};

let serviceRoleClient: SupabaseClient | null = null;

export const getSupabaseServiceRoleClient = (): SupabaseClient => {
  if (!serviceRoleClient) {
    serviceRoleClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return serviceRoleClient;
};

export default createSupabaseServerClient;
