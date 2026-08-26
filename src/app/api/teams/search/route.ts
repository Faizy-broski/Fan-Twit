import { NextResponse } from "next/server";

import { searchTeams } from "@/lib/highlightly.functions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";

    const teams = await searchTeams(query);

    return NextResponse.json(teams, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to search teams:", error);

    return NextResponse.json(
      {
        message: "Failed to search teams",
      },
      {
        status: 500,
      },
    );
  }
}
