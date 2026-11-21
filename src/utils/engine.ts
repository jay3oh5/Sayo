import type { AppToneRule, DictionaryEntry, DictationRecord } from "../types";

export const DEFAULT_TONE_RULES: AppToneRule[] = [
  { id: "mail", bundleID: "com.apple.mail", appName: "Mail", category: "email", isDefault: true },
  { id: "slack", bundleID: "com.tinyspeck.slackmacgap", appName: "Slack", category: "workChat", isDefault: true },
  { id: "messages", bundleID: "com.apple.MobileSMS", appName: "Messages", category: "personalChat", isDefault: true },
  { id: "vscode", bundleID: "com.microsoft.VSCode", appName: "VS Code", category: "code", isDefault: true },
  { id: "xcode", bundleID: "com.apple.dt.Xcode", appName: "Xcode", category: "code", isDefault: true },
  { id: "notes", bundleID: "com.apple.Notes", appName: "Notes", category: "neutral", isDefault: true },
];

export const DEFAULT_DICTIONARY: DictionaryEntry[] = [
  {
    id: "word-sayo",
    kind: "word",
    term: "Sayo",
    misspelling: "say oh",
    starred: true,
    createdAt: new Date(Date.now() - 86_400_000 * 5).toISOString(),
  },
  {
    id: "word-k8s",
    kind: "word",
    term: "Kubernetes",
    misspelling: "cooper netties",
    starred: true,
    createdAt: new Date(Date.now() - 86_400_000 * 4).toISOString(),
  },
  {
    id: "word-auhal",
    kind: "word",
    term: "AUHAL",
    misspelling: "a you hall",
    starred: false,
    createdAt: new Date(Date.now() - 86_400_000 * 3).toISOString(),
  },
  {
    id: "snippet-signoff",
    kind: "snippet",
    misspelling: "my sign off",
    term: "Best,\nJay\nSent with Sayo",
    starred: true,
    createdAt: new Date(Date.now() - 86_400_000 * 2).toISOString(),
  },
  {
    id: "snippet-standup",
    kind: "snippet",
    misspelling: "standup template",
    term: "Yesterday:\n- \n\nToday:\n- \n\nBlockers:\n- None",
    starred: false,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

export const SEED_HISTORY: DictationRecord[] = [
  {
    id: "seed-1",
    startedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    status: "inserted",
    targetAppName: "Slack",
    targetAppBundleID: "com.tinyspeck.slackmacgap",
    durationSeconds: 6.4,
    rawTranscript: "um hey team let's move the Kubernetes rollout to 2pm actually no make it 3pm so QA has time",
    cleanedTranscript: "Hey team, let's move the Kubernetes rollout to 3pm so QA has time",
    wordCount: 13,
    pipelineSeconds: 0.84,
    modelID: "gemini-3.5-transcribe/smart+gemini-4-hydrogen",
  },
  {
    id: "seed-2",
    startedAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    status: "inserted",
    targetAppName: "VS Code",
    targetAppBundleID: "com.microsoft.VSCode",
    durationSeconds: 8.1,
    rawTranscript: "refactor audio capture engine to pin the selected microphone through AUHAL without mutating system default input",
    cleanedTranscript: "Refactor AudioCaptureEngine to pin the selected microphone through AUHAL without mutating the system default input.",
    wordCount: 15,
    pipelineSeconds: 0.91,
    modelID: "gemini-3.5-transcribe/smart+gemini-4-hydrogen",
  },
  {
    id: "seed-3",
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    status: "inserted",
    targetAppName: "Mail",
    targetAppBundleID: "com.apple.mail",
    durationSeconds: 11.2,
    rawTranscript: "hi everyone thanks for testing Sayo v0.6.1 please let me know if Bluetooth headphones stay in stereo mode",
    cleanedTranscript: "Hi everyone, thanks for testing Sayo v0.6.1. Please let me know if Bluetooth headphones stay in stereo mode.",
    wordCount: 19,
    pipelineSeconds: 1.04,
    modelID: "gemini-3.5-transcribe/smart",
  },
];

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeQuotes(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

/**
 * Deterministic ReplacementEngine port: supports smart quotes, case-insensitive
 * whole-word/phrase boundary matching, and multi-line snippet expansions.
 */
export function applyReplacementRules(text: string, entries: DictionaryEntry[]): string {
  let result = text;
  const rules = entries
    .filter((e) => e.misspelling && e.misspelling.trim().length > 0)
    .sort((a, b) => (b.misspelling?.length ?? 0) - (a.misspelling?.length ?? 0));

  for (const rule of rules) {
    const trigger = normalizeQuotes(rule.misspelling!.trim());
    if (!trigger) continue;
    const pattern = escapeRegex(trigger).replace(/'/g, "['‘’]").replace(/"/g, '["“”]');
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, "giu");
    result = result.replace(regex, rule.term);
  }
  return result;
}

export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function exportDictionaryCSV(entries: DictionaryEntry[]): string {
  const lines = ["term,misspelling,isSnippet"];
  for (const entry of entries) {
    const term = entry.term.replace(/"/g, '""');
    const misspelling = (entry.misspelling ?? "").replace(/"/g, '""');
    const isSnippet = entry.kind === "snippet" ? "true" : "false";
    lines.push(`"${term}","${misspelling}","${isSnippet}"`);
  }
  return lines.join("\n");
}

export function parseDictionaryCSV(csv: string): Omit<DictionaryEntry, "id" | "createdAt">[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (current.trim().length > 0) records.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) records.push(current);

  const parseLine = (line: string): string[] => {
    const cols: string[] = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && quoted && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = !quoted;
      } else if (ch === "," && !quoted) {
        cols.push(cell.trim());
        cell = "";
      } else {
        cell += ch;
      }
    }
    cols.push(cell.trim());
    return cols;
  };

  if (records.length > 0) {
    const firstCell = parseLine(records[0])[0]?.toLowerCase() ?? "";
    if (["term", "word", "phrase"].includes(firstCell)) {
      records.shift();
    }
  }

  const parsed: Omit<DictionaryEntry, "id" | "createdAt">[] = [];
  for (const line of records.slice(0, 1000)) {
    const cols = parseLine(line);
    const term = (cols[0] ?? "").trim();
    const misspelling = (cols[1] ?? "").trim() || undefined;
    const isSnippet = (cols[2] ?? "").toLowerCase() === "true";
    if (!term) continue;
    if (isSnippet && !misspelling) continue;
    if (!isSnippet && term.length > 60) continue;
    parsed.push({
      kind: isSnippet ? "snippet" : "word",
      term,
      misspelling,
      starred: false,
    });
  }
  return parsed;
}

