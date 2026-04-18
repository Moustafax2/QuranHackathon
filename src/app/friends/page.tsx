"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import type {
  SocialRelationshipStatus,
  SocialUserSummary,
} from "@/lib/social/qf-users";

interface FriendsResponse {
  total: number;
  friends: SocialUserSummary[];
  incomingRequests: SocialUserSummary[];
  outgoingRequests: SocialUserSummary[];
  error?: string;
}

interface SearchResponse {
  data: SocialUserSummary[];
  error?: string;
}

interface FriendMutationResponse {
  relationshipStatus?: SocialRelationshipStatus;
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

function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function relationshipCopy(status: SocialRelationshipStatus) {
  if (status === "friend") {
    return "Friend";
  }

  if (status === "incoming_request") {
    return "Sent you a request";
  }

  if (status === "outgoing_request") {
    return "Request pending";
  }

  return "Signed-in app user";
}

export default function FriendsPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [friends, setFriends] = useState<SocialUserSummary[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<SocialUserSummary[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<SocialUserSummary[]>([]);
  const [searchResults, setSearchResults] = useState<SocialUserSummary[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<IncomingInvitation[]>([]);
  const [outgoingInvites, setOutgoingInvites] = useState<OutgoingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [friendActionKey, setFriendActionKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [isPending, startTransition] = useTransition();

  async function loadPageData(options?: { background?: boolean }) {
    const background = options?.background ?? false;
    if (!background) {
      setLoading(true);
    }
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

      setFriends(friendsPayload?.friends ?? []);
      setIncomingRequests(friendsPayload?.incomingRequests ?? []);
      setOutgoingRequests(friendsPayload?.outgoingRequests ?? []);
      setIncomingInvites(invitationsPayload?.incoming ?? []);
      setOutgoingInvites(invitationsPayload?.outgoing ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load social features.");
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }

  function getRelationshipStatus(user: SocialUserSummary): SocialRelationshipStatus {
    if (friends.some((friend) => friend.id === user.id)) {
      return "friend";
    }

    if (incomingRequests.some((request) => request.id === user.id)) {
      return "incoming_request";
    }

    if (outgoingRequests.some((request) => request.id === user.id)) {
      return "outgoing_request";
    }

    return user.relationshipStatus ?? (user.followed ? "friend" : "none");
  }

  function syncSearchRelationship(userId: string, relationshipStatus: SocialRelationshipStatus) {
    setSearchResults((current) =>
      current.map((candidate) =>
        candidate.id === userId
          ? {
              ...candidate,
              followed: relationshipStatus === "friend",
              relationshipStatus,
            }
          : candidate
      )
    );
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

  async function updateFriendship(
    user: SocialUserSummary,
    action: "request" | "accept" | "decline" | "cancel" | "remove"
  ) {
    setSearchError(null);
    setError(null);
    const actionKey = `${action}:${user.id}`;
    setFriendActionKey(actionKey);

    try {
      const response = await fetch(`/api/social/friends/${encodeURIComponent(user.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json().catch(() => null)) as FriendMutationResponse | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update friendship.");
      }

      syncSearchRelationship(user.id, payload?.relationshipStatus ?? "none");
      await loadPageData({ background: true });
    } catch (friendError) {
      const message =
        friendError instanceof Error ? friendError.message : "Failed to update friendship.";
      setSearchError(message);
      setError(message);
    } finally {
      setFriendActionKey(null);
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

          await loadPageData({ background: true });
        } catch (inviteError) {
          setError(inviteError instanceof Error ? inviteError.message : `Failed to ${action} invitation.`);
        }
      })();
    });
  }

  function renderFriendActions(user: SocialUserSummary) {
    const relationshipStatus = getRelationshipStatus(user);
    const isActionPending = (action: string) => friendActionKey === `${action}:${user.id}`;

    if (relationshipStatus === "friend") {
      return (
        <button
          type="button"
          onClick={() => void updateFriendship(user, "remove")}
          disabled={Boolean(friendActionKey)}
          className="shrink-0 rounded-xl border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:border-red-400 hover:text-red-300 disabled:opacity-60"
        >
          {isActionPending("remove") ? "Removing..." : "Remove"}
        </button>
      );
    }

    if (relationshipStatus === "incoming_request") {
      return (
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void updateFriendship(user, "accept")}
            disabled={Boolean(friendActionKey)}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
          >
            {isActionPending("accept") ? "Accepting..." : "Accept"}
          </button>
          <button
            type="button"
            onClick={() => void updateFriendship(user, "decline")}
            disabled={Boolean(friendActionKey)}
            className="rounded-xl border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white disabled:opacity-60"
          >
            {isActionPending("decline") ? "Declining..." : "Decline"}
          </button>
        </div>
      );
    }

    if (relationshipStatus === "outgoing_request") {
      return (
        <button
          type="button"
          onClick={() => void updateFriendship(user, "cancel")}
          disabled={Boolean(friendActionKey)}
          className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 transition-colors hover:border-amber-400 hover:text-amber-100 disabled:opacity-60"
        >
          {isActionPending("cancel") ? "Canceling..." : "Cancel Request"}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => void updateFriendship(user, "request")}
        disabled={Boolean(friendActionKey)}
        className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
      >
        {isActionPending("request") ? "Sending..." : "Send Request"}
      </button>
    );
  }

  function renderUserList(
    users: SocialUserSummary[],
    emptyMessage: string,
    loadingMessage?: string
  ) {
    if (loading && loadingMessage) {
      return <p className="text-sm text-gray-500">{loadingMessage}</p>;
    }

    if (!users.length) {
      return (
        <p className="rounded-2xl border border-dashed border-gray-800 px-4 py-6 text-sm text-gray-500">
          {emptyMessage}
        </p>
      );
    }

    return users.map((user) => {
      const status = getRelationshipStatus(user);

      return (
        <div
          key={user.id}
          className="flex items-center justify-between gap-4 rounded-2xl border border-gray-800 bg-gray-950/40 px-4 py-4"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user.displayName}</p>
            <p className="truncate text-xs text-gray-500">{relationshipCopy(status)}</p>
          </div>
          {renderFriendActions(user)}
        </div>
      );
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
          Sign in to send friend requests, build your friends list, and receive private game invites.
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
              Search signed-in users, send friend requests, and manage multiplayer invites from accepted friends.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3 text-sm text-gray-400">
            {friends.length} friend{friends.length === 1 ? "" : "s"} connected
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
              <h2 className="text-lg font-semibold">Search Users</h2>
              <p className="mt-1 text-sm text-gray-500">
                Search signed-in app users and send them a friend request. Once they accept, you can invite each other to games.
              </p>

              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by display name or email..."
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
                    Type at least 2 characters to search for users.
                  </p>
                ) : searchLoading ? (
                  <p className="px-4 py-4 text-sm text-gray-500">Searching users...</p>
                ) : searchResults.length > 0 ? (
                  <div className="divide-y divide-gray-800">
                    {searchResults.map((user) => {
                      const status = getRelationshipStatus(user);

                      return (
                        <div
                          key={user.id}
                          className="flex items-center justify-between gap-4 px-4 py-4"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {user.displayName}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              {relationshipCopy(status)}
                            </p>
                          </div>
                          {renderFriendActions(user)}
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
              <h2 className="text-lg font-semibold">Incoming Friend Requests</h2>
              <p className="mt-1 text-sm text-gray-500">
                Accept a request to unlock direct game invites from that user.
              </p>

              <div className="mt-4 space-y-3">
                {renderUserList(
                  incomingRequests,
                  "No incoming friend requests right now.",
                  "Loading friend requests..."
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="text-lg font-semibold">Sent Requests</h2>
              <p className="mt-1 text-sm text-gray-500">
                These users still need to accept before game invites will work.
              </p>

              <div className="mt-4 space-y-3">
                {renderUserList(
                  outgoingRequests,
                  "You have no pending outgoing friend requests."
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="text-lg font-semibold">Your Friends</h2>
              <p className="mt-1 text-sm text-gray-500">
                Accepted friends can send you room invites, and you can invite them back.
              </p>

              <div className="mt-4 space-y-3">
                {renderUserList(
                  friends,
                  "You haven&apos;t added any friends yet. Search above to send your first request.",
                  "Loading friends..."
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="text-lg font-semibold">Incoming Game Invites</h2>
              <p className="mt-1 text-sm text-gray-500">
                Only accepted friends can invite you, and each invite disappears once you accept, decline, or the lobby closes.
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
                            Sent {formatDateTime(invitation.created_at)}
                          </p>
                        </div>
                        <span className="rounded-full border border-gray-700 px-2.5 py-1 text-[10px] uppercase tracking-wider text-gray-400">
                          pending
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
              <h2 className="text-lg font-semibold">Pending Game Invites You Sent</h2>
              <p className="mt-1 text-sm text-gray-500">
                This list only shows live lobby invites that still need a response.
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
                            Sent {formatDateTime(invitation.created_at)}
                          </p>
                        </div>
                        <span className="rounded-full border border-gray-700 px-2.5 py-1 text-[10px] uppercase tracking-wider text-gray-400">
                          pending
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-gray-800 px-4 py-6 text-sm text-gray-500">
                    You have no pending game invites right now.
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
