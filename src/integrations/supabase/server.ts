import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "./types";
import { createSupabaseFetch } from "./client";

// Request-scoped Supabase client for Server Components, built from the
// incoming request's cookies. Used to read the session synchronously on the
// server so the client can hydrate already knowing whether a user is signed
// in, instead of starting from "logged out" and flipping after the browser
// resolves its own session lookup (see src/hooks/useAuth.tsx).
export async function createSupabaseServerComponentClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    global: {
      fetch: createSupabaseFetch(supabaseKey),
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component render, where cookies are
          // read-only — session refresh already happens in src/proxy.ts on
          // every request, so there's nothing to persist here.
        }
      },
    },
  });
}
