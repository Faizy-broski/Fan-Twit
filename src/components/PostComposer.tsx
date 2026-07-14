import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extractTeamSymbols, extractPlayerSymbols } from "@/lib/team-index";
import { toast } from "sonner";
import Link from "next/link";
import { ImagePlus, X } from "lucide-react";

export function PostComposer({
  userId,
  defaultTag,
  defaultPlayer,
  parentPostId,
  placeholder = "What's happening in sports? Tag teams with $ARS, players with @LBJ…",
  onPosted,
}: {
  userId: string | null;
  defaultTag?: string;
  defaultPlayer?: string;
  parentPostId?: string;
  placeholder?: string;
  onPosted?: () => void;
}) {
  const initial = defaultTag ? `$${defaultTag} ` : defaultPlayer ? `@${defaultPlayer} ` : "";
  const [body, setBody] = useState(initial);
  const qc = useQueryClient();
  const max = 500;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(initial.length);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [fetchedSuggestions, setFetchedSuggestions] = useState<
    { symbol: string; name: string; league: string; kind: "team" | "player" }[]
  >([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Detect a $XX or @XX token immediately before the caret.
  const tokenMatch = (() => {
    const before = body.slice(0, caret);
    const m = before.match(/(?:^|\s)([$@])([A-Za-z0-9]{2,8})$/);
    if (!m) return null;
    return { kind: m[1] === "$" ? ("team" as const) : ("player" as const), query: m[2], start: caret - m[2].length - 1 };
  })();
  const suggestions = tokenMatch && !dismissed ? fetchedSuggestions : [];

  useEffect(() => {
    let ignore = false;
    if (!tokenMatch) {
      return;
    }
    const term = tokenMatch.query;
    (async () => {
      if (tokenMatch.kind === "team") {
        const { data } = await supabase
          .from("teams")
          .select("symbol,name,league")
          .or(`symbol.ilike.${term}%,name.ilike.%${term}%`)
          .limit(6);
        if (!ignore) {
          setFetchedSuggestions((data ?? []).map((t) => ({ ...t, kind: "team" as const })));
          setActiveIdx(0);
        }
      } else {
        const sb = supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              or: (f: string) => { limit: (n: number) => Promise<{ data: { symbol: string; name: string; team_symbol: string | null }[] | null }> };
            };
          };
        };
        const { data } = await sb
          .from("players")
          .select("symbol,name,team_symbol")
          .or(`symbol.ilike.${term}%,name.ilike.%${term}%`)
          .limit(6);
        if (!ignore) {
          setFetchedSuggestions((data ?? []).map((p) => ({ symbol: p.symbol, name: p.name, league: p.team_symbol ?? "", kind: "player" as const })));
          setActiveIdx(0);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [tokenMatch?.kind, tokenMatch?.query]);

  const applySuggestion = (s: { symbol: string; kind: "team" | "player" }) => {
    if (!tokenMatch) return;
    const prefix = s.kind === "team" ? "$" : "@";
    const before = body.slice(0, tokenMatch.start);
    const after = body.slice(caret);
    const insert = `${prefix}${s.symbol} `;
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
      const symbols = extractTeamSymbols(trimmed);
      if (symbols.length) {
        // Only insert tags for teams that exist.
        const { data: teams } = await supabase
          .from("teams")
          .select("symbol")
          .in("symbol", symbols);
        const valid = (teams ?? []).map((t) => ({ post_id: post.id, team_symbol: t.symbol }));
        if (valid.length) await supabase.from("post_teams").insert(valid);
      }
      const sb = supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => { in: (c: string, v: string[]) => Promise<{ data: { symbol: string }[] | null }> };
          insert: (v: unknown) => Promise<unknown>;
        };
      };
      const players = extractPlayerSymbols(trimmed);
      if (players.length) {
        const { data: found } = await sb.from("players").select("symbol").in("symbol", players);
        const valid = (found ?? []).map((p) => ({ post_id: post.id, player_symbol: p.symbol }));
        if (valid.length) await sb.from("post_players").insert(valid);
      }
    },
    onSuccess: () => {
      setBody(initial);
      setMediaFile(null);
      setMediaPreview(null);
      qc.invalidateQueries();
      toast.success(parentPostId ? "Reply posted" : "Posted");
      onPosted?.();
    },
    onError: (e: Error) => toast.error(e.message),
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
              <li key={`${s.kind}-${s.symbol}`}>
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
                    {s.kind === "team" ? "$" : "@"}
                    {s.symbol}
                  </span>
                  <span className="flex-1 truncate text-foreground">{s.name}</span>
                  {s.league && (
                    <span className="text-xs text-muted-foreground">{s.league}</span>
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