export type MainSection =
  | "studio"
  | "history"
  | "dictionary"
  | "tones"
  | "settings"
  | "about";

export type ToneCategory =
  | "email"
  | "workChat"
  | "personalChat"
  | "code"
  | "neutral"
  | "custom";

export interface AppToneRule {
  id: string;
  bundleID: string;
  appName: string;
  category: ToneCategory;
  customInstruction?: string;
  isDefault?: boolean;
}

export type DictionaryKind = "word" | "snippet";

export interface DictionaryEntry {
  id: string;
  kind: DictionaryKind;
  /** Correct word/phrase, or snippet expansion body */
  term: string;
  /** Optional misspelling for words, or spoken trigger phrase for snippets */
  misspelling?: string;
  starred: boolean;
  createdAt: string;
}

export type DictationStatus =
  | "inserted"
  | "copiedToClipboard"
  | "awaitingChip"
  | "failed"
  | "queuedForRetry"
  | "cancelled";

export interface DictationRecord {
  id: string;
  startedAt: string;
  status: DictationStatus;
  targetAppName: string;
  targetAppBundleID: string;
  durationSeconds: number;
  rawTranscript: string | null;
  cleanedTranscript: string | null;
  wordCount: number;
  pipelineSeconds?: number;
  modelID?: string;
  errorCode?: string;
  errorMessage?: string;
  /** Session-local Blob URL for interactive audio scrubbing */
  audioUrl?: string;
  /** Session-local base64 + mime for Retry Transcription */
  audioBase64?: string;
  audioMimeType?: string;
}

export interface SayoSettings {
  hotkeyLabel: string;
  doubleTapLock: boolean;
  soundsEnabled: boolean;
  showIdleIndicator: boolean;
  smartTranscription: boolean;
  toneMatchingPass: boolean;
  audioRetentionDays: number;
  theme: "light" | "dark";
}

export type PillState =
  | { kind: "hidden" }
  | { kind: "idleDot" }
  | { kind: "listening"; locked: boolean }
  | { kind: "processing"; inFlightCount: number }
  | { kind: "success"; words: number }
  | { kind: "actionChip"; appName: string; bundleID: string; text: string }
  | { kind: "notice"; message: string }
  | { kind: "error"; message: string };
