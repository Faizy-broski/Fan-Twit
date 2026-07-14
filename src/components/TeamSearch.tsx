import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";

type TeamHit = { symbol: string; name: string; league: string; sport: string };

export function TeamSearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [fetchedHits, setFetchedHits] = useState<TeamHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const term = q.trim();
  const hits = term ? fetchedHits : [];

  const router = useRouter();

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!term) return;
    let ignore = false;
    (async () => {
      const { data } = await supabase
        .from("teams")
        .select("symbol,name,league,sport")
        .or(`name.ilike.%${term}%,symbol.ilike.%${term}%`)
        .limit(8);
      if (!ignore) setFetchedHits(data ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [term]);

  const go = (symbol: string) => {
    setQ("");
    onClose();
    router.push(`/team/${encodeURIComponent(symbol)}`);
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
            placeholder="Search teams (e.g. Arsenal, Lakers, $KC)"
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={onClose} aria-label="Close">
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1">
          {hits.length === 0 && q && (
            <li className="px-4 py-3 text-sm text-muted-foreground">No teams found.</li>
          )}
          {hits.map((t) => (
            <li key={t.symbol}>
              <button
                onClick={() => go(t.symbol)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    ${t.symbol}
                  </span>
                  <span className="text-sm text-foreground">{t.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{t.league}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function TeamSearch() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        aria-label="Search teams"
      >
        <Search className="size-5" />
      </button>
      <TeamSearchModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
