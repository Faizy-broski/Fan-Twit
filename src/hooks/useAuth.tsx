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

export type Profile = {
  username: string | null;
  role: string | null;
};

export type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: Profile | null;
  profileLoading: boolean;
};

type InternalState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: Profile | null;
  // Which user id `profile` was fetched for, so profileLoading can be
  // derived (profile fetch in progress for the current user) instead of
  // toggled with a direct setState call at the top of the fetch effect.
  profileUserId: string | null;
};

const AuthContext = createContext<AuthState | null>(null);

// One shared subscription for the whole app (mounted once in
// src/app/providers.tsx, which lives in the root layout and therefore never
// remounts on client-side navigation), instead of every `useAuth()` call
// site — and every Sidebar/BottomNav mount, since AppShell is re-created on
// every page — running its own `getSession()`/profile fetch independently.
// That's what caused nav links (including the admin link, which depends on
// `profile.role`) to flip between "logged out"/"no admin link" and the
// correct state on every navigation: each page's fresh Sidebar/BottomNav used
// to start from scratch and refetch. Centralizing here means the data
// already exists in context by the time a new page's Sidebar mounts.
// `initialUser`/`initialProfile` are read server-side (see
// src/integrations/supabase/server.ts + src/app/layout.tsx) so the very
// first client render already reflects the real state instead of starting
// from `null` and flashing before the effect resolves.
export function AuthProvider({
  initialUser,
  initialProfile,
  children,
}: {
  initialUser: User | null;
  initialProfile: Profile | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [state, setState] = useState<InternalState>({
    session: null,
    user: initialUser,
    loading: false,
    profile: initialProfile,
    profileUserId: initialUser ? initialUser.id : null,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState((prev) => ({
        ...prev,
        session: data.session,
        user: data.session?.user ?? null,
        loading: false,
      }));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
        loading: false,
      }));

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

  useEffect(() => {
    const userId = state.user?.id;

    if (!userId || userId === state.profileUserId) {
      return;
    }

    let ignore = false;

    supabase
      .from("profiles")
      .select("username, role")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (ignore) {
          return;
        }

        setState((prev) => ({
          ...prev,
          profile: data ? { username: data.username, role: data.role } : null,
          profileUserId: userId,
        }));
      });

    return () => {
      ignore = true;
    };
  }, [state.user?.id, state.profileUserId]);

  const profileMatchesUser = Boolean(state.user) && state.user?.id === state.profileUserId;

  const exposedState: AuthState = {
    session: state.session,
    user: state.user,
    loading: state.loading,
    profile: profileMatchesUser ? state.profile : null,
    profileLoading: Boolean(state.user) && !profileMatchesUser,
  };

  return <AuthContext.Provider value={exposedState}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
