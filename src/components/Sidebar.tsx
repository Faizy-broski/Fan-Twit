"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Compass,
  Home,
  LogOut,
  PlusSquare,
  Search,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Sidebar({
  onSearch,
  unreadNotifications = 0,
}: {
  onSearch: () => void;
  unreadNotifications?: number;
}) {
  const path = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, loading, profile } = useAuth();
  // profile comes from the shared AuthProvider (fetched once, seeded from
  // the server on first load) instead of a per-mount fetch here — Sidebar
  // used to remount fresh on every page navigation (it's rendered inside
  // AppShell, which each page constructs itself) and refetch from scratch,
  // which is why the admin link would disappear and reappear on every
  // navigation.
  // The DB profile is the source of truth, but while it's still in flight
  // (or fails) fall back to the username set at signup so the Profile link
  // never mistakenly points at /auth while signed in.
  const metadataUsername = (user?.user_metadata as { username?: string } | undefined)?.username;
  const username = user ? (profile?.username ?? metadataUsername ?? null) : null;
  const effectiveRole = user ? profile?.role : null;

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.push("/");
  };

  const isMe = path.startsWith("/user/") || path === "/me";

  const navItem = (active: boolean) =>
    `flex items-center justify-center gap-4 rounded-full px-3 py-2.5 text-base font-medium transition-colors xl:justify-start ${
      active
        ? "text-foreground font-bold"
        : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
    }`;

  return (
    <div className="flex h-screen flex-col justify-between py-4 pl-2 pr-2 xl:pr-4">
      <div>
        <Link
          href="/"
          className="mb-2 flex items-center justify-center gap-0 px-3 py-2 text-lg font-black tracking-tight xl:justify-start"
        >
          <span className="rounded-md bg-primary px-1.5 py-0.5 text-primary-foreground">
            Fan
            </span>
            <span className="hidden xl:inline">sport</span> 
        </Link>

        <nav className="flex flex-col gap-1">
          <Link href="/" className={navItem(path === "/")} aria-label="Home">
            <Home className="size-6 shrink-0" />
            <span className="hidden xl:inline">Home</span>
          </Link>

          <Link
            href="/explore"
            className={navItem(path.startsWith("/explore"))}
            aria-label="Explore"
          >
            <Compass className="size-6 shrink-0" />
            <span className="hidden xl:inline">Explore</span>
          </Link>

          <button
            type="button"
            onClick={onSearch}
            className={navItem(false)}
            aria-label="Search"
          >
            <Search className="size-6 shrink-0" />
            <span className="hidden xl:inline">Search</span>
          </button>

          <Link
            href="/alerts"
            className={navItem(path.startsWith("/alerts"))}
            aria-label="Alerts"
          >
            <span className="relative shrink-0">
              <Bell className="size-6" />
              {unreadNotifications > 0 && (
                <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-background" />
              )}
            </span>
            <span className="hidden xl:inline">Alerts</span>
          </Link>

          <Link
            href={username ? `/user/${encodeURIComponent(username)}` : "/auth"}
            className={navItem(isMe)}
            aria-label="Profile"
          >
            <UserIcon className="size-6 shrink-0" />
            <span className="hidden xl:inline">Profile</span>
          </Link>

          {effectiveRole === "admin" && (
            <Link
              href="/admin"
              className={navItem(path.startsWith("/admin"))}
              aria-label="Admin"
            >
              <ShieldCheck className="size-6 shrink-0" />
              <span className="hidden xl:inline">Admin</span>
            </Link>
          )}
        </nav>

        <Link
          href={user ? "/compose" : "/auth"}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90"
          aria-label="Post"
        >
          <PlusSquare className="size-5 shrink-0" />
          <span className="hidden xl:inline">Post</span>
        </Link>
      </div>

      <div className="px-1">
        <div className="mb-1 flex items-center justify-center xl:justify-start xl:px-2">
          <ThemeToggle />
        </div>

        {!loading && (
          user ? (
            <button
              onClick={signOut}
              className="flex w-full items-center justify-center gap-3 rounded-full px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground xl:justify-start"
              aria-label="Sign out"
            >
              <LogOut className="size-5 shrink-0" />
              <span className="hidden xl:inline">Sign out</span>
            </button>
          ) : (
            <Link
              href="/auth"
              className="flex w-full items-center justify-center rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Sign in
            </Link>
          )
        )}
      </div>
    </div>
  );
}
