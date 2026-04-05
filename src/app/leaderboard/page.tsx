"use client";

import { useState } from "react";

type Player = { rank: number; name: string; points: number; wins: number; streak: number; isYou?: boolean };

const globalPlayers: Player[] = [
  { rank: 1, name: "Abdullah K.", points: 3840, wins: 47, streak: 12 },
  { rank: 2, name: "Fatima M.", points: 3210, wins: 39, streak: 8 },
  { rank: 3, name: "Yusuf A.", points: 2980, wins: 35, streak: 5 },
  { rank: 4, name: "Maryam H.", points: 2650, wins: 31, streak: 3 },
  { rank: 5, name: "Ibrahim S.", points: 2400, wins: 28, streak: 7 },
  { rank: 6, name: "Aisha R.", points: 2100, wins: 24, streak: 2 },
  { rank: 7, name: "Omar F.", points: 1870, wins: 21, streak: 4 },
  { rank: 8, name: "Khadija N.", points: 1640, wins: 18, streak: 1 },
  { rank: 9, name: "Ali B.", points: 1420, wins: 15, streak: 0 },
  { rank: 10, name: "Zainab L.", points: 1200, wins: 13, streak: 6 },
];

const friendsPlayers: Player[] = [
  { rank: 1, name: "Abdullah K.", points: 3840, wins: 47, streak: 12 },
  { rank: 2, name: "Yusuf A.", points: 2980, wins: 35, streak: 5 },
  { rank: 3, name: "You", points: 1240, wins: 14, streak: 3, isYou: true },
  { rank: 4, name: "Omar F.", points: 870, wins: 9, streak: 1 },
];

const medals = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"global" | "friends">("global");
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

        {/* Top 3 podium */}
        {players.length >= 3 && (
          <div className="mb-6 grid grid-cols-3 gap-3">
            {[players[1], players[0], players[2]].map((player, i) => {
              const actualRank = i === 0 ? 2 : i === 1 ? 1 : 3;
              return (
                <div
                  key={player.rank}
                  className={`flex flex-col items-center rounded-2xl border p-4 text-center ${
                    actualRank === 1
                      ? "border-amber-500/40 bg-amber-500/10"
                      : "border-gray-800 bg-gray-900"
                  }`}
                >
                  <span className="text-2xl">{medals[actualRank - 1]}</span>
                  <p className={`mt-2 text-sm font-semibold ${player.isYou ? "text-emerald-400" : "text-white"}`}>
                    {player.name}
                  </p>
                  <p className="mt-1 text-lg font-bold text-white">
                    {player.points.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">{player.wins} wins</p>
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
                <th className="hidden px-4 py-3 text-right sm:table-cell">Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {players.map((player) => (
                <tr
                  key={player.rank}
                  className={`transition-colors ${player.isYou ? "bg-emerald-500/5" : "bg-gray-950 hover:bg-gray-900"}`}
                >
                  <td className="px-4 py-3 font-mono text-gray-500">
                    {player.rank <= 3 ? medals[player.rank - 1] : player.rank}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <span className={player.isYou ? "text-emerald-400" : "text-white"}>
                      {player.name}
                    </span>
                    {player.isYou && (
                      <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                        you
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-white">
                    {player.points.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">{player.wins}</td>
                  <td className="hidden px-4 py-3 text-right sm:table-cell">
                    {player.streak > 0 ? (
                      <span className="text-amber-400">{player.streak} 🔥</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-center text-xs text-gray-700">
          Mock data — real scores coming once auth is live
        </p>
      </div>
    </div>
  );
}
