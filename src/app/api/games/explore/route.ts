import { NextResponse } from "next/server";

import {
  getExploreGames,
  type ExploreGame,
} from "@/lib/highlightly.functions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const games: ExploreGame[] = await getExploreGames();

    return NextResponse.json(games, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to fetch explore games:", error);

    return NextResponse.json(
      {
        message: "Failed to fetch explore games",
      },
      {
        status: 500,
      },
    );
  }
}