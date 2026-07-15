import { NextResponse } from "next/server";

import { getGameDetail } from "@/lib/highlightly.functions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const { id } = await params;
    const normalizedId = id.trim();

    if (!normalizedId) {
      return NextResponse.json(
        {
          message: "Game ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const game = await getGameDetail(normalizedId);

    if (!game) {
      return NextResponse.json(
        {
          message: "Game not found.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json(game, {
      headers: {
        "Cache-Control":
          "public, s-maxage=30, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("Failed to load game details:", error);

    return NextResponse.json(
      {
        message: "Failed to load game details.",
      },
      {
        status: 500,
      },
    );
  }
}