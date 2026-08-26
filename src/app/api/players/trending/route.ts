import { NextResponse } from "next/server";

import { getTrendingScorers } from "@/lib/highlightly.functions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const scorers = await getTrendingScorers();

    return NextResponse.json(scorers, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to fetch trending players:", error);

    return NextResponse.json(
      {
        message: "Failed to fetch trending players",
      },
      {
        status: 500,
      },
    );
  }
}
