"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

type TeamHit = {
  id: string;
  sport: string;
  name: string;
  logo: string | null;
  type: string | null;
};

/** Debounced team lookup against /api/teams/search. */
function useTeamSearch(term: string) {
  const [hits, setHits] = useState<TeamHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!term) {
      setHits([]);
      setFailed(false);
      setLoading(false);
      return;
    }

    let ignore = false;
    setLoading(true);
    setFailed(false);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/teams/search?q=${encodeURIComponent(term)}`);
        if (ignore) return;
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as TeamHit[];
        if (!ignore) setHits(data);
      } catch {
        if (!ignore) {
          setHits([]);
          setFailed(true);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }, 300);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [term]);

  return { hits, loading, failed };
}

function TeamResultList({
  term,
  hits,
  loading,
  failed,
  onPick,
}: {
  term: string;
  hits: TeamHit[];
  loading: boolean;
  failed: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <ul className="max-h-80 overflow-y-auto py-1">
      {term && loading && (
        <li className="px-4 py-3 text-sm text-muted-foreground">Searching…</li>
      )}
      {term && !loading && failed && (
        <li className="px-4 py-3 text-sm text-muted-foreground">
          Teams could not be loaded.
        </li>
      )}
      {term && !loading && !failed && hits.length === 0 && (
        <li className="px-4 py-3 text-sm text-muted-foreground">No teams found.</li>
      )}
      {!loading &&
        !failed &&
        hits.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => onPick(t.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 hover:bg-accent"
            >
              <div className="flex min-w-0 items-center gap-3">
                {t.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.logo}
                    alt=""
                    className="size-6 shrink-0 rounded-full bg-muted object-contain"
                  />
                ) : null}
                <span className="truncate text-sm text-foreground">{t.name}</span>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{t.sport}</span>
            </button>
          </li>
        ))}
    </ul>
  );
}

export function TeamSearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const term = q.trim();
  const { hits, loading, failed } = useTeamSearch(term);

  const router = useRouter();

  useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const go = (id: string) => {
    setQ("");
    onClose();
    router.push(`/team/${encodeURIComponent(id)}`);
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-auto mt-24 w-[92%] max-w-xl rounded-xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search teams (e.g. Arsenal, Lakers)"
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={onClose} aria-label="Close">
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>
        <TeamResultList
          term={term}
          hits={hits}
          loading={loading}
          failed={failed}
          onPick={go}
        />
      </div>
    </div>
  );
}

/**
 * Inline search field that expands within the mobile header: the search icon
 * turns into this full-width input, with a close button that restores the
 * previous (branded) header. Results drop down beneath the header — there is
 * no full-screen overlay.
 */
export function TeamSearchInline({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const term = q.trim();
  const { hits, loading, failed } = useTeamSearch(term);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const go = (id: string) => {
    setQ("");
    onClose();
    router.push(`/team/${encodeURIComponent(id)}`);
  };

  return (
    <div className="relative flex flex-1 items-center gap-2">
      <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-muted/40 px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          placeholder="Search teams (e.g. Arsenal, Lakers)"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close search"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <X className="size-5" />
      </button>

      {term && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 rounded-xl border border-border bg-background shadow-2xl">
          <TeamResultList
            term={term}
            hits={hits}
            loading={loading}
            failed={failed}
            onPick={go}
          />
        </div>
      )}
    </div>
  );
}

export function TeamSearch({ variant = "icon" }: { variant?: "icon" | "bar" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "bar" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/70"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 text-left">Search teams</span>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label="Search teams"
        >
          <Search className="size-5" />
        </button>
      )}
      <TeamSearchModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
