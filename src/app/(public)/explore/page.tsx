"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelative } from "@/lib/team-index";
import type { ExploreGame } from "@/lib/highlightly.functions";

type ApiErrorResponse = {
  message?: string;
};

type HotTeam = {
  key: string;
  name: string;
  sport: string;
  league: string;
  logo: string | null;
  gameId: string;
  gameCount: number;
  live: boolean;
};

async function fetchExploreGames(): Promise<ExploreGame[]> {
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

    throw new Error(error?.message ?? "Failed to fetch explore games");
  }

  return response.json() as Promise<ExploreGame[]>;
}

async function fetchFifaGames(): Promise<ExploreGame[]> {
  const response = await fetch("/api/games/fifa", {
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

    throw new Error(error?.message ?? "Failed to fetch FIFA games");
  }

  return response.json() as Promise<ExploreGame[]>;
}

// Hot teams / featured matchups are both derived from the games list we
// already fetch for "Live & upcoming games" — no extra Highlightly requests.
function deriveHotTeams(games: ExploreGame[]): HotTeam[] {
  const byTeam = new Map<string, HotTeam>();

  for (const game of games) {
    const sides = [
      { name: game.home, logo: game.homeLogo },
      { name: game.away, logo: game.awayLogo },
    ];

    for (const side of sides) {
      if (!side.name || side.name === "TBD") {
        continue;
      }

      const key = `${game.sport}:${side.name}`;
      const existing = byTeam.get(key);

      if (existing) {
        existing.gameCount += 1;
        existing.live = existing.live || game.status === "live";
        existing.logo = existing.logo ?? side.logo;
      } else {
        byTeam.set(key, {
          key,
          name: side.name,
          sport: game.sport,
          league: game.league,
          logo: side.logo,
          gameId: game.id,
          gameCount: 1,
          live: game.status === "live",
        });
      }
    }
  }

  return Array.from(byTeam.values())
    .sort((a, b) => {
      if (a.live !== b.live) {
        return a.live ? -1 : 1;
      }

      return b.gameCount - a.gameCount;
    })
    .slice(0, 12);
}

function deriveFeaturedMatchups(games: ExploreGame[]): ExploreGame[] {
  // getExploreGames() already orders live-first, then by kickoff, so the
  // front of the list is naturally the most "featured" set of matchups.
  return games.slice(0, 6);
}

export default function ExplorePage() {
  const {
    data: games = [],
    isLoading: gamesLoading,
    isError: gamesFailed,
  } = useQuery<ExploreGame[]>({
    queryKey: ["explore-live-games"],
    queryFn: fetchExploreGames,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchIntervalInBackground: false,
  });

  const {
    data: fifaGames = [],
    isLoading: fifaLoading,
    isError: fifaFailed,
  } = useQuery<ExploreGame[]>({
    queryKey: ["explore-fifa-games"],
    queryFn: fetchFifaGames,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchIntervalInBackground: false,
  });

  const hotTeams = useMemo(() => deriveHotTeams(games), [games]);
  const featuredMatchups = useMemo(() => deriveFeaturedMatchups(games), [games]);

  return (
    <AppShell>
      <div className="px-4 pt-4">
        <h1 className="text-xl font-black tracking-tight">
          Explore
        </h1>
      </div>

      <Section title="Live & upcoming games">
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          {gamesLoading &&
            Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="w-60 shrink-0 rounded-xl border border-border bg-card p-3"
              >
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
              </div>
            ))}

          {gamesFailed && (
            <StatusMessage>
              Live scores could not be loaded.
            </StatusMessage>
          )}

          {!gamesLoading &&
            !gamesFailed &&
            games.map((game) => (
              <Link
                key={game.id}
                href={`/game/${encodeURIComponent(game.id)}`}
                className="w-60 shrink-0 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide">
                  <span className="max-w-[10rem] truncate text-muted-foreground">
                    {game.league || game.sport}
                  </span>

                  <GameStatus game={game} />
                </div>

                <div className="mt-2 space-y-1 text-sm">
                  <TeamRow
                    name={game.home}
                    score={game.homeScore}
                  />

                  <TeamRow
                    name={game.away}
                    score={game.awayScore}
                  />
                </div>

                {game.venue && (
                  <div className="mt-2 truncate text-[10px] text-muted-foreground">
                    {game.venue}
                  </div>
                )}
              </Link>
            ))}

          {!gamesLoading &&
            !gamesFailed &&
            games.length === 0 && (
              <StatusMessage>
                No games right now.
              </StatusMessage>
            )}
        </div>
      </Section>

      <Section title="FIFA & internationals">
        {fifaLoading && <RowListSkeleton />}

        {fifaFailed && (
          <StatusMessage className="px-4">
            FIFA matches could not be loaded.
          </StatusMessage>
        )}

        {!fifaLoading && !fifaFailed && fifaGames.length === 0 && (
          <StatusMessage className="px-4">
            No FIFA matches right now.
          </StatusMessage>
        )}

        {!fifaLoading && !fifaFailed && fifaGames.length > 0 && (
          <ul className="divide-y divide-border">
            {fifaGames.map((game) => (
              <li key={game.id}>
                <Link
                  href={`/game/${encodeURIComponent(game.id)}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {game.league || game.sport}
                    </p>

                    <p className="mt-0.5 truncate text-sm font-semibold">
                      {game.home} <span className="text-muted-foreground">vs</span> {game.away}
                    </p>
                  </div>

                  <GameStatus game={game} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Hot teams">
        {gamesLoading && <RowListSkeleton />}

        {gamesFailed && (
          <StatusMessage className="px-4">
            Teams could not be loaded.
          </StatusMessage>
        )}

        {!gamesLoading && !gamesFailed && hotTeams.length === 0 && (
          <StatusMessage className="px-4">
            No teams playing right now.
          </StatusMessage>
        )}

        {!gamesLoading && !gamesFailed && hotTeams.length > 0 && (
          <ul className="divide-y divide-border">
            {hotTeams.map((team) => (
              <li key={team.key}>
                <Link
                  href={`/game/${encodeURIComponent(team.gameId)}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  {team.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={team.logo}
                      alt=""
                      className="size-9 shrink-0 rounded-full bg-muted object-contain"
                    />
                  ) : (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                      {team.name.slice(0, 3).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {team.name}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {team.league || team.sport}
                    </p>
                  </div>

                  {team.live ? (
                    <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">
                      ● LIVE
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      {team.gameCount} {team.gameCount === 1 ? "game" : "games"}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Featured matchups">
        {gamesLoading && <RowListSkeleton />}

        {gamesFailed && (
          <StatusMessage className="px-4">
            Matchups could not be loaded.
          </StatusMessage>
        )}

        {!gamesLoading && !gamesFailed && featuredMatchups.length === 0 && (
          <StatusMessage className="px-4">
            No matchups right now.
          </StatusMessage>
        )}

        {!gamesLoading && !gamesFailed && featuredMatchups.length > 0 && (
          <ul className="divide-y divide-border">
            {featuredMatchups.map((game) => (
              <li key={game.id}>
                <Link
                  href={`/game/${encodeURIComponent(game.id)}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {game.league || game.sport}
                    </p>

                    <p className="mt-0.5 truncate text-sm font-semibold">
                      {game.home} <span className="text-muted-foreground">vs</span> {game.away}
                    </p>
                  </div>

                  <GameStatus game={game} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}

function GameStatus({
  game,
}: {
  game: ExploreGame;
}) {
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

  return (
    <span className={className}>
      {label}
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-2">
      <h2 className="px-4 pb-2 pt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>

      {children}
    </section>
  );
}

function TeamRow({
  name,
  score,
}: {
  name: string;
  score: number | null;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="truncate pr-2 font-semibold">
        {name}
      </span>

      <span className="tabular-nums text-muted-foreground">
        {score ?? "—"}
      </span>
    </div>
  );
}

function StatusMessage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`py-4 text-sm text-muted-foreground ${className}`}
    >
      {children}
    </div>
  );
}

function RowListSkeleton() {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, index) => (
        <li key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-10 rounded-md" />
        </li>
      ))}
    </ul>
  );
}