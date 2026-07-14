import "server-only";

const BASE = "https://www.thesportsdb.com/api/v1/json/3";

const SPORTS = [
  "Soccer",
  "Basketball",
  "American_Football",
  "Baseball",
  "Ice_Hockey",
  "Tennis",
  "Motorsport",
] as const;

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

type RawEvent = {
  idEvent: string;
  strEvent?: string | null;
  strSport?: string | null;
  strLeague?: string | null;
  strHomeTeam?: string | null;
  strAwayTeam?: string | null;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strStatus?: string | null;
  strProgress?: string | null;
  strPostponed?: string | null;
  dateEvent?: string | null;
  strTime?: string | null;
  strTimestamp?: string | null;
  strThumb?: string | null;
  strVenue?: string | null;
};

type RawDetailedEvent = RawEvent & {
  strDescriptionEN?: string | null;
  strSeason?: string | null;
  intRound?: string | null;
  strHomeTeamBadge?: string | null;
  strAwayTeamBadge?: string | null;
};

type RawStat = {
  strStat: string;
  intHome: string | null;
  intAway: string | null;
};

function toIso(event: RawEvent): string {
  if (event.strTimestamp) {
    const timestamp = new Date(event.strTimestamp);

    if (!Number.isNaN(timestamp.getTime())) {
      return timestamp.toISOString();
    }
  }

  if (event.dateEvent) {
    const time =
      event.strTime && event.strTime !== "00:00:00"
        ? event.strTime
        : "00:00:00";

    const timestamp = new Date(`${event.dateEvent}T${time}Z`);

    if (!Number.isNaN(timestamp.getTime())) {
      return timestamp.toISOString();
    }
  }

  return new Date().toISOString();
}

function classify(
  event: RawEvent,
): "live" | "upcoming" | "finished" {
  const status = (event.strStatus ?? "").toLowerCase();
  const progress = (event.strProgress ?? "").toLowerCase();

  const finishedStatuses = [
    "ft",
    "aet",
    "pen",
    "finished",
    "match finished",
    "full time",
  ];

  if (
    finishedStatuses.some((value) => status.includes(value))
  ) {
    return "finished";
  }

  const liveStatuses = [
    "1h",
    "2h",
    "ht",
    "live",
    "in play",
  ];

  if (
    progress ||
    liveStatuses.some((value) => status.includes(value))
  ) {
    return "live";
  }

  const kickoff = new Date(toIso(event)).getTime();
  const now = Date.now();

  if (kickoff > now) {
    return "upcoming";
  }

  const hasScores =
    event.intHomeScore !== null &&
    event.intHomeScore !== undefined &&
    event.intHomeScore !== "";

  const matchWindow = 3.5 * 60 * 60 * 1000;

  if (now - kickoff <= matchWindow) {
    return hasScores ? "live" : "live";
  }

  return "finished";
}

function parseScore(value?: string | null): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const score = Number(value);

  return Number.isFinite(score) ? score : null;
}

function normalize(event: RawEvent): ExploreGame {
  return {
    id: event.idEvent,
    sport: (event.strSport ?? "").replaceAll("_", " "),
    league: event.strLeague ?? "",
    home: event.strHomeTeam ?? "TBD",
    away: event.strAwayTeam ?? "TBD",
    homeScore: parseScore(event.intHomeScore),
    awayScore: parseScore(event.intAwayScore),
    status: classify(event),
    progress: event.strProgress ?? event.strStatus ?? null,
    kickoff: toIso(event),
    thumb: event.strThumb ?? null,
    venue: event.strVenue ?? null,
  };
}

async function safeJson<T>(
  url: string,
  revalidate = 30,
): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      next: {
        revalidate,
      },
    });

    if (!response.ok) {
      console.error(
        `TheSportsDB request failed: ${response.status} ${url}`,
      );

      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error("TheSportsDB request failed:", error);

    return null;
  }
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getExploreGames(): Promise<
  ExploreGame[]
> {
  const now = Date.now();
  const oneDay = 86_400_000;

  const days = [
    ymd(new Date(now - oneDay)),
    ymd(new Date(now)),
    ymd(new Date(now + oneDay)),
    ymd(new Date(now + 2 * oneDay)),
  ];

  const requests = SPORTS.flatMap((sport) =>
    days.map(async (day) => {
      const searchParams = new URLSearchParams({
        d: day,
        s: sport,
      });

      const result = await safeJson<{
        events: RawEvent[] | null;
      }>(
        `${BASE}/eventsday.php?${searchParams.toString()}`,
        30,
      );

      return result?.events ?? [];
    }),
  );

  const dayLists = await Promise.all(requests);

  const seen = new Set<string>();
  const games: ExploreGame[] = [];

  for (const list of dayLists) {
    for (const rawEvent of list) {
      if (
        !rawEvent?.idEvent ||
        seen.has(rawEvent.idEvent)
      ) {
        continue;
      }

      seen.add(rawEvent.idEvent);
      games.push(normalize(rawEvent));
    }
  }

  const rank: Record<ExploreGame["status"], number> = {
    live: 0,
    upcoming: 1,
    finished: 2,
  };

  games.sort((a, b) => {
    const rankDifference =
      rank[a.status] - rank[b.status];

    if (rankDifference !== 0) {
      return rankDifference;
    }

    return (
      new Date(a.kickoff).getTime() -
      new Date(b.kickoff).getTime()
    );
  });

  return games.slice(0, 60);
}

export async function getGameDetail(
  id: string,
): Promise<GameDetail | null> {
  const normalizedId = id.trim();

  if (!normalizedId) {
    return null;
  }

  const encodedId = encodeURIComponent(normalizedId);

  const [lookup, statsResponse] = await Promise.all([
    safeJson<{
      events: RawDetailedEvent[] | null;
    }>(
      `${BASE}/lookupevent.php?id=${encodedId}`,
      30,
    ),
    safeJson<{
      eventstats: RawStat[] | null;
    }>(
      `${BASE}/lookupeventstats.php?id=${encodedId}`,
      30,
    ),
  ]);

  const event = lookup?.events?.[0];

  if (!event) {
    return null;
  }

  return {
    ...normalize(event),
    description: event.strDescriptionEN ?? null,
    season: event.strSeason ?? null,
    round: event.intRound ?? null,
    homeBadge: event.strHomeTeamBadge ?? null,
    awayBadge: event.strAwayTeamBadge ?? null,
    stats: (statsResponse?.eventstats ?? []).map(
      (stat) => ({
        name: stat.strStat,
        home: stat.intHome ?? "-",
        away: stat.intAway ?? "-",
      }),
    ),
  };
}