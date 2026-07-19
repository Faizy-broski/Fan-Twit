"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { fetchLiveScores } from "@/components/LiveScores";
import type { ExploreGame } from "@/lib/highlightly.functions";
import { Skeleton } from "@/components/ui/skeleton";

export function GamesRail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedGameId = searchParams.get("game");

  const {
    data: games = [],
    isLoading,
  } = useQuery<ExploreGame[]>({
    queryKey: ["explore-live-games"],
    queryFn: fetchLiveScores,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchIntervalInBackground: false,
  });

  function select(gameId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (gameId) {
      params.set("game", gameId);
    } else {
      params.delete("game");
    }
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }

  if (!isLoading && games.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border bg-gradient-to-r from-primary/5 via-background to-accent/40 py-2.5">
      <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-primary">
        Games
      </div>

      <div className="flex gap-2 overflow-x-auto px-3 pb-1 scrollbar-none [-webkit-overflow-scrolling:touch]">
        <button
          type="button"
          onClick={() => select(null)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            !selectedGameId
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          All
        </button>

        {isLoading &&
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[42px] w-32 shrink-0 rounded-xl" />
          ))}

        {!isLoading &&
          games.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => select(game.id)}
              className={`shrink-0 rounded-xl border px-3 py-1.5 text-left transition-colors ${
                selectedGameId === game.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-muted/40"
              }`}
            >
              <span
                className={`block max-w-[9rem] truncate text-xs font-semibold ${
                  selectedGameId === game.id ? "text-primary" : "text-foreground"
                }`}
              >
                {game.home} v {game.away}
              </span>
              <span className="block text-[10px] text-muted-foreground">
                {game.status === "live"
                  ? `${game.homeScore ?? 0}-${game.awayScore ?? 0} · LIVE`
                  : game.league || game.sport}
              </span>
            </button>
          ))}
      </div>
    </div>
  );
}
