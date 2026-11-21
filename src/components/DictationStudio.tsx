import React, { useState } from "react";
import {
  Check,
  Copy,
  Eraser,
  Lock,
  Mic,
  Square,
  X,
} from "lucide-react";
import type { AppToneRule, DictationRecord, SayoSettings, ToneCategory } from "../types";
import { formatDuration } from "../utils/engine";

interface DictationStudioProps {
  toneRules: AppToneRule[];
  activeAppBundleID: string;
  onSelectApp: (bundleID: string) => void;
  draftsByApp: Record<string, string>;
  onChangeDraft: (bundleID: string, value: string) => void;
  isRecording: boolean;
  isLocked: boolean;
  elapsedSeconds: number;
  inFlightCount: number;
  recentSweepAppID: string | null;
  lastRecord: DictationRecord | null;
  settings: SayoSettings;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onToggleHandsFree: () => void;
  onCancelRecording: () => void;
  onOpenSection: (section: "tones" | "dictionary" | "history") => void;
}

const TONE_LABELS: Record<ToneCategory, string> = {
  email: "Email · Polished & complete",
  workChat: "Work chat · Concise & direct",
  personalChat: "Personal chat · Casual & warm",
  code: "Code · Technical & literal",
  neutral: "Neutral · Clean punctuation",
  custom: "Custom prompt",
};

export const DictationStudio: React.FC<DictationStudioProps> = ({
  toneRules,
  activeAppBundleID,
  onSelectApp,
  draftsByApp,
  onChangeDraft,
  isRecording,
  isLocked,
  elapsedSeconds,
  inFlightCount,
  recentSweepAppID,
  lastRecord,
  settings,
  onHoldStart,
  onHoldEnd,
  onToggleHandsFree,
  onCancelRecording,
  onOpenSection,
}) => {
  const [copied, setCopied] = useState(false);

  const activeRule =
    toneRules.find((r) => r.bundleID === activeAppBundleID) ?? toneRules[0];
  const draft = draftsByApp[activeRule.bundleID] ?? "";

  const handleCopy = async () => {
    if (!draft.trim()) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard fallback ignored if blocked
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action & Target App Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-zinc-200/80 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Dictation Studio
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Hold <kbd className="px-1.5 py-0.5 text-xs font-mono rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">Space</kbd> or press and hold below. Switch target apps mid-transcription to test the focus-switch chip.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isRecording ? (
            <>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  onHoldStart();
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  onHoldEnd();
                }}
                onPointerLeave={() => {
                  if (isRecording && !isLocked) onHoldEnd();
                }}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] active:scale-[0.99] text-white text-sm font-medium transition-all select-none cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                <span>Hold to Dictate</span>
              </button>

              <button
                type="button"
                onClick={onToggleHandsFree}
                className="inline-flex items-center gap-2 h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#15171C] hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 text-sm font-medium transition-colors"
              >
                <Lock className="w-3.5 h-3.5 text-zinc-500" />
                <span>Hands-Free</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onHoldEnd}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span className="tabular-nums">Finish ({formatDuration(elapsedSeconds)})</span>
              </button>
              <button
                type="button"
                onClick={onCancelRecording}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm transition-colors"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Target App Scratchpad (8 cols) */}
        <div className="xl:col-span-8 flex flex-col rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#15171C] overflow-hidden">
          {/* App Tab Strip */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 overflow-x-auto">
            <div className="flex items-center gap-1">
              {toneRules.map((rule) => {
                const selected = rule.bundleID === activeRule.bundleID;
                return (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => onSelectApp(rule.bundleID)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                      selected
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-xs border border-zinc-200/80 dark:border-zinc-700"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    {rule.appName}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!draft.trim()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#34A853]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeDraft(activeRule.bundleID, "")}
                disabled={!draft.trim()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Active Tone Context Line */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-zinc-100 dark:border-zinc-800/70 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{activeRule.appName}</span>
              <span>·</span>
              <span className="truncate">
                {settings.toneMatchingPass ? TONE_LABELS[activeRule.category] : "Tone pass off · Direct smart transcription"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpenSection("tones")}
              className="text-[#1A73E8] dark:text-[#8AB4F8] hover:underline shrink-0"
            >
              Edit tone
            </button>
          </div>

          {/* Editable Target Area */}
          <div className="relative flex-1 min-h-[300px]">
            <textarea
              value={draft}
              onChange={(e) => onChangeDraft(activeRule.bundleID, e.target.value)}
              placeholder={`Dictated text for ${activeRule.appName} lands here. Speak naturally — Sayo strips filler words, resolves self-corrections, and expands your dictionary snippets.`}
              className={`w-full h-full min-h-[300px] p-5 bg-transparent resize-none text-[15px] leading-relaxed text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none ${
                recentSweepAppID === activeRule.bundleID ? "sayo-gemini-sweep" : ""
              }`}
            />
          </div>

          {/* Footer Status Line */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800/70 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            <span>
              {draft.trim() ? `${draft.trim().split(/\s+/).length} words` : "0 words"}
              {inFlightCount > 0 ? ` · ${inFlightCount} transcribing in background` : ""}
            </span>
            <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
              {activeRule.bundleID}
            </span>
          </div>
        </div>

        {/* Right Context Column (4 cols) */}
        <div className="xl:col-span-4 space-y-4">
          {/* Last Dictation Diff Card */}
          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#15171C] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Latest Pipeline Result
              </h2>
              <button
                type="button"
                onClick={() => onOpenSection("history")}
                className="text-xs text-[#1A73E8] dark:text-[#8AB4F8] hover:underline"
              >
                All history
              </button>
            </div>

            {lastRecord ? (
              <div className="space-y-3">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                  {lastRecord.targetAppName} · {lastRecord.wordCount} words
                  {lastRecord.pipelineSeconds ? ` · ${lastRecord.pipelineSeconds.toFixed(2)}s` : ""}
                </div>
                <p className="text-sm text-zinc-900 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap">
                  {lastRecord.cleanedTranscript ?? lastRecord.rawTranscript ?? "—"}
                </p>
                {lastRecord.rawTranscript &&
                  lastRecord.cleanedTranscript &&
                  lastRecord.rawTranscript.trim() !== lastRecord.cleanedTranscript.trim() && (
                    <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">
                        Raw speech
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {lastRecord.rawTranscript}
                      </p>
                    </div>
                  )}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No dictations yet. Hold to dictate to see transcription and cleanup latency here.
              </p>
            )}
          </div>

          {/* Quick Try Prompts */}
          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#15171C] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Try Speaking
              </h2>
              <button
                type="button"
                onClick={() => onOpenSection("dictionary")}
                className="text-xs text-[#1A73E8] dark:text-[#8AB4F8] hover:underline"
              >
                Dictionary
              </button>
            </div>
            <ul className="space-y-2.5 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              <li className="pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">Self-correction:</span>{" "}
                “Let’s meet at 1pm — actually no, make it 2:30pm.”
              </li>
              <li className="pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">Multi-line snippet:</span>{" "}
                Say “my sign off” or “standup template” to expand deterministically.
              </li>
              <li>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">Overlapping capture:</span>{" "}
                Start a second dictation immediately while the first is still transcribing.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
