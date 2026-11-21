import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { AppToneRule, SayoSettings, ToneCategory } from "../types";

const TONE_OPTIONS: { value: ToneCategory; label: string; hint: string }[] = [
  { value: "email", label: "Email", hint: "Polished, full sentences, proper greetings" },
  { value: "workChat", label: "Work Chat", hint: "Concise, skips stiff trailing periods" },
  { value: "personalChat", label: "Personal Chat", hint: "Warm, natural, casual phrasing" },
  { value: "code", label: "Code & Docs", hint: "Preserves identifiers, flags, and paths verbatim" },
  { value: "neutral", label: "Neutral", hint: "Clean punctuation without stylistic rewrite" },
  { value: "custom", label: "Custom", hint: "Use your own formatting instruction" },
];

export const TonesView: React.FC<{
  rules: AppToneRule[];
  onUpdateRule: (id: string, patch: Partial<AppToneRule>) => void;
  onAddRule: (rule: Omit<AppToneRule, "id">) => void;
  onDeleteRule: (id: string) => void;
}> = ({ rules, onUpdateRule, onAddRule, onDeleteRule }) => {
  const [appName, setAppName] = useState("");
  const [bundleID, setBundleID] = useState("");
  const [category, setCategory] = useState<ToneCategory>("workChat");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = appName.trim();
    if (!cleanName) return;
    const cleanBundle =
      bundleID.trim() || `com.custom.${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
    onAddRule({
      appName: cleanName,
      bundleID: cleanBundle,
      category,
      customInstruction: category === "custom" ? "Keep output concise and clear." : undefined,
    });
    setAppName("");
    setBundleID("");
  };

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-zinc-200/80 dark:border-zinc-800">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Per-App Tones
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Match cleanup tone automatically to the active application, or define custom prompt rules.
        </p>
      </div>

      {/* Add Custom App Rule */}
      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#15171C] p-4 grid grid-cols-1 md:grid-cols-12 gap-3"
      >
        <input
          type="text"
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
          placeholder="App name (e.g. Linear)"
          className="md:col-span-4 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/60 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#4285F4]"
        />
        <input
          type="text"
          value={bundleID}
          onChange={(e) => setBundleID(e.target.value)}
          placeholder="Bundle ID (optional, e.g. com.linear)"
          className="md:col-span-4 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/60 text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#4285F4]"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ToneCategory)}
          className="md:col-span-2 h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#4285F4]"
        >
          {TONE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="md:col-span-2 inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add app</span>
        </button>
      </form>

      {/* Rules List */}
      <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#15171C] divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden">
        {rules.map((rule) => {
          const activeOption = TONE_OPTIONS.find((o) => o.value === rule.category);
          return (
            <div key={rule.id} className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {rule.appName}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    {rule.bundleID}
                    {activeOption ? ` · ${activeOption.hint}` : ""}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={rule.category}
                    onChange={(e) =>
                      onUpdateRule(rule.id, { category: e.target.value as ToneCategory })
                    }
                    aria-label={`Tone for ${rule.appName}`}
                    className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-[#4285F4]"
                  >
                    {TONE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {!rule.isDefault && (
                    <button
                      type="button"
                      onClick={() => onDeleteRule(rule.id)}
                      aria-label={`Remove ${rule.appName}`}
                      className="p-1.5 rounded-md text-zinc-400 hover:text-[#C5221F] dark:hover:text-[#F28B82] hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {rule.category === "custom" && (
                <input
                  type="text"
                  value={rule.customInstruction ?? ""}
                  onChange={(e) => onUpdateRule(rule.id, { customInstruction: e.target.value })}
                  placeholder="Describe the tone for this app (e.g. Bullet points, concise engineering voice)"
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/60 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#4285F4]"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-3.5 cursor-pointer">
      <div>
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4285F4]/40 ${
          checked ? "bg-[#1A73E8]" : "bg-zinc-300 dark:bg-zinc-700"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow-xs transform transition-transform mt-0.5 ${
            checked ? "translate-x-5.5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export const SettingsView: React.FC<{
  settings: SayoSettings;
  onUpdate: (patch: Partial<SayoSettings>) => void;
}> = ({ settings, onUpdate }) => {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="pb-5 border-b border-zinc-200/80 dark:border-zinc-800">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Configure capture behavior, cleanup pipeline, audio retention, and appearance.
        </p>
      </div>

      {/* Dictation & Pipeline */}
      <section className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#15171C] px-5 divide-y divide-zinc-100 dark:divide-zinc-800/80">
        <SettingToggle
          label="Smart transcription"
          description="Removes filler words, resolves spoken self-corrections, and applies punctuation."
          checked={settings.smartTranscription}
          onChange={(v) => onUpdate({ smartTranscription: v })}
        />
        <SettingToggle
          label="Match tone to active app"
          description="Runs a fast cleanup pass tailored to the target application’s tone rule."
          checked={settings.toneMatchingPass}
          onChange={(v) => onUpdate({ toneMatchingPass: v })}
        />
        <SettingToggle
          label="Double-tap to lock hands-free"
          description="Double-tap Space (outside text fields) to dictate without holding the key."
          checked={settings.doubleTapLock}
          onChange={(v) => onUpdate({ doubleTapLock: v })}
        />
      </section>

      {/* HUD & Audio */}
      <section className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#15171C] px-5 divide-y divide-zinc-100 dark:divide-zinc-800/80">
        <SettingToggle
          label="Show resting indicator"
          description="Keeps a subtle hover-to-dictate capsule at the bottom of the viewport."
          checked={settings.showIdleIndicator}
          onChange={(v) => onUpdate({ showIdleIndicator: v })}
        />
        <SettingToggle
          label="Sound feedback"
          description="Play subtle G-major chimes on start, lock, completion, and cancellation."
          checked={settings.soundsEnabled}
          onChange={(v) => onUpdate({ soundsEnabled: v })}
        />
        <div className="flex items-center justify-between gap-4 py-3.5">
          <div>
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Audio clip retention
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              How long native macOS Sayo keeps recordings for replay and retry.
            </div>
          </div>
          <select
            value={settings.audioRetentionDays}
            onChange={(e) => onUpdate({ audioRetentionDays: Number(e.target.value) })}
            className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-800 dark:text-zinc-200"
          >
            <option value={1}>1 day</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={0}>Don’t keep</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-4 py-3.5">
          <div>
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Appearance
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Switch between light and dark surfaces.
            </div>
          </div>
          <div className="inline-flex rounded-lg p-0.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800">
            {(["light", "dark"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onUpdate({ theme: mode })}
                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                  settings.theme === mode
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export const AboutView: React.FC = () => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-4 pb-5 border-b border-zinc-200/80 dark:border-zinc-800">
        {!imgError ? (
          <img
            src="/docs/images/icon.png"
            alt="Sayo icon"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-16 h-16 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-[#1A73E8] text-white flex items-center justify-center text-2xl font-semibold">
            S
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Sayo
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">
            Version 0.6.1 · Smart voice dictation for macOS
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#15171C] p-5 space-y-3 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
        <p>
          Sayo turns natural speech into clean, formatted text tailored to the app you are writing in — stripping filler words, resolving self-corrections, and expanding personal snippets.
        </p>
        <p>
          This workspace provides an interactive browser studio for testing Sayo’s transcription pipeline, floating pill HUD, seekable audio history, dictionary snippets, and per-app tones. The full native macOS Swift application remains intact in this repository under <code className="font-mono text-xs px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">App/</code> and <code className="font-mono text-xs px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">JotCore/</code>.
        </p>
      </div>

      <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
        <p>Maintained by Jay · Forked from Jot by Ammaar Reshi</p>
        <p>Licensed under Apache License 2.0</p>
      </div>
    </div>
  );
};
