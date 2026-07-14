"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { PostCard, type PostRow } from "@/components/PostCard";
import { PostCardSkeleton, PostListSkeleton } from "@/components/PostCardSkeleton";
import { PostComposer } from "@/components/PostComposer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type PostDetailProps = {
  postId: string;
};

const POST_SELECT = `
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
`;

async function fetchPost(
  postId: string,
): Promise<PostRow | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as unknown as PostRow | null;
}

async function fetchReplies(
  postId: string,
): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("parent_post_id", postId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as PostRow[];
}

export function PostDetail({
  postId,
}: PostDetailProps) {
  const { user } = useAuth();

  const {
    data: post,
    isLoading: postLoading,
    isError: postFailed,
    error: postError,
  } = useQuery<PostRow | null>({
    queryKey: ["post", postId],
    queryFn: () => fetchPost(postId),
    enabled: Boolean(postId),
    staleTime: 30_000,
  });

  const {
    data: replies = [],
    isLoading: repliesLoading,
    isError: repliesFailed,
    error: repliesError,
  } = useQuery<PostRow[]>({
    queryKey: ["replies", postId],
    queryFn: () => fetchReplies(postId),
    enabled: Boolean(postId),
    staleTime: 15_000,
  });

  return (
    <AppShell>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link
          href="/"
          aria-label="Back to feed"
          className="rounded-md p-1 transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-5 text-muted-foreground" />
        </Link>

        <h1 className="text-base font-bold">Post</h1>
      </header>

      {postLoading && <PostCardSkeleton />}

      {postFailed && (
        <div className="p-8 text-center">
          <p className="text-sm font-medium text-destructive">
            Post could not be loaded.
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {postError instanceof Error
              ? postError.message
              : "An unexpected error occurred."}
          </p>
        </div>
      )}

      {!postLoading && !postFailed && !post && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Post not found.
        </div>
      )}

      {post && (
        <>
          <PostCard
            post={post}
            currentUserId={user?.id ?? null}
          />

          <PostComposer
            userId={user?.id ?? null}
            parentPostId={post.id}
            placeholder={`Reply to @${post.profiles?.username ?? "post"}…`}
          />
        </>
      )}

      {post && repliesLoading && <PostListSkeleton count={3} />}

      {post && repliesFailed && (
        <div className="p-6 text-center">
          <p className="text-sm font-medium text-destructive">
            Replies could not be loaded.
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {repliesError instanceof Error
              ? repliesError.message
              : "An unexpected error occurred."}
          </p>
        </div>
      )}

      {post &&
        !repliesLoading &&
        !repliesFailed &&
        replies.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No replies yet. Start the conversation.
          </div>
        )}

      {post &&
        !repliesLoading &&
        !repliesFailed &&
        replies.map((reply) => (
          <PostCard
            key={reply.id}
            post={reply}
            currentUserId={user?.id ?? null}
          />
        ))}
    </AppShell>
  );
}