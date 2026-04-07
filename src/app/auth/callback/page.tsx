import Link from "next/link";

export default function AuthCallbackPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center text-white">
      <h1 className="text-3xl font-bold">Authentication Callback</h1>
      <p className="mt-4 text-gray-400">
        Quran Foundation redirects back through the API callback route, not this page.
      </p>
      <Link
        href="/login"
        className="mt-8 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
      >
        Go to login
      </Link>
    </div>
  );
}
