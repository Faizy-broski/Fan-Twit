import type { Metadata } from "next";

import { PlayerThread } from "./player-thread";

type PlayerPageProps = {
  params: Promise<{
    symbol: string;
  }>;
};

export async function generateMetadata({
  params,
}: PlayerPageProps): Promise<Metadata> {
  const { symbol } = await params;
  const normalizedSymbol = decodeURIComponent(symbol).toUpperCase();

  return {
    title: `@${normalizedSymbol} — FanTwit player thread`,
    description: `All FanTwit posts tagging @${normalizedSymbol}.`,
  };
}

export default async function PlayerPage({
  params,
}: PlayerPageProps) {
  const { symbol } = await params;
  const normalizedSymbol = decodeURIComponent(symbol).toUpperCase();

  return <PlayerThread symbol={normalizedSymbol} />;
}