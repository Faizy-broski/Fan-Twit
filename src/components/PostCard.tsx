import Link from "next/link";
import { Heart, MessageCircle, Repeat2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TEAM_TAG_RE, PLAYER_TAG_RE, formatRelative } from "@/lib/team-index";
import { toast } from "sonner";

export type PostRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  media_url?: string | null;
  media_type?: string | null;
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
  likes: { user_id: string }[];
  post_teams: { team_symbol: string }[];
  reposts?: { user_id: string }[];
  post_players?: { player_symbol: string }[];
  reply_count?: { count: number }[];
};

function renderBody(body: string) {
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
        <Link key={i} href={`/team/${encodeURIComponent(t.sym)}`} className="font-semibold text-primary hover:underline">
          ${t.sym}
        </Link>,
      );
    } else {
      out.push(
        <Link key={i} href={`/player/${encodeURIComponent(t.sym)}`} className="font-semibold text-primary hover:underline">
          @{t.sym}
        </Link>,
      );
    }
    last = t.end;
  });
  if (last < body.length) out.push(<span key="tail">{body.slice(last)}</span>);
  return out;
}

export function PostCard({ post, currentUserId }: { post: PostRow; currentUserId: string | null }) {
  const qc = useQueryClient();
  const liked = !!currentUserId && post.likes.some((l) => l.user_id === currentUserId);
  const likeCount = post.likes.length;
  const reposted = !!currentUserId && (post.reposts ?? []).some((r) => r.user_id === currentUserId);
  const repostCount = (post.reposts ?? []).length;
  const replyCount = post.reply_count?.[0]?.count ?? 0;
  const author = post.profiles;
  const name = author?.display_name || author?.username || "unknown";

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
    onSuccess: () => qc.invalidateQueries(),
    onError: (e: Error) => toast.error(e.message),
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
    onSuccess: () => qc.invalidateQueries(),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <article className="border-b border-border px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="flex gap-3">
        <Link
          href={`/user/${encodeURIComponent(author?.username || "")}`}
          className="size-10 shrink-0 rounded-full bg-gradient-to-br from-primary to-accent-foreground flex items-center justify-center text-primary-foreground font-bold overflow-hidden"
        >
          {author?.avatar_url ? (
            <img src={author.avatar_url} alt={name} className="size-full object-cover" />
          ) : (
            name.slice(0, 1).toUpperCase()
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 text-sm">
            <Link
              href={`/user/${encodeURIComponent(author?.username || "")}`}
              className="font-semibold text-foreground hover:underline truncate"
            >
              {name}
            </Link>
            <span className="text-muted-foreground truncate">@{author?.username}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{formatRelative(post.created_at)}</span>
          </div>
          <Link href={`/post/${encodeURIComponent(post.id)}`} className="mt-1 block">
            <p className="whitespace-pre-wrap break-words text-[15px] leading-snug text-foreground">
              {renderBody(post.body)}
            </p>
            {post.media_url && (
              <img
                src={post.media_url}
                alt=""
                className="mt-2 max-h-96 w-full rounded-2xl border border-border object-cover"
                loading="lazy"
              />
            )}
          </Link>
          <div className="mt-2 flex items-center gap-6 text-muted-foreground">
            <Link
              href={`/post/${encodeURIComponent(post.id)}`}
              className="inline-flex items-center gap-1.5 text-sm hover:text-primary"
            >
              <MessageCircle className="size-4" />
              <span>{replyCount || ""}</span>
            </Link>
            <button
              onClick={() => toggleRepost.mutate()}
              disabled={toggleRepost.isPending}
              className={`inline-flex items-center gap-1.5 text-sm transition-colors hover:text-green-600 ${reposted ? "text-green-600" : ""}`}
            >
              <Repeat2 className="size-4" />
              <span>{repostCount || ""}</span>
            </button>
            <button
              onClick={() => toggleLike.mutate()}
              disabled={toggleLike.isPending}
              className={`inline-flex items-center gap-1.5 text-sm transition-colors hover:text-destructive ${liked ? "text-destructive" : ""}`}
            >
              <Heart className={`size-4 ${liked ? "fill-current" : ""}`} />
              <span>{likeCount || ""}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}