import { NextRequest, NextResponse } from "next/server";
import { getUsableSession } from "@/lib/qf-user/session";
import { searchLocalPlayers } from "@/lib/social/friends";

function unauthorized() {
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return unauthorized();
  }

  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("limit") ?? "8"), 1),
    10
  );
  const page = Math.max(Number(request.nextUrl.searchParams.get("page") ?? "1"), 1);

  if (query.length < 2) {
    return NextResponse.json(
      {
        total: 0,
        currentPage: 1,
        limit,
        pages: 0,
        data: [],
      },
      { headers: cookieCarrier.headers }
    );
  }

  try {
    const results = await searchLocalPlayers(query, session.player_id, limit);

    return NextResponse.json(
      {
        total: results.length,
        currentPage: page,
        limit,
        pages: 1,
        data: results,
      },
      { headers: cookieCarrier.headers }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to search users.",
      },
      { status: 500, headers: cookieCarrier.headers }
    );
  }
}
