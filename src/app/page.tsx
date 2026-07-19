"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { GamesRail } from "@/components/GamesRail";
import { PostCard, type PostRow } from "@/components/PostCard";
import { PostComposer } from "@/components/PostComposer";
import { PostListSkeleton } from "@/components/PostCardSkeleton";

const PAGE_SIZE = 10;
// Prefetch the next page once the 8th post of the most recent 10-post
// batch scrolls into view, instead of waiting until the very last post.
const PREFETCH_OFFSET_FROM_END = 3;

type HomePost = PostRow;

async function fetchHomePosts({ pageParam }: { pageParam: number }): Promise<HomePost[]> {
  const from = pageParam * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

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
        like_count,
        repost_count,
        reply_count,
        profiles!posts_user_id_profiles_fkey (
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
        ),
        post_games (
          game_id
        )
      `,
    )
    .is("parent_post_id", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as HomePost[];
}

export default function HomePage() {
  return (
    <Suspense fallback={<PostListSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedGameId = searchParams.get("game");

  const [tab, setTab] = useState<"popular" | "latest">("popular");

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["home-posts"],
    queryFn: fetchHomePosts,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
    staleTime: 30_000,
  });

  const posts = useMemo(() => data?.pages.flat() ?? [], [data]);

  const filteredPosts = useMemo(() => {
    const gamePosts = selectedGameId
      ? posts.filter((post) =>
          (post.post_games ?? []).some((tag) => tag.game_id === selectedGameId),
        )
      : posts;

    if (tab === "popular") {
      return [...gamePosts].sort((a, b) => {
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

    return gamePosts;
  }, [posts, selectedGameId, tab]);

  const canLoadMore = Boolean(hasNextPage) && !isFetchingNextPage;
  const sentinelIndex = Math.max(0, filteredPosts.length - PREFETCH_OFFSET_FROM_END);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();

      if (!node || !canLoadMore) {
        return;
      }

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      });

      observerRef.current.observe(node);
    },
    [canLoadMore, fetchNextPage],
  );

  // A game filter can hide every post on the pages loaded so far even
  // though later pages have matches — keep pulling until we find one or
  // run out of pages, instead of flashing "no posts yet".
  useEffect(() => {
    if (posts.length > 0 && filteredPosts.length === 0 && canLoadMore) {
      fetchNextPage();
    }
  }, [posts.length, filteredPosts.length, canLoadMore, fetchNextPage]);

  function handlePostCreated() {
    setTab("latest");
    if (selectedGameId) {
      router.replace("/", { scroll: false });
    }
    refetch();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <AppShell>
      <GamesRail />

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

      <div className="hidden lg:block">
        <PostComposer
          userId={user?.id ?? null}
          onPosted={handlePostCreated}
        />
      </div>

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
          No posts yet. Be the first — tag a game with #, mention someone with @username…
        </div>
      )}

      {!isLoading &&
        !isError &&
        filteredPosts.map((post, index) => (
          <div key={post.id}>
            <PostCard post={post} currentUserId={user?.id ?? null} />
            {index === sentinelIndex && <div ref={sentinelRef} aria-hidden />}
          </div>
        ))}

      {isFetchingNextPage && <PostListSkeleton count={3} />}
    </AppShell>
  );
}