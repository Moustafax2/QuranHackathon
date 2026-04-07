"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";

const navLinks = [
  { href: "/play", label: "Play" },
  { href: "/train", label: "Train" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/quran", label: "Quran" },
];

export function Header() {
  const pathname = usePathname();
  const { isAuthenticated, loading, player, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-emerald-400">
          Quran<span className="text-white">Arena</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          {navLinks.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-3 py-2 transition-colors ${
                  active
                    ? "bg-emerald-600/20 text-emerald-400"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                }`}
              >
                {label}
              </Link>
            );
          })}
          {loading ? (
            <span className="px-3 py-2 text-gray-500">...</span>
          ) : isAuthenticated && player ? (
            <>
              <Link
                href="/account"
                className={`rounded-lg px-3 py-2 transition-colors ${
                  pathname === "/account"
                    ? "bg-emerald-600/20 text-emerald-400"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                }`}
              >
                {player.display_name}
              </Link>
              <button
                onClick={() => void logout()}
                className="rounded-lg px-3 py-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-100"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href={`/login${pathname ? `?next=${encodeURIComponent(pathname)}` : ""}`}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-white transition-colors hover:bg-emerald-500"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
