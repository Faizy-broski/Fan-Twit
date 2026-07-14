import type { Metadata } from "next";

import { TeamThread } from "./team-thread";

type TeamPageProps = {
  params: Promise<{
    symbol: string;
  }>;
};

export async function generateMetadata({
  params,
}: TeamPageProps): Promise<Metadata> {
  const { symbol } = await params;
  const normalizedSymbol = decodeURIComponent(symbol).toUpperCase();

  return {
    title: `$${normalizedSymbol} — FanTwit team thread`,
    description: `All FanTwit posts tagged $${normalizedSymbol}.`,
  };
}

export default async function TeamPage({
  params,
}: TeamPageProps) {
  const { symbol } = await params;

  return (
    <TeamThread
      symbol={decodeURIComponent(symbol).toUpperCase()}
    />
  );
}