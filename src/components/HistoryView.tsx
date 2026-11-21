import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Pause,
  Play,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { DictationRecord } from "../types";
import { exportHistoryMarkdown, formatDuration } from "../utils/engine";

interface HistoryViewProps {
  records: DictationRecord[];
  onRetryRecord: (id: string) => Promise<void>;
  onDeleteRecord: (id: string) => void;
  onClearHistory: () => void;
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2];

function dayGroupLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function RecordDetailModal({
  record,
  onClose,
  onRetry,
  onDelete,
}: {
  record: DictationRecord;
  onClose: () => void;
  onRetry: (id: string) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const hasDistinctRaw =
    Boolean(record.rawTranscript) &&
    Boolean(record.cleanedTranscript) &&
    record.rawTranscript!.trim() !== record.cleanedTranscript!.trim();

  const [tab, setTab] = useState<"cleaned" | "raw">("cleaned");
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Seekable audio playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(record.durationSeconds || 0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const displayedText =
    tab === "raw"
      ? record.rawTranscript ?? record.cleanedTranscript ?? ""
      : record.cleanedTranscript ?? record.rawTranscript ?? "";

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  const handleSeek = (next: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = next;
    }
    setCurrentTime(next);
  };

  const handleCopy = async () => {
    if (!displayedText) return;
    try {
      await navigator.clipboard.writeText(displayedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleRetryClick = async () => {
    setRetrying(true);
    try {
      await onRetry(record.id);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#15171C] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200/80 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {record.targetAppName}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
              {new Date(record.startedAt).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              · {record.wordCount} words · {formatDuration(record.durationSeconds)}
              {record.pipelineSeconds ? ` · ${record.pipelineSeconds.toFixed(2)}s` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {hasDistinctRaw && (
            <div className="inline-flex rounded-lg p-0.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setTab("cleaned")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  tab === "cleaned"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Cleaned
              </button>
              <button
                type="button"
                onClick={() => setTab("raw")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  tab === "raw"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Raw speech
              </button>
            </div>
          )}

          {record.errorMessage && (
            <div className="rounded-lg border border-[#EA4335]/30 bg-[#EA4335]/5 px-3.5 py-2.5 text-xs text-[#C5221F] dark:text-[#F28B82]">
              {record.errorMessage}
            </div>
          )}

          <div className="rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 p-4 max-h-60 overflow-y-auto">
            <p className="text-sm leading-relaxed text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
              {displayedText || "No transcript captured."}
            </p>
          </div>

          {/* Interactive Seekable Audio Scrubber */}
          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-3.5 space-y-2">
            {record.audioUrl ? (
              <>
                <audio
                  ref={audioRef}
                  src={record.audioUrl}
                  onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration;
                    if (Number.isFinite(d) && d > 0) setDuration(d);
                  }}
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onEnded={() => {
                    setIsPlaying(false);
                    setCurrentTime(0);
                  }}
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? "Pause audio" : "Play audio"}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white shrink-0 transition-colors"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                  </button>

                  <input
                    type="range"
                    min={0}
                    max={Math.max(duration, 0.1)}
                    step={0.05}
                    value={Math.min(currentTime, Math.max(duration, 0.1))}
                    onChange={(e) => handleSeek(parseFloat(e.target.value))}
                    aria-label="Seek audio position"
                    className="flex-1 accent-[#1A73E8] h-1.5 cursor-pointer"
                  />

                  <span className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400 shrink-0">
                    {formatDuration(currentTime)} / {formatDuration(duration)}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx = (SPEED_OPTIONS.indexOf(playbackRate) + 1) % SPEED_OPTIONS.length;
                      setPlaybackRate(SPEED_OPTIONS[nextIdx]);
                    }}
                    className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-[11px] font-mono tabular-nums text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    {playbackRate}x
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Audio clip not retained for this entry. Record a new dictation to scrub and replay audio.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
          <button
            type="button"
            onClick={() => {
              onDelete(record.id);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#C5221F] dark:text-[#F28B82] hover:bg-[#EA4335]/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>

          <div className="flex items-center gap-2">
            {record.audioBase64 && (
              <button
                type="button"
                onClick={handleRetryClick}
                disabled={retrying}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
                <span>{retrying ? "Retrying…" : "Retry transcription"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCopy}
              disabled={!displayedText}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium disabled:opacity-40 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy text"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  records,
  onRetryRecord,
  onDeleteRecord,
  onClearHistory,
}) => {
  const [query, setQuery] = useState("");
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Full-corpus stats computed independently of search query
  const stats = useMemo(() => {
    const completed = records.filter(
      (r) => r.status === "inserted" || r.status === "copiedToClipboard" || r.status === "awaitingChip"
    );
    const totalWords = completed.reduce((acc, r) => acc + r.wordCount, 0);
    const totalMinutes = completed.reduce((acc, r) => acc + r.durationSeconds, 0) / 60;
    const avgWpm = totalMinutes > 0.05 ? Math.round(totalWords / totalMinutes) : 0;
    return {
      totalWords,
      totalSessions: completed.length,
      avgWpm,
    };
  }, [records]);

  const attentionRecords = useMemo(
    () => records.filter((r) => r.status === "failed" || r.status === "queuedForRetry"),
    [records]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = records.filter((r) => r.status !== "failed" && r.status !== "queuedForRetry");
    if (!q) return visible;
    return visible.filter(
      (r) =>
        (r.cleanedTranscript ?? "").toLowerCase().includes(q) ||
        (r.rawTranscript ?? "").toLowerCase().includes(q) ||
        r.targetAppName.toLowerCase().includes(q)
    );
  }, [records, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, DictationRecord[]>();
    for (const r of filtered) {
      const label = dayGroupLabel(r.startedAt);
      const list = map.get(label) ?? [];
      list.push(r);
      map.set(label, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const selectedRecord = records.find((r) => r.id === selectedID) ?? null;

  const handleExportMarkdown = async () => {
    if (records.length === 0) return;
    try {
      await navigator.clipboard.writeText(exportHistoryMarkdown(records));
      setExported(true);
      setTimeout(() => setExported(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleQuickCopy = async (e: React.MouseEvent, rec: DictationRecord) => {
    e.stopPropagation();
    const text = rec.cleanedTranscript ?? rec.rawTranscript ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(rec.id);
      setTimeout(() => setCopiedId(null), 1400);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-zinc-200/80 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            History
          </h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">
            <span>
              <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                {stats.totalWords.toLocaleString()}
              </strong>{" "}
              words dictated
            </span>
            <span>
              <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                {stats.totalSessions}
              </strong>{" "}
              dictations
            </span>
            {stats.avgWpm > 0 && (
              <span>
                <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {stats.avgWpm}
                </strong>{" "}
                avg WPM
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportMarkdown}
            disabled={records.length === 0}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#15171C] hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 disabled:opacity-40 transition-colors"
          >
            {exported ? <Check className="w-3.5 h-3.5 text-[#34A853]" /> : <Download className="w-3.5 h-3.5" />}
            <span>{exported ? "Copied Markdown" : "Export Markdown"}</span>
          </button>

          {confirmClear ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onClearHistory();
                  setConfirmClear(false);
                }}
                className="h-9 px-3 rounded-lg bg-[#EA4335] text-white text-xs font-medium hover:bg-[#D93025] transition-colors"
              >
                Confirm clear
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={records.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-[#C5221F] dark:hover:text-[#F28B82] disabled:opacity-40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Needs Attention Shelf */}
      {attentionRecords.length > 0 && (
        <div className="rounded-xl border border-[#EA4335]/30 bg-[#EA4335]/[0.03] dark:bg-[#EA4335]/[0.06] p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#C5221F] dark:text-[#F28B82]">
            Needs attention ({attentionRecords.length})
          </div>
          <div className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
            {attentionRecords.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {rec.errorMessage || "Transcription failed"}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {rec.targetAppName} · {formatDuration(rec.durationSeconds)} ·{" "}
                    {new Date(rec.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {rec.audioBase64 && (
                    <button
                      type="button"
                      onClick={() => void onRetryRecord(rec.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteRecord(rec.id)}
                    className="px-2 py-1 rounded-md text-xs text-zinc-500 hover:text-[#C5221F] dark:hover:text-[#F28B82]"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search transcripts or target apps…"
          className="w-full h-10 pl-10 pr-9 rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-[#15171C] text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#4285F4]/40 focus:border-[#4285F4]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Day-Grouped Timeline */}
      {grouped.length === 0 ? (
        <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#15171C] py-12 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {query ? `No transcripts matching “${query}”.` : "No dictation history yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, items]) => (
            <section key={day} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">
                {day}
              </h2>
              <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#15171C] divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden">
                {items.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => setSelectedID(rec.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedID(rec.id);
                      }
                    }}
                    className="group flex items-start justify-between gap-4 px-4 py-3.5 hover:bg-zinc-50/90 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-relaxed">
                        {rec.cleanedTranscript ?? rec.rawTranscript ?? "—"}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {rec.targetAppName}
                        </span>
                        <span>·</span>
                        <span>
                          {new Date(rec.startedAt).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        <span>·</span>
                        <span>{rec.wordCount} words</span>
                        <span>·</span>
                        <span>{formatDuration(rec.durationSeconds)}</span>
                        {rec.audioUrl && (
                          <>
                            <span>·</span>
                            <span className="text-[#1A73E8] dark:text-[#8AB4F8]">Audio ready</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={(e) => void handleQuickCopy(e, rec)}
                        title="Copy transcript"
                        className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        {copiedId === rec.id ? (
                          <Check className="w-3.5 h-3.5 text-[#34A853]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRecord(rec.id);
                        }}
                        title="Delete entry"
                        className="p-1.5 rounded-md text-zinc-500 hover:text-[#C5221F] dark:hover:text-[#F28B82] hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {selectedRecord && (
        <RecordDetailModal
          record={selectedRecord}
          onClose={() => setSelectedID(null)}
          onRetry={onRetryRecord}
          onDelete={onDeleteRecord}
        />
      )}
    </div>
  );
};
