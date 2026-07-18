import { useState } from "react";
import Link from "next/link";
import { Heart, Link2, MessageCircle, MoreHorizontal, Repeat2, Share, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TEAM_TAG_RE, PLAYER_TAG_RE, formatRelative } from "@/lib/team-index";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mapPostsIn, removePostFrom, POST_QUERY_KEYS } from "@/lib/post-cache";
import { friendlyErrorMessage } from "@/lib/errors";
import { UserListDialog } from "@/components/UserListDialog";
import { ShareDialog } from "@/components/ShareDialog";
import { CommentsDialog } from "@/components/CommentsDialog";

export type PostRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  parent_post_id?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  like_count?: number;
  repost_count?: number;
  reply_count?: number;
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
  likes: { user_id: string }[];
  post_teams: { team_symbol: string }[];
  reposts?: { user_id: string }[];
  post_players?: { player_symbol: string }[];
};

export function renderBody(body: string) {
  type Tok = { kind: "team" | "player"; sym: string; start: number; end: number };
  const toks: Tok[] = [];
  for (const m of body.matchAll(TEAM_TAG_RE)) {
    toks.push({ kind: "team", sym: m[1], start: m.index!, end: m.index! + m[0].length });
  }
  for (const m of body.matchAll(PLAYER_TAG_RE)) {
    const at = body.indexOf("@", m.index!);
    toks.push({ kind: "player", sym: m[1], start: at, end: at + 1 + m[1].length });
  }
  toks.sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let last = 0;
  toks.forEach((t, i) => {
    if (t.start < last) return;
    if (t.start > last) out.push(<span key={`t${i}`}>{body.slice(last, t.start)}</span>);
    if (t.kind === "team") {
      out.push(
        <Link
          key={i}
          href={`/team/${encodeURIComponent(t.sym)}`}
          className="mx-0.5 inline-block rounded-md bg-primary/10 px-1.5 py-0.5 align-baseline text-[13px] font-bold text-primary hover:bg-primary/20"
        >
          ${t.sym}
        </Link>,
      );
    } else {
      out.push(
        <Link
          key={i}
          href={`/player/${encodeURIComponent(t.sym)}`}
          className="mx-0.5 inline-block rounded-md bg-accent px-1.5 py-0.5 align-baseline text-[13px] font-bold text-accent-foreground hover:bg-accent/70"
        >
          @{t.sym}
        </Link>,
      );
    }
    last = t.end;
  });
  if (last < body.length) out.push(<span key="tail">{body.slice(last)}</span>);
  return out;
}

