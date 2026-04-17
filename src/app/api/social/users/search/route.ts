import { NextRequest, NextResponse } from "next/server";
import { getUsableSession } from "@/lib/qf-user/session";
import { QfUserApiError, searchQfUsers } from "@/lib/qf-user/user-api";
import { serializeSocialUser } from "@/lib/social/qf-users";

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
    const result = await searchQfUsers(session, {
      query,
      limit,
      page,
      all: true,
    });

    return NextResponse.json(
      {
        ...result,
        data: result.data.map(serializeSocialUser),
      },
      { headers: cookieCarrier.headers }
    );
  } catch (error) {
    const status = error instanceof QfUserApiError ? error.status : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to search users.",
      },
      { status, headers: cookieCarrier.headers }
    );
  }
}
