"use client";

import { useEffect, useState } from "react";
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
  User as UserIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function Sidebar({ onSearch }: { onSearch: () => void }) {
  const path = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const [fetchedUsername, setFetchedUsername] = useState<string | null>(null);
  const username = user ? fetchedUsername : null;

  useEffect(() => {
    if (!user) return;
    let ignore = false;
    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!ignore) setFetchedUsername(data?.username ?? null);
      });
    return () => {
      ignore = true;
    };
  }, [user]);

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
          className="mb-2 flex items-center justify-center gap-2 px-3 py-2 text-lg font-black tracking-tight xl:justify-start"
        >
          <span className="rounded-md bg-primary px-1.5 py-0.5 text-primary-foreground">
            Fan
          </span>
          <span className="hidden xl:inline">twit</span>
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
            <Bell className="size-6 shrink-0" />
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

      {!loading && (
        <div className="px-1">
          {user ? (
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
          )}
        </div>
      )}
    </div>
  );
}
