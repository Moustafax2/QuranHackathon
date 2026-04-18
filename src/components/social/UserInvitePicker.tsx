"use client";

import { useDeferredValue, useEffect, useState } from "react";
import type { SocialUserSummary } from "@/lib/social/qf-users";

interface UserInvitePickerProps {
  selectedUsers: SocialUserSummary[];
  onChange: (users: SocialUserSummary[]) => void;
  disabled?: boolean;
  maxSelected?: number;
}

interface SearchResponse {
  data: SocialUserSummary[];
  error?: string;
}

export function UserInvitePicker({
  selectedUsers,
  onChange,
  disabled = false,
  maxSelected = 6,
}: UserInvitePickerProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [results, setResults] = useState<SocialUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (disabled || deferredQuery.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    async function searchUsers() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/social/users/search?query=${encodeURIComponent(deferredQuery)}&limit=6&friendsOnly=1`,
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );
        const payload = (await response.json().catch(() => null)) as SearchResponse | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to search users.");
        }
        setResults(payload?.data ?? []);
      } catch (searchError) {
        if ((searchError as Error).name === "AbortError") {
          return;
        }
        setResults([]);
        setError(searchError instanceof Error ? searchError.message : "Failed to search users.");
      } finally {
        setLoading(false);
      }
    }

    void searchUsers();

    return () => controller.abort();
  }, [deferredQuery, disabled]);

  function addUser(user: SocialUserSummary) {
    if (selectedUsers.some((selected) => selected.id === user.id)) {
      return;
    }
    if (selectedUsers.length >= maxSelected) {
      setError(`You can invite up to ${maxSelected} friends at a time.`);
      return;
    }

    onChange([...selectedUsers, user]);
    setQuery("");
    setResults([]);
    setError(null);
  }

  function removeUser(userId: string) {
    onChange(selectedUsers.filter((user) => user.id !== userId));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Invite Friends</h3>
          <p className="mt-1 text-xs text-gray-500">
            Search accepted friends and send them lobby invites right after room creation.
          </p>
        </div>
        <span className="rounded-full border border-gray-700 px-2.5 py-1 text-xs text-gray-400">
          {selectedUsers.length}/{maxSelected}
        </span>
      </div>

      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search accepted friends..."
        disabled={disabled}
        className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      />

      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => removeUser(user.id)}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200"
            >
              <span>{user.displayName}</span>
              <span className="text-emerald-400">x</span>
            </button>
          ))}
        </div>
      )}

      {deferredQuery.length >= 2 && (
        <div className="rounded-2xl border border-gray-800 bg-gray-950/60">
          {loading ? (
            <p className="px-4 py-3 text-sm text-gray-500">Searching friends...</p>
          ) : results.length > 0 ? (
            <div className="divide-y divide-gray-800">
              {results.map((user) => {
                const isSelected = selectedUsers.some((selected) => selected.id === user.id);

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {user.displayName}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {user.username ? `@${user.username}` : "Accepted friend"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addUser(user)}
                      disabled={isSelected || disabled}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isSelected
                          ? "cursor-not-allowed border border-gray-700 text-gray-500"
                          : "bg-emerald-600 text-white hover:bg-emerald-500"
                      }`}
                    >
                      {isSelected ? "Selected" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="px-4 py-3 text-sm text-gray-500">
              No accepted friends matched that search.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
