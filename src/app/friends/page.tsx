"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import type { SocialUserSummary } from "@/lib/social/qf-users";

interface FriendsResponse {
  profile: SocialUserSummary;
  total: number;
  data: SocialUserSummary[];
  error?: string;
}

interface SearchResponse {
  data: SocialUserSummary[];
  error?: string;
}

interface InvitationItem {
  id: string;
  status: "pending" | "accepted" | "declined" | "revoked";
  created_at: string;
  responded_at: string | null;
  room: {
    id: string;
    code: string;
    status: "lobby" | "in_progress" | "finished";
    host_id: string;
    game_mode: string;
  };
}

interface IncomingInvitation extends InvitationItem {
  inviter: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    quran_foundation_uid: string | null;
  };
}

interface OutgoingInvitation extends InvitationItem {
  invitee: {
    qf_user_id: string;
    display_name: string;
    username: string | null;
    avatar_url: string | null;
  };
}

interface InvitationsResponse {
  incoming: IncomingInvitation[];
  outgoing: OutgoingInvitation[];
  error?: string;
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function FriendsPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [friends, setFriends] = useState<SocialUserSummary[]>([]);
  const [searchResults, setSearchResults] = useState<SocialUserSummary[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<IncomingInvitation[]>([]);
  const [outgoingInvites, setOutgoingInvites] = useState<OutgoingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [isPending, startTransition] = useTransition();

  async function loadPageData() {
    setLoading(true);
    setError(null);

    try {
      const [friendsResponse, invitationsResponse] = await Promise.all([
        fetch("/api/social/friends", { cache: "no-store" }),
        fetch("/api/social/invitations", { cache: "no-store" }),
      ]);

      const friendsPayload = (await friendsResponse.json().catch(() => null)) as FriendsResponse | null;
      const invitationsPayload = (await invitationsResponse.json().catch(() => null)) as InvitationsResponse | null;

      if (!friendsResponse.ok) {
        throw new Error(friendsPayload?.error ?? "Failed to load friends.");
      }

      if (!invitationsResponse.ok) {
        throw new Error(invitationsPayload?.error ?? "Failed to load invitations.");
      }

      setFriends(friendsPayload?.data ?? []);
      setIncomingInvites(invitationsPayload?.incoming ?? []);
      setOutgoingInvites(invitationsPayload?.outgoing ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load social features.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setLoading(false);
      return;
    }

    void loadPageData();
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || deferredQuery.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();

    async function searchUsers() {
      setSearchLoading(true);
      setSearchError(null);

      try {
        const response = await fetch(
          `/api/social/users/search?query=${encodeURIComponent(deferredQuery)}&limit=8`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const payload = (await response.json().catch(() => null)) as SearchResponse | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to search users.");
        }
        if (payload?.error) {
          setSearchError(payload.error);
        }
        setSearchResults(payload?.data ?? []);
      } catch (searchLoadError) {
        if ((searchLoadError as Error).name === "AbortError") {
          return;
        }
        setSearchResults([]);
        setSearchError(
          searchLoadError instanceof Error ? searchLoadError.message : "Failed to search users."
        );
      } finally {
        setSearchLoading(false);
      }
    }

    void searchUsers();

    return () => controller.abort();
  }, [deferredQuery, isAuthenticated]);

  async function toggleFollow(user: SocialUserSummary, action: "follow" | "unfollow") {
    setSearchError(null);

    const previousFriends = friends;
    const previousSearch = searchResults;

    if (action === "follow") {
      setFriends((current) =>
        current.some((friend) => friend.id === user.id) ? current : [user, ...current]
      );
    } else {
      setFriends((current) => current.filter((friend) => friend.id !== user.id));
    }

    setSearchResults((current) =>
      current.map((candidate) =>
        candidate.id === user.id
          ? { ...candidate, followed: action === "follow" }
          : candidate
      )
    );

    try {
      const response = await fetch(`/api/social/friends/${encodeURIComponent(user.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json().catch(() => null)) as { followed?: boolean; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update follow status.");
      }

      if (payload?.followed === false) {
        setFriends((current) => current.filter((friend) => friend.id !== user.id));
      }
    } catch (toggleError) {
      setFriends(previousFriends);
      setSearchResults(previousSearch);
      setSearchError(toggleError instanceof Error ? toggleError.message : "Failed to update follow status.");
    }
  }

  function respondToInvite(invitationId: string, action: "accept" | "decline") {
    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/social/invitations/${invitationId}/${action}`, {
            method: "POST",
          });
          const payload = (await response.json().catch(() => null)) as
            | { success?: boolean; roomCode?: string; error?: string }
            | null;

          if (!response.ok) {
            throw new Error(payload?.error ?? `Failed to ${action} invitation.`);
          }

          if (action === "accept" && payload?.roomCode) {
            router.push(`/play/${payload.roomCode}`);
            return;
          }

          await loadPageData();
        } catch (inviteError) {
          setError(inviteError instanceof Error ? inviteError.message : `Failed to ${action} invitation.`);
        }
      })();
    });
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 text-white">
        <p className="text-gray-400">Loading social features...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-white">
        <h1 className="text-3xl font-bold">Friends</h1>
        <p className="mt-3 text-gray-400">
          Sign in with Quran.com to search users, follow friends, and respond to game invites.
        </p>
        <Link
          href="/login?next=/friends"
          className="mt-6 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Friends</h1>
            <p className="mt-2 max-w-2xl text-gray-400">
              Search Quran.com users, follow them into your friends list, and manage multiplayer invitations in one place.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3 text-sm text-gray-400">
            {friends.length} friend{friends.length === 1 ? "" : "s"} tracked
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Search Users</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Results appear as you type. Follow someone to add them to your in-app friends list.
                  </p>
                </div>
              </div>

              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or username..."
                className="mt-4 w-full rounded-2xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-colors focus:border-emerald-500"
              />

              {searchError && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {searchError}
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/40">
                {deferredQuery.length < 2 ? (
                  <p className="px-4 py-4 text-sm text-gray-500">
                    Type at least 2 characters to search Quran.com users.
                  </p>
                ) : searchLoading ? (
                  <p className="px-4 py-4 text-sm text-gray-500">Searching users...</p>
                ) : searchResults.length > 0 ? (
                  <div className="divide-y divide-gray-800">
                    {searchResults.map((user) => {
                      const isFriend = friends.some((friend) => friend.id === user.id) || user.followed;
                      return (
                        <div
                          key={user.id}
                          className="flex items-center justify-between gap-4 px-4 py-4"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-white">
                                {user.displayName}
                              </p>
                              {user.verified && (
                                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
                                  Verified
                                </span>
                              )}
                            </div>
                            <p className="truncate text-xs text-gray-500">
                              {user.username ? `@${user.username}` : "Quran.com user"}
                            </p>
                            {user.bio && (
                              <p className="mt-1 text-xs text-gray-400">{user.bio}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => void toggleFollow(user, isFriend ? "unfollow" : "follow")}
                            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                              isFriend
                                ? "border border-gray-700 text-gray-300 hover:border-red-400 hover:text-red-300"
                                : "bg-emerald-600 text-white hover:bg-emerald-500"
                            }`}
                          >
                            {isFriend ? "Remove" : "Add Friend"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-4 py-4 text-sm text-gray-500">No users matched your search.</p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Your Friends</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    This list reflects the users you currently follow through Quran Foundation.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {loading ? (
                  <p className="text-sm text-gray-500">Loading friends...</p>
                ) : friends.length > 0 ? (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-gray-800 bg-gray-950/40 px-4 py-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">
                            {friend.displayName}
                          </p>
                          {friend.verified && (
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
                              Verified
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-gray-500">
                          {friend.username ? `@${friend.username}` : "Quran.com user"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void toggleFollow(friend, "unfollow")}
                        className="shrink-0 rounded-xl border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:border-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-gray-800 px-4 py-6 text-sm text-gray-500">
                    You haven&apos;t added any friends yet. Search above to start building your list.
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="text-lg font-semibold">Incoming Invites</h2>
              <p className="mt-1 text-sm text-gray-500">
                Accept to jump straight into the room lobby.
              </p>

              <div className="mt-4 space-y-3">
                {incomingInvites.length > 0 ? (
                  incomingInvites.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="rounded-2xl border border-gray-800 bg-gray-950/40 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {invitation.inviter.display_name} invited you
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Room {invitation.room.code} • {invitation.room.game_mode}
                          </p>
                          <p className="mt-2 text-xs text-gray-600">
                            Sent {formatRelativeDate(invitation.created_at)}
                          </p>
                        </div>
                        <span className="rounded-full border border-gray-700 px-2.5 py-1 text-[10px] uppercase tracking-wider text-gray-400">
                          {invitation.status}
                        </span>
                      </div>

                      <div className="mt-4 flex gap-3">
                        <button
                          type="button"
                          onClick={() => respondToInvite(invitation.id, "accept")}
                          disabled={isPending}
                          className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
                        >
                          Join Lobby
                        </button>
                        <button
                          type="button"
                          onClick={() => respondToInvite(invitation.id, "decline")}
                          disabled={isPending}
                          className="rounded-xl border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white disabled:opacity-60"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-gray-800 px-4 py-6 text-sm text-gray-500">
                    No incoming game invitations right now.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="text-lg font-semibold">Sent Invites</h2>
              <p className="mt-1 text-sm text-gray-500">
                Keep an eye on who has already accepted or declined your latest room invites.
              </p>

              <div className="mt-4 space-y-3">
                {outgoingInvites.length > 0 ? (
                  outgoingInvites.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="rounded-2xl border border-gray-800 bg-gray-950/40 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {invitation.invitee.display_name}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Room {invitation.room.code}
                            {invitation.invitee.username ? ` • @${invitation.invitee.username}` : ""}
                          </p>
                          <p className="mt-2 text-xs text-gray-600">
                            Sent {formatRelativeDate(invitation.created_at)}
                          </p>
                        </div>
                        <span className="rounded-full border border-gray-700 px-2.5 py-1 text-[10px] uppercase tracking-wider text-gray-400">
                          {invitation.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-gray-800 px-4 py-6 text-sm text-gray-500">
                    You haven&apos;t sent any game invites yet.
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
