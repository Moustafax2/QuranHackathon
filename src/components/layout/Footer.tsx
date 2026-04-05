export function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-gray-950">
      <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-gray-600">
        <p>
          Powered by{" "}
          <a
            href="https://quran.foundation"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-emerald-600"
          >
            Quran Foundation Content API
          </a>
        </p>
      </div>
    </footer>
  );
}
