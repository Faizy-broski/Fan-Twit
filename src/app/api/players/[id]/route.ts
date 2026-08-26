import { NextResponse } from "next/server";

import { getPlayerDetail } from "@/lib/highlightly.functions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const normalizedId = id.trim();

    if (!normalizedId) {
      return NextResponse.json(
        {
          message: "Player ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const player = await getPlayerDetail(normalizedId);

    if (!player) {
      return NextResponse.json(
        {
          message: "Player not found.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json(player, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Failed to load player details:", error);

    return NextResponse.json(
      {
        message: "Failed to load player details.",
      },
      {
        status: 500,
      },
    );
  }
}