/** Synthesizes gentle G-major Sayo earcons via Web Audio API */
export function playEarcon(type: "start" | "stop" | "lock" | "success" | "cancel" | "error", enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";

    const profiles: Record<typeof type, { freqs: number[]; dur: number; vol: number }> = {
      start: { freqs: [392, 493.88], dur: 0.11, vol: 0.06 },
      lock: { freqs: [493.88, 587.33], dur: 0.12, vol: 0.06 },
      stop: { freqs: [493.88, 392], dur: 0.1, vol: 0.05 },
      success: { freqs: [587.33, 783.99], dur: 0.14, vol: 0.05 },
      cancel: { freqs: [329.63, 261.63], dur: 0.11, vol: 0.05 },
      error: { freqs: [220, 196], dur: 0.18, vol: 0.06 },
    };

    const p = profiles[type];
    osc.frequency.setValueAtTime(p.freqs[0], now);
    osc.frequency.exponentialRampToValueAtTime(p.freqs[1], now + p.dur);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(p.vol, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + p.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + p.dur + 0.02);
    setTimeout(() => void ctx.close(), 350);
  } catch {
    // Ignore audio context autoplay blocks gracefully
  }
}

export function exportHistoryMarkdown(records: DictationRecord[]): string {
  return records
    .map((r) => {
      const time = new Date(r.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const text = r.cleanedTranscript ?? r.rawTranscript ?? "";
      return `### [${time}] - [${r.targetAppName}]\n\n${text}\n`;
    })
    .join("\n");
}
