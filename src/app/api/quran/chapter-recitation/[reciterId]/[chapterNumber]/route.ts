import { NextResponse } from "next/server";
import { getChapterRecitation } from "@/lib/api/audio";
import { QuranApiError } from "@/lib/api/client";

interface RouteContext {
  params: Promise<{
    reciterId: string;
    chapterNumber: string;
  }>;
}

export async function GET(_: Request, context: RouteContext) {
  const { reciterId, chapterNumber } = await context.params;
  const reciter = Number(reciterId);
  const chapter = Number(chapterNumber);

  if (!Number.isInteger(reciter) || !Number.isInteger(chapter)) {
    return NextResponse.json(
      { error: "Invalid reciter or chapter number." },
      { status: 400 }
    );
  }

  try {
    const response = await getChapterRecitation(reciter, chapter);
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof QuranApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch chapter recitation." },
      { status: 500 }
    );
  }
}
