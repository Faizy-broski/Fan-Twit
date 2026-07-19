import "server-only";

const DIRECT_BASE = "https://sports.highlightly.net";
const RAPIDAPI_BASE = "https://sport-highlights-api.p.rapidapi.com";
const RAPIDAPI_HOST = "sport-highlights-api.p.rapidapi.com";

type SportPath =
  | "football"
  | "basketball"
  | "american-football"
  | "baseball"
  | "hockey";

const SPORTS: {
  path: SportPath;
  label: string;
  leagueParam?: "league" | "leagueName";
  leagueValue?: string;
}[] = [
  { path: "football", label: "Football" },
  {
    path: "basketball",
    label: "Basketball",
    leagueParam: "leagueName",
    leagueValue: "NBA",
  },
  {
    path: "american-football",
    label: "American Football",
    leagueParam: "league",
    leagueValue: "NFL",
  },
  {
    path: "baseball",
    label: "Baseball",
    leagueParam: "league",
    leagueValue: "MLB",
  },
  {
    path: "hockey",
    label: "Hockey",
    leagueParam: "leagueName",
    leagueValue: "NHL",
  },
];

export type ExploreGame = {
  id: string;
  sport: string;
  league: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "live" | "upcoming" | "finished";
  progress: string | null;
  kickoff: string;
  thumb: string | null;
  venue: string | null;
  homeLogo: string | null;
  awayLogo: string | null;
};

export type GameDetail = ExploreGame & {
  description: string | null;
  season: string | null;
  round: string | null;
  homeBadge: string | null;
  awayBadge: string | null;
  stats: {
    name: string;
    home: string;
    away: string;
  }[];
};

type RawTeam = {
  id?: number | string;
  name?: string | null;
  logo?: string | null;
};

type RawLeague = {
  id?: number | string;
  name?: string | null;
  logo?: string | null;
  season?: number | string | null;
};

type RawVenue = {
  name?: string | null;
  city?: string | null;
};

type RawScore = {
  current?: string | null;
  penalties?: string | null;
};

type RawState = {
  description?: string | null;
  clock?: number | string | null;
  score?: RawScore | null;
};

type RawStatistic = {
  name?: string | null;
  home?: string | number | null;
  away?: string | number | null;
};

type RawMatch = {
  id: number | string;
  date?: string | null;
  round?: string | number | null;
  league?: RawLeague | null;
  homeTeam?: RawTeam | null;
  awayTeam?: RawTeam | null;
  state?: RawState | null;
  venue?: RawVenue | null;
  statistics?: RawStatistic[] | null;
};

const FINISHED_DESCRIPTIONS = [
  "finished",
  "finished after penalties",
  "finished after extra time",
  "cancelled",
  "postponed",
  "awarded",
];

const UPCOMING_DESCRIPTIONS = ["not started", "to be announced", "scheduled"];

const FEATURED_COMPETITION_KEYWORDS = [
  "fifa",
  "world cup",
  "nations league",
  "confederations cup",
];

export function isFeaturedCompetition(league: string): boolean {
  const value = league.toLowerCase();

  return FEATURED_COMPETITION_KEYWORDS.some((keyword) => value.includes(keyword));
}

function classify(state: RawState | null | undefined): "live" | "upcoming" | "finished" {
  const description = (state?.description ?? "").toLowerCase().trim();

  if (!description) {
    return "upcoming";
  }

  if (FINISHED_DESCRIPTIONS.some((value) => description.includes(value))) {
    return "finished";
  }

  if (UPCOMING_DESCRIPTIONS.some((value) => description.includes(value))) {
    return "upcoming";
  }

  return "live";
}

