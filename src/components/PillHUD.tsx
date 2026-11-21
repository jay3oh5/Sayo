import React, { useEffect, useRef, useState } from "react";
import { Check, CornerDownLeft, Lock, Mic, Square, X } from "lucide-react";
import type { PillState } from "../types";
import { formatDuration } from "../utils/engine";

interface PillHUDProps {
  state: PillState;
  levelRef: React.MutableRefObject<number>;
  elapsedSeconds: number;
  onStartHandsFree: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onConfirmActionChip: () => void;
  onDismiss: () => void;
}

const BAR_WEIGHTS = [0.55, 0.85, 1.0, 0.85, 0.55];
const QUAD_COLORS = ["#4285F4", "#EA4335", "#FBBC04", "#34A853", "#4285F4"];

function WaveformCanvas({
  mode,
  levelRef,
}: {
  mode: "listening" | "processing";
  levelRef: React.MutableRefObject<number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = 44;
    const height = 22;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let rafId = 0;
    let smoothed = 0.08;
    const startTime = performance.now();

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      const t = (now - startTime) / 1000;

      const raw = Math.min(1, Math.max(0, levelRef.current));
      const alpha = raw > smoothed ? 0.42 : 0.14;
      smoothed = smoothed + (raw - smoothed) * alpha;

      const barW = 3.5;
      const gap = 4.5;
      const totalW = BAR_WEIGHTS.length * barW + (BAR_WEIGHTS.length - 1) * gap;
      const startX = (width - totalW) / 2;

      for (let i = 0; i < BAR_WEIGHTS.length; i++) {
        const x = startX + i * (barW + gap);
        let h: number;

        if (mode === "processing") {
          const wave = reducedMotion ? 0.45 : (Math.sin(t * 5.2 - i * 0.85) + 1) / 2;
          h = 4 + wave * 12;
          ctx.fillStyle = QUAD_COLORS[i];
        } else {
          const idleRipple = reducedMotion ? 0.12 : (Math.sin(t * 3.4 + i * 1.1) + 1) * 0.06;
          const energy = Math.max(0.08, Math.min(1, smoothed * 1.35 + idleRipple));
          h = 4 + energy * BAR_WEIGHTS[i] * 16;
          ctx.fillStyle = "#4285F4";
        }

        const y = (height - h) / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, barW / 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [mode, levelRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: 44, height: 22 }}
      className="shrink-0"
      aria-hidden="true"
    />
  );
}

export const PillHUD: React.FC<PillHUDProps> = ({
  state,
  levelRef,
  elapsedSeconds,
  onStartHandsFree,
  onStopRecording,
  onCancelRecording,
  onConfirmActionChip,
  onDismiss,
}) => {
  const [idleHovered, setIdleHovered] = useState(false);

  if (state.kind === "hidden") return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none"
      role="status"
      aria-live="polite"
    >
      {state.kind === "idleDot" && (
        <button
          type="button"
          onClick={onStartHandsFree}
          onMouseEnter={() => setIdleHovered(true)}
          onMouseLeave={() => setIdleHovered(false)}
          onFocus={() => setIdleHovered(true)}
          onBlur={() => setIdleHovered(false)}
          aria-label="Start hands-free dictation"
          className={`pointer-events-auto flex items-center justify-center rounded-full border border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-950/95 dark:bg-zinc-900/95 text-white shadow-lg shadow-black/15 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4285F4] ${
            idleHovered ? "h-9 px-3.5 gap-2" : "h-3.5 w-11 hover:h-9 hover:px-3.5"
          }`}
        >
          {idleHovered ? (
            <>
              <Mic className="w-3.5 h-3.5 text-[#4285F4]" />
              <span className="text-xs font-medium tracking-tight">Dictate</span>
            </>
          ) : (
            <span className="w-4 h-1 rounded-full bg-zinc-400/80" />
          )}
        </button>
      )}

      {state.kind === "listening" && (
        <div className="pointer-events-auto flex items-center gap-2.5 h-10 px-3.5 rounded-full bg-zinc-950/95 dark:bg-zinc-900/95 text-white border border-zinc-800 shadow-xl shadow-black/20">
          {state.locked && (
            <Lock className="w-3.5 h-3.5 text-[#4285F4] shrink-0" aria-label="Hands-free locked" />
          )}
          <WaveformCanvas mode="listening" levelRef={levelRef} />
          <span className="text-xs font-mono tabular-nums text-zinc-200 min-w-[34px]">
            {formatDuration(elapsedSeconds)}
          </span>
          {state.locked && (
            <div className="flex items-center gap-1 pl-1 border-l border-zinc-800">
              <button
                type="button"
                onClick={onStopRecording}
                title="Finish dictation"
                className="flex items-center justify-center w-6 h-6 rounded-full bg-[#4285F4] hover:bg-[#3367D6] text-white transition-colors"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
              </button>
              <button
                type="button"
                onClick={onCancelRecording}
                title="Cancel dictation (Esc)"
                className="flex items-center justify-center w-6 h-6 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {state.kind === "processing" && (
        <div className="pointer-events-auto flex items-center gap-2.5 h-10 px-4 rounded-full bg-zinc-950/95 dark:bg-zinc-900/95 text-white border border-zinc-800 shadow-xl shadow-black/20">
          <WaveformCanvas mode="processing" levelRef={levelRef} />
          <span className="text-xs font-medium text-zinc-200 tabular-nums">
            {state.inFlightCount > 1
              ? `Transcribing (${state.inFlightCount})`
              : "Transcribing"}
          </span>
        </div>
      )}

      {state.kind === "success" && (
        <div className="pointer-events-auto flex items-center gap-2 h-9 px-3.5 rounded-full bg-zinc-950/95 dark:bg-zinc-900/95 text-white border border-zinc-800 shadow-xl shadow-black/20">
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#34A853]/20 text-[#34A853]">
            <Check className="w-3 h-3 stroke-[2.5]" />
          </span>
          <span className="text-xs font-medium tabular-nums">
            {state.words} {state.words === 1 ? "word" : "words"}
          </span>
        </div>
      )}

      {state.kind === "actionChip" && (
        <div className="pointer-events-auto flex items-center gap-1.5 h-10 pl-3.5 pr-2 rounded-full bg-zinc-950/95 dark:bg-zinc-900/95 text-white border border-zinc-700 shadow-xl shadow-black/25">
          <button
            type="button"
            onClick={onConfirmActionChip}
            className="flex items-center gap-2 text-xs font-medium text-white hover:text-[#8AB4F8] transition-colors"
          >
            <CornerDownLeft className="w-3.5 h-3.5 text-[#4285F4]" />
            <span>Insert into {state.appName}</span>
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {state.kind === "notice" && (
        <div className="pointer-events-auto flex items-center gap-2 h-9 px-3.5 rounded-full bg-zinc-950/95 dark:bg-zinc-900/95 text-zinc-200 border border-zinc-800 shadow-lg">
          <span className="text-xs">{state.message}</span>
        </div>
      )}

      {state.kind === "error" && (
        <div className="pointer-events-auto sayo-shake flex items-center gap-2 h-9 px-3.5 rounded-full bg-zinc-950/95 text-white border border-[#EA4335]/60 shadow-xl shadow-black/20">
          <span className="text-xs text-[#F28B82] font-medium">{state.message}</span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error"
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
