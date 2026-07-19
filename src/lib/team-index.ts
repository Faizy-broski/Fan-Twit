// Utilities for FanSport post tags: games and user mentions.

// Legacy $SYM / @SYM team+player tags. No longer creatable from the composer,
// kept only so posts written before that change keep rendering their chips.
export const TEAM_TAG_RE = /\$([A-Z][A-Z0-9]{1,5})\b/g;
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

// Games are tagged with #sport:matchId (e.g. "#football:12345"), inserted by
// the composer's game-search autocomplete rather than hand-typed.
export const GAME_TAG_RE = /#([a-z-]+:\d+)\b/g;
// Real usernames are lowercase [a-z0-9_], enforced by handle_new_user() —
// this is distinct from (and disjoint with) the uppercase PLAYER_TAG_RE.
export const MENTION_RE = /(?:^|\s)@([a-z][a-z0-9_]{1,19})\b/g;

export function extractGameIds(body: string): string[] {
  const set = new Set<string>();
  for (const m of body.matchAll(GAME_TAG_RE)) set.add(m[1]);
  return Array.from(set);
}

export function extractMentions(body: string): string[] {
  const set = new Set<string>();
  for (const m of body.matchAll(MENTION_RE)) set.add(m[1]);
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

// Time remaining until a future date (e.g. a game's kickoff), formatted as
// "1D 4H" / "4H 12M" / "12M 30S" depending on magnitude, per the largest
// two non-zero units — never raw seconds.
export function formatCountdown(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const totalSeconds = Math.max(0, Math.floor((d.getTime() - Date.now()) / 1000));

  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days >= 1) return `${days}D ${hours}H`;
  if (hours >= 1) return `${hours}H ${minutes}M`;
  return `${minutes}M ${seconds}S`;
}