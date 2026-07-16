import { NextResponse } from "next/server";

import {
  getFifaGames,
  type ExploreGame,
} from "@/lib/highlightly.functions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const games: ExploreGame[] = await getFifaGames();

    return NextResponse.json(games, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to fetch FIFA games:", error);

    return NextResponse.json(
      {
        message: "Failed to fetch FIFA games",
      },
      {
        status: 500,
      },
    );
  }
}
