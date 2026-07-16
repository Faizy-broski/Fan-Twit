"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { TeamSearch, TeamSearchModal } from "./TeamSearch";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { LiveScores, LiveScoresRail } from "./LiveScores";
import { useRealtimePosts } from "@/hooks/useRealtimePosts";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";

export function AppShell({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);

  useRealtimePosts();
  const unreadNotifications = useUnreadNotifications();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile / tablet header (hidden at lg+, replaced by the left sidebar) */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur lg:hidden">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight">
            <span className="rounded-md bg-primary px-1.5 py-0.5 text-primary-foreground">Fan</span>
            <span>sport</span>
          </Link>
          <div className="flex items-center gap-1">
            <TeamSearch />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl lg:hidden">
        <LiveScoresRail />
      </div>

      <div className="mx-auto flex max-w-[1265px] justify-center">
        <aside className="sticky top-0 hidden h-screen w-[68px] shrink-0 lg:block xl:w-[275px]">
          <Sidebar onSearch={() => setSearchOpen(true)} unreadNotifications={unreadNotifications} />
        </aside>

        <main className="min-h-screen w-full max-w-2xl border-x border-border pb-28 lg:pb-0">
          {children}
        </main>

        <aside className="sticky top-0 hidden max-h-screen w-[320px] shrink-0 overflow-y-auto px-4 py-4 xl:block scrollbar-none">
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
            <Search className="size-4" />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex-1 text-left"
            >
              Search teams
            </button>
          </div>

          <div className="mt-4">
            <LiveScores />
          </div>
        </aside>
      </div>

      <TeamSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      <BottomNav unreadNotifications={unreadNotifications} />
    </div>
  );
}
