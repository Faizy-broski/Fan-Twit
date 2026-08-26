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
  // Composite `${sportPath}:${teamId}` ids (same shape as `id` above) for
  // each side, when the upstream match payload includes them — lets team
  // search resolve a name match here straight to a real team detail page.
  homeTeamId: string | null;
  awayTeamId: string | null;
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

// The match-detail endpoint returns stats grouped by team, not as flat
// {name, home, away} rows: [{ team: {id, name, ...}, statistics: [{value,
// displayName}] }, { team: {...other side}, statistics: [...] }].
type RawStatisticEntry = {
  value?: number | string | null;
  displayName?: string | null;
};

type RawTeamStatistics = {
  team?: { id?: number | string | null } | null;
  statistics?: RawStatisticEntry[] | null;
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
  statistics?: RawTeamStatistics[] | null;
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
    league: (match.league?.name ?? "").trim(),
    home: (match.homeTeam?.name ?? "").trim() || "TBD",
    away: (match.awayTeam?.name ?? "").trim() || "TBD",
    homeScore: parseScoreSide(match.state?.score?.current, "home"),
    awayScore: parseScoreSide(match.state?.score?.current, "away"),
    status: classify(match.state),
    progress: match.state?.description ?? null,
    kickoff: toIso(match.date),
    thumb: match.homeTeam?.logo ?? null,
    venue: (match.venue?.name ?? "").trim() || null,
    homeLogo: match.homeTeam?.logo ?? null,
    awayLogo: match.awayTeam?.logo ?? null,
    homeTeamId:
      match.homeTeam?.id !== undefined ? teamId(sport.path, match.homeTeam.id) : null,
    awayTeamId:
      match.awayTeam?.id !== undefined ? teamId(sport.path, match.awayTeam.id) : null,
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

      return (result?.data ?? [])
        .map((match) => normalize(match, sport))
        // Some fixtures come back with neither team assigned yet (e.g. an
        // unresolved playoff slot) — they render as blank rows in the UI,
        // so drop them instead of showing an empty card.
        .filter((game) => game.home !== "TBD" || game.away !== "TBD");
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

export type TrendingScorer = {
  key: string;
  name: string;
  sport: string;
  team: string;
  teamLogo: string | null;
  gameId: string;
  goals: number;
  playerId: string | null;
};

type RawPlayerListItem = {
  id?: number | string;
  name?: string | null;
  fullName?: string | null;
  logo?: string | null;
};

// Goal events don't always carry a playerId (only some do — see
// getTrendingScorers), so a name search against /players?name= resolves one
// when needed, preferring an exact fullName match over the first hit.
async function resolvePlayerId(sportPath: SportPath, name: string): Promise<string | null> {
  const result = await safeJson<{ data: RawPlayerListItem[] | null } | RawPlayerListItem[]>(
    `/${sportPath}/players?${new URLSearchParams({ name }).toString()}`,
    300,
  );

  const rows = Array.isArray(result) ? result : result?.data ?? [];
  const exact = rows.find(
    (row) => row.fullName?.toLowerCase() === name.toLowerCase(),
  );
  const match = exact ?? rows[0];

  return match?.id !== undefined ? `${sportPath}:${match.id}` : null;
}

type RawMatchEvent = {
  team?: { name?: string | null; logo?: string | null } | null;
  type?: string | null;
  player?: string | null;
  playerId?: number | string | null;
};

// "Trending players" has no live signal of its own to rank by — the old
// community $PLAYER tagging it used to read from was retired from the
// composer (see team-index.ts) — so it's derived from real goal events in
// currently-live matches instead. Only football's /events endpoint exists
// in this API tier (basketball/hockey/american-football all 404 on it), so
// this is football-only.
export async function getTrendingScorers(): Promise<TrendingScorer[]> {
  const games = await getExploreGames();
  const liveFootball = games
    .filter((game) => game.status === "live" && game.sport === "Football")
    .slice(0, 15);

  const eventLists = await Promise.all(
    liveFootball.map(async (game) => {
      const matchId = game.id.split(":")[1];
      const events = await safeJson<RawMatchEvent[]>(`/football/events/${encodeURIComponent(matchId)}`, 30);

      return (events ?? []).map((event) => ({ event, gameId: game.id }));
    }),
  );

  const byPlayer = new Map<string, TrendingScorer>();

  for (const { event, gameId } of eventLists.flat()) {
    if (event.type !== "Goal" || !event.player || !event.team?.name) {
      continue;
    }

    const key = `${event.team.name}:${event.player}`;
    const existing = byPlayer.get(key);

    if (existing) {
      existing.goals += 1;
      existing.playerId = existing.playerId ?? (event.playerId !== undefined && event.playerId !== null
        ? `football:${event.playerId}`
        : null);
    } else {
      byPlayer.set(key, {
        key,
        name: event.player,
        sport: "Football",
        team: event.team.name,
        teamLogo: event.team.logo ?? null,
        gameId,
        goals: 1,
        playerId:
          event.playerId !== undefined && event.playerId !== null
            ? `football:${event.playerId}`
            : null,
      });
    }
  }

  const top = Array.from(byPlayer.values())
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 8);

  // Events don't always carry a playerId — resolve the rest by name search,
  // but only for the players actually being shown, to keep this bounded.
  await Promise.all(
    top.map(async (scorer) => {
      if (!scorer.playerId) {
        scorer.playerId = await resolvePlayerId("football", scorer.name);
      }
    }),
  );

  return top;
}

