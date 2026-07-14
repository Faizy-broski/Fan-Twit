"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { CategoryBanner } from "@/components/CategoryBanner";
import { PostCard, type PostRow } from "@/components/PostCard";
import { PostComposer } from "@/components/PostComposer";
import { PostListSkeleton } from "@/components/PostCardSkeleton";

type HomePost = Omit<PostRow, "post_teams"> & {
  post_teams: {
    team_symbol: string;
    teams: {
      sport: string;
    } | null;
  }[];
};

async function fetchHomePosts(): Promise<HomePost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      `
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
          team_symbol,
          teams (
            sport
          )
        )
      `,
    )
    .is("parent_post_id", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as HomePost[];
}

export default function HomePage() {
  const { user } = useAuth();

  const [category, setCategory] = useState("All");
  const [tab, setTab] = useState<"popular" | "latest">("popular");

  const {
    data: posts = [],
    isLoading,
    isError,
    error,
  } = useQuery<HomePost[]>({
    queryKey: ["home-posts"],
    queryFn: fetchHomePosts,
    staleTime: 30_000,
  });

  const filteredPosts = useMemo(() => {
    const categoryPosts =
      category === "All"
        ? posts
        : posts.filter((post) =>
            post.post_teams.some(
              (postTeam) => postTeam.teams?.sport === category,
            ),
          );

    if (tab === "popular") {
      return [...categoryPosts].sort((a, b) => {
        const likesDifference = b.likes.length - a.likes.length;

        if (likesDifference !== 0) {
          return likesDifference;
        }

        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      });
    }

    return categoryPosts;
  }, [posts, category, tab]);

  function handlePostCreated() {
    setTab("latest");
    setCategory("All");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <AppShell>
      <CategoryBanner
        active={category}
        onChange={setCategory}
      />

      <div className="flex border-b border-border">
        {(["popular", "latest"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
              tab === item
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <PostComposer
        userId={user?.id ?? null}
        onPosted={handlePostCreated}
      />

      {isLoading && <PostListSkeleton />}

      {isError && (
        <div className="p-8 text-center">
          <p className="text-sm font-medium text-destructive">
            Feed could not be loaded.
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {error instanceof Error
              ? error.message
              : "An unexpected error occurred."}
          </p>
        </div>
      )}

      {!isLoading && !isError && filteredPosts.length === 0 && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No posts yet. Be the first — tag a team with $ARS, $LAL, $KC…
        </div>
      )}

      {!isLoading &&
        !isError &&
        filteredPosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={user?.id ?? null}
          />
        ))}
    </AppShell>
  );
}