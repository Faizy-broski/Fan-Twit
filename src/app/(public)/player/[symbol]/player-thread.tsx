"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { PostCard, type PostRow } from "@/components/PostCard";
import { PostListSkeleton } from "@/components/PostCardSkeleton";
import { PostComposer } from "@/components/PostComposer";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type PlayerThreadProps = {
  symbol: string;
};

type Player = {
  symbol: string;
  name: string;
  sport: string;
  team_symbol: string | null;
  avatar_url: string | null;
};

type PlayerPostRow = {
  post_id: string;
  posts: PostRow;
};

async function fetchPlayer(
  symbol: string,
): Promise<Player | null> {
  const { data, error } = await supabase
    .from("players")
    .select(
      `
        symbol,
        name,
        sport,
        team_symbol,
        avatar_url
      `,
    )
    .eq("symbol", symbol)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Player | null;
}

async function fetchPlayerPosts(
  symbol: string,
): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("post_players")
    .select(
      `
        post_id,
        posts!inner (
          id,
          body,
          created_at,
          user_id,
          media_url,
          media_type,
          profiles (
            username,
            display_name,
            avatar_url
          ),
          likes (
            user_id
          ),
          reposts (
            user_id
          ),
          post_teams (
            team_symbol
          )
        )
      `,
    )
    .eq("player_symbol", symbol)
    .order("post_id", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as PlayerPostRow[];

  return rows
    .map((row) => row.posts)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime(),
    );
}

export function PlayerThread({
  symbol,
}: PlayerThreadProps) {
  const { user } = useAuth();

  const {
    data: player,
    isLoading: playerLoading,
    isError: playerFailed,
    error: playerError,
  } = useQuery<Player | null>({
    queryKey: ["player", symbol],
    queryFn: () => fetchPlayer(symbol),
    staleTime: 60_000,
  });

  const {
    data: posts = [],
    isLoading: postsLoading,
    isError: postsFailed,
    error: postsError,
  } = useQuery<PostRow[]>({
    queryKey: ["player-posts", symbol],
    queryFn: () => fetchPlayerPosts(symbol),
    staleTime: 30_000,
  });

  return (
    <AppShell>
      <section className="border-b border-border bg-gradient-to-br from-primary/10 to-accent/40 px-4 py-6">
        <div className="flex items-center gap-3">
          {playerLoading ? (
            <Skeleton className="size-12 shrink-0 rounded-full" />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent-foreground font-black text-primary-foreground">
              {player?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={player.avatar_url}
                  alt={`${player.name} avatar`}
                  className="size-full object-cover"
                />
              ) : (
                symbol.slice(0, 1)
              )}
            </div>
          )}

          <div className="min-w-0">
            {playerLoading ? (
              <>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-2 h-3 w-24" />
              </>
            ) : (
              <>
                <h1 className="truncate text-xl font-black tracking-tight">
                  {player?.name ?? `@${symbol}`}
                </h1>

                <p className="text-xs text-muted-foreground">
                  @{symbol}
                  {player?.team_symbol
                    ? ` · $${player.team_symbol}`
                    : ""}
                  {player?.sport ? ` · ${player.sport}` : ""}
                </p>
              </>
            )}
          </div>
        </div>

        {playerFailed && (
          <p className="mt-3 text-sm text-destructive">
            {playerError instanceof Error
              ? playerError.message
              : "Player details could not be loaded."}
          </p>
        )}

        {!playerLoading && !playerFailed && !player && (
          <p className="mt-3 text-sm text-muted-foreground">
            No player registered for @{symbol}.{" "}
            <Link
              href="/"
              className="text-primary hover:underline"
            >
              Back to feed
            </Link>
          </p>
        )}
      </section>

      <PostComposer
        userId={user?.id ?? null}
        defaultPlayer={symbol}
        placeholder={`Post to @${symbol}…`}
      />

      {postsLoading && <PostListSkeleton />}

      {postsFailed && (
        <div className="p-8 text-center">
          <p className="text-sm font-medium text-destructive">
            Posts could not be loaded.
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {postsError instanceof Error
              ? postsError.message
              : "An unexpected error occurred."}
          </p>
        </div>
      )}

      {!postsLoading &&
        !postsFailed &&
        posts.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No posts yet for this player. Start the conversation.
          </div>
        )}

      {!postsLoading &&
        !postsFailed &&
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={user?.id ?? null}
          />
        ))}
    </AppShell>
  );
}