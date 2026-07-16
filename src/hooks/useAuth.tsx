"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

// One shared subscription for the whole app (mounted once in
// src/app/providers.tsx), instead of every `useAuth()` call site running its
// own `getSession()`/`onAuthStateChange` independently — that's what caused
// different components to flip from "logged out" to "logged in" at visibly
// different times. `initialUser` is read server-side (see
// src/integrations/supabase/server.ts + src/app/layout.tsx) so the very
// first client render already reflects the real auth state instead of
// starting from `null` and flashing logged-out before the effect resolves.
export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: User | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [state, setState] = useState<AuthState>({
    session: null,
    user: initialUser,
    loading: false,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState({
        session: data.session,
        user: data.session?.user ?? null,
        loading: false,
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, user: session?.user ?? null, loading: false });

      const relevantEvents = ["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "TOKEN_REFRESHED"];

      if (!relevantEvents.includes(event)) {
        return;
      }

      // Refreshes Next.js Server Components and any auth-dependent
      // server-rendered content.
      router.refresh();

      if (event === "SIGNED_OUT") {
        queryClient.clear();
        return;
      }

      void queryClient.invalidateQueries();
    });

    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
