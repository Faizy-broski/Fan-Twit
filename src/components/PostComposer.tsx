import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extractGameIds, extractMentions } from "@/lib/team-index";
import { toast } from "sonner";
import Link from "next/link";
import { ImagePlus, X } from "lucide-react";
import { POST_QUERY_KEYS } from "@/lib/post-cache";
import { friendlyErrorMessage } from "@/lib/errors";
import type { ExploreGame } from "@/lib/highlightly.functions";

type Suggestion =
  | { kind: "game"; id: string; label: string; league: string }
  | { kind: "mention"; username: string; label: string };

export function PostComposer({
  userId,
  defaultTag,
  defaultPlayer,
  replyToUsername,
  parentPostId,
  placeholder = "What's happening in sports? Tag a game with #, mention someone with @username…",
  onPosted,
}: {
  userId: string | null;
  defaultTag?: string;
  defaultPlayer?: string;
  /** Prefills "@username " — used when replying to a specific comment so
   * the reply reads as directed at them (Instagram/LinkedIn-style), while
   * still posting flat as a direct reply to the thread's root post. */
  replyToUsername?: string;
  parentPostId?: string;
  placeholder?: string;
  onPosted?: () => void;
}) {
  const initial = defaultTag
    ? `$${defaultTag} `
    : defaultPlayer
      ? `@${defaultPlayer} `
      : replyToUsername
        ? `@${replyToUsername} `
        : "";
  const [body, setBody] = useState(initial);
  const qc = useQueryClient();
  const max = 500;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(initial.length);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [fetchedSuggestions, setFetchedSuggestions] = useState<Suggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Detect a #game or @mention token immediately before the caret.
  const tokenMatch = (() => {
    const before = body.slice(0, caret);
    const m = before.match(/(?:^|\s)([#@])([A-Za-z0-9_]{2,20})$/);
    if (!m) return null;
    return { kind: m[1] === "#" ? ("game" as const) : ("mention" as const), query: m[2], start: caret - m[2].length - 1 };
  })();
  const suggestions = tokenMatch && !dismissed ? fetchedSuggestions : [];

  useEffect(() => {
    let ignore = false;
    if (!tokenMatch) {
      return;
    }
    const term = tokenMatch.query;
    (async () => {
      if (tokenMatch.kind === "game") {
        let games = qc.getQueryData<ExploreGame[]>(["explore-live-games"]);
        if (!games) {
          try {
            const res = await fetch("/api/games/explore");
            games = res.ok ? ((await res.json()) as ExploreGame[]) : [];
          } catch {
            games = [];
          }
        }
        const q = term.toLowerCase();
        const matches = (games ?? [])
          .filter(
            (g) =>
              g.home.toLowerCase().includes(q) ||
              g.away.toLowerCase().includes(q) ||
              g.league.toLowerCase().includes(q),
          )
          .slice(0, 6);
        if (!ignore) {
          setFetchedSuggestions(
            matches.map((g) => ({
              kind: "game" as const,
              id: g.id,
              label: `${g.home} vs ${g.away}`,
              league: g.league || g.sport,
            })),
          );
          setActiveIdx(0);
        }
      } else {
        const { data } = await supabase
          .from("profiles")
          .select("username,display_name")
          .ilike("username", `%${term}%`)
          .limit(6);
        if (!ignore) {
          setFetchedSuggestions(
            (data ?? []).map((p) => ({
              kind: "mention" as const,
              username: p.username,
              label: p.display_name || p.username,
            })),
          );
          setActiveIdx(0);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [tokenMatch?.kind, tokenMatch?.query]);

  const applySuggestion = (s: Suggestion) => {
    if (!tokenMatch) return;
    const insert = s.kind === "game" ? `#${s.id} ` : `@${s.username} `;
    const before = body.slice(0, tokenMatch.start);
    const after = body.slice(caret);
    const next = `${before}${insert}${after}`;
    const nextCaret = before.length + insert.length;
    setBody(next);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(nextCaret, nextCaret);
        setCaret(nextCaret);
      }
    });
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sign in to post");
      const trimmed = body.trim();
      if (!trimmed && !mediaFile) throw new Error("Post cannot be empty");
      if (trimmed.length > max) throw new Error("Post too long");
      let media_url: string | null = null;
      let media_type: string | null = null;
      if (mediaFile) {
        const ext = mediaFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("post-media")
          .upload(path, mediaFile, { upsert: false, contentType: mediaFile.type });
        if (upErr) throw upErr;
        const { data: signed, error: sErr } = await supabase.storage
          .from("post-media")
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
        if (sErr || !signed) throw sErr ?? new Error("Could not sign URL");
        media_url = signed.signedUrl;
        media_type = mediaFile.type;
      }
      const { data: post, error } = await supabase
        .from("posts")
        .insert({ user_id: userId, body: trimmed, parent_post_id: parentPostId ?? null, media_url, media_type })
        .select("id")
        .single();
      if (error) throw error;
      const gameIds = extractGameIds(trimmed);
      if (gameIds.length) {
        await supabase
          .from("post_games")
          .insert(gameIds.map((game_id) => ({ post_id: post.id, game_id })));
      }
      const mentions = extractMentions(trimmed);
      if (mentions.length) {
        const { data: found } = await supabase
          .from("profiles")
          .select("id")
          .in("username", mentions);
        const valid = (found ?? [])
          .filter((p) => p.id !== userId)
          .map((p) => ({ post_id: post.id, mentioned_user_id: p.id }));
        if (valid.length) await supabase.from("post_mentions").insert(valid);
      }
    },
    onSuccess: () => {
      setBody(initial);
      setMediaFile(null);
      setMediaPreview(null);
      qc.invalidateQueries({
        predicate: (query) => POST_QUERY_KEYS.includes(String(query.queryKey[0])),
      });
      toast.success(parentPostId ? "Reply posted" : "Posted");
      onPosted?.();
    },
    onError: (e: Error) => toast.error(friendlyErrorMessage(e)),
  });

  const pickMedia = (f: File) => {
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image or GIF");
    if (f.size > 5 * 1024 * 1024) return toast.error("Media must be under 5 MB");
    setMediaFile(f);
    setMediaPreview(URL.createObjectURL(f));
  };

  if (!userId) {
    return (
      <div className="border-b border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Link href="/auth" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>{" "}
        to join the conversation.
      </div>
    );
  }

  const remaining = max - body.length;
  return (
    <div className="border-b border-border px-4 py-3">
      <div
        className="relative rounded-2xl border border-border bg-muted/30 px-3 py-2 focus-within:border-primary/60 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20 transition-colors cursor-text"
        onClick={(e) => {
          if (e.target === e.currentTarget) textareaRef.current?.focus();
        }}
      >
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            setDismissed(false);
          }}
          onKeyUp={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
          onClick={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
          onKeyDown={(e) => {
            if (!suggestions.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => (i + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              applySuggestion(suggestions[activeIdx]);
            } else if (e.key === "Escape") {
              setDismissed(true);
            }
          }}
          placeholder={placeholder}
          rows={3}
          className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-muted-foreground min-h-[72px]"
        />
        {mediaPreview && (
          <div className="relative mt-2 inline-block max-w-full">
            <img src={mediaPreview} alt="preview" className="max-h-64 rounded-lg border border-border" />
            <button
              type="button"
              onClick={() => { setMediaFile(null); setMediaPreview(null); }}
              className="absolute right-1 top-1 rounded-full bg-background/90 p-1 shadow"
              aria-label="Remove media"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        {suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
            {suggestions.map((s, i) => (
              <li key={s.kind === "game" ? `game-${s.id}` : `mention-${s.username}`}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySuggestion(s);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${
                    i === activeIdx ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                >
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                      i === activeIdx
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {s.kind === "game" ? "#" : "@"}
                  </span>
                  <span className="flex-1 truncate text-foreground">
                    {s.kind === "game" ? s.label : s.label}
                  </span>
                  {s.kind === "game" ? (
                    <span className="text-xs text-muted-foreground">{s.league}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">@{s.username}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pickMedia(f);
          e.target.value = "";
        }}
      />
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-primary hover:bg-primary/10"
            aria-label="Add photo or GIF"
          >
            <ImagePlus className="size-5" />
          </button>
          <span className={`text-xs ${remaining < 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {remaining}
          </span>
        </div>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending || (!body.trim() && !mediaFile) || remaining < 0}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:opacity-90"
        >
          {create.isPending ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}