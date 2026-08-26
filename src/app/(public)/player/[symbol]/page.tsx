import type { Metadata } from "next";

import { PlayerThread } from "./player-thread";
import { PlayerDetail } from "./player-detail";

type PlayerPageProps = {
  params: Promise<{
    symbol: string;
  }>;
};

// Trending players links here with a live composite id ("football:23614024",
// matching the same `${sportPath}:${id}` convention as /game/[id] and
// /team/[symbol]) sourced straight from the Highlightly API. Older posts
// still carry the legacy short @SYMBOL tags from the retired player-tagging
// feature — those keep rendering the community thread they always have.
function isLivePlayerId(value: string): boolean {
  return /^[a-z-]+:[a-zA-Z0-9]+$/.test(value);
}

export async function generateMetadata({
  params,
}: PlayerPageProps): Promise<Metadata> {
  const { symbol } = await params;
  const decoded = decodeURIComponent(symbol);

  if (isLivePlayerId(decoded)) {
    return {
      title: "Player — FanSport",
      description: "Player info and season stats on FanSport.",
    };
  }

  const normalizedSymbol = decoded.toUpperCase();

  return {
    title: `@${normalizedSymbol} — FanSport player thread`,
    description: `All FanSport posts tagging @${normalizedSymbol}.`,
  };
}

export default async function PlayerPage({
  params,
}: PlayerPageProps) {
  const { symbol } = await params;
  const decoded = decodeURIComponent(symbol);

  if (isLivePlayerId(decoded)) {
    return <PlayerDetail id={decoded} />;
  }

  return <PlayerThread symbol={decoded.toUpperCase()} />;
}
