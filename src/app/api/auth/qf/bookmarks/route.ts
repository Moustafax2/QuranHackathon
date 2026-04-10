import { NextRequest, NextResponse } from "next/server";
import { getUsableSession } from "@/lib/qf-user/session";
import {
  addUserBookmark,
  deleteUserBookmark,
  getUserBookmarks,
  QfUserApiError,
} from "@/lib/qf-user/user-api";

function unauthorized() {
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}

export async function GET() {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return unauthorized();
  }

  try {
    const bookmarks = await getUserBookmarks(session);
    return NextResponse.json(bookmarks, { headers: cookieCarrier.headers });
  } catch (error) {
    const status = error instanceof QfUserApiError ? error.status : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load bookmarks.",
      },
      { status, headers: cookieCarrier.headers }
    );
  }
}

export async function POST(request: NextRequest) {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as
    | { chapterId?: number; verseNumber?: number }
    | null;

  if (!body?.chapterId || !body.verseNumber) {
    return NextResponse.json({ error: "chapterId and verseNumber are required." }, { status: 400 });
  }

  try {
    const result = await addUserBookmark(session, body as { chapterId: number; verseNumber: number });
    return NextResponse.json(result, { headers: cookieCarrier.headers });
  } catch (error) {
    const status = error instanceof QfUserApiError ? error.status : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create bookmark.",
      },
      { status, headers: cookieCarrier.headers }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as { bookmarkId?: string } | null;
  if (!body?.bookmarkId) {
    return NextResponse.json({ error: "bookmarkId is required." }, { status: 400 });
  }

  try {
    const result = await deleteUserBookmark(session, body.bookmarkId);
    return NextResponse.json(result, { headers: cookieCarrier.headers });
  } catch (error) {
    const status = error instanceof QfUserApiError ? error.status : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete bookmark.",
      },
      { status, headers: cookieCarrier.headers }
    );
  }
}