function parseScoreSide(current: string | null | undefined, side: "home" | "away"): number | null {
  if (!current) {
    return null;
  }

  const parts = current.split("-").map((part) => part.trim());
  const value = side === "home" ? parts[0] : parts[1];
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function toIso(date: string | null | undefined): string {
  if (date) {
    const timestamp = new Date(date);

    if (!Number.isNaN(timestamp.getTime())) {
      return timestamp.toISOString();
    }
  }

  return new Date().toISOString();
}

function normalize(match: RawMatch, sport: { path: SportPath; label: string }): ExploreGame {
  return {
    id: `${sport.path}:${match.id}`,
    sport: sport.label,
    league: match.league?.name ?? "",
    home: match.homeTeam?.name ?? "TBD",
    away: match.awayTeam?.name ?? "TBD",
    homeScore: parseScoreSide(match.state?.score?.current, "home"),
    awayScore: parseScoreSide(match.state?.score?.current, "away"),
    status: classify(match.state),
    progress: match.state?.description ?? null,
    kickoff: toIso(match.date),
    thumb: match.homeTeam?.logo ?? null,
    venue: match.venue?.name ?? null,
    homeLogo: match.homeTeam?.logo ?? null,
    awayLogo: match.awayTeam?.logo ?? null,
  };
}

function apiBase(): string {
  return process.env.RAPIDAPI_KEY ? RAPIDAPI_BASE : DIRECT_BASE;
}

function authHeaders(): Record<string, string> {
  const key = process.env.RAPIDAPI_KEY ?? process.env.HIGHLIGHTLY_API_KEY ?? "";

  const headers: Record<string, string> = {
    "x-rapidapi-key": key,
  };

  if (process.env.RAPIDAPI_KEY) {
    headers["x-rapidapi-host"] = RAPIDAPI_HOST;
  }

  return headers;
}

async function safeJson<T>(path: string, revalidate = 30): Promise<T | null> {
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      headers: {
        Accept: "application/json",
        ...authHeaders(),
      },
      next: {
        revalidate,
      },
    });

    if (!response.ok) {
      console.error(`Highlightly request failed: ${response.status} ${path}`);

      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error("Highlightly request failed:", error);

    return null;
  }
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Highlightly refreshes match data once a minute and rate-limits hard on
// most plans, so the raw fan-out (sports × days) is cached in-process. A
// failed/rate-limited refresh falls back to the last good result instead of
// clobbering the UI with an empty list.
const FRESH_TTL_MS = 60_000;
const STALE_TTL_MS = 15 * 60_000;

let cache: { data: ExploreGame[]; fetchedAt: number } | null = null;
let inflight: Promise<ExploreGame[]> | null = null;

async function fetchExploreGamesFromUpstream(): Promise<ExploreGame[]> {
  const now = Date.now();
  const oneDay = 86_400_000;

  const days = [ymd(new Date(now)), ymd(new Date(now + oneDay))];

  const requests = SPORTS.flatMap((sport) =>
    days.map(async (day) => {
      const searchParams = new URLSearchParams({ date: day });

      if (sport.leagueParam && sport.leagueValue) {
        searchParams.set(sport.leagueParam, sport.leagueValue);
      }

      const result = await safeJson<{ data: RawMatch[] | null }>(
        `/${sport.path}/matches?${searchParams.toString()}`,
        60,
      );

      return (result?.data ?? []).map((match) => normalize(match, sport));
    }),
  );

  const dayLists = await Promise.all(requests);

  const seen = new Set<string>();
  const games: ExploreGame[] = [];

  for (const list of dayLists) {
    for (const game of list) {
      if (seen.has(game.id)) {
        continue;
      }

      seen.add(game.id);
      games.push(game);
    }
  }

  const rank: Record<ExploreGame["status"], number> = {
    live: 0,
    upcoming: 1,
    finished: 2,
  };

  games.sort((a, b) => {
    const rankDifference = rank[a.status] - rank[b.status];

    if (rankDifference !== 0) {
      return rankDifference;
    }

    const featuredDifference =
      Number(isFeaturedCompetition(b.league)) - Number(isFeaturedCompetition(a.league));

    if (featuredDifference !== 0) {
      return featuredDifference;
    }

    return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
  });

  // Interleave by sport so a single sport with a lot of same-day fixtures
  // (e.g. lower football divisions) can't crowd the other sports — or
  // featured competitions like FIFA tournaments — out of the final cap.
  const bySport = new Map<string, ExploreGame[]>();

  for (const game of games) {
    const list = bySport.get(game.sport) ?? [];
    list.push(game);
    bySport.set(game.sport, list);
  }

  const perSportCap = 20;
  const buckets = Array.from(bySport.values()).map((list) => list.slice(0, perSportCap));
  const interleaved: ExploreGame[] = [];
  let index = 0;

  while (buckets.some((bucket) => index < bucket.length)) {
    for (const bucket of buckets) {
      if (index < bucket.length) {
        interleaved.push(bucket[index]);
      }
    }

    index += 1;
  }

  return interleaved.slice(0, 60);
}

