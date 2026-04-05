import { NextResponse } from "next/server";

import { getChapterRecitation } from "@/lib/api/audio";
import { QuranApiError } from "@/lib/api/client";

interface RouteContext {
  params: Promise<{
    reciterId: string;
    chapterNumber: string;
  }>;
}

function parseInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const { reciterId, chapterNumber } = await context.params;
  const parsedReciterId = parseInteger(reciterId);
  const parsedChapterNumber = parseInteger(chapterNumber);

  if (!parsedReciterId || !parsedChapterNumber) {
    return NextResponse.json(
      {
        message: "Invalid reciter or chapter number.",
        success: false,
        type: "invalid_request",
      },
      { status: 400 }
    );
  }

  try {
    const response = await getChapterRecitation(
      parsedReciterId,
      parsedChapterNumber
    );

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof QuranApiError) {
      return NextResponse.json(
        {
          message: error.message,
          success: false,
          type: error.type || "service_error",
        },
        { status: error.status }
      );
    }

    throw error;
  }
}
