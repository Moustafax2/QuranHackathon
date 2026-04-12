import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createAdminClient,
  corsHeaders,
} from "../_shared/supabase-admin.ts";
import {
  maybeAdvanceGameAfterParticipantChange,
  reassignHostIfNeeded,
} from "../_shared/game-state.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { room_id, player_id } = await req.json() as {
      room_id?: string;
      player_id?: string;
    };

    if (!room_id || !player_id) {
      return new Response(
        JSON.stringify({ error: "room_id and player_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createAdminClient();

    const { data: room, error: roomError } = await admin
      .from("rooms")
      .select("id, status")
      .eq("id", room_id)
      .maybeSingle();

    if (roomError || !room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: membership, error: membershipError } = await admin
      .from("room_players")
      .select("status")
      .eq("room_id", room_id)
      .eq("player_id", player_id)
      .maybeSingle();

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: "Player is not in this room" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (membership.status === "left") {
      return new Response(
        JSON.stringify({ room_id, status: "left" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const leftAt = new Date().toISOString();

    const { error: leaveError } = await admin
      .from("room_players")
      .update({ status: "left", left_at: leftAt })
      .eq("room_id", room_id)
      .eq("player_id", player_id);

    if (leaveError) {
      return new Response(
        JSON.stringify({ error: leaveError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await reassignHostIfNeeded(admin, room_id, player_id);

    if (room.status === "in_progress") {
      const { data: activeGame } = await admin
        .from("games")
        .select("id")
        .eq("room_id", room_id)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeGame?.id) {
        await maybeAdvanceGameAfterParticipantChange(admin, activeGame.id);
      }
    }

    return new Response(
      JSON.stringify({ room_id, status: "left" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
