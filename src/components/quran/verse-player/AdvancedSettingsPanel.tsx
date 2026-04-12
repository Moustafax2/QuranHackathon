"use client";

import type { VerseAudioSettings } from "@/lib/types";

interface Props {
  settings: VerseAudioSettings;
  versesCount: number;
  onChange: (patch: Partial<VerseAudioSettings>) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function AdvancedSettingsPanel({ settings, versesCount, onChange }: Props) {
  return (
    <div className="space-y-4 border-t border-gray-700 pt-3">
      {/* Speed */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-gray-400">Speed</label>
          <span className="min-w-[3rem] text-right text-xs font-semibold text-emerald-400">
            {settings.speed.toFixed(2)}×
          </span>
        </div>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.05}
          value={settings.speed}
          onChange={(e) => onChange({ speed: Number(e.target.value) })}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-700 accent-emerald-500"
        />
        <div className="mt-0.5 flex justify-between text-[10px] text-gray-600">
          <span>0.5×</span>
          <span>3×</span>
        </div>
      </div>

      {/* Range */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-400">
          Verse range
        </label>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-1">
            <span className="text-xs text-gray-500">From</span>
            <input
              type="number"
              min={1}
              max={versesCount}
              value={settings.startVerse}
              onChange={(e) =>
                onChange({
                  startVerse: clamp(Number(e.target.value), 1, settings.endVerse),
                })
              }
              className="w-16 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-center text-sm text-white"
            />
          </div>
          <div className="flex flex-1 items-center gap-1">
            <span className="text-xs text-gray-500">To</span>
            <input
              type="number"
              min={1}
              max={versesCount}
              value={settings.endVerse === 9999 ? versesCount : settings.endVerse}
              onChange={(e) =>
                onChange({
                  endVerse: clamp(Number(e.target.value), settings.startVerse, versesCount),
                })
              }
              className="w-16 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-center text-sm text-white"
            />
          </div>
        </div>
      </div>

      {/* Repeat counts */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">
            Each verse ×
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={settings.timesPerVerse}
            onChange={(e) =>
              onChange({ timesPerVerse: clamp(Number(e.target.value), 1, 10) })
            }
            className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-center text-sm text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">
            Full set ×
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={settings.timesPerSet}
            onChange={(e) =>
              onChange({ timesPerSet: clamp(Number(e.target.value), 1, 10) })
            }
            className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-center text-sm text-white"
          />
        </div>
      </div>
    </div>
  );
}
