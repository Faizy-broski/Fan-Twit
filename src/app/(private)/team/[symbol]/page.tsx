import type { Metadata } from "next";

import { TeamThread } from "./team-thread";
import { TeamDetail } from "./team-detail";

type TeamPageProps = {
  params: Promise<{
    symbol: string;
  }>;
};

// Team search links here with a live composite id ("football:529", matching
// the same `${sportPath}:${id}` convention as /game/[id]) sourced straight
// from the Highlightly API. Older posts still carry the legacy short $SYMBOL
// tags (e.g. "ARS") from the retired team-tagging feature — those keep
// rendering the community thread they always have.
function isLiveTeamId(value: string): boolean {
  return /^[a-z-]+:[a-zA-Z0-9]+$/.test(value);
}

export async function generateMetadata({
  params,
}: TeamPageProps): Promise<Metadata> {
  const { symbol } = await params;
  const decoded = decodeURIComponent(symbol);

  if (isLiveTeamId(decoded)) {
    return {
      title: "Team — FanSport",
      description: "Team info and season stats on FanSport.",
    };
  }

  const normalizedSymbol = decoded.toUpperCase();

  return {
    title: `$${normalizedSymbol} — FanSport team thread`,
    description: `All FanSport posts tagged $${normalizedSymbol}.`,
  };
}

export default async function TeamPage({
  params,
}: TeamPageProps) {
  const { symbol } = await params;
  const decoded = decodeURIComponent(symbol);

  if (isLiveTeamId(decoded)) {
    return <TeamDetail id={decoded} />;
  }

  return <TeamThread symbol={decoded.toUpperCase()} />;
}