export type TeamSummary = {
  id: string;
  sport: string;
  name: string;
  logo: string | null;
  type: string | null;
};

export type TeamSeasonStats = {
  leagueId: string;
  leagueName: string;
  season: string;
  total: { played: number | null; wins: number | null; draws: number | null; losses: number | null; goalsFor: number | null; goalsAgainst: number | null };
  home: { played: number | null; wins: number | null; draws: number | null; losses: number | null; goalsFor: number | null; goalsAgainst: number | null };
  away: { played: number | null; wins: number | null; draws: number | null; losses: number | null; goalsFor: number | null; goalsAgainst: number | null };
};

export type TeamDetail = TeamSummary & {
  seasonStats: TeamSeasonStats[];
};

type RawTeamListItem = {
  id?: number | string;
  name?: string | null;
  logo?: string | null;
  type?: string | null;
};

function teamId(sport: SportPath, rawId: number | string): string {
  return `${sport}:${rawId}`;
}

// Highlightly's /teams?name= filter is an exact match, not a prefix/substring
// search ("arsena" returns nothing, only the complete word "arsenal" does),
// so it can't power an as-you-type search on its own — typing a couple of
// letters would always show "No teams found" until the full name was typed.
// Substring-matching against the already-cached live/upcoming games list
// covers that (free, instant, real partial matches for anything currently
// scheduled); the exact-name upstream lookup is layered on top so a full
// team name still reaches the entire library, not just what's playing today.
function searchTeamsFromExploreGames(games: ExploreGame[], term: string): TeamSummary[] {
  const q = term.toLowerCase();
  const byId = new Map<string, TeamSummary>();

  for (const game of games) {
    const sides = [
      { name: game.home, id: game.homeTeamId, logo: game.homeLogo },
      { name: game.away, id: game.awayTeamId, logo: game.awayLogo },
    ];

    for (const side of sides) {
      if (!side.id || !side.name || side.name === "TBD") continue;
      if (!side.name.toLowerCase().includes(q)) continue;

      if (!byId.has(side.id)) {
        byId.set(side.id, {
          id: side.id,
          sport: game.sport,
          name: side.name,
          logo: side.logo,
          type: null,
        });
      }
    }
  }

  return Array.from(byId.values());
}

// Team search fans out across every supported sport (there's no single
// cross-sport search endpoint), same shape as the explore-games fan-out.
export async function searchTeams(query: string): Promise<TeamSummary[]> {
  const term = query.trim();

  if (!term) {
    return [];
  }

  const [games, exactMatchLists] = await Promise.all([
    getExploreGames(),
    Promise.all(
      SPORTS.map(async (sport) => {
        // Not every sport's /teams endpoint accepts the same query params —
        // baseball and american-football 400 on `limit` ("property limit
        // should not exist") even though football/basketball/hockey accept
        // it fine, so it's left off entirely and capped after merging.
        const searchParams = new URLSearchParams({ name: term });
        const result = await safeJson<{ data: RawTeamListItem[] | null } | RawTeamListItem[]>(
          `/${sport.path}/teams?${searchParams.toString()}`,
          120,
        );

        const rows = Array.isArray(result) ? result : result?.data ?? [];

        return rows
          .filter((row) => row.id !== undefined && row.name)
          .slice(0, 8)
          .map((row) => ({
            id: teamId(sport.path, row.id as number | string),
            sport: sport.label,
            name: row.name as string,
            logo: row.logo ?? null,
            type: row.type ?? null,
          }));
      }),
    ),
  ]);

  const merged = new Map<string, TeamSummary>();

  for (const t of searchTeamsFromExploreGames(games, term)) {
    merged.set(t.id, t);
  }

  for (const t of exactMatchLists.flat()) {
    if (!merged.has(t.id)) merged.set(t.id, t);
  }

  return Array.from(merged.values()).slice(0, 40);
}

