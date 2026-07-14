"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelative } from "@/lib/team-index";
import type { ExploreGame } from "@/lib/sportsdb.functions";

type Team = {
  symbol: string;
  name: string;
  league: string;
  sport: string;
  tag_count: number;
};

type Player = {
  symbol: string;
  name: string;
  team_symbol: string | null;
  sport: string;
};

type ApiErrorResponse = {
  message?: string;
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

async function fetchExploreTeams(): Promise<Team[]> {
  const { data: tags, error: tagsError } = await supabase
    .from("post_teams")
    .select("team_symbol");

  if (tagsError) {
    throw new Error(tagsError.message);
  }

  const counts = new Map<string, number>();

  for (const tag of tags ?? []) {
    counts.set(
      tag.team_symbol,
      (counts.get(tag.team_symbol) ?? 0) + 1,
    );
  }

  const symbols = Array.from(counts.keys());

  if (symbols.length === 0) {
    const { data, error } = await supabase
      .from("teams")
      .select("symbol, name, league, sport")
      .limit(12);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((team) => ({
      ...team,
      tag_count: 0,
    }));
  }

  const { data, error } = await supabase
    .from("teams")
    .select("symbol, name, league, sport")
    .in("symbol", symbols);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((team) => ({
      ...team,
      tag_count: counts.get(team.symbol) ?? 0,
    }))
    .sort((a, b) => b.tag_count - a.tag_count)
    .slice(0, 12);
}

async function fetchExplorePlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from("players")
    .select("symbol, name, team_symbol, sport")
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export default function ExplorePage() {
  const {
    data: games = [],
    isLoading: gamesLoading,
    isError: gamesFailed,
  } = useQuery<ExploreGame[]>({
    queryKey: ["explore-live-games"],
    queryFn: fetchExploreGames,
    refetchInterval: 45_000,
    staleTime: 30_000,
    refetchIntervalInBackground: false,
  });

  const {
    data: teams = [],
    isLoading: teamsLoading,
    isError: teamsFailed,
  } = useQuery<Team[]>({
    queryKey: ["explore-teams"],
    queryFn: fetchExploreTeams,
    staleTime: 60_000,
  });

  const {
    data: players = [],
    isLoading: playersLoading,
    isError: playersFailed,
  } = useQuery<Player[]>({
    queryKey: ["explore-players"],
    queryFn: fetchExplorePlayers,
    staleTime: 60_000,
  });

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

      <Section title="Hot teams">
        {teamsLoading && <RowListSkeleton />}

        {teamsFailed && (
          <StatusMessage className="px-4">
            Teams could not be loaded.
          </StatusMessage>
        )}

        {!teamsLoading && !teamsFailed && (
          <ul className="divide-y divide-border">
            {teams.map((team) => (
              <li key={team.symbol}>
                <Link
                  href={`/team/${encodeURIComponent(team.symbol)}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                    {team.symbol.slice(0, 3)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {team.name}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {team.league} · {team.sport}
                    </p>
                  </div>

                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    ${team.symbol}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Top players">
        {playersLoading && <RowListSkeleton />}

        {playersFailed && (
          <StatusMessage className="px-4">
            Players could not be loaded.
          </StatusMessage>
        )}

        {!playersLoading && !playersFailed && (
          <ul className="divide-y divide-border">
            {players.map((player) => (
              <li
                key={player.symbol}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent-foreground text-sm font-bold text-primary-foreground">
                  {player.name.slice(0, 1).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {player.name}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {player.sport}
                    {player.team_symbol
                      ? ` · $${player.team_symbol}`
                      : ""}
                  </p>
                </div>

                <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                  @{player.symbol}
                </span>
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