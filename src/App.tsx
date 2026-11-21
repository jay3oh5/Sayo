import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BookA,
  Clock,
  Info,
  Mic,
  Moon,
  Settings,
  Sliders,
  Sun,
} from "lucide-react";
import type {
  AppToneRule,
  DictationRecord,
  DictionaryEntry,
  MainSection,
  PillState,
  SayoSettings,
} from "./types";
import {
  applyReplacementRules,
  countWords,
  DEFAULT_DICTIONARY,
  DEFAULT_TONE_RULES,
  playEarcon,
  SEED_HISTORY,
} from "./utils/engine";
import { PillHUD } from "./components/PillHUD";
import { DictationStudio } from "./components/DictationStudio";
import { HistoryView } from "./components/HistoryView";
import { DictionaryView } from "./components/DictionaryView";
import { AboutView, SettingsView, TonesView } from "./components/TonesSettingsAbout";

const STORAGE_KEYS = {
  history: "sayo.history.v1",
  dictionary: "sayo.dictionary.v1",
  tones: "sayo.tones.v1",
  settings: "sayo.settings.v1",
};

const DEFAULT_SETTINGS: SayoSettings = {
  hotkeyLabel: "Space",
  doubleTapLock: true,
  soundsEnabled: true,
  showIdleIndicator: true,
  smartTranscription: true,
  toneMatchingPass: true,
  audioRetentionDays: 7,
  theme: "light",
};

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read recorded audio."));
    reader.readAsDataURL(blob);
  });
}

const NAV_ITEMS: { id: MainSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "studio", label: "Studio", icon: Mic },
  { id: "history", label: "History", icon: Clock },
  { id: "dictionary", label: "Dictionary", icon: BookA },
  { id: "tones", label: "Per-App Tones", icon: Sliders },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "about", label: "About", icon: Info },
];

