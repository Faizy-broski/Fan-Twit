"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { formatRelative } from "@/lib/team-index";
import type { ExploreGame } from "@/lib/highlightly.functions";
import { Skeleton } from "@/components/ui/skeleton";

type ApiErrorResponse = {
  message?: string;
};

async function fetchLiveScores(): Promise<ExploreGame[]> {
  const response = await fetch("/api/games/explore", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const error = (await response
      .json()
      .catch(() => null)) as ApiErrorResponse | null;

    throw new Error(error?.message ?? "Failed to fetch live scores");
  }

  return response.json() as Promise<ExploreGame[]>;
}

export function LiveScores() {
  const {
    data: games = [],
    isLoading,
    isError,
  } = useQuery<ExploreGame[]>({
    queryKey: ["explore-live-games"],
    queryFn: fetchLiveScores,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchIntervalInBackground: false,
  });

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-bold">Live scores</h2>
        <Link
          href="/explore"
          className="text-xs font-semibold text-primary hover:underline"
        >
          See all
        </Link>
      </div>

      {isLoading && (
        <ul className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, index) => (
            <li key={index} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-10" />
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-5" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-5" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isError && (
        <p className="px-4 pb-4 text-sm text-muted-foreground">
          Live scores could not be loaded.
        </p>
      )}

      {!isLoading && !isError && games.length === 0 && (
        <p className="px-4 pb-4 text-sm text-muted-foreground">
          No games right now.
        </p>
      )}

      {!isLoading && !isError && games.length > 0 && (
        <ul className="divide-y divide-border">
          {games.slice(0, 8).map((game) => (
            <li key={game.id}>
              <Link
                href={`/game/${encodeURIComponent(game.id)}`}
                className="block px-4 py-2.5 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide">
                  <span className="max-w-[10rem] truncate text-muted-foreground">
                    {game.league || game.sport}
                  </span>
                  <GameStatus game={game} />
                </div>

                <div className="mt-1.5 space-y-1 text-sm">
                  <TeamRow name={game.home} score={game.homeScore} />
                  <TeamRow name={game.away} score={game.awayScore} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LiveScoresRail() {
  const {
    data: games = [],
    isLoading,
    isError,
  } = useQuery<ExploreGame[]>({
    queryKey: ["explore-live-games"],
    queryFn: fetchLiveScores,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchIntervalInBackground: false,
  });

  if (!isLoading && !isError && games.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border bg-muted/20 py-2.5">
      <div className="flex items-center justify-between px-4 pb-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Live scores
        </h2>
        <Link
          href="/explore"
          className="text-xs font-semibold text-primary hover:underline"
        >
          See all
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none [-webkit-overflow-scrolling:touch]">
        {isLoading &&
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="w-36 shrink-0 rounded-xl border border-border bg-card px-3 py-2"
            >
              <Skeleton className="h-2.5 w-14" />
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-4" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-4" />
                </div>
              </div>
            </div>
          ))}

        {isError && (
          <p className="px-1 text-xs text-muted-foreground">
            Live scores could not be loaded.
          </p>
        )}

        {!isLoading &&
          !isError &&
          games.slice(0, 10).map((game) => (
            <Link
              key={game.id}
              href={`/game/${encodeURIComponent(game.id)}`}
              className="w-36 shrink-0 rounded-xl border border-border bg-card px-3 py-2 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center justify-between gap-1 text-[9px] font-semibold uppercase tracking-wide">
                <span className="max-w-[5.5rem] truncate text-muted-foreground">
                  {game.league || game.sport}
                </span>
                <GameStatus game={game} />
              </div>

              <div className="mt-1.5 space-y-1 text-xs">
                <TeamRow name={game.home} score={game.homeScore} />
                <TeamRow name={game.away} score={game.awayScore} />
              </div>
            </Link>
          ))}
      </div>
    </div>
  );
}

function GameStatus({ game }: { game: ExploreGame }) {
  const className =
    game.status === "live"
      ? "rounded-full bg-destructive/10 px-1.5 py-0.5 text-destructive"
      : game.status === "finished"
        ? "text-muted-foreground"
        : "text-primary";

  let label: string;

  if (game.status === "live") {
    label = `● LIVE${game.progress ? ` ${game.progress}` : ""}`;
  } else if (game.status === "finished") {
    label = "FT";
  } else {
    label = formatRelative(game.kickoff);
  }

  return <span className={className}>{label}</span>;
}

function TeamRow({ name, score }: { name: string; score: number | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="truncate pr-2 font-semibold">{name}</span>
      <span className="tabular-nums text-muted-foreground">{score ?? "—"}</span>
    </div>
  );
}
