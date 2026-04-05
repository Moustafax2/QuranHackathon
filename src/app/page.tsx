import Link from "next/link";

const modes = [
  {
    href: "/play",
    title: "Compete",
    description: "Live multiplayer competitions with friends. Buzzers, next ayah challenges, trivia, and more.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-7 w-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 hover:border-emerald-400",
    badge: "Multiplayer",
  },
  {
    href: "/train",
    title: "Train",
    description: "Flashcards, blank-the-ayah tests, and vocabulary drills to sharpen your memorization.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-7 w-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
      </svg>
    ),
    color: "from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-400",
    badge: "Solo",
  },
  {
    href: "/leaderboard",
    title: "Leaderboard",
    description: "Track your rank among friends and globally. See who's leading the memorization race.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-7 w-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m4.992 0 .124-3.957a.75.75 0 0 1 .75-.733h.372m-5.614.266A.75.75 0 0 1 9.37 9.75h5.26a.75.75 0 0 1 .75.816l-.124 3.957" />
      </svg>
    ),
    color: "from-amber-500/20 to-amber-600/10 border-amber-500/30 hover:border-amber-400",
    badge: "Rankings",
  },
  {
    href: "/quran",
    title: "Read Quran",
    description: "Full Arabic text with English translations, audio recitations, and bookmarks.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-7 w-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    color: "from-gray-500/20 to-gray-600/10 border-gray-500/30 hover:border-gray-400",
    badge: "Reference",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white">
      {/* Hero */}
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Memorize the Quran
          <br />
          <span className="text-emerald-400">together.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
          Compete with friends, train your memorization, and climb the leaderboard.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/play"
            className="rounded-xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            Start competing
          </Link>
          <Link
            href="/train"
            className="rounded-xl border border-gray-700 px-6 py-3 text-base font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
          >
            Practice solo
          </Link>
        </div>
      </div>

      {/* Mode cards */}
      <div className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modes.map((mode) => (
            <Link
              key={mode.href}
              href={mode.href}
              className={`group relative flex flex-col gap-4 rounded-2xl border bg-gradient-to-br p-6 transition-all ${mode.color}`}
            >
              <div className="flex items-start justify-between">
                <div className="rounded-xl bg-white/5 p-2 text-white">
                  {mode.icon}
                </div>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-gray-300">
                  {mode.badge}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{mode.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-gray-400">
                  {mode.description}
                </p>
              </div>
              <div className="mt-auto flex items-center gap-1 text-sm font-medium text-emerald-400 opacity-0 transition-opacity group-hover:opacity-100">
                Go
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
