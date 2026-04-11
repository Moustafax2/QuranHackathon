"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { CHAPTERS_DATA } from "@/lib/data/chapters-data";

// ── Types ────────────────────────────────────────────────────────────────────

type GameModeId = "multiple-choice" | "word-meaning" | "fill-in-blank" | "buzzer";
type ScopeType = "all" | "juz" | "surah";

const GAME_MODES: {
  id: GameModeId;
  title: string;
  short: string;
  difficulty: string;
  difficultyColor: string;
  description: string;
  icon: string;
  available: boolean;
}[] = [
  {
    id: "multiple-choice",
    title: "Next Ayah — Multiple Choice",
    short: "Multiple Choice",
    difficulty: "Easy",
    difficultyColor: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    description: "Given a verse, pick the correct next ayah from four options.",
    icon: "🎯",
    available: true,
  },
  {
    id: "word-meaning",
    title: "Word Meaning",
    short: "Word Meaning",
    difficulty: "Medium",
    difficultyColor: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    description: "A word from an ayah appears — race to select the correct meaning.",
    icon: "📖",
    available: true,
  },
  {
    id: "fill-in-blank",
    title: "Fill in the Blank",
    short: "Fill Blank",
    difficulty: "Medium",
    difficultyColor: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    description: "A word is blanked out from an ayah — pick the missing word.",
    icon: "✏️",
    available: true,
  },
  {
    id: "buzzer",
    title: "Buzzer — Next Ayah",
    short: "Buzzer",
    difficulty: "Hard",
    difficultyColor: "text-red-400 bg-red-400/10 border-red-400/20",
    description: "An ayah is read aloud. First to buzz in and recite the next one wins the point.",
    icon: "⚡",
    available: false,
  },
];

const QUESTION_COUNTS = [5, 10, 15, 20, 25, 30];

