"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRoom } from "@/lib/hooks/useRoom";
import { useGame } from "@/lib/hooks/useGame";
import { UserInvitePicker } from "@/components/social/UserInvitePicker";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import type { GamePhase } from "@/lib/game/state-machine";
import type { SocialUserSummary } from "@/lib/social/qf-users";

interface Props {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ mode?: string }>;
}

type RoomInfo = Database["public"]["Tables"]["rooms"]["Row"];
type ActiveGameLookup = Pick<Database["public"]["Tables"]["games"]["Row"], "id">;
type RoomMembershipStatus = "loading" | "active" | "left" | "missing";

export default function GameRoomPage({ params, searchParams }: Props) {
  const router = useRouter();
  const { roomId } = use(params);
  use(searchParams);
  const { player, isAuthenticated, loading: authLoading, refresh } = useAuth();
  const [guestPlayerId, setGuestPlayerId] = useState<string | null>(null);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [autoJoining, setAutoJoining] = useState(false);
  const [hasAttemptedAutoJoin, setHasAttemptedAutoJoin] = useState(false);
  const [creatingGuest, setCreatingGuest] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<RoomMembershipStatus>("loading");
  const hasLeftRef = useRef(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [selectedInvitees, setSelectedInvitees] = useState<SocialUserSummary[]>([]);

  const fetchActiveGame = useCallback(async (roomPrimaryId: string) => {
    const supabase = createClient();
    const activeGameResponse = await supabase
      .from("games")
      .select("id")
      .eq("room_id", roomPrimaryId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const activeGame = activeGameResponse.data as ActiveGameLookup | null;

    if (activeGame?.id) {
      setGameId(activeGame.id);
      return activeGame.id;
    }

    return null;
  }, []);

  // Read guest player ID from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("qalamspace_guest_player");
      if (raw) {
        const guest = JSON.parse(raw) as { id?: string };
        if (guest.id) setGuestPlayerId(guest.id);
      }
    } catch { /* ignore */ }
  }, []);

  // Fetch room info on mount
  useEffect(() => {
    async function fetchRoom() {
      const supabase = createClient();
      const roomResponse = await supabase
        .from("rooms")
        .select("*")
        .eq("code", roomId)
        .single();
      const data = roomResponse.data as RoomInfo | null;
      const fetchError = roomResponse.error;

      if (fetchError || !data) {
        setError("Room not found");
      } else {
        setRoomInfo(data);
        await fetchActiveGame(data.id);
      }
      setLoading(false);
    }
    fetchRoom();
  }, [fetchActiveGame, roomId]);

  useEffect(() => {
    if (!roomInfo?.id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`room-meta:${roomInfo.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomInfo.id}`,
        },
        ({ new: updatedRoom }) => {
          const nextRoom = updatedRoom as RoomInfo;
          setRoomInfo(nextRoom);
          if (nextRoom.status === "in_progress") {
            void fetchActiveGame(nextRoom.id);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchActiveGame, roomInfo?.id]);

  useEffect(() => {
    if (loading || authLoading) return;
    if (!roomInfo?.id) return;

    if (!player?.id) {
      setMembershipStatus("missing");
      return;
    }

    let cancelled = false;

    async function fetchMembership() {
      const supabase = createClient();
      const membershipResponse = await supabase
        .from("room_players")
        .select("status")
        .eq("room_id", roomInfo!.id)
        .eq("player_id", player!.id)
        .maybeSingle();

      if (cancelled) return;

      const membership = membershipResponse.data as { status: "active" | "left" } | null;
      if (!membership) {
        setMembershipStatus("missing");
        return;
      }

      if (membership.status === "left") {
        hasLeftRef.current = true;
        setMembershipStatus("left");
        return;
      }

      setMembershipStatus("active");
      hasLeftRef.current = false;
    }

    void fetchMembership();

    return () => {
      cancelled = true;
    };
  }, [authLoading, loading, player?.id, roomInfo?.id]);

  const buildMultiplayerHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (guestPlayerId) headers["X-Guest-Player-Id"] = guestPlayerId;
    return headers;
  }, [guestPlayerId]);

  const joinRoom = useCallback(async () => {
    const response = await fetch("/api/multiplayer/join-room", {
      method: "POST",
      headers: buildMultiplayerHeaders(),
      body: JSON.stringify({ room_code: roomId }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      throw new Error(data?.error ?? "Failed to join room.");
    }

    setError(null);
    // Clear the joining overlay before flipping membership state. Otherwise the
    // effect cleanup can mark the attempt as cancelled and skip clearing it.
    setAutoJoining(false);
    setMembershipStatus("active");
  }, [buildMultiplayerHeaders, roomId]);

  const leaveRoom = useCallback(
    async ({
      keepalive = false,
      suppressErrors = false,
    }: { keepalive?: boolean; suppressErrors?: boolean } = {}) => {
      if (!roomInfo?.id || !player?.id || hasLeftRef.current) {
        return true;
      }

      hasLeftRef.current = true;

      try {
        const request = fetch("/api/multiplayer/leave-room", {
          method: "POST",
          headers: buildMultiplayerHeaders(),
          body: JSON.stringify({ room_id: roomInfo!.id }),
          keepalive,
        });

        if (keepalive) {
          void request.catch(() => {});
          return true;
        }

        const response = await request;
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to leave room.");
        }

        setMembershipStatus("left");
        return true;
      } catch (err) {
        hasLeftRef.current = false;
        if (!suppressErrors) {
          setError((err as Error).message);
        }
        return false;
      }
    },
    [buildMultiplayerHeaders, player?.id, roomInfo?.id]
  );

  useEffect(() => {
    if (loading || authLoading || !roomInfo?.id) return;
    if (!player?.id) return;
    if (membershipStatus !== "missing") return;
    if (roomInfo.status !== "lobby") return;
    if (hasAttemptedAutoJoin) return;

    let cancelled = false;

    async function attemptAutoJoin() {
      setHasAttemptedAutoJoin(true);
      setAutoJoining(true);

      try {
        await joinRoom();
      } catch (joinError) {
        if (cancelled) return;

        const message =
          joinError instanceof Error ? joinError.message : "Failed to join room.";
        if (message.toLowerCase().includes("already left")) {
          setMembershipStatus("left");
        }
        setError(message);
      } finally {
        if (!cancelled) {
          setAutoJoining(false);
        }
      }
    }

    void attemptAutoJoin();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    hasAttemptedAutoJoin,
    joinRoom,
    loading,
    membershipStatus,
    player?.id,
    roomInfo?.id,
    roomInfo?.status,
  ]);

  useEffect(() => {
    if (membershipStatus !== "active" || !roomInfo?.id || !player?.id) return;

    let cancelled = false;

    async function sendHeartbeat() {
      try {
        await fetch("/api/multiplayer/heartbeat-room", {
          method: "POST",
          headers: buildMultiplayerHeaders(),
          body: JSON.stringify({ room_id: roomInfo!.id }),
        });
      } catch {
        if (!cancelled) {
          // Heartbeats are best-effort; game sync falls back to polling/realtime.
        }
      }
    }

    void sendHeartbeat();
    const interval = window.setInterval(() => {
      void sendHeartbeat();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [buildMultiplayerHeaders, membershipStatus, player?.id, roomInfo?.id]);

  useEffect(() => {
    if (!roomInfo?.id || membershipStatus !== "active" || gameId) return;

    const supabase = createClient();
    const interval = window.setInterval(async () => {
      const roomResponse = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomInfo.id)
        .maybeSingle();

      const latestRoom = roomResponse.data as RoomInfo | null;
      if (!latestRoom) return;

      setRoomInfo(latestRoom);
      await fetchActiveGame(latestRoom.id);
    }, 2000);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchActiveGame, gameId, membershipStatus, roomInfo?.id]);

  // Watch for the host starting the game — lets non-host players transition
  // automatically without needing to refresh.
  useEffect(() => {
    if (gameId || !roomInfo?.id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`room-events:${roomInfo.id}`)
      .on("broadcast", { event: "room_event" }, ({ payload }) => {
        const event = payload as { type: string; payload: { game_id: string } };
        if (event.type === "game:started" && event.payload.game_id) {
          setGameId(event.payload.game_id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomInfo?.id, gameId]);

  // Realtime hooks
  const { players, isConnected } = useRoom(
    membershipStatus === "active" ? roomInfo?.id ?? null : null,
    roomInfo?.host_id ?? null
  );

  const { gameState, submitAnswer, pressBuzzer } = useGame(
    gameId,
    membershipStatus === "active" ? player?.id ?? null : null,
    guestPlayerId
  );

  const isHost = player?.id === roomInfo?.host_id;
  const phase: GamePhase = gameState.phase;

  async function handleStartGame() {
    if (!roomInfo || !player || starting) return;
    setStarting(true);
    setError(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (guestPlayerId) headers["X-Guest-Player-Id"] = guestPlayerId;
      const response = await fetch("/api/multiplayer/start-game", {
        method: "POST",
        headers,
        body: JSON.stringify({ room_id: roomInfo.id }),
      });
      const data = (await response.json()) as { game_id?: string; error?: string };
      if (!response.ok || !data.game_id) {
        throw new Error(data.error ?? "Failed to start game.");
      }
      setGameId(data.game_id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarting(false);
    }
  }

  async function handleLeave() {
    const didLeave = await leaveRoom();
    if (didLeave) {
      router.push("/play");
    }
  }

  async function handleContinueAsGuest() {
    setCreatingGuest(true);
    setError(null);

    try {
      const response = await fetch("/api/multiplayer/guest-token", {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { id?: string; error?: string }
        | null;

      if (!response.ok || !payload?.id) {
        throw new Error(payload?.error ?? "Failed to create guest profile.");
      }

      sessionStorage.setItem("qalamspace_guest_player", JSON.stringify(payload));
      setGuestPlayerId(payload.id);
      await refresh();
    } catch (guestError) {
      setError(guestError instanceof Error ? guestError.message : "Failed to join as guest.");
    } finally {
      setCreatingGuest(false);
    }
  }

  async function handleCopyShareLink() {
    const shareUrl = `${window.location.origin}/play/${roomId}`;
    await navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function handleNativeShare() {
    const shareUrl = `${window.location.origin}/play/${roomId}`;
    if (!navigator.share) {
      await handleCopyShareLink();
      return;
    }

    try {
      await navigator.share({
        title: "Join my QuranArena lobby",
        text: `Join my QuranArena lobby with room code ${roomId}.`,
        url: shareUrl,
      });
    } catch {
      // Ignore aborted shares.
    }
  }

  async function handleSendInvites() {
    if (!selectedInvitees.length) return;

    setSendingInvites(true);
    setError(null);

    try {
      const response = await fetch("/api/social/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: roomId,
          invitees: selectedInvitees,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to send invitations.");
      }
      setSelectedInvitees([]);
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Failed to send invitations.");
    } finally {
      setSendingInvites(false);
    }
  }

  if (loading || authLoading || autoJoining || (!!roomInfo && membershipStatus === "loading")) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-950 text-white">
        <div className="text-gray-500">{autoJoining ? "Joining room..." : "Loading room..."}</div>
      </div>
    );
  }

  if (error && !roomInfo) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <p className="text-red-400">{error}</p>
          <Link href="/play" className="mt-4 inline-block text-sm text-emerald-400 hover:underline">
            Back to game modes
          </Link>
        </div>
      </div>
    );
  }

  if (membershipStatus === "left") {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-950 text-white">
        <div className="max-w-md text-center">
          <p className="text-red-400">You already left this game and can&apos;t rejoin it.</p>
          <Link href="/play" className="mt-4 inline-block text-sm text-emerald-400 hover:underline">
            Back to game modes
          </Link>
        </div>
      </div>
    );
  }

  if (membershipStatus === "missing") {
    if (!player) {
      return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-950 text-white">
          <div className="w-full max-w-lg rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
              Join Lobby
            </p>
            <h1 className="mt-4 text-3xl font-bold">Room {roomId}</h1>
            <p className="mt-3 text-gray-400">
              {roomInfo?.status === "lobby"
                ? "Sign in with Quran.com to auto-join this lobby, or continue as a guest."
                : "This room is no longer in the lobby, so new players can’t join right now."}
            </p>

            {roomInfo?.status === "lobby" ? (
              <div className="mt-8 space-y-3">
                <Link
                  href={`/login?next=${encodeURIComponent(`/play/${roomId}`)}`}
                  className="flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
                >
                  Sign in with Quran.com
                </Link>
                <button
                  type="button"
                  onClick={() => void handleContinueAsGuest()}
                  disabled={creatingGuest}
                  className="w-full rounded-2xl border border-gray-700 bg-gray-800 px-6 py-3 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:text-white disabled:opacity-60"
                >
                  {creatingGuest ? "Preparing guest access..." : "Join as Guest"}
                </button>
              </div>
            ) : (
              <Link
                href="/play"
                className="mt-8 inline-flex rounded-2xl border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
              >
                Back to game modes
              </Link>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-950 text-white">
        <div className="max-w-md text-center">
          <p className="text-red-400">You are not an active participant in this room.</p>
          <Link href="/play" className="mt-4 inline-block text-sm text-emerald-400 hover:underline">
            Back to game modes
          </Link>
        </div>
      </div>
    );
  }

  // Game in progress
  if (phase !== "lobby" && gameState.current_round) {
    return (
      <GameInProgress
        key={gameId}
        roomCode={roomId}
        gameState={gameState}
        playerId={player?.id ?? ""}
        players={players}
        onSubmitAnswer={submitAnswer}
        onPressBuzzer={pressBuzzer}
        onLeave={() => void handleLeave()}
      />
    );
  }

  // Lobby
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Room header */}
        <div className="mb-8 text-center">
          <p className="mb-2 text-sm text-gray-500">Room Code</p>
          <div className="inline-flex items-center gap-3 rounded-2xl border border-gray-700 bg-gray-900 px-6 py-3">
            <span className="font-mono text-3xl font-bold tracking-widest text-emerald-400">
              {roomId}
            </span>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(roomId);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className={`rounded-lg p-1.5 transition-colors ${copied ? "text-emerald-400" : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"}`}
              title="Copy code"
            >
              {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                </svg>
              )}
            </button>
          </div>
          <p className="mt-3 text-sm text-gray-500">
            Share the code or the lobby link with friends to join
          </p>
          {!isConnected && (
            <p className="mt-2 text-xs text-amber-400">Connecting...</p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void handleCopyShareLink()}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                linkCopied
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white"
              }`}
            >
              {linkCopied ? "Link Copied" : "Copy Lobby Link"}
            </button>
            <button
              type="button"
              onClick={() => void handleNativeShare()}
              className="rounded-xl border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
            >
              Share Link
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Players ({players.length}/8)
          </h2>
          <div className="space-y-2">
            {players.map((p) => (
              <div
                key={p.player_id}
                className="flex items-center justify-between rounded-xl bg-gray-800/50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${p.player_id === player?.id ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-700 text-gray-400"}`}>
                    {p.display_name[0]?.toUpperCase() ?? "?"}
                  </div>
                  <span className={`text-sm font-medium ${p.player_id === player?.id ? "text-white" : "text-gray-300"}`}>
                    {p.display_name}
                    {p.player_id === player?.id && " (You)"}
                    {p.is_host && (
                      <span className="ml-2 text-xs text-amber-400">Host</span>
                    )}
                  </span>
                </div>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
              </div>
            ))}
            {players.length === 0 && (
              <p className="py-3 text-center text-sm text-gray-600">
                Waiting for players to join...
              </p>
            )}
          </div>
        </div>

        {roomInfo && isAuthenticated && player && roomInfo.status === "lobby" && roomInfo.host_id === player.id && (
          <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <UserInvitePicker
              selectedUsers={selectedInvitees}
              onChange={setSelectedInvitees}
              disabled={sendingInvites}
            />
            <button
              type="button"
              onClick={() => void handleSendInvites()}
              disabled={!selectedInvitees.length || sendingInvites}
              className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {sendingInvites ? "Sending invites..." : "Send Invites"}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {isHost ? (
            <button
              onClick={handleStartGame}
              disabled={players.length < 1 || starting}
              className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {starting ? "Starting..." : "Start Game"}
            </button>
          ) : (
            <div className="flex-1 rounded-xl border border-gray-700 py-3 text-center text-sm text-gray-500">
              Waiting for host to start...
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleLeave()}
            className="rounded-xl border border-gray-700 px-4 py-3 text-sm font-semibold text-gray-400 transition-colors hover:border-gray-500 hover:text-white"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Game In Progress Component
// ==========================================

import type { GameState } from "@/lib/game/state-machine";
import type { RoomPlayer } from "@/lib/hooks/useRoom";

interface GameProps {
  roomCode: string;
  gameState: GameState;
  playerId: string;
  players: RoomPlayer[];
  onSubmitAnswer: (roundId: string, answerVerseKey: string) => Promise<{ ok: boolean; error?: string }>;
  onPressBuzzer: (roundId: string) => Promise<{ ok: boolean; error?: string }>;
  onLeave: () => void;
}

const RESULT_MIN_MS = 3500; // minimum time to show the round result screen

function GameInProgress({
  roomCode,
  gameState,
  playerId,
  players,
  onSubmitAnswer,
  onPressBuzzer,
  onLeave,
}: GameProps) {
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [buzzed, setBuzzed] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Pinned result — keeps the result screen visible for at least RESULT_MIN_MS
  // even after the server moves to the next round.
  const [pinnedResult, setPinnedResult] = useState<typeof gameState.round_result>(null);
  const [pinnedRound, setPinnedRound] = useState<typeof gameState.current_round>(null);
  const [showingResult, setShowingResult] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const round = gameState.current_round;
  const result = gameState.round_result;
  const phase = gameState.phase;

  // When a real round_result arrives, pin both the result and the round so the
  // display stays frozen for RESULT_MIN_MS even after the server moves on.
  // We use a ref for the timer so phase changes don't cancel it via effect cleanup.
  useEffect(() => {
    let cancelled = false;

    if (phase === "round_result" && result && !showingResult) {
      queueMicrotask(() => {
        if (cancelled) return;

        setPinnedResult(result);
        setPinnedRound(round);
        setShowingResult(true);
        setCountdown(Math.ceil(RESULT_MIN_MS / 1000));

        countdownIntervalRef.current = setInterval(() => {
          setCountdown((c) => c - 1);
        }, 1000);

        resultTimerRef.current = setTimeout(() => {
          resultTimerRef.current = null;
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          setShowingResult(false);
          setPinnedResult(null);
          setPinnedRound(null);
          setCountdown(0);
          setAnswered(false);
          setSelected(null);
          setBuzzed(false);
        }, RESULT_MIN_MS);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [phase, result]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up on unmount only
  useEffect(() => {
    return () => {
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // While pinned, freeze the phase, result, and round so nothing flickers.
  const effectivePhase = showingResult ? "round_result" : phase;
  const effectiveResult = showingResult ? pinnedResult : result;
  const effectiveRound = (showingResult && pinnedRound) ? pinnedRound : round;

  // Infer per-round mode from the data so mixed-mode games label correctly.
  const isTrivia = effectiveRound?.prompt_verse_key?.startsWith("trivia-") ?? false;
  const isBuzzerMode = !isTrivia && (!effectiveRound?.options || effectiveRound.options.length === 0);
  const isFillInBlank = !isTrivia && (effectiveRound?.options?.some((o) => o.verse_key.startsWith("fill:")) ?? false);
  const isWordMeaning = !isTrivia && (effectiveRound?.options?.some((o) => o.verse_key.startsWith("meaning:")) ?? false);
  // multiple-choice is the fallback (regular verse key options)

  // Game over screen
  if (phase === "game_over") {
    const sortedScores = Object.entries(gameState.scores).sort(
      ([, a], [, b]) => b - a
    );
    const winnerName = players.find(
      (p) => p.player_id === gameState.winner_id
    )?.display_name;

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white">
        <div className="mx-auto max-w-2xl px-4 py-12 text-center">
          <h1 className="mb-2 text-4xl font-bold text-emerald-400">
            Game Over!
          </h1>
          <p className="mb-8 text-lg text-gray-400">
            {!gameState.winner_id
              ? "Game ended."
              : gameState.winner_id === playerId
              ? "You won!"
              : `${winnerName ?? "Someone"} wins!`}
          </p>
          <div className="mb-8 space-y-2">
            {sortedScores.map(([pid, score], i) => {
              const name = players.find((p) => p.player_id === pid)?.display_name ?? "Unknown";
              return (
                <div
                  key={pid}
                  className={`flex items-center justify-between rounded-xl px-5 py-3 ${
                    i === 0
                      ? "border border-amber-500/30 bg-amber-500/10"
                      : "bg-gray-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${i === 0 ? "text-amber-400" : "text-gray-500"}`}>
                      #{i + 1}
                    </span>
                    <span className="font-medium">
                      {name}
                      {pid === playerId && " (You)"}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400">
                    {score} pts
                  </span>
                </div>
              );
            })}
          </div>
          <Link
            href="/play"
            className="inline-block rounded-xl bg-emerald-600 px-8 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Play Again
          </Link>
        </div>
      </div>
    );
  }

  if (!round) return null;

  async function handleSelect(verseKey: string) {
    if (answered) return;
    setSelected(verseKey);
    setAnswered(true);
    setSubmitError(null);
    const result = await onSubmitAnswer(round!.round_id, verseKey);
    if (!result.ok) {
      setSubmitError(result.error ?? "Failed to submit answer");
    }
  }

  async function handleBuzzer() {
    if (buzzed) return;
    setBuzzed(true);
    setSubmitError(null);
    const result = await onPressBuzzer(round!.round_id);
    if (!result.ok) {
      setSubmitError(result.error ?? "Failed to buzz");
      setBuzzed(false); // allow retry
    }
  }

  // Build scores display — sorted by score descending
  const sortedScores = Object.entries(gameState.scores)
    .map(([id, score]) => ({
      id,
      score,
      name: players.find((p) => p.player_id === id)?.display_name ?? "Unknown",
      isMe: id === playerId,
    }))
    .sort((a, b) => b.score - a.score);

  const rankEmoji = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Score bar */}
        <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900 px-5 py-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <div>
              <span className="text-gray-500">Room </span>
              <span className="font-mono text-gray-300">{roomCode}</span>
            </div>
            <span className="text-gray-600">
              Round {effectiveRound?.round_number}/{effectiveRound?.total_rounds}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sortedScores.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  p.isMe
                    ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : "bg-gray-800 text-gray-300"
                }`}
              >
                <span className="text-xs">{rankEmoji[i] ?? `#${i + 1}`}</span>
                <span className="max-w-24 truncate">{p.isMe ? "You" : p.name}</span>
                <span className={`font-mono ${p.isMe ? "text-emerald-400" : "text-gray-400"}`}>
                  {p.score}
                </span>
              </div>
            ))}
            <button
              type="button"
              onClick={onLeave}
              className="ml-auto rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
            >
              Leave
            </button>
          </div>
        </div>

        {/* Prompt */}
        <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            {isTrivia
              ? "Quran Trivia"
              : isBuzzerMode
              ? "Recite the next ayah"
              : isWordMeaning
              ? "What does this word mean?"
              : isFillInBlank
              ? "Fill in the blank"
              : "What is the next ayah?"}
          </p>
          <p
            dir={isTrivia ? "ltr" : "rtl"}
            lang={isTrivia ? "en" : "ar"}
            className={`text-white ${
              isTrivia
                ? "text-xl font-medium leading-relaxed"
                : isWordMeaning
                ? "font-amiri text-5xl leading-loose"
                : "font-amiri text-3xl leading-loose"
            }`}
          >
            {isFillInBlank && effectiveRound?.prompt_text?.includes("___")
              ? effectiveRound.prompt_text.split("___").map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <span className="inline-block w-16 border-b-2 border-white mx-1 align-bottom mb-2" />
                    )}
                  </span>
                ))
              : effectiveRound?.prompt_text}
          </p>
          {!isTrivia && (
            <p className="mt-2 text-sm text-gray-500">{effectiveRound?.prompt_verse_key}</p>
          )}
        </div>


        {/* Round result — stays visible for RESULT_MIN_MS */}
        {effectivePhase === "round_result" && effectiveResult && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Round over
              </p>
              <p className="text-xs text-gray-500">
                Next question in <span className="font-mono text-gray-300">{countdown}s</span>
              </p>
            </div>
            <p className="mb-1 text-sm text-gray-400">Correct answer:</p>
            <p
              dir={isTrivia ? "ltr" : "rtl"}
              lang={isTrivia ? "en" : "ar"}
              className={`mb-4 text-white ${isTrivia ? "text-lg font-medium leading-relaxed" : "font-amiri text-2xl leading-loose"}`}
            >
              {effectiveResult.correct_text}
            </p>
            <div className="space-y-2">
              {effectiveResult.answers.map((a) => {
                const isMe = a.player_id === playerId;
                return (
                  <div
                    key={a.player_id}
                    className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm ${
                      isMe
                        ? a.is_correct
                          ? "border border-emerald-500/30 bg-emerald-500/10"
                          : "border border-red-500/30 bg-red-500/10"
                        : "bg-gray-800/50"
                    }`}
                  >
                    <span className={isMe ? "font-semibold text-white" : "text-gray-400"}>
                      {a.display_name}{isMe && " (You)"}
                    </span>
                    <span className={a.is_correct ? "font-bold text-emerald-400" : "font-bold text-red-400"}>
                      {a.is_correct ? "✓" : "✗"} {a.is_correct ? "+" : ""}{a.points_awarded} pts
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Buzzer mode */}
        {isBuzzerMode && effectivePhase === "round_active" && (
          <div className="text-center">
            <button
              onClick={handleBuzzer}
              disabled={buzzed}
              className={`h-32 w-32 rounded-full text-2xl font-bold transition-all ${
                buzzed
                  ? "bg-gray-700 text-gray-500"
                  : "bg-red-600 text-white shadow-lg shadow-red-600/30 hover:bg-red-500 active:scale-95"
              }`}
            >
              {buzzed ? "Buzzed!" : "BUZZ"}
            </button>
          </div>
        )}

        {/* Options */}
        {!isBuzzerMode && effectiveRound?.options && effectivePhase === "round_active" && (
          <div className={`grid gap-3 ${isFillInBlank || isWordMeaning || isTrivia ? "grid-cols-2" : "sm:grid-cols-2"}`}>
            {effectiveRound.options.map((option) => {
              let style = "border-gray-800 bg-gray-900 hover:border-gray-600";
              if (answered && effectiveResult) {
                if (option.verse_key === effectiveResult.correct_verse_key)
                  style = "border-emerald-500 bg-emerald-500/10";
                else if (option.verse_key === selected)
                  style = "border-red-500 bg-red-500/10";
                else style = "border-gray-800 bg-gray-900 opacity-50";
              } else if (option.verse_key === selected) {
                style = "border-blue-500 bg-blue-500/10";
              }
              const isEnglishOption = isTrivia || isWordMeaning;
              return (
                <button
                  key={option.verse_key}
                  onClick={() => handleSelect(option.verse_key)}
                  disabled={answered}
                  className={`rounded-xl border transition-all ${
                    isFillInBlank || isWordMeaning || isTrivia ? "p-4 text-center" : "p-4 text-right"
                  } ${style}`}
                >
                  <p
                    dir={isEnglishOption ? "ltr" : "rtl"}
                    lang={isEnglishOption ? "en" : "ar"}
                    className={`text-white ${
                      isEnglishOption
                        ? "text-lg font-medium leading-relaxed"
                        : isFillInBlank
                        ? "font-amiri text-2xl leading-loose"
                        : "font-amiri text-xl leading-loose"
                    }`}
                  >
                    {option.text}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {answered && !effectiveResult && (
          <p className="mt-4 text-center text-sm text-gray-500">
            Waiting for other players...
          </p>
        )}

        {submitError && (
          <p className="mt-4 text-center text-sm text-red-400">{submitError}</p>
        )}
      </div>
    </div>
  );
}
