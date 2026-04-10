import { NextResponse } from "next/server";
import { resolvePlayerId } from "@/lib/multiplayer/resolve-player";
import { invokeSupabaseEdgeFunction } from "@/lib/multiplayer/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { generateQuestions, resolveSurahPool } from "@/lib/game/question-generator";

export async function POST(request: Request) {
  const cookieCarrier = new NextResponse();

  try {
    const playerId = await resolvePlayerId(request, cookieCarrier.cookies);
    if (!playerId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { room_id?: string } | null;
    if (!body?.room_id) {
      return NextResponse.json({ error: "room_id is required." }, { status: 400 });
    }

    // Read room settings in Next.js so question generation hot-reloads in dev
    const supabase = createAdminSupabaseClient();
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("game_mode, settings")
      .eq("id", body.room_id)
      .single();

    if (roomError || !room) {
      console.error("[start-game] room lookup failed:", roomError);
      return NextResponse.json({ error: "Room not found." }, { status: 404, headers: cookieCarrier.headers });
    }

    const settings = room.settings as {
      num_rounds?: number;
      game_modes?: string[];
      scope?: string;
      surah_filter?: number[] | null;
      juz_filter?: number[] | null;
    } | null;

    const numRounds = settings?.num_rounds ?? 10;
    const gameModes: string[] =
      settings?.game_modes?.length ? settings.game_modes : [room.game_mode];
    const surahFilter = resolveSurahPool(settings ?? {});

    console.log("[start-game] generating", numRounds, "questions, modes:", gameModes, "surahFilter length:", surahFilter?.length ?? "all");

    const questions = await generateQuestions(numRounds, gameModes, surahFilter);

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "Could not generate questions for the selected scope and modes." },
        { status: 400, headers: cookieCarrier.headers }
      );
    }

    console.log("[start-game] generated", questions.length, "questions, calling edge function");

    const data = await invokeSupabaseEdgeFunction<{ game_id: string; total_rounds: number }>(
      "start-game",
      { room_id: body.room_id, player_id: playerId, questions }
    );

    return NextResponse.json(data, { headers: cookieCarrier.headers });

  } catch (err) {
    console.error("[start-game] unhandled error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start game." },
      { status: 500, headers: cookieCarrier.headers }
    );
  }
}