export function PostCard({
  post,
  currentUserId,
  repostedBy,
  onOpenComments,
}: {
  post: PostRow;
  currentUserId: string | null;
  /** Shown as a "X reposted" banner above the card — used on profile pages
   * where a repost appears in both the original author's and the
   * reposting user's post lists. */
  repostedBy?: { username: string; display_name: string | null };
  /** When rendered as a flat comment row inside CommentsDialog, tapping
   * "reply" should target that comment's author (Instagram/LinkedIn-style
   * @mention prefill) instead of opening a nested comments dialog. */
  onOpenComments?: (post: PostRow) => void;
}) {
  const qc = useQueryClient();
  const liked = !!currentUserId && post.likes.some((l) => l.user_id === currentUserId);
  const likeCount = post.like_count ?? post.likes.length;
  const reposted = !!currentUserId && (post.reposts ?? []).some((r) => r.user_id === currentUserId);
  const repostCount = post.repost_count ?? (post.reposts ?? []).length;
  const replyCount = post.reply_count ?? 0;
  const author = post.profiles;
  const name = author?.display_name || author?.username || "unknown";

  // A PostCard only ever receives onOpenComments when it's being rendered
  // as a comment row inside CommentsDialog — used here to render a tighter,
  // repost/share-less layout so deep nesting doesn't squeeze cards down to
  // nothing, and so comments can only be liked/replied to, not reposted or
  // shared like a top-level post.
  const isComment = Boolean(onOpenComments);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likesOpen, setLikesOpen] = useState(false);
  const [repostsOpen, setRepostsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const postCacheFilter = {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      POST_QUERY_KEYS.includes(String(query.queryKey[0])),
  };

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Sign in to like posts");
      if (liked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("likes")
          .insert({ post_id: post.id, user_id: currentUserId });
        if (error) throw error;
      }
    },
    onMutate: () => {
      if (!currentUserId) return { snapshot: [] as [readonly unknown[], unknown][] };

      const snapshot = qc.getQueriesData(postCacheFilter);
      const wasLiked = liked;
      const userId = currentUserId;

      qc.setQueriesData(postCacheFilter, (old: unknown) =>
        mapPostsIn<PostRow>(old, post.id, (p) => {
          const rows = p.likes ?? [];
          const nextLikes = wasLiked
            ? rows.filter((r) => r.user_id !== userId)
            : [...rows, { user_id: userId }];
          const baseCount = p.like_count ?? rows.length;

          return {
            ...p,
            likes: nextLikes,
            like_count: Math.max(0, baseCount + (wasLiked ? -1 : 1)),
          };
        }),
      );

      return { snapshot };
    },
    onError: (e: Error, _vars, context) => {
      toast.error(friendlyErrorMessage(e));
      context?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
  });

  const toggleRepost = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Sign in to repost");
      const sb = supabase as unknown as {
        from: (t: string) => {
          delete: () => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> } };
          insert: (v: unknown) => Promise<{ error: Error | null }>;
        };
      };
      if (reposted) {
        const { error } = await sb.from("reposts").delete().eq("post_id", post.id).eq("user_id", currentUserId);
        if (error) throw error;
      } else {
        const { error } = await sb.from("reposts").insert({ post_id: post.id, user_id: currentUserId });
        if (error) throw error;
      }
    },
    onMutate: () => {
      if (!currentUserId) return { snapshot: [] as [readonly unknown[], unknown][] };

      const snapshot = qc.getQueriesData(postCacheFilter);
      const wasReposted = reposted;
      const userId = currentUserId;

      qc.setQueriesData(postCacheFilter, (old: unknown) =>
        mapPostsIn<PostRow>(old, post.id, (p) => {
          const rows = p.reposts ?? [];
          const nextReposts = wasReposted
            ? rows.filter((r) => r.user_id !== userId)
            : [...rows, { user_id: userId }];
          const baseCount = p.repost_count ?? rows.length;

          return {
            ...p,
            reposts: nextReposts,
            repost_count: Math.max(0, baseCount + (wasReposted ? -1 : 1)),
          };
        }),
      );

      return { snapshot };
    },
    onError: (e: Error, _vars, context) => {
      toast.error(friendlyErrorMessage(e));
      context?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
  });

  const deletePost = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onMutate: () => {
      const snapshot = qc.getQueriesData(postCacheFilter);
      qc.setQueriesData(postCacheFilter, (old: unknown) => removePostFrom(old, post.id));
      return { snapshot };
    },
    onSuccess: () => toast.success("Post deleted"),
    onError: (e: Error, _vars, context) => {
      toast.error(friendlyErrorMessage(e));
      context?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
  });

  const postUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/post/${encodeURIComponent(post.id)}`;
  const shareText = post.body ? post.body.slice(0, 120) : `A post by @${author?.username ?? "unknown"}`;

  const copyLink = () => {
    navigator.clipboard.writeText(postUrl).then(
      () => toast.success("Link copied"),
      () => toast.error("Could not copy link"),
    );
  };

  return (
    <article
      className={`border-b border-border transition-colors hover:bg-muted/30 ${
        isComment ? "px-2 py-2" : "px-3 py-2.5 sm:px-4 sm:py-4"
      }`}
    >
      {repostedBy && (
        <Link
          href={`/user/${encodeURIComponent(repostedBy.username)}`}
          className="mb-2 flex items-center gap-2 pl-9 text-xs font-semibold text-muted-foreground hover:underline"
        >
          <Repeat2 className="size-3.5" />
          {repostedBy.display_name || repostedBy.username} reposted
        </Link>
      )}
      <div className={isComment ? "flex gap-2" : "flex gap-3"}>
        <Link
          href={`/user/${encodeURIComponent(author?.username || "")}`}
          className={`shrink-0 rounded-full bg-gradient-to-br from-primary to-accent-foreground flex items-center justify-center text-primary-foreground font-bold overflow-hidden transition-opacity hover:opacity-90 ${
            isComment ? "size-8 text-sm" : "size-9 sm:size-11"
          }`}
        >
          {author?.avatar_url ? (
            <img src={author.avatar_url} alt={name} className="size-full object-cover" />
          ) : (
            name.slice(0, 1).toUpperCase()
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm">
              <Link
                href={`/user/${encodeURIComponent(author?.username || "")}`}
                className="truncate font-semibold text-foreground hover:underline"
              >
                {name}
              </Link>
              <span className="truncate text-muted-foreground">@{author?.username}</span>
              <span className="text-muted-foreground">·</span>
              <span className="shrink-0 text-muted-foreground">{formatRelative(post.created_at)}</span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More options"
                  className="-mr-1.5 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <MoreHorizontal className="size-[18px]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={copyLink}>
                  <Link2 className="size-4" />
                  Copy link
                </DropdownMenuItem>
                {currentUserId && currentUserId === post.user_id && (
                  <DropdownMenuItem
                    onClick={() => deletePost.mutate()}
                    disabled={deletePost.isPending}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    Delete post
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Link
            href={`/post/${encodeURIComponent(post.id)}`}
            className={isComment ? "mt-0.5 block" : "mt-1 block sm:mt-1.5"}
          >
            <p
              className={`whitespace-pre-wrap break-words leading-normal text-foreground ${
                isComment ? "text-sm" : "text-[15px]"
              }`}
            >
              {renderBody(post.body)}
            </p>
            {post.media_url && (
              <img
                src={post.media_url}
                alt=""
                className={`max-w-full rounded-2xl border border-border ${
                  isComment ? "mt-1.5 max-h-56" : "mt-2 max-h-72 sm:mt-3 sm:max-h-[32rem]"
                }`}
                loading="lazy"
              />
            )}
          </Link>
          <div
            className={`flex items-center text-muted-foreground ${
              isComment ? "mt-1 max-w-[140px] justify-between" : "mt-1 max-w-sm justify-between sm:mt-3"
            }`}
          >
            <button
              type="button"
              onClick={() => (onOpenComments ? onOpenComments(post) : setCommentsOpen(true))}
              className={`group inline-flex items-center gap-1.5 rounded-full transition-colors hover:text-primary ${
                isComment ? "py-1 pl-0 pr-2" : "-ml-2 py-1 pl-2 pr-3 sm:py-2"
              }`}
            >
              <span
                className={`flex items-center justify-center rounded-full transition-colors group-hover:bg-primary/10 ${
                  isComment ? "size-6" : "size-7 sm:size-8"
                }`}
              >
                <MessageCircle className={isComment ? "size-4" : "size-4 sm:size-[18px]"} />
              </span>
              <span className="text-xs tabular-nums">{replyCount || ""}</span>
            </button>

            {!isComment && (
              <div
                className={`group inline-flex items-center rounded-full transition-colors hover:text-green-600 ${reposted ? "text-green-600" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => toggleRepost.mutate()}
                  disabled={toggleRepost.isPending}
                  className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-green-600/10 sm:size-8"
                  aria-label={reposted ? "Undo repost" : "Repost"}
                >
                  <Repeat2 className="size-4 transition-transform active:scale-90 sm:size-[18px]" />
                </button>
                <button
                  type="button"
                  onClick={() => setRepostsOpen(true)}
                  disabled={!repostCount}
                  className="rounded-full py-1 pr-3 text-xs tabular-nums hover:underline disabled:no-underline sm:py-2"
                >
                  {repostCount || ""}
                </button>
              </div>
            )}

            <div
              className={`group inline-flex items-center rounded-full transition-colors hover:text-destructive ${liked ? "text-destructive" : ""}`}
            >
              <button
                type="button"
                onClick={() => toggleLike.mutate()}
                disabled={toggleLike.isPending}
                className={`flex items-center justify-center rounded-full transition-colors hover:bg-destructive/10 ${
                  isComment ? "size-6" : "size-7 sm:size-8"
                }`}
                aria-label={liked ? "Unlike" : "Like"}
              >
                <Heart
                  className={`transition-transform active:scale-90 ${isComment ? "size-4" : "size-4 sm:size-[18px]"} ${liked ? "fill-current" : ""}`}
                />
              </button>
              <button
                type="button"
                onClick={() => setLikesOpen(true)}
                disabled={!likeCount}
                className={`rounded-full text-xs tabular-nums hover:underline disabled:no-underline ${
                  isComment ? "py-1 pr-2" : "py-1 pr-3 sm:py-2"
                }`}
              >
                {likeCount || ""}
              </button>
            </div>

            {!isComment && (
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="group inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-2 text-sm transition-colors hover:text-primary sm:py-2"
                aria-label="Share post"
              >
                <span className="flex size-7 items-center justify-center rounded-full transition-colors group-hover:bg-primary/10 sm:size-8">
                  <Share className="size-4 sm:size-[18px]" />
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {!onOpenComments && (
        <CommentsDialog
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          post={post}
          currentUserId={currentUserId}
        />
      )}

      <UserListDialog
        open={likesOpen}
        onClose={() => setLikesOpen(false)}
        title="Liked by"
        table="likes"
        postId={post.id}
      />

      <UserListDialog
        open={repostsOpen}
        onClose={() => setRepostsOpen(false)}
        title="Reposted by"
        table="reposts"
        postId={post.id}
      />

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={postUrl}
        text={shareText}
      />
    </article>
  );
}