export async function getExploreGames(): Promise<ExploreGame[]> {
  if (cache && Date.now() - cache.fetchedAt < FRESH_TTL_MS) {
    return cache.data;
  }

  // Coalesce concurrent callers (multiple requests hitting a cold cache at
  // once) into a single upstream fan-out instead of one each.
  if (!inflight) {
    inflight = fetchExploreGamesFromUpstream().finally(() => {
      inflight = null;
    });
  }

  const fresh = await inflight;

  if (fresh.length > 0) {
    cache = { data: fresh, fetchedAt: Date.now() };

    return fresh;
  }

  // Upstream returned nothing — likely rate-limited or a transient outage
  // rather than an actual empty schedule. Prefer serving the last good
  // result over flashing "no games" while it's still reasonably fresh.
  if (cache && Date.now() - cache.fetchedAt < STALE_TTL_MS) {
    return cache.data;
  }

  cache = { data: fresh, fetchedAt: Date.now() };

  return fresh;
}

export async function getFifaGames(): Promise<ExploreGame[]> {
  const games = await getExploreGames();

  return games.filter((game) => isFeaturedCompetition(game.league));
}

// Same rationale as the explore-list cache: Highlightly rate-limits single-game
// lookups too, and without a fallback a transient 429 turns straight into a
// "game not found" 404 for the user instead of just serving slightly-stale data.
const detailCache = new Map<string, { data: GameDetail; fetchedAt: number }>();

export async function getGameDetail(id: string): Promise<GameDetail | null> {
  const normalizedId = id.trim();

  if (!normalizedId) {
    return null;
  }

  const [sportPath, matchId] = normalizedId.split(":");
  const sport = SPORTS.find((entry) => entry.path === sportPath);

  if (!sport || !matchId) {
    return null;
  }

  const raw = await safeJson<RawMatch | RawMatch[]>(
    `/${sport.path}/matches/${encodeURIComponent(matchId)}`,
    30,
  );

  const match = Array.isArray(raw) ? raw[0] : raw;

  if (!match) {
    const cached = detailCache.get(normalizedId);

    if (cached && Date.now() - cached.fetchedAt < STALE_TTL_MS) {
      return cached.data;
    }

    return null;
  }

  const detail: GameDetail = {
    ...normalize(match, sport),
    description: null,
    season: match.league?.season ? String(match.league.season) : null,
    round: match.round ? String(match.round) : null,
    homeBadge: match.homeTeam?.logo ?? null,
    awayBadge: match.awayTeam?.logo ?? null,
    stats: (match.statistics ?? []).map((stat) => ({
      name: stat.name ?? "",
      home: stat.home !== null && stat.home !== undefined ? String(stat.home) : "-",
      away: stat.away !== null && stat.away !== undefined ? String(stat.away) : "-",
    })),
  };

  detailCache.set(normalizedId, { data: detail, fetchedAt: Date.now() });

  return detail;
}
