import { NextResponse } from "next/server";

import { getTeamDetail } from "@/lib/highlightly.functions";

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
          message: "Team ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const team = await getTeamDetail(normalizedId);

    if (!team) {
      return NextResponse.json(
        {
          message: "Team not found.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json(team, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Failed to load team details:", error);

    return NextResponse.json(
      {
        message: "Failed to load team details.",
      },
      {
        status: 500,
      },
    );
  }
}
