"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { fetcher, createTask } from "@/lib/api";

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

// Git-branch glyph: two nodes on the trunk plus one branch node peeling off,
// used as the product mark since "isolated branch per task" is the whole idea.
function BranchIcon({ className }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <circle cx="4" cy="3" r="1.6" fill="currentColor" />
      <circle cx="4" cy="13" r="1.6" fill="currentColor" />
      <circle cx="12" cy="9" r="1.6" fill="currentColor" />
      <path d="M4 4.6V11.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 7C4 8.4 5 9 6.5 9H10.4" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

// The connector each task row draws from the shared trunk line into its own
// card — a small branch-out curve, colored by status, ending in a node.
// This is the same visual grammar as `git log --graph`: one trunk, many
// short-lived branches peeling off and (if approved) merging back in.
function BranchConnector({ hex, merged }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" className="mt-3 shrink-0" aria-hidden>
      <path d="M6 0 Q6 16 22 16" stroke="#2A303C" strokeWidth="1.5" fill="none" />
      <circle cx="22" cy="16" r="4" fill={hex} />
      {merged && (
        <path d="M22 16 Q6 16 6 32" stroke={hex} strokeWidth="1.5" fill="none" strokeDasharray="3 2" />
      )}
    </svg>
  );
}

export default function HomePage() {
  const { data: tasks, error, isLoading } = useSWR("/tasks", fetcher, {
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

      <div className="relative mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-1 flex items-baseline justify-between">
          <h1 className="flex items-center gap-2.5 font-mono text-[26px] font-semibold tracking-tight text-[#E6E8EB]">
            <BranchIcon className="h-5 w-5 text-[#E8A33D]" />
            Agent Tasks
          </h1>
          {runningCount > 0 && (
            <span className="flex items-center gap-2 font-mono text-xs text-[#3FA9C9]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3FA9C9] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#3FA9C9]" />
              </span>
              {runningCount} running
            </span>
          )}
        </div>
        <p className="mb-10 max-w-xl text-sm text-[#7C8494]">
          Every task gets its own <code className="rounded bg-[#1A1F29] px-1.5 py-0.5 font-mono text-[13px] text-[#9AA1AC]">git worktree</code> —
          an isolated branch and folder, so parallel agents never collide. Nothing touches{" "}
          <code className="rounded bg-[#1A1F29] px-1.5 py-0.5 font-mono text-[13px] text-[#9AA1AC]">main</code> until
          you review the diff.
        </p>

        {/* Composer */}
        <form
          onSubmit={handleSubmit}
          className="mb-14 rounded-xl border border-[#232935] bg-[#12161F] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition focus-within:border-[#E8A33D]/40"
        >
          <textarea
            className="w-full resize-none rounded-md border border-[#232935] bg-[#0B0E14] p-3 font-mono text-sm text-[#E6E8EB] placeholder:text-[#4B5563] focus:outline-none focus:ring-1 focus:ring-[#E8A33D]/60"
            rows={3}
            placeholder="In src/components/login.jsx, add a password length check…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="mt-4 flex items-center justify-between">
            <div
              role="radiogroup"
              aria-label="Task mode"
              className="inline-flex rounded-md border border-[#232935] bg-[#0B0E14] p-0.5 text-sm"
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
                  className={`rounded-[5px] px-3 py-1.5 font-mono text-xs transition ${
                    mode === opt.value
                      ? "bg-[#232935] text-[#E6E8EB]"
                      : "text-[#7C8494] hover:text-[#9AA1AC]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <span className="hidden self-center px-3 text-xs text-[#4B5563] sm:inline">
                {mode === "edit" ? "agent writes the change" : "agent proposes only"}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting || !description.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-[#E8A33D] px-4 py-2 text-sm font-medium text-[#0B0E14] transition hover:bg-[#F0B15A] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Starting…" : "Start task"}
              {!submitting && <span aria-hidden>→</span>}
            </button>
          </div>

          {submitError && (
            <p className="mt-3 text-sm text-[#E0605A]">Couldn't start the task — {submitError}</p>
          )}
        </form>

        {/* Branch list */}
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[#7C8494]">
            Branches
          </h2>
          {tasks?.length > 0 && (
            <span className="font-mono text-xs text-[#4B5563]">{tasks.length} total</span>
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
              <span className="font-mono text-xs text-[#545B68]">main</span>
            </div>

            <div className="space-y-3">
              {tasks.map((task) => {
                const s = statusInfo(task.status);
                return (
                  <Link key={task.id} href={`/tasks/${task.id}`} className="group flex items-start gap-4">
                    <BranchConnector hex={s.hex} merged={task.status === "approved"} />
                    <div className="flex-1 rounded-lg border border-[#232935] bg-[#12161F] p-4 transition group-hover:-translate-y-0.5 group-hover:border-[#3A4150] group-hover:shadow-[0_8px_20px_rgba(0,0,0,0.3)]">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm leading-snug text-[#E6E8EB]">{task.description}</p>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-xs ${s.pill}`}>
                          {s.label}
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-xs text-[#7C8494]">
                        {task.mode === "edit" ? "edit mode" : "suggest mode"} · agent/{task.id.slice(0, 8)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
