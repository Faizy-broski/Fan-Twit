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

type TeamThreadProps = {
  symbol: string;
};

type Team = {
  symbol: string;
  name: string;
  league: string;
  sport: string;
  country: string | null;
  logo_url: string | null;
};

type TeamPostRow = {
  post_id: string;
  posts: PostRow;
};

async function fetchTeam(symbol: string): Promise<Team | null> {
  const { data, error } = await supabase
    .from("teams")
    .select(
      `
        symbol,
        name,
        league,
        sport,
        country,
        logo_url
      `,
    )
    .eq("symbol", symbol)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Team | null;
}

async function fetchTeamPosts(
  symbol: string,
): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("post_teams")
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
    .eq("team_symbol", symbol)
    .order("post_id", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as TeamPostRow[];

  return rows
    .map((row) => row.posts)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime(),
    );
}

export function TeamThread({
  symbol,
}: TeamThreadProps) {
  const { user } = useAuth();

  const {
    data: team,
    isLoading: teamLoading,
    isError: teamFailed,
    error: teamError,
  } = useQuery<Team | null>({
    queryKey: ["team", symbol],
    queryFn: () => fetchTeam(symbol),
    staleTime: 60_000,
  });

  const {
    data: posts = [],
    isLoading: postsLoading,
    isError: postsFailed,
    error: postsError,
  } = useQuery<PostRow[]>({
    queryKey: ["team-posts", symbol],
    queryFn: () => fetchTeamPosts(symbol),
    staleTime: 30_000,
  });

  return (
    <AppShell>
      <section className="border-b border-border bg-gradient-to-br from-primary/10 to-accent/40 px-4 py-6">
        <div className="flex items-center gap-4">
          {teamLoading ? (
            <Skeleton className="size-16 shrink-0 rounded-full" />
          ) : team?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={team.logo_url}
              alt={`${team.name || symbol} crest`}
              className="size-16 shrink-0 rounded-full border border-border bg-background object-cover shadow-sm"
            />
          ) : (
            <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-black text-primary-foreground">
              ${symbol}
            </span>
          )}

          <div className="min-w-0">
            {teamLoading ? (
              <>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-2 h-3 w-32" />
              </>
            ) : (
              <>
                <h1 className="truncate text-xl font-black tracking-tight">
                  {team?.name ?? symbol}
                </h1>

                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-primary">
                    ${symbol}
                  </span>

                  {team && (
                    <>
                      {" · "}
                      {team.league} · {team.sport}
                      {team.country ? ` · ${team.country}` : ""}
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        </div>

        {teamFailed && (
          <p className="mt-3 text-sm text-destructive">
            {teamError instanceof Error
              ? teamError.message
              : "Team details could not be loaded."}
          </p>
        )}

        {!teamLoading && !teamFailed && !team && (
          <p className="mt-3 text-sm text-muted-foreground">
            No team registered for ${symbol} yet.{" "}
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
        defaultTag={symbol}
        placeholder={`Post to $${symbol}…`}
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
            No posts yet in this thread. Start the conversation.
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