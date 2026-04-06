"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserPreferences } from "@/lib/types/flashcard";
import {
  getPreferences,
  savePreferences,
  resetAllData,
  exportData,
} from "@/lib/storage/flashcard-storage-supabase";
import { DEFAULT_PREFERENCES } from "@/lib/types/flashcard";

export default function SettingsPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadPrefs() {
      const preferences = await getPreferences();
      setPrefs(preferences);
      setLoading(false);
    }
    loadPrefs();
  }, []);

  const handleSave = async () => {
    await savePreferences(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = async () => {
    if (
      confirm(
        "Are you sure you want to reset all data? This cannot be undone."
      )
    ) {
      await resetAllData();
      router.push("/train/flashcards");
    }
  };

  const handleExport = async () => {
    const data = await exportData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qalamspace-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updatePref = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-400">Customize your learning experience</p>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <span>🎴</span> Card Display
            </h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <span className="text-gray-300">Show Arabic explanation</span>
                <input
                  type="checkbox"
                  checked={prefs.show_arabic_explanation}
                  onChange={(e) =>
                    updatePref("show_arabic_explanation", e.target.checked)
                  }
                  className="h-5 w-5 rounded border-gray-700 bg-gray-800 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-gray-300">Show root/lemma</span>
                <input
                  type="checkbox"
                  checked={prefs.show_root}
                  onChange={(e) => updatePref("show_root", e.target.checked)}
                  className="h-5 w-5 rounded border-gray-700 bg-gray-800 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-gray-300">Show ayah examples</span>
                <input
                  type="checkbox"
                  checked={prefs.show_ayah_examples}
                  onChange={(e) =>
                    updatePref("show_ayah_examples", e.target.checked)
                  }
                  className="h-5 w-5 rounded border-gray-700 bg-gray-800 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-gray-300">Show transliteration</span>
                <input
                  type="checkbox"
                  checked={prefs.show_transliteration}
                  onChange={(e) =>
                    updatePref("show_transliteration", e.target.checked)
                  }
                  className="h-5 w-5 rounded border-gray-700 bg-gray-800 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-gray-300">Auto audio</span>
                <input
                  type="checkbox"
                  checked={prefs.auto_audio}
                  onChange={(e) => updatePref("auto_audio", e.target.checked)}
                  className="h-5 w-5 rounded border-gray-700 bg-gray-800 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <span>🔍</span> Word Filtering
            </h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <span className="text-gray-300">Include particles</span>
                <input
                  type="checkbox"
                  checked={prefs.include_particles}
                  onChange={(e) =>
                    updatePref("include_particles", e.target.checked)
                  }
                  className="h-5 w-5 rounded border-gray-700 bg-gray-800 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-gray-300">Include proper nouns</span>
                <input
                  type="checkbox"
                  checked={prefs.include_proper_nouns}
                  onChange={(e) =>
                    updatePref("include_proper_nouns", e.target.checked)
                  }
                  className="h-5 w-5 rounded border-gray-700 bg-gray-800 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <span>📊</span> Learning Limits
            </h2>
            <div className="space-y-6">
              <div>
                <label className="mb-2 flex items-center justify-between text-gray-300">
                  <span>Daily new cards</span>
                  <span className="text-emerald-400">
                    {prefs.daily_new_cards_limit}
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={prefs.daily_new_cards_limit}
                  onChange={(e) =>
                    updatePref("daily_new_cards_limit", parseInt(e.target.value))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-2 flex items-center justify-between text-gray-300">
                  <span>Daily review cards</span>
                  <span className="text-emerald-400">
                    {prefs.daily_review_cards_limit}
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={prefs.daily_review_cards_limit}
                  onChange={(e) =>
                    updatePref("daily_review_cards_limit", parseInt(e.target.value))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-2 flex items-center justify-between text-gray-300">
                  <span>Session size</span>
                  <span className="text-emerald-400">{prefs.session_size}</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={prefs.session_size}
                  onChange={(e) =>
                    updatePref("session_size", parseInt(e.target.value))
                  }
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <span>⚙️</span> Advanced
            </h2>
            <div className="space-y-3">
              <button
                onClick={handleExport}
                className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-left text-gray-300 transition-all hover:border-emerald-500 hover:bg-gray-700"
              >
                <div className="font-medium">Export Data</div>
                <div className="text-sm text-gray-500">
                  Download your flashcards and progress
                </div>
              </button>
              <button
                onClick={handleReset}
                className="w-full rounded-xl border border-red-900 bg-red-950 px-4 py-3 text-left text-red-400 transition-all hover:border-red-700 hover:bg-red-900"
              >
                <div className="font-medium">Reset All Data</div>
                <div className="text-sm text-red-500">
                  Delete all flashcards and progress
                </div>
              </button>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => router.push("/train/flashcards")}
              className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-6 py-3 font-semibold text-gray-300 transition-all hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
            >
              {saved ? "✓ Saved!" : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
