"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, CornerDownRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PostCard, renderBody, type PostRow } from "@/components/PostCard";
import { PostComposer } from "@/components/PostComposer";
import { PostListSkeleton } from "@/components/PostCardSkeleton";
import { POST_SELECT } from "@/lib/posts";
import { formatRelative } from "@/lib/team-index";

// Facebook-style: the whole thread (comments, replies to comments, replies
// to those replies, and so on) renders in this one dialog, nested under
// its real parent — no per-comment dialogs. Fetched level-by-level (BFS)
// since PostgREST has no recursive-CTE embed; each level is one request
// regardless of how many siblings it has, and real conversations are only
// a handful of levels deep.
const MAX_LEVELS = 8;
// Beyond this, further replies stop indenting further right (still nested
// logically) so a long reply chain can't collapse into a sliver on mobile.
const MAX_VISUAL_DEPTH = 4;
const INDENT_PX = 12;

async function fetchThread(rootId: string): Promise<PostRow[]> {
  const all: PostRow[] = [];
  let frontier = [rootId];

  for (let level = 0; level < MAX_LEVELS && frontier.length > 0; level++) {
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .in("parent_post_id", frontier)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as unknown as PostRow[];

    if (rows.length === 0) {
      break;
    }

    all.push(...rows);
    frontier = rows.map((row) => row.id);
  }

  return all;
}

type CommentNode = {
  post: PostRow;
  children: CommentNode[];
};

function buildTree(rootId: string, all: PostRow[]): CommentNode[] {
  const byParent = new Map<string, PostRow[]>();

  for (const post of all) {
    const key = post.parent_post_id ?? "";
    const list = byParent.get(key) ?? [];
    list.push(post);
    byParent.set(key, list);
  }

  function build(post: PostRow): CommentNode {
    return {
      post,
      children: (byParent.get(post.id) ?? []).map(build),
    };
  }

  return (byParent.get(rootId) ?? []).map(build);
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

function CommentThread({
  node,
  depth,
  currentUserId,
  replyingToId,
  onToggleReply,
}: {
  node: CommentNode;
  depth: number;
  currentUserId: string | null;
  replyingToId: string | null;
  onToggleReply: (post: PostRow) => void;
}) {
  const indent = Math.min(depth, MAX_VISUAL_DEPTH) * INDENT_PX;
  const hasReplies = node.children.length > 0;
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginLeft: indent }} className={depth > 0 ? "border-l border-border pl-1" : ""}>
      <PostCard
        post={node.post}
        currentUserId={currentUserId}
        onOpenComments={onToggleReply}
      />

      {replyingToId === node.post.id && (
        <div className="border-b border-border bg-muted/30">
          <PostComposer
            userId={currentUserId}
            parentPostId={node.post.id}
            placeholder={`Reply to @${node.post.profiles?.username ?? "comment"}`}
            onPosted={() => {
              onToggleReply(node.post);
              setExpanded(true);
            }}
          />
        </div>
      )}

      {hasReplies && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex items-center gap-1.5 py-1 pl-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          {expanded ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <CornerDownRight className="size-3.5" />
          )}
          {expanded
            ? "Hide replies"
            : `View ${node.children.length} ${node.children.length === 1 ? "reply" : "replies"}`}
          {!expanded && <ChevronDown className="size-3.5" />}
        </button>
      )}

      {expanded &&
        node.children.map((child) => (
          <CommentThread
            key={child.post.id}
            node={child}
            depth={depth + 1}
            currentUserId={currentUserId}
            replyingToId={replyingToId}
            onToggleReply={onToggleReply}
          />
        ))}
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
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    data: descendants = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["thread", post.id],
    queryFn: () => fetchThread(post.id),
    enabled: open,
    staleTime: 10_000,
  });

  // Any insert whose parent is the root or any comment already in this
  // thread should refresh the whole tree — filters can't express "IN a set
  // of ids" server-side, so this checks client-side against what we know.
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    knownIdsRef.current = new Set([post.id, ...descendants.map((d) => d.id)]);
  }, [post.id, descendants]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const channel = supabase
      .channel(`thread-${post.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const row = payload.new as Record<string, unknown>;
          const parentId = row.parent_post_id;

          if (typeof parentId === "string" && knownIdsRef.current.has(parentId)) {
            queryClient.invalidateQueries({ queryKey: ["thread", post.id] });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, post.id, queryClient]);

  const tree = useMemo(() => buildTree(post.id, descendants), [post.id, descendants]);

  const toggleReply = (target: PostRow) =>
    setReplyingToId((current) => (current === target.id ? null : target.id));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReplyingToId(null);
          onClose();
        }
      }}
    >
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

          {!isLoading && !isError && tree.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No comments yet. Be the first to reply.
            </p>
          )}

          {tree.map((node) => (
            <CommentThread
              key={node.post.id}
              node={node}
              depth={0}
              currentUserId={currentUserId}
              replyingToId={replyingToId}
              onToggleReply={toggleReply}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