export default function App() {
  const [section, setSection] = useState<MainSection>("studio");
  const [settings, setSettings] = useState<SayoSettings>(() =>
    loadJSON(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
  );
  const [toneRules, setToneRules] = useState<AppToneRule[]>(() =>
    loadJSON(STORAGE_KEYS.tones, DEFAULT_TONE_RULES)
  );
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>(() =>
    loadJSON(STORAGE_KEYS.dictionary, DEFAULT_DICTIONARY)
  );
  const [history, setHistory] = useState<DictationRecord[]>(() =>
    loadJSON(STORAGE_KEYS.history, SEED_HISTORY)
  );

  const [activeAppBundleID, setActiveAppBundleID] = useState<string>(
    () => toneRules[1]?.bundleID ?? toneRules[0]?.bundleID ?? "com.apple.Notes"
  );
  const activeAppRef = useRef(activeAppBundleID);
  activeAppRef.current = activeAppBundleID;

  const [draftsByApp, setDraftsByApp] = useState<Record<string, string>>({});
  const [recentSweepAppID, setRecentSweepAppID] = useState<string | null>(null);

  // Audio capture & HUD state
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [inFlightCount, setInFlightCount] = useState(0);
  const [pillState, setPillState] = useState<PillState>(() =>
    settings.showIdleIndicator ? { kind: "idleDot" } : { kind: "hidden" }
  );

  const levelRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRafRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const cancelledRef = useRef<boolean>(false);
  const pillResetTimerRef = useRef<number | null>(null);
  const lastSpaceTapRef = useRef<number>(0);
  const spaceHeldRef = useRef<boolean>(false);

  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;
  const inFlightRef = useRef(inFlightCount);
  inFlightRef.current = inFlightCount;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const dictionaryRef = useRef(dictionary);
  dictionaryRef.current = dictionary;
  const toneRulesRef = useRef(toneRules);
  toneRulesRef.current = toneRules;

  // Apply theme class
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [settings.theme]);

  // Persist lightweight state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch {
      // ignore quota
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.tones, JSON.stringify(toneRules));
    } catch {
      // ignore
    }
  }, [toneRules]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.dictionary, JSON.stringify(dictionary));
    } catch {
      // ignore
    }
  }, [dictionary]);

  useEffect(() => {
    try {
      // Strip transient blob URLs and base64 audio blobs before persisting to localStorage
      const persistable = history.slice(0, 100).map(({ audioUrl: _u, audioBase64: _b, audioMimeType: _m, ...rest }) => rest);
      localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(persistable));
    } catch {
      // ignore
    }
  }, [history]);

  // Sync resting pill visibility when idle
  useEffect(() => {
    setPillState((prev) => {
      if (prev.kind === "hidden" || prev.kind === "idleDot") {
        return settings.showIdleIndicator ? { kind: "idleDot" } : { kind: "hidden" };
      }
      return prev;
    });
  }, [settings.showIdleIndicator]);

  // Elapsed timer while recording
  useEffect(() => {
    if (!isRecording) {
      setElapsedSeconds(0);
      return;
    }
    const id = window.setInterval(() => {
      setElapsedSeconds((Date.now() - recordingStartRef.current) / 1000);
    }, 250);
    return () => window.clearInterval(id);
  }, [isRecording]);

  const schedulePillIdle = useCallback((delayMs: number) => {
    if (pillResetTimerRef.current) {
      window.clearTimeout(pillResetTimerRef.current);
    }
    pillResetTimerRef.current = window.setTimeout(() => {
      if (isRecordingRef.current) return;
      if (inFlightRef.current > 0) {
        setPillState({ kind: "processing", inFlightCount: inFlightRef.current });
        return;
      }
      setPillState(settingsRef.current.showIdleIndicator ? { kind: "idleDot" } : { kind: "hidden" });
    }, delayMs);
  }, []);

  const insertIntoTarget = useCallback((bundleID: string, text: string) => {
    setDraftsByApp((prev) => {
      const existing = prev[bundleID] ?? "";
      const sep = existing.length > 0 && !existing.endsWith("\n") && !existing.endsWith(" ") ? " " : "";
      return { ...prev, [bundleID]: existing + sep + text };
    });
    setRecentSweepAppID(bundleID);
    window.setTimeout(() => {
      setRecentSweepAppID((curr) => (curr === bundleID ? null : curr));
    }, 950);
  }, []);

  const runPipeline = useCallback(
    async ({
      recordId,
      audioBase64,
      mimeType,
      durationSeconds,
      audioUrl,
      targetBundleID,
      targetAppName,
      isRetry,
    }: {
      recordId: string;
      audioBase64: string;
      mimeType: string;
      durationSeconds: number;
      audioUrl?: string;
      targetBundleID: string;
      targetAppName: string;
      isRetry?: boolean;
    }) => {
      const startedPipeline = performance.now();
      setInFlightCount((c) => {
        const next = c + 1;
        inFlightRef.current = next;
        if (!isRecordingRef.current) {
          setPillState({ kind: "processing", inFlightCount: next });
        }
        return next;
      });

      const currentSettings = settingsRef.current;
      const currentDict = dictionaryRef.current;
      const rule =
        toneRulesRef.current.find((r) => r.bundleID === targetBundleID) ??
        toneRulesRef.current[0];

      const vocabulary = currentDict
        .filter((e) => e.kind === "word")
        .map((e) => e.term);
      const spellings = currentDict
        .filter((e) => e.kind === "word" && e.misspelling)
        .map((e) => ({ term: e.term, misspelling: e.misspelling! }));

      try {
        // Stage 1: gemini-3.5-transcribe
        const tRes = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64,
            mimeType,
            smartMode: currentSettings.smartTranscription,
            vocabulary,
          }),
        });
        const tData = await tRes.json();
        if (!tRes.ok) {
          throw new Error(tData?.error || "Transcription request failed.");
        }

        const rawTranscript: string = (tData.rawTranscript ?? "").trim();
        if (!rawTranscript) {
          throw new Error("No speech detected in that clip.");
        }

        let cleanedTranscript = rawTranscript;
        let modelID: string = tData.model || "gemini-3.5-transcribe";

        // Stage 2: optional tone-matching cleanup via gemini-4-hydrogen
        if (currentSettings.toneMatchingPass && rule && rule.category !== "neutral") {
          const cRes = await fetch("/api/cleanup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rawTranscript,
              toneCategory: rule.category,
              customInstruction: rule.customInstruction,
              vocabulary,
              spellings,
            }),
          });
          if (cRes.ok) {
            const cData = await cRes.json();
            if (cData.cleanedTranscript) {
              cleanedTranscript = cData.cleanedTranscript;
              modelID = `${modelID}+${cData.model || "gemini-4-hydrogen"}`;
            }
          }
        }

        // Stage 3: deterministic ReplacementEngine (words + multi-line snippets)
        const finalTranscript = applyReplacementRules(cleanedTranscript, currentDict).trim();
        const words = countWords(finalTranscript);
        const pipelineSeconds = (performance.now() - startedPipeline) / 1000;

        // Focus-switch check (if user switched target app while transcribing)
        const switchedApp = !isRetry && activeAppRef.current !== targetBundleID;

        const completedRecord: DictationRecord = {
          id: recordId,
          startedAt: new Date().toISOString(),
          status: switchedApp ? "awaitingChip" : "inserted",
          targetAppName,
          targetAppBundleID: targetBundleID,
          durationSeconds,
          rawTranscript,
          cleanedTranscript: finalTranscript,
          wordCount: words,
          pipelineSeconds,
          modelID,
          audioUrl,
          audioBase64,
          audioMimeType: mimeType,
        };

        setHistory((prev) => {
          const exists = prev.some((r) => r.id === recordId);
          if (exists) {
            return prev.map((r) => (r.id === recordId ? { ...completedRecord, startedAt: r.startedAt } : r));
          }
          return [completedRecord, ...prev];
        });

        playEarcon("success", currentSettings.soundsEnabled);

        if (!isRetry) {
          if (switchedApp) {
            setPillState({
              kind: "actionChip",
              appName: targetAppName,
              bundleID: targetBundleID,
              text: finalTranscript,
            });
          } else {
            insertIntoTarget(targetBundleID, finalTranscript);
            if (!isRecordingRef.current) {
              setPillState({ kind: "success", words });
              schedulePillIdle(2200);
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transcription failed.";
        playEarcon("error", currentSettings.soundsEnabled);

        const failedRecord: DictationRecord = {
          id: recordId,
          startedAt: new Date().toISOString(),
          status: "failed",
          targetAppName,
          targetAppBundleID: targetBundleID,
          durationSeconds,
          rawTranscript: null,
          cleanedTranscript: null,
          wordCount: 0,
          errorMessage: message,
          audioUrl,
          audioBase64,
          audioMimeType: mimeType,
        };

        setHistory((prev) => {
          const exists = prev.some((r) => r.id === recordId);
          if (exists) {
            return prev.map((r) => (r.id === recordId ? { ...failedRecord, startedAt: r.startedAt } : r));
          }
          return [failedRecord, ...prev];
        });

        if (!isRecordingRef.current) {
          setPillState({ kind: "error", message });
          schedulePillIdle(4200);
        }
      } finally {
        setInFlightCount((c) => {
          const next = Math.max(0, c - 1);
          inFlightRef.current = next;
          return next;
        });
      }
    },
    [insertIntoTarget, schedulePillIdle]
  );

  const cleanupAudioGraph = useCallback(() => {
    cancelAnimationFrame(analyserRafRef.current);
    levelRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }, []);

  const startCapture = useCallback(
    async (locked: boolean) => {
      if (isRecordingRef.current) return;
      if (pillResetTimerRef.current) {
        window.clearTimeout(pillResetTimerRef.current);
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setPillState({ kind: "error", message: "Microphone API unavailable in this browser." });
        schedulePillIdle(3500);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // Web Audio RMS meter directly into ref (0 React renders/frame)
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const buffer = new Uint8Array(analyser.fftSize);
        const pump = () => {
          analyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            const v = (buffer[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buffer.length);
          levelRef.current = Math.min(1, rms * 3.8);
          analyserRafRef.current = requestAnimationFrame(pump);
        };
        analyserRafRef.current = requestAnimationFrame(pump);

        const preferredMime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

        const recorder = preferredMime
          ? new MediaRecorder(stream, { mimeType: preferredMime })
          : new MediaRecorder(stream);

        const targetBundleID = activeAppRef.current;
        const targetRule =
          toneRulesRef.current.find((r) => r.bundleID === targetBundleID) ??
          toneRulesRef.current[0];

        chunksRef.current = [];
        cancelledRef.current = false;
        recordingStartRef.current = Date.now();
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunksRef.current.push(ev.data);
        };

        recorder.onstop = async () => {
          cleanupAudioGraph();
          setIsRecording(false);
          setIsLocked(false);

          const durationSeconds = Math.max(0.1, (Date.now() - recordingStartRef.current) / 1000);
          if (cancelledRef.current) {
            playEarcon("cancel", settingsRef.current.soundsEnabled);
            setPillState({ kind: "notice", message: "Cancelled" });
            schedulePillIdle(1400);
            return;
          }

          if (durationSeconds < 0.35) {
            setPillState({ kind: "notice", message: "Hold slightly longer to speak" });
            schedulePillIdle(1800);
            return;
          }

          const mimeType = recorder.mimeType || "audio/webm";
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const audioUrl = URL.createObjectURL(blob);
          const audioBase64 = await blobToBase64(blob);
          const recordId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

          void runPipeline({
            recordId,
            audioBase64,
            mimeType: mimeType.split(";")[0],
            durationSeconds,
            audioUrl,
            targetBundleID: targetRule.bundleID,
            targetAppName: targetRule.appName,
          });
        };

        recorder.start(100);
        setIsRecording(true);
        setIsLocked(locked);
        setPillState({ kind: "listening", locked });
        playEarcon(locked ? "lock" : "start", settingsRef.current.soundsEnabled);
      } catch {
        cleanupAudioGraph();
        playEarcon("error", settingsRef.current.soundsEnabled);
        setPillState({ kind: "error", message: "Microphone permission denied." });
        schedulePillIdle(3800);
      }
    },
    [cleanupAudioGraph, runPipeline, schedulePillIdle]
  );

  const stopCapture = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      playEarcon("stop", settingsRef.current.soundsEnabled);
      rec.stop();
    }
  }, []);

  const cancelCapture = useCallback(() => {
    cancelledRef.current = true;
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
  }, []);

  // Global keyboard shortcuts: Hold Space (outside editable fields), double-tap Space to lock, Esc to cancel
  useEffect(() => {
    const isEditable = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isRecordingRef.current) {
        e.preventDefault();
        cancelCapture();
        return;
      }

      if (e.code === "Space" && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditable(e.target)) {
        if (e.repeat) {
          e.preventDefault();
          return;
        }
        e.preventDefault();

        if (isRecordingRef.current && isLockedRef.current) {
          stopCapture();
          return;
        }

        const now = Date.now();
        if (settingsRef.current.doubleTapLock && now - lastSpaceTapRef.current < 320) {
          lastSpaceTapRef.current = 0;
          spaceHeldRef.current = false;
          void startCapture(true);
          return;
        }
        lastSpaceTapRef.current = now;
        spaceHeldRef.current = true;
        void startCapture(false);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && spaceHeldRef.current) {
        e.preventDefault();
        spaceHeldRef.current = false;
        if (isRecordingRef.current && !isLockedRef.current) {
          stopCapture();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [cancelCapture, startCapture, stopCapture]);

  // Dictionary handlers
  const handleAddDictionary = (entry: Omit<DictionaryEntry, "id" | "createdAt">): string | null => {
    const dup = dictionary.some(
      (e) =>
        e.kind === entry.kind &&
        (entry.kind === "word"
          ? e.term.toLowerCase() === entry.term.toLowerCase()
          : (e.misspelling ?? "").toLowerCase() === (entry.misspelling ?? "").toLowerCase())
    );
    if (dup) {
      return entry.kind === "word"
        ? "That word is already in your dictionary."
        : "A snippet with that trigger phrase already exists.";
    }
    setDictionary((prev) => [
      {
        ...entry,
        id: `dict-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    return null;
  };

  const handleUpdateDictionary = (
    id: string,
    term: string,
    misspelling?: string
  ): string | null => {
    const target = dictionary.find((e) => e.id === id);
    if (!target) return "Entry not found.";
    const dup = dictionary.some(
      (e) =>
        e.id !== id &&
        e.kind === target.kind &&
        (target.kind === "word"
          ? e.term.toLowerCase() === term.toLowerCase()
          : (e.misspelling ?? "").toLowerCase() === (misspelling ?? "").toLowerCase())
    );
    if (dup) return "Another entry already uses that key.";
    setDictionary((prev) =>
      prev.map((e) => (e.id === id ? { ...e, term, misspelling } : e))
    );
    return null;
  };

  const handleImportDictionary = (
    parsed: Omit<DictionaryEntry, "id" | "createdAt">[]
  ): number => {
    let added = 0;
    setDictionary((prev) => {
      const next = [...prev];
      for (const item of parsed) {
        const exists = next.some(
          (e) =>
            e.kind === item.kind &&
            (item.kind === "word"
              ? e.term.toLowerCase() === item.term.toLowerCase()
              : (e.misspelling ?? "").toLowerCase() === (item.misspelling ?? "").toLowerCase())
        );
        if (!exists) {
          next.unshift({
            ...item,
            id: `dict-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            createdAt: new Date().toISOString(),
          });
          added++;
        }
      }
      return next;
    });
    return added;
  };

  const handleRetryRecord = async (id: string) => {
    const rec = history.find((r) => r.id === id);
    if (!rec?.audioBase64) return;
    await runPipeline({
      recordId: rec.id,
      audioBase64: rec.audioBase64,
      mimeType: rec.audioMimeType || "audio/webm",
      durationSeconds: rec.durationSeconds,
      audioUrl: rec.audioUrl,
      targetBundleID: rec.targetAppBundleID,
      targetAppName: rec.targetAppName,
      isRetry: true,
    });
  };

  const currentNav = NAV_ITEMS.find((n) => n.id === section) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex bg-[#FBFBFC] dark:bg-[#0D0E11] text-zinc-900 dark:text-zinc-100">
      {/* Left Sidebar (Desktop) */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-zinc-200/80 dark:border-zinc-800/90 bg-white dark:bg-[#111318]">
        <div className="h-14 px-5 flex items-center gap-2.5 border-b border-zinc-200/70 dark:border-zinc-800/80">
          <img
            src="/docs/images/icon.png"
            alt="Sayo"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="w-7 h-7 rounded-lg object-cover border border-zinc-200/70 dark:border-zinc-700"
          />
          <div className="leading-none">
            <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Sayo
            </span>
            <span className="block text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 tabular-nums">
              v0.6.1
            </span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-zinc-100 dark:bg-zinc-800/90 text-zinc-950 dark:text-white"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    active ? "text-[#1A73E8] dark:text-[#8AB4F8]" : "text-zinc-400 dark:text-zinc-500"
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-200/70 dark:border-zinc-800/80 text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
          <div className="font-medium text-zinc-700 dark:text-zinc-300">Keyboard shortcut</div>
          <div>Hold Space · Double-tap lock</div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean Single-Row Top Header */}
        <header className="h-14 px-5 md:px-8 flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/90 bg-white/80 dark:bg-[#111318]/80 backdrop-blur-xs sticky top-0 z-20">
          <div className="flex items-center gap-2 text-sm">
            <span className="md:hidden font-semibold text-zinc-900 dark:text-zinc-50">Sayo</span>
            <span className="md:hidden text-zinc-300 dark:text-zinc-700">/</span>
            <span className="font-medium text-zinc-800 dark:text-zinc-100">{currentNav.label}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSettings((s) => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" }))
              }
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {settings.theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => (isRecording ? stopCapture() : void startCapture(true))}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                isRecording
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  : "bg-[#1A73E8] hover:bg-[#1557B0] text-white"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{isRecording ? "Stop" : "Dictate"}</span>
            </button>
          </div>
        </header>

        {/* Mobile Nav Strip */}
        <nav className="flex md:hidden items-center gap-1 px-4 py-2 border-b border-zinc-200/80 dark:border-zinc-800 overflow-x-auto bg-white dark:bg-[#111318]">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                section === item.id
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Main Scrollable Content */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-5 md:px-8 py-6 pb-24">
          {section === "studio" && (
            <DictationStudio
              toneRules={toneRules}
              activeAppBundleID={activeAppBundleID}
              onSelectApp={setActiveAppBundleID}
              draftsByApp={draftsByApp}
              onChangeDraft={(bundleID, value) =>
                setDraftsByApp((prev) => ({ ...prev, [bundleID]: value }))
              }
              isRecording={isRecording}
              isLocked={isLocked}
              elapsedSeconds={elapsedSeconds}
              inFlightCount={inFlightCount}
              recentSweepAppID={recentSweepAppID}
              lastRecord={history[0] ?? null}
              settings={settings}
              onHoldStart={() => void startCapture(false)}
              onHoldEnd={stopCapture}
              onToggleHandsFree={() => void startCapture(true)}
              onCancelRecording={cancelCapture}
              onOpenSection={(target) => setSection(target)}
            />
          )}

          {section === "history" && (
            <HistoryView
              records={history}
              onRetryRecord={handleRetryRecord}
              onDeleteRecord={(id) => setHistory((prev) => prev.filter((r) => r.id !== id))}
              onClearHistory={() => setHistory([])}
            />
          )}

          {section === "dictionary" && (
            <DictionaryView
              entries={dictionary}
              onAddEntry={handleAddDictionary}
              onUpdateEntry={handleUpdateDictionary}
              onToggleStar={(id) =>
                setDictionary((prev) =>
                  prev.map((e) => (e.id === id ? { ...e, starred: !e.starred } : e))
                )
              }
              onDeleteEntry={(id) =>
                setDictionary((prev) => prev.filter((e) => e.id !== id))
              }
              onImportEntries={handleImportDictionary}
            />
          )}

          {section === "tones" && (
            <TonesView
              rules={toneRules}
              onUpdateRule={(id, patch) =>
                setToneRules((prev) =>
                  prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
                )
              }
              onAddRule={(rule) =>
                setToneRules((prev) => [
                  ...prev,
                  { ...rule, id: `tone-${Date.now()}` },
                ])
              }
              onDeleteRule={(id) => {
                setToneRules((prev) => {
                  const next = prev.filter((r) => r.id !== id);
                  if (
                    next.length > 0 &&
                    !next.some((r) => r.bundleID === activeAppBundleID)
                  ) {
                    setActiveAppBundleID(next[0].bundleID);
                  }
                  return next;
                });
              }}
            />
          )}

          {section === "settings" && (
            <SettingsView
              settings={settings}
              onUpdate={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
            />
          )}

          {section === "about" && <AboutView />}
        </main>
      </div>

      {/* Floating Sayo Pill HUD */}
      <PillHUD
        state={pillState}
        levelRef={levelRef}
        elapsedSeconds={elapsedSeconds}
        onStartHandsFree={() => void startCapture(true)}
        onStopRecording={stopCapture}
        onCancelRecording={cancelCapture}
        onConfirmActionChip={() => {
          if (pillState.kind !== "actionChip") return;
          setActiveAppBundleID(pillState.bundleID);
          insertIntoTarget(pillState.bundleID, pillState.text);
          setSection("studio");
          setPillState({ kind: "success", words: countWords(pillState.text) });
          schedulePillIdle(1800);
        }}
        onDismiss={() => {
          setPillState(settings.showIdleIndicator ? { kind: "idleDot" } : { kind: "hidden" });
        }}
      />
    </div>
  );
}
