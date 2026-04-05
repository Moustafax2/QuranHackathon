"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/useAuth";

interface LeaderboardPlayer {
  id: string;
  display_name: string;
  total_points: number;
  total_wins: number;
  isYou?: boolean;
}

const medals = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const { player } = useAuth();
  const [tab, setTab] = useState<"global" | "friends">("global");
  const [globalPlayers, setGlobalPlayers] = useState<LeaderboardPlayer[]>([]);
  const [friendsPlayers, setFriendsPlayers] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      const supabase = createClient();

      // Global leaderboard
      const { data: global } = await supabase
        .from("players")
        .select("id, display_name, total_points, total_wins")
        .order("total_points", { ascending: false })
        .limit(50) as { data: { id: string; display_name: string; total_points: number; total_wins: number }[] | null };

      setGlobalPlayers(
        (global ?? []).map((p) => ({
          id: p.id,
          display_name: p.display_name,
          total_points: p.total_points,
          total_wins: p.total_wins,
          isYou: p.id === player?.id,
        }))
      );

      // Friends leaderboard
      if (player) {
        const { data: friendRows } = await supabase
          .from("friends")
          .select("player_a, player_b")
          .or(`player_a.eq.${player.id},player_b.eq.${player.id}`)
          .eq("status", "accepted") as { data: { player_a: string; player_b: string }[] | null };

        const friendIds = (friendRows ?? []).map((f) =>
          f.player_a === player.id ? f.player_b : f.player_a
        );
        friendIds.push(player.id);

        if (friendIds.length > 0) {
          const { data: friends } = await supabase
            .from("players")
            .select("id, display_name, total_points, total_wins")
            .in("id", friendIds)
            .order("total_points", { ascending: false }) as { data: { id: string; display_name: string; total_points: number; total_wins: number }[] | null };

          setFriendsPlayers(
            (friends ?? []).map((p) => ({
              id: p.id,
              display_name: p.display_name,
              total_points: p.total_points,
              total_wins: p.total_wins,
              isYou: p.id === player.id,
            }))
          );
        }
      }

      setLoading(false);
    }

    fetchLeaderboard();
  }, [player?.id]);

  const players = tab === "global" ? globalPlayers : friendsPlayers;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Leaderboard</h1>
          <p className="mt-2 text-gray-400">Rankings update after every game.</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1">
          {(["global", "friends"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition-colors ${
                tab === t
                  ? "bg-emerald-600 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading...</div>
        ) : players.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            {tab === "friends"
              ? "Add friends to see their scores here"
              : "No games played yet. Be the first!"}
          </div>
        ) : (
          <>
            {/* Top 3 podium */}
            {players.length >= 3 && (
              <div className="mb-6 grid grid-cols-3 gap-3">
                {[players[1], players[0], players[2]].map((p, i) => {
                  const actualRank = i === 0 ? 2 : i === 1 ? 1 : 3;
                  return (
                    <div
                      key={p.id}
                      className={`flex flex-col items-center rounded-2xl border p-4 text-center ${
                        actualRank === 1
                          ? "border-amber-500/40 bg-amber-500/10"
                          : "border-gray-800 bg-gray-900"
                      }`}
                    >
                      <span className="text-2xl">{medals[actualRank - 1]}</span>
                      <p className={`mt-2 text-sm font-semibold ${p.isYou ? "text-emerald-400" : "text-white"}`}>
                        {p.display_name}
                      </p>
                      <p className="mt-1 text-lg font-bold text-white">
                        {p.total_points.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">{p.total_wins} wins</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full table */}
            <div className="overflow-hidden rounded-2xl border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3 text-right">Points</th>
                    <th className="px-4 py-3 text-right">Wins</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {players.map((p, i) => (
                    <tr
                      key={p.id}
                      className={`transition-colors ${p.isYou ? "bg-emerald-500/5" : "bg-gray-950 hover:bg-gray-900"}`}
                    >
                      <td className="px-4 py-3 font-mono text-gray-500">
                        {i < 3 ? medals[i] : i + 1}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <span className={p.isYou ? "text-emerald-400" : "text-white"}>
                          {p.display_name}
                        </span>
                        {p.isYou && (
                          <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                            you
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-white">
                        {p.total_points.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">
                        {p.total_wins}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
