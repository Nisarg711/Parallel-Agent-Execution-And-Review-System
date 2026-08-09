"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { fetcher, createTask } from "@/lib/api";
import { BranchIcon } from "@/components/BrandMark";

const STATUS = {
  pending: { label: "Queued", hex: "#545B68", pill: "bg-[#545B68]/15 text-[#9AA1AC] border-[#545B68]/30" },
  running: { label: "Running", hex: "#3FA9C9", pill: "bg-[#3FA9C9]/15 text-[#3FA9C9] border-[#3FA9C9]/30" },
  needs_review: { label: "Needs review", hex: "#E8A33D", pill: "bg-[#E8A33D]/15 text-[#E8A33D] border-[#E8A33D]/30" },
  approved: { label: "Approved", hex: "#4FB477", pill: "bg-[#4FB477]/15 text-[#4FB477] border-[#4FB477]/30" },
  rejected: { label: "Rejected", hex: "#E0605A", pill: "bg-[#E0605A]/15 text-[#E0605A] border-[#E0605A]/30" },
  failed: { label: "Failed", hex: "#E0605A", pill: "bg-[#E0605A]/15 text-[#E0605A] border-[#E0605A]/30" },
};

function statusInfo(status) {
  return STATUS[status] || STATUS.pending;
}

// Phases mirror the agent's real ReAct loop (see backend/app/agent.py's
// system prompts): explore the repo, decide, act, then optionally verify.
// We don't have telemetry on which exact step it's on, so this cycles
// through them as a plausible "what it's probably doing" — not a claim
// about the literal current step.
const RUNNING_PHASES = {
  edit: [
    "Setting up an isolated worktree…",
    "Reading through the code…",
    "Figuring out an approach…",
    "Writing the change…",
    "Double-checking the result…",
  ],
  suggest: [
    "Setting up an isolated worktree…",
    "Reading through the code…",
    "Figuring out an approach…",
    "Drafting a proposal…",
    "Double-checking the result…",
  ],
};

function useCyclingPhase(active, phases, intervalMs = 2600) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % phases.length), intervalMs);
    return () => clearInterval(id);
  }, [active, phases, intervalMs]);
  return active ? phases[index] : null;
}

// True for ~1.2s right after `value` changes — used to briefly highlight a
// card the moment its status actually flips, so a change between polls is
// easy to notice instead of silently swapping a label.
function useFlashOnChange(value) {
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(value);
  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(t);
    }
  }, [value]);
  return flash;
}

// The connector each task row draws from the shared trunk line into its own
// card — a small branch-out curve, colored by status, ending in a node.
// This is the same visual grammar as `git log --graph`: one trunk, many
// short-lived branches peeling off and (if approved) merging back in.
function BranchConnector({ hex, merged, pulsing }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" className="mt-3 shrink-0" aria-hidden>
      <path d="M6 0 Q6 16 22 16" stroke="#2A303C" strokeWidth="1.5" fill="none" />
      {pulsing && (
        // Flowing dashes racing along the curve toward the node — reads as
        // "work is actively moving from main into this branch right now."
        <path
          d="M6 0 Q6 16 22 16"
          stroke={hex}
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="4 5"
          className="animate-[dash-flow_0.8s_linear_infinite]"
        />
      )}
      {pulsing && <circle cx="22" cy="16" r="4" fill={hex} className="origin-center animate-ping" />}
      <circle cx="22" cy="16" r="4" fill={hex} />
      {merged && (
        <path d="M22 16 Q6 16 6 32" stroke={hex} strokeWidth="1.5" fill="none" strokeDasharray="3 2" />
      )}
    </svg>
  );
}