type RawTeamStatsSplit = {
  games?: { played?: number | null; wins?: number | null; loses?: number | null; draws?: number | null } | null;
  goals?: { scored?: number | null; received?: number | null } | null;
};

type RawTeamStatsEntry = {
  leagueId?: number | string | null;
  leagueName?: string | null;
  season?: number | string | null;
  total?: RawTeamStatsSplit | null;
  home?: RawTeamStatsSplit | null;
  away?: RawTeamStatsSplit | null;
};

function normalizeStatsSplit(split: RawTeamStatsSplit | null | undefined) {
  return {
    played: split?.games?.played ?? null,
    wins: split?.games?.wins ?? null,
    draws: split?.games?.draws ?? null,
    losses: split?.games?.loses ?? null,
    goalsFor: split?.goals?.scored ?? null,
    goalsAgainst: split?.goals?.received ?? null,
  };
}

export async function getTeamDetail(compositeId: string): Promise<TeamDetail | null> {
  const normalizedId = compositeId.trim();
  const [sportPath, rawId] = normalizedId.split(":");
  const sport = SPORTS.find((entry) => entry.path === sportPath);

  if (!sport || !rawId) {
    return null;
  }

  const rawTeam = await safeJson<RawTeamListItem | RawTeamListItem[]>(
    `/${sport.path}/teams/${encodeURIComponent(rawId)}`,
    300,
  );
  const team = Array.isArray(rawTeam) ? rawTeam[0] : rawTeam;

  if (!team || team.id === undefined) {
    return null;
  }

  const fromDate = ymd(new Date(Date.now() - 365 * 86_400_000));
  const statsResult = await safeJson<RawTeamStatsEntry[] | { data: RawTeamStatsEntry[] | null }>(
    `/${sport.path}/teams/statistics/${encodeURIComponent(rawId)}?fromDate=${fromDate}`,
    300,
  );
  const statsRows = Array.isArray(statsResult) ? statsResult : statsResult?.data ?? [];

  // A team can carry a dozen+ rows (every cup/friendly it played in, across
  // seasons) — surface the most relevant ones: most recent season first,
  // then the competitions it's played the most games in.
  const sortedStats = [...statsRows].sort((a, b) => {
    const seasonDiff = Number(b.season ?? 0) - Number(a.season ?? 0);
    if (seasonDiff !== 0) return seasonDiff;
    return (b.total?.games?.played ?? 0) - (a.total?.games?.played ?? 0);
  });

  return {
    id: teamId(sport.path, team.id),
    sport: sport.label,
    name: team.name ?? "Unknown team",
    logo: team.logo ?? null,
    type: team.type ?? null,
    seasonStats: sortedStats.slice(0, 8).map((row) => ({
      leagueId: String(row.leagueId ?? ""),
      leagueName: row.leagueName ?? "",
      season: String(row.season ?? ""),
      total: normalizeStatsSplit(row.total),
      home: normalizeStatsSplit(row.home),
      away: normalizeStatsSplit(row.away),
    })),
  };
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

  const homeGroup = match.statistics?.find(
    (group) => group.team?.id !== undefined && group.team?.id === match.homeTeam?.id,
  );
  const awayGroup = match.statistics?.find(
    (group) => group.team?.id !== undefined && group.team?.id === match.awayTeam?.id,
  );
  const awayByName = new Map(
    (awayGroup?.statistics ?? []).map((entry) => [entry.displayName ?? "", entry.value]),
  );

  const detail: GameDetail = {
    ...normalize(match, sport),
    description: null,
    season: match.league?.season ? String(match.league.season) : null,
    round: match.round ? String(match.round) : null,
    homeBadge: match.homeTeam?.logo ?? null,
    awayBadge: match.awayTeam?.logo ?? null,
    stats: (homeGroup?.statistics ?? [])
      .filter((entry) => entry.displayName)
      .map((entry) => {
        const homeValue = entry.value;
        const awayValue = awayByName.get(entry.displayName ?? "");

        return {
          name: entry.displayName ?? "",
          home: homeValue !== null && homeValue !== undefined ? String(homeValue) : "-",
          away: awayValue !== null && awayValue !== undefined ? String(awayValue) : "-",
        };
      }),
  };

  detailCache.set(normalizedId, { data: detail, fetchedAt: Date.now() });

  return detail;
}

