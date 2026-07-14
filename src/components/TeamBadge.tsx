import Link from "next/link";

export function TeamBadge({ symbol, name }: { symbol: string; name?: string }) {
  return (
    <Link
      href={`/team/${encodeURIComponent(symbol)}`}
      className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
      title={name}
    >
      ${symbol}
    </Link>
  );
}