// One worker's lane. Reads real RQ/Redis state via /queue/status — not the
// tasks table — so this is a direct view into the queue mechanics: which
// process is idle, which one is actually crunching which job right now.
// Three dots bouncing in sequence — the universal "actively working" tell,
// next to whatever a busy worker is doing.
function BouncingDots() {
  return (
    <span className="ml-1 inline-flex items-end gap-0.5 align-middle">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1 w-1 animate-bounce rounded-full bg-[#3FA9C9]"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

// Stat tile contract: label (sentence case), value in text tokens (never the
// status color itself — identity comes from the dot beside the label, per
// the dataviz skill's "text never wears the data color" rule).
function StatTile({ label, value, dot }) {
  return (
    <div className="rounded-lg border border-[#232935] bg-[#12161F] px-5 py-4">
      <div className="flex items-center gap-2">
        {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />}
        <span className="text-sm text-[#7C8494]">{label}</span>
      </div>
      <p className="mt-2 font-mono text-3xl font-semibold text-[#E6E8EB]">{value}</p>
    </div>
  );
}

function WorkerLane({ worker }) {
  const busy = worker.state === "busy" && worker.current_description;
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-[#232935] bg-[#12161F] p-4 transition-all duration-700 ${
        busy ? "animate-[running-pulse_2s_ease-in-out_infinite] border-[#3FA9C9]/40" : ""
      }`}
    >
      {busy && (
        // A light sweep drifting across the card — continuous horizontal
        // movement so a busy worker reads as active at a glance, not just
        // differently colored.
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2 animate-[shimmer-sweep_2.2s_linear_infinite]"
          style={{ background: "linear-gradient(90deg, transparent, rgba(63,169,201,0.12), transparent)" }}
        />
      )}
      <div className="relative flex items-center justify-between gap-2">
        <span className="truncate font-mono text-sm text-[#7C8494]">{worker.name.slice(0, 12)}</span>
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {busy && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3FA9C9] opacity-75" />
          )}
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${busy ? "bg-[#3FA9C9]" : "bg-[#3A414D]"}`} />
        </span>
      </div>
      <p className={`relative mt-2 line-clamp-2 text-sm leading-snug ${busy ? "text-[#E6E8EB]" : "text-[#4B5563]"}`}>
        {busy ? worker.current_description : "idle"}
        {busy && <BouncingDots />}
      </p>
    </div>
  );
}

// One branch row. Pulled out of the list's .map() into its own component
// because useCyclingPhase/useFlashOnChange are hooks — they must run inside
// a real component instance per task, not inside a bare .map() callback.
function TaskRow({ task }) {
  const s = statusInfo(task.status);
  const isRunning = task.status === "running";
  const justChanged = useFlashOnChange(task.status);
  const phase = useCyclingPhase(isRunning, RUNNING_PHASES[task.mode] || RUNNING_PHASES.edit);

  return (
    <Link href={`/tasks/${task.id}`} className="group flex items-start gap-4">
      <BranchConnector hex={s.hex} merged={task.status === "approved"} pulsing={isRunning} />
      <div
        className={`flex-1 rounded-lg border border-[#232935] bg-[#12161F] p-5 transition-all duration-700 group-hover:-translate-y-0.5 group-hover:border-[#3A4150] group-hover:shadow-[0_8px_20px_rgba(0,0,0,0.3)] ${
          isRunning ? "animate-[running-pulse_2s_ease-in-out_infinite]" : ""
        } ${justChanged ? "border-[#E8A33D]/60 bg-[#1A1610]" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-base font-medium leading-snug text-[#E6E8EB]">{task.description}</p>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-xs ${s.pill}`}>
            {s.label}
          </span>
        </div>
        <p className="mt-2.5 font-mono text-sm text-[#7C8494]">
          {task.mode === "edit" ? "edit mode" : "suggest mode"} · agent/{task.id.slice(0, 8)}
          {isRunning && phase && (
            <span key={phase} className="animate-[text-fade-in_0.4s_ease-out] text-[#3FA9C9]">
              {" "}
              · {phase}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { data: tasks, error, isLoading } = useSWR("/tasks", fetcher, {
    refreshInterval: 2000,
  });
  const { data: queueStatus } = useSWR("/queue/status", fetcher, {
    refreshInterval: 2000,
  });

  const [description, setDescription] = useState("");
  const [mode, setMode] = useState("edit");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createTask(description, mode);
      setDescription("");
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const runningCount = tasks?.filter((t) => t.status === "running").length ?? 0;
  const needsReviewCount = tasks?.filter((t) => t.status === "needs_review").length ?? 0;
  const workersOnline = queueStatus?.workers?.length ?? 0;

  return (
    <main className="relative min-h-screen bg-[#0B0E14]">
      {/* Subtle depth: a soft radial glow behind the header so the dark
      field doesn't read as a flat void on wide viewports. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, rgba(232,163,61,0.07), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-4xl px-8 py-20">
        {/* Header */}
        <div className="mb-2 flex items-baseline justify-between">
          <h1 className="flex items-center gap-3 font-mono text-4xl font-semibold tracking-tight text-[#E6E8EB]">
            <BranchIcon className="h-7 w-7 text-[#E8A33D]" />
            Agent Tasks
          </h1>
          {runningCount > 0 && (
            <span className="flex items-center gap-2 font-mono text-sm text-[#3FA9C9]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3FA9C9] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#3FA9C9]" />
              </span>
              {runningCount} running
            </span>
          )}
        </div>
        <p className="mb-12 max-w-2xl text-base leading-relaxed text-[#7C8494]">
          Every task gets its own <code className="rounded bg-[#1A1F29] px-1.5 py-0.5 font-mono text-sm text-[#9AA1AC]">git worktree</code> —
          an isolated branch and folder, so parallel agents never collide. Nothing touches{" "}
          <code className="rounded bg-[#1A1F29] px-1.5 py-0.5 font-mono text-sm text-[#9AA1AC]">main</code> until
          you review the diff.
        </p>

        {/* KPI row — real counts, not decoration */}
        <div className="mb-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Branches" value={tasks?.length ?? "—"} />
          <StatTile label="Running" value={runningCount} dot="#3FA9C9" />
          <StatTile label="Needs review" value={needsReviewCount} dot="#E8A33D" />
          <StatTile label="Workers online" value={workersOnline} dot={workersOnline > 0 ? "#4FB477" : "#545B68"} />
        </div>

        {/* Composer */}
        <form
          onSubmit={handleSubmit}
          className="mb-16 rounded-xl border border-[#232935] bg-[#12161F] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition focus-within:border-[#E8A33D]/40"
        >
          <textarea
            className="w-full resize-none rounded-md border border-[#232935] bg-[#0B0E14] p-4 font-mono text-base text-[#E6E8EB] placeholder:text-[#4B5563] focus:outline-none focus:ring-1 focus:ring-[#E8A33D]/60"
            rows={3}
            placeholder="In src/components/login.jsx, add a password length check…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="mt-5 flex items-center justify-between">
            <div
              role="radiogroup"
              aria-label="Task mode"
              className="inline-flex rounded-md border border-[#232935] bg-[#0B0E14] p-1 text-sm"
            >
              {[
                { value: "edit", label: "Edit" },
                { value: "suggest", label: "Suggest" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === opt.value}
                  onClick={() => setMode(opt.value)}
                  className={`rounded-[5px] px-4 py-2 font-mono text-sm transition ${
                    mode === opt.value
                      ? "bg-[#232935] text-[#E6E8EB]"
                      : "text-[#7C8494] hover:text-[#9AA1AC]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <span className="hidden self-center px-3 text-sm text-[#4B5563] sm:inline">
                {mode === "edit" ? "agent writes the change" : "agent proposes only"}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting || !description.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-[#E8A33D] px-5 py-2.5 text-base font-medium text-[#0B0E14] transition hover:bg-[#F0B15A] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Starting…" : "Start task"}
              {!submitting && <span aria-hidden>→</span>}
            </button>
          </div>

          {submitError && (
            <p className="mt-3 text-sm text-[#E0605A]">Couldn't start the task — {submitError}</p>
          )}
        </form>

        {/* Workers: live RQ/Redis state, not derived from the tasks table */}
        {queueStatus && (
          <div id="workers" className="mb-12 scroll-mt-8">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="font-mono text-sm uppercase tracking-widest text-[#7C8494]">Workers</h2>
              <span className="font-mono text-sm text-[#4B5563]">{queueStatus.queued_count} queued</span>
            </div>
            {queueStatus.workers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#232935] py-6 text-center">
                <p className="text-sm text-[#7C8494]">
                  No workers connected — start one with <code className="text-[#9AA1AC]">rq worker tasks</code>.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {queueStatus.workers.map((w) => (
                  <WorkerLane key={w.name} worker={w} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Branch list */}
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-mono text-sm uppercase tracking-widest text-[#7C8494]">
            Branches
          </h2>
          {tasks?.length > 0 && (
            <span className="font-mono text-sm text-[#4B5563]">{tasks.length} total</span>
          )}
        </div>

        {isLoading && (
          <div className="rounded-lg border border-dashed border-[#232935] py-10 text-center">
            <p className="font-mono text-sm text-[#7C8494]">Loading…</p>
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-[#3A2323] bg-[#1A1414] px-4 py-3">
            <p className="text-sm text-[#E0605A]">Couldn't load tasks. Check that the API is running.</p>
          </div>
        )}
        {tasks?.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#232935] py-10 text-center">
            <p className="text-sm text-[#7C8494]">
              No branches yet. Describe a task above to send an agent into its own worktree.
            </p>
          </div>
        )}

        {tasks?.length > 0 && (
          <div className="relative">
            <div className="absolute bottom-3 left-[5px] top-0 w-px bg-[#232935]" />

            {/* Trunk label: the line above is literally `main` — everything
            below branches off it and (if approved) merges back in. */}
            <div className="mb-1 flex items-center gap-4">
              <span className="relative z-10 h-2.75 w-2.75 shrink-0 rounded-full bg-[#545B68] ring-4 ring-[#0B0E14]" />
              <span className="font-mono text-sm text-[#545B68]">main</span>
            </div>

            <div className="space-y-3">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