export type PlayerSummary = {
  id: string;
  sport: string;
  name: string;
  fullName: string | null;
  logo: string | null;
  club: string | null;
  position: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  citizenship: string | null;
  height: string | null;
  foot: string | null;
};

export type PlayerSeasonStats = {
  club: string;
  league: string;
  season: string;
  gamesPlayed: number | null;
  goals: number | null;
  assists: number | null;
  minutesPlayed: number | null;
  yellowCards: number | null;
  redCards: number | null;
};

export type PlayerDetail = PlayerSummary & {
  seasonStats: PlayerSeasonStats[];
};

type RawPlayerDetailItem = {
  id?: number | string;
  name?: string | null;
  fullName?: string | null;
  logo?: string | null;
  profile?: {
    club?: { current?: string | null } | null;
    position?: { main?: string | null } | null;
    birthDate?: string | null;
    birthPlace?: string | null;
    citizenship?: string | null;
    height?: string | null;
    foot?: string | null;
  } | null;
};

type RawPlayerStatsEntry = {
  club?: string | null;
  league?: string | null;
  season?: string | number | null;
  gamesPlayed?: number | null;
  goals?: number | null;
  assists?: number | null;
  minutesPlayed?: number | null;
  yellowCards?: number | null;
  redCards?: number | null;
};

// Only football exposes /players — /players, /players/{id}, and
// /players/{id}/statistics all 404 for the other sports in this API tier
// (same as the events endpoint getTrendingScorers depends on), so player
// detail is football-only for now.
export async function getPlayerDetail(compositeId: string): Promise<PlayerDetail | null> {
  const normalizedId = compositeId.trim();
  const [sportPath, rawId] = normalizedId.split(":");

  if (sportPath !== "football" || !rawId) {
    return null;
  }

  const rawPlayer = await safeJson<RawPlayerDetailItem | RawPlayerDetailItem[]>(
    `/football/players/${encodeURIComponent(rawId)}`,
    300,
  );
  const player = Array.isArray(rawPlayer) ? rawPlayer[0] : rawPlayer;

  if (!player || player.id === undefined) {
    return null;
  }

  const rawStats = await safeJson<
    ({ perCompetition?: RawPlayerStatsEntry[] | null } | RawPlayerStatsEntry[])[]
    | { perCompetition?: RawPlayerStatsEntry[] | null }
  >(`/football/players/${encodeURIComponent(rawId)}/statistics`, 300);

  const statsRoot = Array.isArray(rawStats) ? rawStats[0] : rawStats;
  const statsRows =
    statsRoot && "perCompetition" in statsRoot ? statsRoot.perCompetition ?? [] : [];

  const sortedStats = [...statsRows].sort((a, b) => {
    const seasonDiff = Number(b.season ?? 0) - Number(a.season ?? 0);
    if (seasonDiff !== 0) return seasonDiff;
    return (b.gamesPlayed ?? 0) - (a.gamesPlayed ?? 0);
  });

  return {
    id: `football:${player.id}`,
    sport: "Football",
    name: player.name ?? player.fullName ?? "Unknown player",
    fullName: player.fullName ?? null,
    logo: player.logo ?? null,
    club: player.profile?.club?.current ?? null,
    position: player.profile?.position?.main ?? null,
    birthDate: player.profile?.birthDate ?? null,
    birthPlace: player.profile?.birthPlace ?? null,
    citizenship: player.profile?.citizenship ?? null,
    height: player.profile?.height ?? null,
    foot: player.profile?.foot ?? null,
    seasonStats: sortedStats.slice(0, 8).map((row) => ({
      club: row.club ?? "",
      league: row.league ?? "",
      season: String(row.season ?? ""),
      gamesPlayed: row.gamesPlayed ?? null,
      goals: row.goals ?? null,
      assists: row.assists ?? null,
      minutesPlayed: row.minutesPlayed ?? null,
      yellowCards: row.yellowCards ?? null,
      redCards: row.redCards ?? null,
    })),
  };
}
