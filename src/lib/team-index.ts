// Utilities for the FanSport team index tags ($SYM tokens in post bodies).

// Match $SYMBOL tokens. Symbols are 2-5 uppercase alphanumerics.
export const TEAM_TAG_RE = /\$([A-Z][A-Z0-9]{1,5})\b/g;
// Players are tagged with @SYMBOL (uppercase 2-8 chars)
export const PLAYER_TAG_RE = /(?:^|\s)@([A-Z][A-Z0-9]{1,8})\b/g;

export function extractTeamSymbols(body: string): string[] {
  const set = new Set<string>();
  for (const m of body.matchAll(TEAM_TAG_RE)) set.add(m[1]);
  return Array.from(set);
}

export function extractPlayerSymbols(body: string): string[] {
  const set = new Set<string>();
  for (const m of body.matchAll(PLAYER_TAG_RE)) set.add(m[1]);
  return Array.from(set);
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
}

export const SPORT_CATEGORIES = [
  { key: "All", sport: null, label: "All" },
  { key: "Soccer", sport: "Soccer", label: "⚽ Soccer" },
  { key: "Basketball", sport: "Basketball", label: "🏀 NBA" },
  { key: "Football", sport: "Football", label: "🏈 NFL" },
  { key: "Baseball", sport: "Baseball", label: "⚾ MLB" },
  { key: "Hockey", sport: "Hockey", label: "🏒 NHL" },
  { key: "Tennis", sport: "Tennis", label: "🎾 Tennis" },
] as const;