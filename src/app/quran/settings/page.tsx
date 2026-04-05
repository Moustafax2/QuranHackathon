import Link from "next/link";
import { getQuranIntegrationStatus } from "@/lib/quran/status";

export const dynamic = "force-dynamic";

function StatusPill({
  status,
}: {
  status: "ok" | "error" | "skipped";
}) {
  const className =
    status === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : status === "error"
        ? "border-red-500/30 bg-red-500/10 text-red-300"
        : "border-amber-500/30 bg-amber-500/10 text-amber-300";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
      {status === "ok" ? "Healthy" : status === "error" ? "Error" : "Pending"}
    </span>
  );
}

function PresenceBadge({ present }: { present: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        present
          ? "bg-emerald-500/10 text-emerald-300"
          : "bg-red-500/10 text-red-300"
      }`}
    >
      {present ? "Present" : "Missing"}
    </span>
  );
}

export default async function QuranSettingsPage() {
  const status = await getQuranIntegrationStatus();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-white">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/quran"
            className="mb-3 inline-block text-sm text-emerald-400 hover:underline"
          >
            &larr; Back to Quran
          </Link>
          <h1 className="text-3xl font-bold">Quran Integration Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Server-side visibility into the Quran Foundation Content API configuration and health.
          </p>
        </div>
        <StatusPill status={status.config.isReady ? "ok" : "error"} />
      </div>

      {!status.config.isReady && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-200">
            Configuration Issues
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-amber-100">
            {status.config.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="text-lg font-semibold">Resolved Config</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-400">Environment</dt>
              <dd className="text-right">
                <div className="font-medium text-white">{status.config.environment}</div>
                <div className="text-xs text-gray-500">
                  {status.config.environmentConfigured ? "From QF_ENV" : "Fallback until QF_ENV is set"}
                </div>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-400">Client ID</dt>
              <dd className="flex items-center gap-2">
                <PresenceBadge present={status.config.clientIdPresent} />
                <span className="font-mono text-xs text-gray-300">
                  {status.config.maskedClientId ?? "Unavailable"}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-400">Client Secret</dt>
              <dd>
                <PresenceBadge present={status.config.clientSecretPresent} />
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-400">Auth Base URL</dt>
              <dd className="max-w-xs text-right">
                <div className="break-all font-mono text-xs text-gray-300">
                  {status.config.authBaseUrl}
                </div>
                <div className="text-xs text-gray-500">
                  {status.config.authBaseUrlSource === "env" ? "Override" : "Default"}
                </div>
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-400">API Base URL</dt>
              <dd className="max-w-xs text-right">
                <div className="break-all font-mono text-xs text-gray-300">
                  {status.config.apiBaseUrl}
                </div>
                <div className="text-xs text-gray-500">
                  {status.config.apiBaseUrlSource === "env" ? "Override" : "Default"}
                </div>
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="text-lg font-semibold">Health</h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">Auth</h3>
                <StatusPill status={status.auth.status} />
              </div>
              <p className="mt-2 text-sm text-gray-400">{status.auth.message}</p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">Content API</h3>
                <StatusPill status={status.content.status} />
              </div>
              <p className="mt-2 text-sm text-gray-400">{status.content.message}</p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">Token Cache</h3>
                <StatusPill status={status.token.hasCachedToken ? "ok" : "skipped"} />
              </div>
              <p className="mt-2 text-sm text-gray-400">
                {status.token.hasCachedToken
                  ? `Cached token available. Expires at ${status.token.expiresAt} (${status.token.expiresInSeconds}s remaining).`
                  : "No cached token is currently stored in memory."}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
