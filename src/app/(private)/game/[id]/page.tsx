"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { PostCard, type PostRow } from "@/components/PostCard";
import { PostListSkeleton } from "@/components/PostCardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { GameDetail } from "@/lib/highlightly.functions";
import { POST_SELECT } from "@/lib/posts";

type GameApiError = {
  message?: string;
};

async function fetchGameDetail(id: string): Promise<GameDetail | null> {
  const response = await fetch(
    `/api/games/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const result = (await response
      .json()
      .catch(() => null)) as GameApiError | null;

    throw new Error(
      result?.message ?? "Failed to load game details.",
    );
  }

  return response.json() as Promise<GameDetail>;
}

async function fetchGameTwits(game: GameDetail): Promise<PostRow[]> {
  const searchTerms = [game.home, game.away]
    .map((term) => term.trim())
    .filter(Boolean)
    .map((term) => `body.ilike.%${term}%`)
    .join(",");

  if (!searchTerms) {
    return [];
  }

  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .or(searchTerms)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as PostRow[];
}

export default function GamePage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { user } = useAuth();

  const {
    data: game,
    isLoading: gameLoading,
    isError: gameFailed,
    error: gameError,
  } = useQuery<GameDetail | null>({
    queryKey: ["game", id],
    queryFn: () => fetchGameDetail(id),
    enabled: Boolean(id),
    refetchInterval: 60_000,
    staleTime: 20_000,
    refetchIntervalInBackground: false,
  });

  const {
    data: twits = [],
    isLoading: twitsLoading,
    isError: twitsFailed,
  } = useQuery<PostRow[]>({
    queryKey: [
      "game-twits",
      id,
      game?.home,
      game?.away,
    ],
    enabled: Boolean(game),
    queryFn: () => {
      if (!game) {
        return Promise.resolve([]);
      }

      return fetchGameTwits(game);
    },
    staleTime: 30_000,
  });

  return (
    <AppShell>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link
          href="/explore"
          aria-label="Back to explore"
          className="rounded-md p-1 transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-5 text-muted-foreground" />
        </Link>

        <h1 className="text-base font-bold">Game</h1>
      </header>

      {gameLoading && (
        <section className="border-b border-border bg-gradient-to-b from-primary/5 to-background px-4 pb-5 pt-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-14" />
          </div>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-8 w-16" />
            <div className="flex items-center justify-end gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="size-10 shrink-0 rounded-full" />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        </section>
      )}

      {gameFailed && (
        <div className="p-8 text-center">
          <p className="text-sm font-medium text-destructive">
            Game details could not be loaded.
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {gameError instanceof Error
              ? gameError.message
              : "An unexpected error occurred."}
          </p>
        </div>
      )}

      {!gameLoading && !gameFailed && !game && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Game not found.
        </div>
      )}

      {game && (
        <>
          <section className="border-b border-border bg-gradient-to-b from-primary/5 to-background px-4 pb-5 pt-4">
            <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span className="truncate">
                {game.league || game.sport}
              </span>

              <GameStatus game={game} />
            </div>

            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
              <TeamColumn
                name={game.home}
                badge={game.homeBadge}
              />

              <div className="text-center">
                <div className="whitespace-nowrap text-3xl font-black tabular-nums">
                  {game.homeScore ?? "–"}{" "}
                  <span className="text-muted-foreground">
                    :
                  </span>{" "}
                  {game.awayScore ?? "–"}
                </div>

                <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {game.sport}
                </div>
              </div>

              <TeamColumn
                name={game.away}
                badge={game.awayBadge}
                align="right"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {game.venue && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" />
                  {game.venue}
                </span>
              )}

              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3" />
                {formatGameDate(game.kickoff)}
              </span>

              {game.season && (
                <span>
                  Season {game.season}
                  {game.round ? ` · R${game.round}` : ""}
                </span>
              )}
            </div>
          </section>

          {game.stats.length > 0 && (
            <section className="border-b border-border px-4 py-4">
              <h2 className="pb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Match stats
              </h2>

              <ul className="space-y-2">
                {game.stats.map((stat, index) => (
                  <li
                    key={`${stat.name}-${index}`}
                    className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-2 text-sm"
                  >
                    <span className="text-left font-semibold tabular-nums">
                      {stat.home}
                    </span>

                    <span className="truncate text-center text-xs uppercase tracking-wider text-muted-foreground">
                      {stat.name}
                    </span>

                    <span className="text-right font-semibold tabular-nums">
                      {stat.away}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {game.description && (
            <section className="border-b border-border px-4 py-4">
              <h2 className="pb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                About
              </h2>

              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {game.description}
              </p>
            </section>
          )}

          <section className="px-4 py-4">
            <h2 className="pb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Fan twits
            </h2>

            {twitsLoading && (
              <div className="-mx-4">
                <PostListSkeleton count={3} />
              </div>
            )}

            {twitsFailed && (
              <p className="text-sm text-destructive">
                Twits could not be loaded.
              </p>
            )}

            {!twitsLoading &&
              !twitsFailed &&
              twits.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No twits about this game yet.
                </p>
              )}

            {!twitsLoading &&
              !twitsFailed &&
              twits.length > 0 && (
                <div className="-mx-4">
                  {twits.map((twit) => (
                    <PostCard
                      key={twit.id}
                      post={twit}
                      currentUserId={user?.id ?? null}
                    />
                  ))}
                </div>
              )}
          </section>
        </>
      )}
    </AppShell>
  );
}

function GameStatus({
  game,
}: {
  game: GameDetail;
}) {
  if (game.status === "live") {
    return (
      <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
        ● LIVE{game.progress ? ` ${game.progress}` : ""}
      </span>
    );
  }

  if (game.status === "finished") {
    return (
      <span className="shrink-0 text-muted-foreground">
        FT
      </span>
    );
  }

  return (
    <span className="shrink-0 text-primary">
      {new Date(game.kickoff).toLocaleString(undefined, {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </span>
  );
}

function TeamColumn({
  name,
  badge,
  align = "left",
}: {
  name: string;
  badge: string | null;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${
        align === "right"
          ? "flex-row-reverse text-right"
          : ""
      }`}
    >
      {badge ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={badge}
          alt={`${name} badge`}
          className="size-10 shrink-0 rounded-full bg-muted object-contain"
        />
      ) : (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}

      <span className="min-w-0 break-words text-sm font-bold leading-tight">
        {name}
      </span>
    </div>
  );
}

function formatGameDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString();
}