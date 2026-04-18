import "server-only";

import type { Database } from "@/lib/supabase/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type {
  SocialRelationshipStatus,
  SocialUserSummary,
} from "./qf-users";

type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type FriendRow = Database["public"]["Tables"]["friends"]["Row"];

export interface LocalFriendDirectory {
  friends: SocialUserSummary[];
  incomingRequests: SocialUserSummary[];
  outgoingRequests: SocialUserSummary[];
}

function toSocialUserSummary(
  player: PlayerRow,
  relationshipStatus: SocialRelationshipStatus = "none"
): SocialUserSummary {
  return {
    id: player.quran_foundation_uid ?? player.id,
    username: null,
    displayName: player.display_name,
    bio: null,
    country: null,
    followed: relationshipStatus === "friend",
    verified: false,
    followersCount: 0,
    avatarUrl: player.avatar_url,
    relationshipStatus,
  };
}

function normalizeFriendPair(playerA: string, playerB: string) {
  return playerA < playerB
    ? { player_a: playerA, player_b: playerB }
    : { player_a: playerB, player_b: playerA };
}

function getCounterpartPlayerId(friendship: FriendRow, playerId: string) {
  return friendship.player_a === playerId ? friendship.player_b : friendship.player_a;
}

function getRelationshipStatus(
  friendship: FriendRow,
  currentPlayerId: string
): SocialRelationshipStatus {
  if (friendship.status === "accepted") {
    return "friend";
  }

  return friendship.requested_by === currentPlayerId
    ? "outgoing_request"
    : "incoming_request";
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

async function getFriendshipsForPlayer(playerId: string) {
  const supabase = createAdminSupabaseClient();
  const response = await supabase
    .from("friends")
    .select("*")
    .or(`player_a.eq.${playerId},player_b.eq.${playerId}`);

  if (response.error) {
    throw new Error(response.error.message);
  }

  return (response.data ?? []) as FriendRow[];
}

async function getFriendshipBetweenPlayers(playerId: string, targetPlayerId: string) {
  const pair = normalizeFriendPair(playerId, targetPlayerId);
  const supabase = createAdminSupabaseClient();
  const response = await supabase
    .from("friends")
    .select("*")
    .eq("player_a", pair.player_a)
    .eq("player_b", pair.player_b)
    .maybeSingle();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data as FriendRow | null;
}

async function resolveTargetPlayer(playerId: string, targetQfSub: string) {
  const targetPlayer = await getLinkedPlayerByQfSub(targetQfSub);
  if (!targetPlayer) {
    throw new Error("User not found.");
  }

  if (targetPlayer.id === playerId) {
    throw new Error("You cannot add yourself as a friend.");
  }

  return targetPlayer;
}

async function deleteFriendship(pair: { player_a: string; player_b: string }) {
  const supabase = createAdminSupabaseClient();
  const response = await supabase
    .from("friends")
    .delete()
    .eq("player_a", pair.player_a)
    .eq("player_b", pair.player_b);

  if (response.error) {
    throw new Error(response.error.message);
  }
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

export async function listLocalFriendDirectory(playerId: string): Promise<LocalFriendDirectory> {
  const friendships = await getFriendshipsForPlayer(playerId);
  const playersById = await getPlayersByIds(
    Array.from(new Set(friendships.map((friendship) => getCounterpartPlayerId(friendship, playerId))))
  );

  const directory: LocalFriendDirectory = {
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
  };

  for (const friendship of friendships) {
    const counterpartId = getCounterpartPlayerId(friendship, playerId);
    const player = playersById.get(counterpartId);
    if (!player || !player.quran_foundation_uid) {
      continue;
    }

    const summary = toSocialUserSummary(player, getRelationshipStatus(friendship, playerId));
    if (summary.relationshipStatus === "friend") {
      directory.friends.push(summary);
      continue;
    }

    if (summary.relationshipStatus === "incoming_request") {
      directory.incomingRequests.push(summary);
      continue;
    }

    directory.outgoingRequests.push(summary);
  }

  return directory;
}

export async function listAcceptedFriendQfUserIds(playerId: string) {
  const directory = await listLocalFriendDirectory(playerId);
  return new Set(
    directory.friends
      .map((friend) => friend.id)
      .filter((friendId) => Boolean(friendId))
  );
}

export async function searchLocalPlayers(
  query: string,
  currentPlayerId: string,
  limit = 8,
  options?: { friendsOnly?: boolean }
) {
  const supabase = createAdminSupabaseClient();
  const sanitizedQuery = query.replace(/[%_,]/g, " ").trim();
  const pattern = `%${sanitizedQuery}%`;
  const friendships = await getFriendshipsForPlayer(currentPlayerId);

  const relationshipByPlayerId = new Map<string, SocialRelationshipStatus>();
  for (const friendship of friendships) {
    relationshipByPlayerId.set(
      getCounterpartPlayerId(friendship, currentPlayerId),
      getRelationshipStatus(friendship, currentPlayerId)
    );
  }

  let playersQuery = supabase
    .from("players")
    .select("*")
    .not("quran_foundation_uid", "is", null)
    .neq("id", currentPlayerId)
    .or(`display_name.ilike.${pattern},qf_email.ilike.${pattern}`)
    .order("last_login_at", { ascending: false })
    .limit(limit);

  if (options?.friendsOnly) {
    const acceptedFriendIds = Array.from(relationshipByPlayerId.entries())
      .filter(([, status]) => status === "friend")
      .map(([playerId]) => playerId);

    if (!acceptedFriendIds.length) {
      return [] as SocialUserSummary[];
    }

    playersQuery = playersQuery.in("id", acceptedFriendIds);
  }

  const playersResponse = await playersQuery;
  if (playersResponse.error) {
    throw new Error(playersResponse.error.message);
  }

  return ((playersResponse.data ?? []) as PlayerRow[]).flatMap((player) => {
    if (!player.quran_foundation_uid) {
      return [];
    }

    return [
      toSocialUserSummary(
        player,
        relationshipByPlayerId.get(player.id) ?? "none"
      ),
    ];
  });
}

export async function requestLocalFriend(playerId: string, targetQfSub: string) {
  const targetPlayer = await resolveTargetPlayer(playerId, targetQfSub);
  const pair = normalizeFriendPair(playerId, targetPlayer.id);
  const existing = await getFriendshipBetweenPlayers(playerId, targetPlayer.id);
  const supabase = createAdminSupabaseClient();

  if (existing?.status === "accepted") {
    return {
      relationshipStatus: "friend" as const,
      targetPlayer,
    };
  }

  if (existing?.status === "pending") {
    if (existing.requested_by === playerId) {
      return {
        relationshipStatus: "outgoing_request" as const,
        targetPlayer,
      };
    }

    throw new Error("This user has already sent you a friend request.");
  }

  const response = await supabase
    .from("friends")
    .insert({
      ...pair,
      requested_by: playerId,
      status: "pending",
    })
    .select("*")
    .maybeSingle();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return {
    relationshipStatus: "outgoing_request" as const,
    targetPlayer,
  };
}

export async function acceptLocalFriend(playerId: string, targetQfSub: string) {
  const targetPlayer = await resolveTargetPlayer(playerId, targetQfSub);
  const pair = normalizeFriendPair(playerId, targetPlayer.id);
  const existing = await getFriendshipBetweenPlayers(playerId, targetPlayer.id);

  if (!existing || existing.status !== "pending" || existing.requested_by !== targetPlayer.id) {
    throw new Error("Friend request not found.");
  }

  const supabase = createAdminSupabaseClient();
  const response = await supabase
    .from("friends")
    .update({
      status: "accepted",
    })
    .eq("player_a", pair.player_a)
    .eq("player_b", pair.player_b)
    .select("*")
    .maybeSingle();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return {
    relationshipStatus: "friend" as const,
    targetPlayer,
  };
}

export async function declineLocalFriend(playerId: string, targetQfSub: string) {
  const targetPlayer = await resolveTargetPlayer(playerId, targetQfSub);
  const pair = normalizeFriendPair(playerId, targetPlayer.id);
  const existing = await getFriendshipBetweenPlayers(playerId, targetPlayer.id);

  if (!existing || existing.status !== "pending" || existing.requested_by !== targetPlayer.id) {
    throw new Error("Friend request not found.");
  }

  await deleteFriendship(pair);

  return {
    relationshipStatus: "none" as const,
    targetPlayer,
  };
}

export async function cancelLocalFriendRequest(playerId: string, targetQfSub: string) {
  const targetPlayer = await resolveTargetPlayer(playerId, targetQfSub);
  const pair = normalizeFriendPair(playerId, targetPlayer.id);
  const existing = await getFriendshipBetweenPlayers(playerId, targetPlayer.id);

  if (!existing || existing.status !== "pending" || existing.requested_by !== playerId) {
    throw new Error("Friend request not found.");
  }

  await deleteFriendship(pair);

  return {
    relationshipStatus: "none" as const,
    targetPlayer,
  };
}

export async function removeLocalFriend(playerId: string, targetQfSub: string) {
  const targetPlayer = await resolveTargetPlayer(playerId, targetQfSub);
  const pair = normalizeFriendPair(playerId, targetPlayer.id);
  const existing = await getFriendshipBetweenPlayers(playerId, targetPlayer.id);

  if (!existing) {
    return {
      relationshipStatus: "none" as const,
      targetPlayer,
    };
  }

  await deleteFriendship(pair);

  return {
    relationshipStatus: "none" as const,
    targetPlayer,
  };
}
