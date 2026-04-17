"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";

const navLinks = [
  { href: "/play", label: "Play" },
  { href: "/train", label: "Train" },
  { href: "/progress", label: "Progress" },
  { href: "/quran", label: "Quran" },
];

export function Header() {
  const pathname = usePathname();
  const { isAuthenticated, loading, player, logout } = useAuth();
  const loginHref = `/login${pathname ? `?next=${encodeURIComponent(pathname)}` : ""}`;

  const renderNavLinks = (mobile = false) =>
    navLinks.map(({ href, label }) => {
      const active = pathname === href || pathname.startsWith(href + "/");

      return (
        <Link
          key={href}
          href={href}
          className={`rounded-lg px-3 py-2 transition-colors ${
            active
              ? "bg-emerald-600/20 text-emerald-400"
              : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
          } ${mobile ? "shrink-0 whitespace-nowrap" : ""}`}
        >
          {label}
        </Link>
      );
    });

  return (
    <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4">
        <div className="hidden h-16 items-center justify-between gap-6 md:flex">
          <Link href="/" className="shrink-0 text-xl font-bold text-emerald-400">
            Quran<span className="text-white">Arena</span>
          </Link>
          <div className="flex min-w-0 items-center gap-1 text-sm font-medium">
            <nav className="flex items-center gap-1">
              {renderNavLinks()}
            </nav>
            {loading ? (
              <span className="px-3 py-2 text-gray-500">...</span>
            ) : isAuthenticated && player ? (
              <>
                <Link
                  href="/account"
                  className={`max-w-40 truncate rounded-lg px-3 py-2 transition-colors ${
                    pathname === "/account"
                      ? "bg-emerald-600/20 text-emerald-400"
                      : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                  }`}
                  title={player.display_name}
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
                href={loginHref}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-white transition-colors hover:bg-emerald-500"
              >
                Login
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 py-3 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="shrink-0 text-lg font-bold text-emerald-400">
              Quran<span className="text-white">Arena</span>
            </Link>
            {loading ? (
              <span className="shrink-0 px-3 py-2 text-gray-500">...</span>
            ) : isAuthenticated && player ? (
              <Link
                href="/account"
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === "/account"
                    ? "bg-emerald-600/20 text-emerald-400"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                }`}
              >
                Account
              </Link>
            ) : (
              <Link
                href={loginHref}
                className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
              >
                Login
              </Link>
            )}
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto pb-1 text-sm font-medium [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {renderNavLinks(true)}
          </nav>

          {isAuthenticated && player ? (
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm text-gray-400">{player.display_name}</p>
              <button
                onClick={() => void logout()}
                className="shrink-0 rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-100"
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
