"use client";

import { Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { TeamSearch, TeamSearchModal, TeamSearchInline } from "./TeamSearch";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { LiveScores, LiveScoresRail } from "./LiveScores";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimePosts } from "@/hooks/useRealtimePosts";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";

export function AppShell({
  children,
  hideLiveScoresSidebar = false,
}: {
  children: ReactNode;
  /** Skip the "Live scores" rail/sidebar — used on pages (like Explore) that
   * already show live/upcoming games in their own, more detailed sections,
   * so the same data isn't duplicated under two differently-named headings.
   * The desktop sidebar column stays, filled with team search instead, so
   * it doesn't collapse into empty space. */
  hideLiveScoresSidebar?: boolean;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  // Mobile only: whether the header has expanded into the search bar. Until the
  // user taps the search icon the header keeps its previous branded layout.
  const [mobileSearchExpanded, setMobileSearchExpanded] = useState(false);

  useRealtimePosts();
  const unreadNotifications = useUnreadNotifications();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile / tablet header (hidden at lg+, replaced by the left sidebar).
       * Default: branded layout. Tapping the search icon expands the header so
       * the full-width grayish search bar takes the place of the branding. */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur lg:hidden">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
          {mobileSearchExpanded ? (
            <TeamSearchInline onClose={() => setMobileSearchExpanded(false)} />
          ) : (
            <>
              <Link href="/" className="flex items-center gap-0 text-lg font-black tracking-tight">
                <span className="rounded-md bg-primary px-1.5 py-0.5 text-primary-foreground">Fan</span>
                <span>Sport</span>
              </Link>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMobileSearchExpanded(true)}
                  className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  aria-label="Search teams"
                >
                  <Search className="size-5" />
                </button>
                <ThemeToggle />
              </div>
            </>
          )}
        </div>
      </header>

      {!hideLiveScoresSidebar && (
        <div className="mx-auto max-w-2xl lg:hidden">
          <LiveScoresRail />
        </div>
      )}

      <div className="mx-auto flex max-w-[1265px] justify-center">
        <aside className="sticky top-0 hidden h-screen w-[68px] shrink-0 lg:block xl:w-[275px]">
          <Sidebar onSearch={() => setSearchOpen(true)} unreadNotifications={unreadNotifications} />
        </aside>

        <main className="min-h-screen w-full max-w-2xl border-x border-border pb-28 lg:pb-0">
          {children}
        </main>

        <aside className="sticky top-0 hidden max-h-screen w-[320px] shrink-0 overflow-y-auto px-4 py-4 xl:block scrollbar-none">
          <TeamSearch variant="bar" />

          {!hideLiveScoresSidebar && (
            <div className="mt-4">
              <Suspense fallback={<Skeleton className="h-40 rounded-2xl" />}>
                <LiveScores />
              </Suspense>
            </div>
          )}
        </aside>
      </div>

      <TeamSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      <BottomNav unreadNotifications={unreadNotifications} />
    </div>
  );
}
