import React, { useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { DictionaryEntry, DictionaryKind } from "../types";
import { exportDictionaryCSV, parseDictionaryCSV } from "../utils/engine";

interface DictionaryViewProps {
  entries: DictionaryEntry[];
  onAddEntry: (entry: Omit<DictionaryEntry, "id" | "createdAt">) => string | null;
  onUpdateEntry: (id: string, term: string, misspelling?: string) => string | null;
  onToggleStar: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onImportEntries: (entries: Omit<DictionaryEntry, "id" | "createdAt">[]) => number;
}

export const DictionaryView: React.FC<DictionaryViewProps> = ({
  entries,
  onAddEntry,
  onUpdateEntry,
  onToggleStar,
  onDeleteEntry,
  onImportEntries,
}) => {
  const [kind, setKind] = useState<DictionaryKind>("word");
  const [query, setQuery] = useState("");
  const [termInput, setTermInput] = useState("");
  const [triggerInput, setTriggerInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTerm, setEditTerm] = useState("");
  const [editTrigger, setEditTrigger] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const wordCount = useMemo(() => entries.filter((e) => e.kind === "word").length, [entries]);
  const snippetCount = useMemo(() => entries.filter((e) => e.kind === "snippet").length, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => e.kind === kind)
      .filter((e) => {
        if (!q) return true;
        return (
          e.term.toLowerCase().includes(q) ||
          (e.misspelling ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Number(b.starred) - Number(a.starred));
  }, [entries, kind, query]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const term = termInput.trim();
    const misspelling = triggerInput.trim() || undefined;

    if (!term) {
      setFormError(kind === "word" ? "Enter a word or phrase." : "Enter the snippet expansion text.");
      return;
    }
    if (kind === "word" && term.length > 60) {
      setFormError("Vocabulary terms must be 60 characters or fewer.");
      return;
    }
    if (kind === "snippet" && !misspelling) {
      setFormError("Snippets require a spoken trigger phrase.");
      return;
    }

    const err = onAddEntry({ kind, term, misspelling, starred: false });
    if (err) {
      setFormError(err);
      return;
    }
    setTermInput("");
    setTriggerInput("");
  };

  const beginEdit = (entry: DictionaryEntry) => {
    setEditingId(entry.id);
    setEditTerm(entry.term);
    setEditTrigger(entry.misspelling ?? "");
    setEditError(null);
  };

  const saveEdit = (entry: DictionaryEntry) => {
    const term = editTerm.trim();
    const trigger = editTrigger.trim() || undefined;
    if (!term) {
      setEditError("Value cannot be empty.");
      return;
    }
    if (entry.kind === "word" && term.length > 60) {
      setEditError("Max 60 characters for words.");
      return;
    }
    if (entry.kind === "snippet" && !trigger) {
      setEditError("Trigger phrase is required.");
      return;
    }
    const err = onUpdateEntry(entry.id, term, trigger);
    if (err) {
      setEditError(err);
      return;
    }
    setEditingId(null);
    setEditError(null);
  };

  const handleExportCSV = () => {
    const csv = exportDictionaryCSV(entries);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sayo-dictionary.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseDictionaryCSV(text);
    const added = onImportEntries(parsed);
    setImportNotice(added > 0 ? `Imported ${added} ${added === 1 ? "entry" : "entries"}` : "No new entries found");
    setTimeout(() => setImportNotice(null), 2600);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-zinc-200/80 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Dictionary
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Teach Sayo custom vocabulary spellings and deterministic multi-line voice snippets.
          </p>
        </div>

        {/* Words / Snippets Segmented Switch */}
        <div className="inline-flex rounded-lg p-0.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setKind("word");
              setFormError(null);
              setEditingId(null);
            }}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors tabular-nums ${
              kind === "word"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Words ({wordCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setKind("snippet");
              setFormError(null);
              setEditingId(null);
            }}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors tabular-nums ${
              kind === "snippet"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Snippets ({snippetCount})
          </button>
        </div>
      </div>

      {/* Add Form */}
      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#15171C] p-4 space-y-3"
      >
        {kind === "word" ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <input
              type="text"
              value={termInput}
              onChange={(e) => setTermInput(e.target.value)}
              placeholder="Word or phrase (e.g. Kubernetes)"
              className="md:col-span-5 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/60 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#4285F4]"
            />
            <input
              type="text"
              value={triggerInput}
              onChange={(e) => setTriggerInput(e.target.value)}
              placeholder="Common misspelling (optional, e.g. cooper netties)"
              className="md:col-span-5 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/60 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#4285F4]"
            />
            <button
              type="submit"
              className="md:col-span-2 inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add word</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <input
                type="text"
                value={triggerInput}
                onChange={(e) => setTriggerInput(e.target.value)}
                placeholder="Spoken trigger phrase (e.g. my sign off)"
                className="md:col-span-9 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/60 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#4285F4]"
              />
              <button
                type="submit"
                className="md:col-span-3 inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add snippet</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={termInput}
              onChange={(e) => setTermInput(e.target.value)}
              placeholder="Multi-line expansion body (supports line breaks, email signatures, templates)…"
              className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/60 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#4285F4] resize-y"
            />
          </div>
        )}

        {formError && (
          <p className="text-xs text-[#C5221F] dark:text-[#F28B82]">{formError}</p>
        )}
      </form>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Filter ${kind === "word" ? "words" : "snippets"}…`}
          className="w-full h-9 pl-10 pr-4 rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-[#15171C] text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#4285F4]"
        />
      </div>

      {/* Entries Table */}
      <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#15171C] divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No {kind === "word" ? "words" : "snippets"} yet.
          </div>
        ) : (
          filtered.map((entry) => {
            const isEditing = editingId === entry.id;
            return (
              <div key={entry.id} className="px-4 py-3">
                {isEditing ? (
                  <div className="space-y-2.5">
                    {entry.kind === "word" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          value={editTerm}
                          onChange={(e) => setEditTerm(e.target.value)}
                          placeholder="Word or phrase"
                          className="h-8 px-2.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#4285F4]"
                        />
                        <input
                          type="text"
                          value={editTrigger}
                          onChange={(e) => setEditTrigger(e.target.value)}
                          placeholder="Misspelling (optional)"
                          className="h-8 px-2.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#4285F4]"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editTrigger}
                          onChange={(e) => setEditTrigger(e.target.value)}
                          placeholder="Trigger phrase"
                          className="w-full h-8 px-2.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#4285F4]"
                        />
                        <textarea
                          rows={3}
                          value={editTerm}
                          onChange={(e) => setEditTerm(e.target.value)}
                          placeholder="Expansion text"
                          className="w-full p-2.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#4285F4]"
                        />
                      </div>
                    )}
                    {editError && (
                      <p className="text-xs text-[#C5221F] dark:text-[#F28B82]">{editError}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(entry)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#1A73E8] text-white text-xs font-medium hover:bg-[#1557B0]"
                      >
                        <Check className="w-3 h-3" />
                        <span>Save</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300"
                      >
                        <X className="w-3 h-3" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => onToggleStar(entry.id)}
                        aria-label={entry.starred ? "Unstar entry" : "Star entry"}
                        className="mt-0.5 text-zinc-300 dark:text-zinc-600 hover:text-[#FBBC04] transition-colors shrink-0"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            entry.starred ? "fill-[#FBBC04] text-[#FBBC04]" : ""
                          }`}
                        />
                      </button>
                      <div className="min-w-0">
                        {entry.kind === "word" ? (
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {entry.term}
                            </span>
                            {entry.misspelling && (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                ← {entry.misspelling}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-xs font-mono text-[#1A73E8] dark:text-[#8AB4F8]">
                              “{entry.misspelling}”
                            </div>
                            <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
                              {entry.term}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => beginEdit(entry)}
                        title="Edit inline"
                        className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteEntry(entry.id)}
                        title="Delete"
                        className="p-1.5 rounded-md text-zinc-400 hover:text-[#C5221F] dark:hover:text-[#F28B82] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer with Accurate Counts + CSV Import/Export */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
        <div>
          {wordCount} {wordCount === 1 ? "word" : "words"} · {snippetCount}{" "}
          {snippetCount === 1 ? "snippet" : "snippets"}
          {importNotice ? ` · ${importNotice}` : ""}
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void handleFileChange(e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#15171C] hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-medium transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#15171C] hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};
