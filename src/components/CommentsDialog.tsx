"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PostCard, renderBody, type PostRow } from "@/components/PostCard";
import { PostComposer } from "@/components/PostComposer";
import { PostListSkeleton } from "@/components/PostCardSkeleton";
import { POST_SELECT } from "@/lib/posts";
import { formatRelative } from "@/lib/team-index";
import { useRepliesRealtime } from "@/hooks/useRepliesRealtime";

const PAGE_SIZE = 10;

async function fetchRepliesPage(postId: string, pageParam: number): Promise<PostRow[]> {
  const from = pageParam * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("parent_post_id", postId)
    .order("created_at", { ascending: true })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as PostRow[];
}

function QuotedPost({ post }: { post: PostRow }) {
  const author = post.profiles;
  const name = author?.display_name || author?.username || "unknown";

  return (
    <div className="flex gap-3 border-b border-border px-4 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent-foreground font-bold text-primary-foreground">
        {author?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={author.avatar_url} alt={name} className="size-full object-cover" />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
          <span className="truncate font-semibold text-foreground">{name}</span>
          <span className="truncate text-muted-foreground">@{author?.username}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{formatRelative(post.created_at)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-snug text-foreground">
          {renderBody(post.body)}
        </p>
      </div>
    </div>
  );
}

export function CommentsDialog({
  open,
  onClose,
  post,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  post: PostRow;
  currentUserId: string | null;
}) {
  useRepliesRealtime(open ? post.id : "");

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["replies-page", post.id],
    queryFn: ({ pageParam }) => fetchRepliesPage(post.id, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
    enabled: open,
    staleTime: 15_000,
  });

  const replies = data?.pages.flat() ?? [];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-base">Comments</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <QuotedPost post={post} />

          <PostComposer
            userId={currentUserId}
            parentPostId={post.id}
            placeholder="Post your reply"
          />

          {isLoading && <PostListSkeleton count={3} />}

          {isError && (
            <p className="p-4 text-center text-sm text-destructive">
              Comments could not be loaded.
            </p>
          )}

          {!isLoading && !isError && replies.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No comments yet. Be the first to reply.
            </p>
          )}

          {replies.map((reply) => (
            <PostCard key={reply.id} post={reply} currentUserId={currentUserId} />
          ))}

          {hasNextPage && (
            <div className="p-3">
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="w-full rounded-full border border-border py-2 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
              >
                {isFetchingNextPage ? "Loading…" : "Load more comments"}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