// Map surah → juz (approximate — first juz each surah starts in)
const SURAH_JUZ: Record<number, number> = {
  1:1,2:1,3:3,4:4,5:6,6:7,7:8,8:9,9:10,10:11,11:11,12:12,13:13,14:13,15:14,
  16:14,17:15,18:15,19:16,20:16,21:17,22:17,23:18,24:18,25:18,26:19,27:19,
  28:20,29:20,30:21,31:21,32:21,33:21,34:22,35:22,36:22,37:23,38:23,39:23,
  40:24,41:24,42:25,43:25,44:25,45:25,46:26,47:26,48:26,49:26,50:26,51:27,
  52:27,53:27,54:27,55:27,56:27,57:27,58:28,59:28,60:28,61:28,62:28,63:28,
  64:28,65:28,66:28,67:29,68:29,69:29,70:29,71:29,72:29,73:29,74:29,75:29,
  76:29,77:29,78:30,79:30,80:30,81:30,82:30,83:30,84:30,85:30,86:30,87:30,
  88:30,89:30,90:30,91:30,92:30,93:30,94:30,95:30,96:30,97:30,98:30,99:30,
  100:30,101:30,102:30,103:30,104:30,105:30,106:30,107:30,108:30,109:30,
  110:30,111:30,112:30,113:30,114:30,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PlayPage() {
  const router = useRouter();
  const { player, isGuest, loading: authLoading, refresh } = useAuth();

  // Game config state
  const [selectedModes, setSelectedModes] = useState<GameModeId[]>(["multiple-choice"]);
  const [numQuestions, setNumQuestions] = useState(10);
  const [scope, setScope] = useState<ScopeType>("all");
  const [selectedJuz, setSelectedJuz] = useState<number[]>([]);
  const [selectedSurahs, setSelectedSurahs] = useState<number[]>([]);
  const [surahSearch, setSurahSearch] = useState("");

  // Join state
  const [roomCode, setRoomCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [creatingGuest, setCreatingGuest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function toggleMode(id: GameModeId) {
    const mode = GAME_MODES.find((m) => m.id === id);
    if (!mode?.available) return;
    setSelectedModes((prev) =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter((m) => m !== id) : prev // keep at least one
        : [...prev, id]
    );
  }

  function toggleJuz(juz: number) {
    setSelectedJuz((prev) =>
      prev.includes(juz) ? prev.filter((j) => j !== juz) : [...prev, juz]
    );
  }

  function toggleSurah(id: number) {
    setSelectedSurahs((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function buildSettings() {
    const base = {
      num_rounds: numQuestions,
      game_modes: selectedModes,
      time_per_question: 30,
      scope,
    } as Record<string, unknown>;

    if (scope === "juz") base.juz_filter = selectedJuz.length ? selectedJuz : null;
    if (scope === "surah") base.surah_filter = selectedSurahs.length ? selectedSurahs : null;

    return base;
  }

  function scopeLabel() {
    if (scope === "all") return "All Quran";
    if (scope === "juz") {
      if (!selectedJuz.length) return "All Quran";
      const sorted = [...selectedJuz].sort((a, b) => a - b);
      return `Juz ${sorted.join(", ")}`;
    }
    if (!selectedSurahs.length) return "All Quran";
    return `${selectedSurahs.length} surah${selectedSurahs.length > 1 ? "s" : ""}`;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function multiplayerHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isGuest && player) headers["X-Guest-Player-Id"] = player.id;
    return headers;
  }

  async function handleContinueAsGuest() {
    setCreatingGuest(true);
    setError(null);
    try {
      const res = await fetch("/api/multiplayer/guest-token", { method: "POST" });
      const data = (await res.json()) as { id?: string; display_name?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? "Failed to create guest session.");
      sessionStorage.setItem("qalamspace_guest_player", JSON.stringify(data));
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreatingGuest(false);
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleCreateRoom() {
    if (!player || selectedModes.length === 0) return;
    setCreating(true);
    setError(null);

    try {
      const primaryMode = selectedModes[0];
      const response = await fetch("/api/multiplayer/create-room", {
        method: "POST",
        headers: multiplayerHeaders(),
        body: JSON.stringify({
          game_mode: primaryMode,   // stored on the room row (used as fallback)
          settings: buildSettings(), // includes game_modes[], scope, filters
        }),
      });
      const data = (await response.json()) as { code?: string; error?: string };
      if (!response.ok || !data.code) throw new Error(data.error ?? "Failed to create room.");
      router.push(`/play/${data.code}?mode=${primaryMode}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinRoom() {
    if (!player || roomCode.length !== 6) return;
    setJoining(true);
    setError(null);

    try {
      const response = await fetch("/api/multiplayer/join-room", {
        method: "POST",
        headers: multiplayerHeaders(),
        body: JSON.stringify({ room_code: roomCode }),
      });
      const data = (await response.json()) as {
        code?: string;
        game_mode?: string;
        rejoined_in_progress?: boolean;
        error?: string;
      };
      if (!response.ok || !data.code) {
        if (response.status === 409) {
          throw new Error("Cannot join: this game is already in progress for current participants only.");
        }
        throw new Error(data.error ?? "Room not found.");
      }
      const rejoinQuery = data.rejoined_in_progress ? "&rejoined=1" : "";
      router.push(`/play/${data.code}?mode=${data.game_mode}${rejoinQuery}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setJoining(false);
    }
  }

  const filteredSurahs = CHAPTERS_DATA.filter(
    (c) =>
      c.name_simple.toLowerCase().includes(surahSearch.toLowerCase()) ||
      c.name_arabic.includes(surahSearch) ||
      String(c.id).includes(surahSearch)
  );

  const canCreate = selectedModes.length > 0 && !!player;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-12">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold">Set Up Your Game</h1>
          <p className="mt-2 text-gray-400">
            Configure your game, then create a room and share the code with friends.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">

          {/* ── Left col: config ── */}
          <div className="space-y-6">

            {/* 1. Game mode */}
            <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="mb-1 font-semibold text-white">Game Mode</h2>
              <p className="mb-4 text-sm text-gray-500">
                Select one or more — questions will be randomly mixed.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {GAME_MODES.map((mode) => {
                  const active = selectedModes.includes(mode.id);
                  return (
                    <button
                      key={mode.id}
                      onClick={() => toggleMode(mode.id)}
                      disabled={!mode.available}
                      className={`relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all ${
                        !mode.available
                          ? "cursor-not-allowed border-gray-800 opacity-40"
                          : active
                          ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500"
                          : "border-gray-700 bg-gray-800 hover:border-gray-600"
                      }`}
                    >
                      {!mode.available && (
                        <span className="absolute right-3 top-3 rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs text-gray-500">
                          Soon
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{mode.icon}</span>
                        <span className="font-medium text-white">{mode.short}</span>
                        <span
                          className={`ml-auto rounded-full border px-2 py-0.5 text-xs font-medium ${mode.difficultyColor}`}
                        >
                          {mode.difficulty}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-gray-400">{mode.description}</p>
                      {active && mode.available && (
                        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Number of questions */}
            <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="mb-1 font-semibold text-white">Number of Questions</h2>
              <p className="mb-4 text-sm text-gray-500">
                Split randomly across selected modes.
              </p>
              <div className="flex flex-wrap gap-2">
                {QUESTION_COUNTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setNumQuestions(n)}
                    className={`rounded-xl border px-5 py-2 text-sm font-semibold transition-all ${
                      numQuestions === n
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                        : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-white"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </section>

            {/* 3. Scope */}
            <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="mb-1 font-semibold text-white">Scope</h2>
              <p className="mb-4 text-sm text-gray-500">
                Restrict questions to specific parts of the Quran.
              </p>

              {/* Scope tabs */}
              <div className="mb-5 flex gap-2">
                {(["all", "juz", "surah"] as ScopeType[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    className={`rounded-lg border px-4 py-1.5 text-sm font-medium capitalize transition-all ${
                      scope === s
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                        : "border-gray-700 bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    {s === "all" ? "All Quran" : s === "juz" ? "By Juz" : "By Surah"}
                  </button>
                ))}
              </div>

              {/* Juz grid */}
              {scope === "juz" && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {selectedJuz.length ? `${selectedJuz.length} selected` : "Select juz (or leave empty for all)"}
                    </span>
                    {selectedJuz.length > 0 && (
                      <button
                        onClick={() => setSelectedJuz([])}
                        className="text-xs text-gray-500 hover:text-gray-300"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
                      <button
                        key={juz}
                        onClick={() => toggleJuz(juz)}
                        className={`rounded-lg border py-2 text-xs font-semibold transition-all ${
                          selectedJuz.includes(juz)
                            ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                            : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-white"
                        }`}
                      >
                        {juz}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Surah picker */}
              {scope === "surah" && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {selectedSurahs.length ? `${selectedSurahs.length} selected` : "Select surahs (or leave empty for all)"}
                    </span>
                    {selectedSurahs.length > 0 && (
                      <button
                        onClick={() => setSelectedSurahs([])}
                        className="text-xs text-gray-500 hover:text-gray-300"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name or number..."
                    value={surahSearch}
                    onChange={(e) => setSurahSearch(e.target.value)}
                    className="mb-3 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-emerald-500"
                  />
                  <div className="max-h-60 overflow-y-auto rounded-xl border border-gray-700">
                    {filteredSurahs.map((ch, idx) => (
                      <button
                        key={ch.id}
                        onClick={() => toggleSurah(ch.id)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                          idx !== 0 ? "border-t border-gray-800" : ""
                        } ${
                          selectedSurahs.includes(ch.id)
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "text-gray-300 hover:bg-gray-800"
                        }`}
                      >
                        <span className="w-6 text-right text-xs text-gray-600">{ch.id}</span>
                        <span className="flex-1 font-medium">{ch.name_simple}</span>
                        <span className="font-arabic text-base text-gray-400">{ch.name_arabic}</span>
                        <span className="text-xs text-gray-600">Juz {SURAH_JUZ[ch.id]}</span>
                        {selectedSurahs.includes(ch.id) && (
                          <span className="text-emerald-400">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ── Right col: create / join ── */}
          <div className="space-y-4 lg:sticky lg:top-6">

            {/* Config summary */}
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
              <h3 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">Game Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Mode</span>
                  <span className="text-white">
                    {selectedModes.map((m) => GAME_MODES.find((g) => g.id === m)?.short).join(" + ")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Questions</span>
                  <span className="text-white">{numQuestions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Scope</span>
                  <span className="text-right text-white">{scopeLabel()}</span>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Identity gate — sign in OR guest */}
            {!authLoading && !player ? (
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-3">
                <p className="text-sm text-gray-400 text-center">Choose how to play</p>
                <a
                  href="/api/auth/qf/login?next=/play"
                  className="flex w-full items-center justify-center rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
                >
                  Sign in with Quran.com
                </a>
                <button
                  onClick={handleContinueAsGuest}
                  disabled={creatingGuest}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 py-2.5 text-sm font-semibold text-gray-300 hover:border-gray-600 hover:text-white transition-colors disabled:opacity-50"
                >
                  {creatingGuest ? "Setting up..." : "Continue as Guest"}
                </button>
                <p className="text-xs text-gray-600 text-center">
                  Guest sessions are temporary — progress won&apos;t be saved.
                </p>
              </div>
            ) : (
              <>
                {/* Guest badge */}
                {isGuest && player && (
                  <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm">
                    <span className="text-amber-300">Playing as {player.display_name}</span>
                    <a
                      href="/api/auth/qf/login?next=/play"
                      className="text-xs text-amber-400 underline hover:text-amber-300"
                    >
                      Sign in
                    </a>
                  </div>
                )}

                {/* Create */}
                <button
                  onClick={handleCreateRoom}
                  disabled={creating || !canCreate}
                  className="w-full rounded-2xl bg-emerald-600 py-4 text-center font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                >
                  {creating ? "Creating room..." : "Create Room"}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-800" />
                  <span className="text-xs text-gray-600">or join existing</span>
                  <div className="h-px flex-1 bg-gray-800" />
                </div>

                {/* Join */}
                <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
                  <p className="mb-3 text-sm font-medium text-gray-300">Join a Room</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Room code"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-center text-sm font-mono tracking-widest text-white placeholder-gray-600 outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={handleJoinRoom}
                      disabled={roomCode.length !== 6 || joining || !player}
                      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                        roomCode.length === 6 && player
                          ? "bg-gray-700 text-white hover:bg-gray-600"
                          : "cursor-not-allowed bg-gray-800 text-gray-600"
                      }`}
                    >
                      {joining ? "..." : "Join"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
