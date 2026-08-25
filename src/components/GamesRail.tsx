"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { fetchLiveScores } from "@/components/LiveScores";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { ExploreGame } from "@/lib/highlightly.functions";
import { Skeleton } from "@/components/ui/skeleton";

type StatusFilter = "all" | "live" | "upcoming" | "final" | "following";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "upcoming", label: "Upcoming" },
  { value: "final", label: "Final" },
  { value: "following", label: "Following" },
];

export function GamesRail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedGameId = searchParams.get("game");
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const {
    data: games = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<ExploreGame[]>({
    queryKey: ["explore-live-games"],
    queryFn: fetchLiveScores,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchIntervalInBackground: false,
  });

  const { data: favoriteTeamName } = useQuery({
    queryKey: ["favorite-team-name", user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("favorite_team")
        .eq("id", user!.id)
        .maybeSingle();

      if (!profile?.favorite_team) {
        return null;
      }

      const { data: team } = await supabase
        .from("teams")
        .select("name")
        .eq("symbol", profile.favorite_team)
        .maybeSingle();

      return team?.name ?? null;
    },
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
  });

  const filteredGames = useMemo(() => {
    switch (statusFilter) {
      case "live":
        return games.filter((game) => game.status === "live");
      case "upcoming":
        return games.filter((game) => game.status === "upcoming");
      case "final":
        return games.filter((game) => game.status === "finished");
      case "following": {
        if (!favoriteTeamName) {
          return [];
        }

        const needle = favoriteTeamName.toLowerCase();

        return games.filter(
          (game) =>
            game.home.toLowerCase().includes(needle) ||
            game.away.toLowerCase().includes(needle),
        );
      }
      default:
        return games;
    }
  }, [games, statusFilter, favoriteTeamName]);

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

  if (!isLoading && !isError && games.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border bg-linear-to-r from-primary/5 via-background to-accent/40 py-2.5">
      <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-primary">
        Games
      </div>

      {isError && (
        <div className="flex items-center justify-between gap-3 px-4 pb-2 text-xs text-muted-foreground">
          <span>Games could not be loaded.</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="shrink-0 font-semibold text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto px-3 pb-2 scrollbar-none [-webkit-overflow-scrolling:touch]">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatusFilter(filter.value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === filter.value
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {filter.label}
          </button>
        ))}

        {selectedGameId && (
          <button
            type="button"
            onClick={() => select(null)}
            className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto px-3 pb-1 scrollbar-none [-webkit-overflow-scrolling:touch]">
        {isLoading &&
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[42px] w-32 shrink-0 rounded-xl" />
          ))}

        {!isLoading && !isError && statusFilter === "following" && !favoriteTeamName && (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            Set a favorite team in your profile to follow their games.
          </p>
        )}

        {!isLoading &&
          !isError &&
          filteredGames.length === 0 &&
          (statusFilter !== "following" || favoriteTeamName) && (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              No {statusFilter === "all" ? "" : `${statusFilter} `}games right now.
            </p>
          )}

        {!isLoading &&
          !isError &&
          filteredGames.map((game) => (
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
