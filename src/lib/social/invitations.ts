import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type GameInvitationRow = Database["public"]["Tables"]["game_invitations"]["Row"];
type GameInvitationInsert = Database["public"]["Tables"]["game_invitations"]["Insert"];
type RoomSummary = {
  id: string;
  code: string;
  status: Database["public"]["Tables"]["rooms"]["Row"]["status"];
  host_id: string;
  game_mode: Database["public"]["Tables"]["rooms"]["Row"]["game_mode"];
};
type PlayerSummary = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  quran_foundation_uid: string | null;
};

type IncomingInvitationRow = {
  id: string;
  status: GameInvitationRow["status"];
  created_at: string;
  responded_at: string | null;
  room_id: string;
  inviter_player_id: string;
};

type OutgoingInvitationRow = {
  id: string;
  status: GameInvitationRow["status"];
  created_at: string;
  responded_at: string | null;
  invitee_qf_user_id: string;
  invitee_display_name: string;
  invitee_username: string | null;
  invitee_avatar_url: string | null;
  room_id: string;
};

export interface InvitationRecipientInput {
  qfUserId: string;
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
}

export interface IncomingInvitation {
  id: string;
  status: GameInvitationRow["status"];
  created_at: string;
  responded_at: string | null;
  room: RoomSummary;
  inviter: PlayerSummary;
}

export interface OutgoingInvitation {
  id: string;
  status: GameInvitationRow["status"];
  created_at: string;
  responded_at: string | null;
  room: RoomSummary;
  invitee: {
    qf_user_id: string;
    display_name: string;
    username: string | null;
    avatar_url: string | null;
  };
}

export async function createGameInvitations(input: {
  roomId: string;
  inviterPlayerId: string;
  recipients: InvitationRecipientInput[];
}) {
  if (!input.recipients.length) {
    return [];
  }

  const supabase = createAdminSupabaseClient();
  const rows: GameInvitationInsert[] = input.recipients.map((recipient) => ({
    room_id: input.roomId,
    inviter_player_id: input.inviterPlayerId,
    invitee_qf_user_id: recipient.qfUserId,
    invitee_display_name: recipient.displayName,
    invitee_username: recipient.username ?? null,
    invitee_avatar_url: recipient.avatarUrl ?? null,
    status: "pending",
    responded_at: null,
  }));

  const { data, error } = await supabase
    .from("game_invitations")
    .upsert(rows, {
      onConflict: "room_id,invitee_qf_user_id",
      ignoreDuplicates: false,
    })
    .select("*");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function getRoomsById(roomIds: string[]) {
  if (!roomIds.length) {
    return new Map<string, RoomSummary>();
  }

  const supabase = createAdminSupabaseClient();
  const response = await supabase
    .from("rooms")
    .select("id, code, status, host_id, game_mode")
    .in("id", roomIds);

  if (response.error) {
    throw new Error(response.error.message);
  }

  return new Map(((response.data ?? []) as RoomSummary[]).map((room) => [room.id, room]));
}

async function getPlayersById(playerIds: string[]) {
  if (!playerIds.length) {
    return new Map<string, PlayerSummary>();
  }

  const supabase = createAdminSupabaseClient();
  const response = await supabase
    .from("players")
    .select("id, display_name, avatar_url, quran_foundation_uid")
    .in("id", playerIds);

  if (response.error) {
    throw new Error(response.error.message);
  }

  return new Map(((response.data ?? []) as PlayerSummary[]).map((player) => [player.id, player]));
}

async function deleteInvitationsByIds(invitationIds: string[]) {
  if (!invitationIds.length) {
    return;
  }

  const supabase = createAdminSupabaseClient();
  const response = await supabase
    .from("game_invitations")
    .delete()
    .in("id", invitationIds);

  if (response.error) {
    throw new Error(response.error.message);
  }
}

export async function deleteInvitationById(invitationId: string) {
  await deleteInvitationsByIds([invitationId]);
}

export async function listIncomingInvitationsForQfUser(qfUserId: string) {
  const supabase = createAdminSupabaseClient();
  const response = await supabase
    .from("game_invitations")
    .select("id, status, created_at, responded_at, room_id, inviter_player_id")
    .eq("invitee_qf_user_id", qfUserId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (response.error) {
    throw new Error(response.error.message);
  }

  const rows = (response.data ?? []) as IncomingInvitationRow[];
  if (!rows.length) {
    return [] as IncomingInvitation[];
  }

  const [roomsById, playersById] = await Promise.all([
    getRoomsById(Array.from(new Set(rows.map((row) => row.room_id)))),
    getPlayersById(Array.from(new Set(rows.map((row) => row.inviter_player_id)))),
  ]);

  const staleIds: string[] = [];
  const invitations: IncomingInvitation[] = [];

  for (const row of rows) {
    const room = roomsById.get(row.room_id);
    const inviter = playersById.get(row.inviter_player_id);

    if (!room || room.status !== "lobby" || !inviter) {
      staleIds.push(row.id);
      continue;
    }

    invitations.push({
      id: row.id,
      status: row.status,
      created_at: row.created_at,
      responded_at: row.responded_at,
      room,
      inviter,
    });
  }

  await deleteInvitationsByIds(staleIds);
  return invitations;
}

export async function listOutgoingInvitationsForPlayer(playerId: string) {
  const supabase = createAdminSupabaseClient();
  const response = await supabase
    .from("game_invitations")
    .select(`
      id,
      status,
      created_at,
      responded_at,
      invitee_qf_user_id,
      invitee_display_name,
      invitee_username,
      invitee_avatar_url,
      room_id
    `)
    .eq("inviter_player_id", playerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (response.error) {
    throw new Error(response.error.message);
  }

  const rows = (response.data ?? []) as OutgoingInvitationRow[];
  if (!rows.length) {
    return [] as OutgoingInvitation[];
  }

  const roomsById = await getRoomsById(Array.from(new Set(rows.map((row) => row.room_id))));
  const staleIds: string[] = [];
  const invitations: OutgoingInvitation[] = [];

  for (const row of rows) {
    const room = roomsById.get(row.room_id);
    if (!room || room.status !== "lobby") {
      staleIds.push(row.id);
      continue;
    }

    invitations.push({
      id: row.id,
      status: row.status,
      created_at: row.created_at,
      responded_at: row.responded_at,
      room,
      invitee: {
        qf_user_id: row.invitee_qf_user_id,
        display_name: row.invitee_display_name,
        username: row.invitee_username,
        avatar_url: row.invitee_avatar_url,
      },
    });
  }

  await deleteInvitationsByIds(staleIds);
  return invitations;
}

export async function getInvitationById(invitationId: string) {
  const supabase = createAdminSupabaseClient();
  const response = await supabase
    .from("game_invitations")
    .select("*")
    .eq("id", invitationId)
    .maybeSingle();

  if (response.error) {
    throw new Error(response.error.message);
  }

  const invitation = response.data as GameInvitationRow | null;
  if (!invitation) {
    return null;
  }

  const roomsById = await getRoomsById([invitation.room_id]);
  const room = roomsById.get(invitation.room_id);
  if (!room) {
    return null;
  }

  return {
    ...invitation,
    rooms: room,
  };
}
