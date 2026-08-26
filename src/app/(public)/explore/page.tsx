"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatCountdown, formatRelative } from "@/lib/team-index";
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
  teamId: string | null;
  gameId: string;
  gameCount: number;
  live: boolean;
};

type TrendingPlayer = {
  key: string;
  name: string;
  sport: string;
  team: string;
  teamLogo: string | null;
  gameId: string;
  goals: number;
  playerId: string | null;
};

type TrendingPost = {
  id: string;
  body: string;
  like_count: number;
  reply_count: number;
  created_at: string;
  profiles: { username: string; display_name: string | null } | null;
};

const TRENDING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

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

async function fetchCompetitionGames(): Promise<ExploreGame[]> {
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

    throw new Error(error?.message ?? "Failed to fetch competition games");
  }

  return response.json() as Promise<ExploreGame[]>;
}

async function fetchTrendingPlayers(): Promise<TrendingPlayer[]> {
  const response = await fetch("/api/players/trending", {
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

    throw new Error(error?.message ?? "Failed to fetch trending players");
  }

  return response.json() as Promise<TrendingPlayer[]>;
}

async function fetchTrendingDiscussions(): Promise<TrendingPost[]> {
  const since = new Date(Date.now() - TRENDING_WINDOW_MS).toISOString();

  const { data, error } = await supabase
    .from("posts")
    .select(
      `
        id,
        body,
        like_count,
        reply_count,
        created_at,
        profiles!posts_user_id_profiles_fkey ( username, display_name )
      `,
    )
    .is("parent_post_id", null)
    .gte("created_at", since)
    .order("like_count", { ascending: false })
    .limit(6);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as TrendingPost[];
}

// Trending teams are derived from the same games list "Live Now"/"Upcoming"
// already fetch — no extra Highlightly requests.
function deriveTrendingTeams(games: ExploreGame[]): HotTeam[] {
  const byTeam = new Map<string, HotTeam>();

  for (const game of games) {
    const sides = [
      { name: game.home, logo: game.homeLogo, teamId: game.homeTeamId },
      { name: game.away, logo: game.awayLogo, teamId: game.awayTeamId },
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
        existing.teamId = existing.teamId ?? side.teamId;
      } else {
        byTeam.set(key, {
          key,
          name: side.name,
          sport: game.sport,
          league: game.league,
          teamId: side.teamId,
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

export default function ExplorePage() {
  const {
    data: games = [],
    isLoading: gamesLoading,
    isError: gamesFailed,
    refetch: refetchGames,
  } = useQuery<ExploreGame[]>({
    queryKey: ["explore-live-games"],
    queryFn: fetchExploreGames,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchIntervalInBackground: false,
  });

  const {
    data: competitionGames = [],
    isLoading: competitionsLoading,
    isError: competitionsFailed,
    refetch: refetchCompetitions,
  } = useQuery<ExploreGame[]>({
    queryKey: ["explore-fifa-games"],
    queryFn: fetchCompetitionGames,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchIntervalInBackground: false,
  });

  const {
    data: trendingPlayers = [],
    isLoading: playersLoading,
    isError: playersFailed,
    refetch: refetchPlayers,
  } = useQuery<TrendingPlayer[]>({
    queryKey: ["trending-players"],
    queryFn: fetchTrendingPlayers,
    staleTime: 60_000,
  });

  const {
    data: trendingPosts = [],
    isLoading: discussionsLoading,
    isError: discussionsFailed,
    refetch: refetchDiscussions,
  } = useQuery<TrendingPost[]>({
    queryKey: ["trending-discussions"],
    queryFn: fetchTrendingDiscussions,
    staleTime: 60_000,
  });

  const liveGames = useMemo(
    () => games.filter((game) => game.status === "live"),
    [games],
  );

  const upcomingGames = useMemo(
    () => games.filter((game) => game.status === "upcoming").slice(0, 12),
    [games],
  );

  const trendingTeams = useMemo(() => deriveTrendingTeams(games), [games]);

  return (
    <AppShell hideLiveScoresSidebar>
      <div className="px-4 pt-4">
        <h1 className="text-xl font-black tracking-tight">
          Explore
        </h1>
      </div>

      <Section title="Live now">
        <GameCardRow
          games={liveGames}
          loading={gamesLoading}
          failed={gamesFailed}
          onRetry={refetchGames}
          loadFailedMessage="Live games could not be loaded."
          emptyMessage="Nothing is live right now."
        />
      </Section>

      <Section title="Upcoming">
        <GameCardRow
          games={upcomingGames}
          loading={gamesLoading}
          failed={gamesFailed}
          onRetry={refetchGames}
          loadFailedMessage="Upcoming games could not be loaded."
          emptyMessage="No upcoming games scheduled."
        />
      </Section>

      <Section title="Trending teams">
        {gamesLoading && <RowListSkeleton />}

        {gamesFailed && (
          <StatusMessage className="px-4" onRetry={refetchGames}>
            Trending teams could not be loaded.
          </StatusMessage>
        )}

        {!gamesLoading && !gamesFailed && trendingTeams.length === 0 && (
          <StatusMessage className="px-4">
            No teams trending right now.
          </StatusMessage>
        )}

        {!gamesLoading && !gamesFailed && trendingTeams.length > 0 && (
          <ul className="divide-y divide-border">
            {trendingTeams.map((team) => (
              <li key={team.key}>
                <Link
                  href={
                    team.teamId
                      ? `/team/${encodeURIComponent(team.teamId)}`
                      : `/game/${encodeURIComponent(team.gameId)}`
                  }
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

      <Section title="Trending players">
        {playersLoading && <RowListSkeleton />}

        {playersFailed && (
          <StatusMessage className="px-4" onRetry={refetchPlayers}>
            Trending players could not be loaded.
          </StatusMessage>
        )}

        {!playersLoading && !playersFailed && trendingPlayers.length === 0 && (
          <StatusMessage className="px-4">
            No goals in live matches right now.
          </StatusMessage>
        )}

        {!playersLoading && !playersFailed && trendingPlayers.length > 0 && (
          <ul className="divide-y divide-border">
            {trendingPlayers.map((player) => (
              <li key={player.key}>
                <Link
                  href={
                    player.playerId
                      ? `/player/${encodeURIComponent(player.playerId)}`
                      : `/game/${encodeURIComponent(player.gameId)}`
                  }
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  {player.teamLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={player.teamLogo}
                      alt=""
                      className="size-9 shrink-0 rounded-full bg-muted object-contain"
                    />
                  ) : (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-black text-accent-foreground">
                      {player.name.slice(0, 3).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {player.name}
                    </p>

                    <p className="truncate text-xs text-muted-foreground">
                      {player.team}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    {player.goals} {player.goals === 1 ? "goal" : "goals"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Trending discussions">
        {discussionsLoading && <RowListSkeleton />}

        {discussionsFailed && (
          <StatusMessage className="px-4" onRetry={refetchDiscussions}>
            Trending discussions could not be loaded.
          </StatusMessage>
        )}

        {!discussionsLoading && !discussionsFailed && trendingPosts.length === 0 && (
          <StatusMessage className="px-4">
            No discussions trending right now.
          </StatusMessage>
        )}

        {!discussionsLoading && !discussionsFailed && trendingPosts.length > 0 && (
          <ul className="divide-y divide-border">
            {trendingPosts.map((post) => {
              const author = post.profiles;
              const name = author?.display_name || author?.username || "unknown";

              return (
                <li key={post.id}>
                  <Link
                    href={`/post/${encodeURIComponent(post.id)}`}
                    className="block px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{name}</span>
                      <span>·</span>
                      <span>{formatRelative(post.created_at)}</span>
                    </div>

                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm text-foreground">
                      {post.body}
                    </p>

                    <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{post.like_count} likes</span>
                      <span>{post.reply_count} replies</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Competitions">
        {competitionsLoading && <RowListSkeleton />}

        {competitionsFailed && (
          <StatusMessage className="px-4" onRetry={refetchCompetitions}>
            Competitions could not be loaded.
          </StatusMessage>
        )}

        {!competitionsLoading && !competitionsFailed && competitionGames.length === 0 && (
          <StatusMessage className="px-4">
            No featured competitions right now.
          </StatusMessage>
        )}

        {!competitionsLoading && !competitionsFailed && competitionGames.length > 0 && (
          <ul className="divide-y divide-border">
            {competitionGames.map((game) => (
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

function GameCardRow({
  games,
  loading,
  failed,
  onRetry,
  loadFailedMessage,
  emptyMessage,
}: {
  games: ExploreGame[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  loadFailedMessage: string;
  emptyMessage: string;
}) {
  const router = useRouter();

  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-3">
      {loading &&
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

      {failed && <StatusMessage onRetry={onRetry}>{loadFailedMessage}</StatusMessage>}

      {!loading &&
        !failed &&
        games.map((game) => {
          const href = `/game/${encodeURIComponent(game.id)}`;

          return (
            <div
              key={game.id}
              role="link"
              tabIndex={0}
              className="w-60 shrink-0 cursor-pointer rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) return;
                router.push(href);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") router.push(href);
              }}
            >
              <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide">
                <span className="max-w-[10rem] truncate text-muted-foreground">
                  {game.league || game.sport}
                </span>

                <GameStatus game={game} />
              </div>

              <div className="mt-2 space-y-1 text-sm">
                <TeamRow name={game.home} teamId={game.homeTeamId} score={game.homeScore} />
                <TeamRow name={game.away} teamId={game.awayTeamId} score={game.awayScore} />
              </div>

              {game.venue && (
                <div className="mt-2 truncate text-[10px] text-muted-foreground">
                  {game.venue}
                </div>
              )}
            </div>
          );
        })}

      {!loading && !failed && games.length === 0 && (
        <StatusMessage>{emptyMessage}</StatusMessage>
      )}
    </div>
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
    label = formatCountdown(game.kickoff);
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
  teamId,
  score,
}: {
  name: string;
  teamId: string | null;
  score: number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      {teamId ? (
        <Link
          href={`/team/${encodeURIComponent(teamId)}`}
          className="min-w-0 truncate font-semibold hover:underline"
        >
          {name}
        </Link>
      ) : (
        <span className="min-w-0 truncate font-semibold">
          {name}
        </span>
      )}

      <span className="shrink-0 tabular-nums text-muted-foreground">
        {score ?? "—"}
      </span>
    </div>
  );
}

function StatusMessage({
  children,
  className = "",
  onRetry,
}: {
  children: ReactNode;
  className?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-4 text-sm text-muted-foreground ${className}`}
    >
      <span>{children}</span>
      {onRetry && (
        <button
          type="button"
          onClick={() => onRetry()}
          className="shrink-0 text-sm font-semibold text-primary hover:underline"
        >
          Retry
        </button>
      )}
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
