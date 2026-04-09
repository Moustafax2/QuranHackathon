import Link from "next/link";

const trainingModes = [
  {
    id: "flashcards",
    title: "Flashcards",
    description:
      "Study vocabulary word by word. Pick a surah and learn every word's meaning before testing yourself.",
    icon: "🃏",
    available: true,
    href: "/train/flashcards",
  },
  {
    id: "memorization-tester",
    title: "Memorization Tester",
    description:
      "Test your hifz: blank out a page and recall it, or identify an ayah and locate it in the mushaf.",
    icon: "✏️",
    available: true,
    href: "/train/memorization-tester",
  },
  {
    id: "challenge",
    title: "Challenge Mode",
    description:
      "Send an async recitation challenge to a friend. They have 24 hours to respond.",
    icon: "📤",
    available: false,
    href: "#",
  },
];

export default function TrainPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold">Training</h1>
          <p className="mt-2 text-gray-400">
            Build your memorization solo before taking it into competition.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {trainingModes.map((mode) => (
            <Link
              key={mode.id}
              href={mode.available ? mode.href : "#"}
              className={`group flex flex-col gap-4 rounded-2xl border p-6 transition-all ${
                mode.available
                  ? "border-gray-800 bg-gray-900 hover:border-emerald-500/50 hover:bg-gray-900"
                  : "pointer-events-none border-gray-800 bg-gray-900/50 opacity-50"
              }`}
            >
              <span className="text-3xl">{mode.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white">{mode.title}</h3>
                  {!mode.available && (
                    <span className="rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs text-gray-500">
                      Soon
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-gray-400">
                  {mode.description}
                </p>
              </div>
              {mode.available && (
                <div className="mt-auto flex items-center gap-1 text-sm font-medium text-emerald-400 opacity-0 transition-opacity group-hover:opacity-100">
                  Start
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
