import "server-only";

import type { Database } from "@/lib/supabase/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { SocialUserSummary } from "./qf-users";

type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type FriendRow = Database["public"]["Tables"]["friends"]["Row"];

function toSocialUserSummary(player: PlayerRow, followed = false): SocialUserSummary {
  return {
    id: player.quran_foundation_uid ?? player.id,
    username: null,
    displayName: player.display_name,
    bio: null,
    country: null,
    followed,
    verified: false,
    followersCount: 0,
    avatarUrl: player.avatar_url,
  };
}

function normalizeFriendPair(playerA: string, playerB: string) {
  return playerA < playerB
    ? { player_a: playerA, player_b: playerB }
    : { player_a: playerB, player_b: playerA };
}

async function getPlayersByIds(playerIds: string[]) {
  if (!playerIds.length) {
    return new Map<string, PlayerRow>();
  }

  const supabase = createAdminSupabaseClient();
  const response = await supabase
    .from("players")
    .select("*")
    .in("id", playerIds);

  if (response.error) {
    throw new Error(response.error.message);
  }

  return new Map(((response.data ?? []) as PlayerRow[]).map((player) => [player.id, player]));
}

export async function getLinkedPlayerByQfSub(qfSub: string) {
  const supabase = createAdminSupabaseClient();
  const response = await supabase
    .from("players")
    .select("*")
    .eq("quran_foundation_uid", qfSub)
    .maybeSingle();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data as PlayerRow | null;
}

export async function listLocalFriends(playerId: string) {
  const supabase = createAdminSupabaseClient();
  const response = await supabase
    .from("friends")
    .select("*")
    .eq("status", "accepted")
    .or(`player_a.eq.${playerId},player_b.eq.${playerId}`);

  if (response.error) {
    throw new Error(response.error.message);
  }

  const friendships = (response.data ?? []) as FriendRow[];
  const friendIds = friendships.map((friendship) =>
    friendship.player_a === playerId ? friendship.player_b : friendship.player_a
  );
  const playersById = await getPlayersByIds(friendIds);

  return friendIds.flatMap((friendId) => {
    const player = playersById.get(friendId);
    if (!player || !player.quran_foundation_uid) {
      return [];
    }

    return [toSocialUserSummary(player, true)];
  });
}

export async function searchLocalPlayers(query: string, currentPlayerId: string, limit = 8) {
  const supabase = createAdminSupabaseClient();
  const sanitizedQuery = query.replace(/[%_,]/g, " ").trim();
  const pattern = `%${sanitizedQuery}%`;

  const [playersResponse, friendsResponse] = await Promise.all([
    supabase
      .from("players")
      .select("*")
      .not("quran_foundation_uid", "is", null)
      .neq("id", currentPlayerId)
      .or(`display_name.ilike.${pattern},qf_email.ilike.${pattern}`)
      .order("last_login_at", { ascending: false })
      .limit(limit),
    supabase
      .from("friends")
      .select("*")
      .eq("status", "accepted")
      .or(`player_a.eq.${currentPlayerId},player_b.eq.${currentPlayerId}`),
  ]);

  if (playersResponse.error) {
    throw new Error(playersResponse.error.message);
  }

  if (friendsResponse.error) {
    throw new Error(friendsResponse.error.message);
  }

  const friendPlayerIds = new Set<string>();
  for (const friendship of (friendsResponse.data ?? []) as FriendRow[]) {
    friendPlayerIds.add(
      friendship.player_a === currentPlayerId ? friendship.player_b : friendship.player_a
    );
  }

  return ((playersResponse.data ?? []) as PlayerRow[]).flatMap((player) => {
    if (!player.quran_foundation_uid) {
      return [];
    }

    return [toSocialUserSummary(player, friendPlayerIds.has(player.id))];
  });
}

export async function addLocalFriend(playerId: string, targetQfSub: string) {
  const targetPlayer = await getLinkedPlayerByQfSub(targetQfSub);
  if (!targetPlayer) {
    throw new Error("User not found.");
  }

  if (targetPlayer.id === playerId) {
    throw new Error("You cannot add yourself as a friend.");
  }

  const pair = normalizeFriendPair(playerId, targetPlayer.id);
  const supabase = createAdminSupabaseClient();
  const response = await supabase
    .from("friends")
    .upsert(
      {
        ...pair,
        status: "accepted",
      },
      {
        onConflict: "player_a,player_b",
        ignoreDuplicates: false,
      }
    )
    .select("*")
    .maybeSingle();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return {
    followed: true,
    targetPlayer,
  };
}

export async function removeLocalFriend(playerId: string, targetQfSub: string) {
  const targetPlayer = await getLinkedPlayerByQfSub(targetQfSub);
  if (!targetPlayer) {
    throw new Error("User not found.");
  }

  const pair = normalizeFriendPair(playerId, targetPlayer.id);
  const supabase = createAdminSupabaseClient();
  const response = await supabase
    .from("friends")
    .delete()
    .eq("player_a", pair.player_a)
    .eq("player_b", pair.player_b);

  if (response.error) {
    throw new Error(response.error.message);
  }

  return {
    followed: false,
    targetPlayer,
  };
}
