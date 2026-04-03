export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>
          Built for the{" "}
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            Quran Foundation Hackathon
          </span>
        </p>
        <p className="mt-1">
          Powered by{" "}
          <a
            href="https://quran.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-emerald-600"
          >
            Quran.com API
          </a>
        </p>
      </div>
    </footer>
  );
}
