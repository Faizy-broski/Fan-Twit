import { useEffect, useState } from "react";
import { SPORT_CATEGORIES } from "@/lib/team-index";

export function CategoryBanner({
  active,
  onChange,
}: {
  active: string;
  onChange: (key: string) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="border-b border-border bg-gradient-to-r from-primary/5 via-background to-accent/40">
      <div className="flex items-center justify-between px-4 pt-3 text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider text-primary">Live feed</span>
        <time>
          {now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          {" · "}
          {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </time>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pt-2 pb-3">
        {SPORT_CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              active === c.key
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </nav>
    </div>
  );
}