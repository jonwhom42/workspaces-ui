import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const cookieDefaults = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        res.cookies.set({
          name,
          value,
          ...cookieDefaults,
          ...options,
        });
      },
      remove(name: string, options: Record<string, unknown>) {
        res.cookies.set({
          name,
          value: '',
          expires: new Date(0),
          ...cookieDefaults,
          ...options,
        });
      },
    },
  });

  // Trigger a session check/refresh so protected routes keep a valid auth cookie.
  await supabase.auth.getSession();

  return res;
}

export const config = {
  matcher: ['/app/:path*', '/w/:path*'],
};
