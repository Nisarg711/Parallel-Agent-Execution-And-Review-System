"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { fetcher, createTask } from "@/lib/api";

const STATUS = {
  pending: { label: "Queued", dot: "bg-[#545B68]", pill: "bg-[#545B68]/15 text-[#9AA1AC] border-[#545B68]/30" },
  running: { label: "Running", dot: "bg-[#3FA9C9]", pill: "bg-[#3FA9C9]/15 text-[#3FA9C9] border-[#3FA9C9]/30" },
  needs_review: { label: "Needs review", dot: "bg-[#E8A33D]", pill: "bg-[#E8A33D]/15 text-[#E8A33D] border-[#E8A33D]/30" },
  approved: { label: "Approved", dot: "bg-[#4FB477]", pill: "bg-[#4FB477]/15 text-[#4FB477] border-[#4FB477]/30" },
  rejected: { label: "Rejected", dot: "bg-[#E0605A]", pill: "bg-[#E0605A]/15 text-[#E0605A] border-[#E0605A]/30" },
  failed: { label: "Failed", dot: "bg-[#E0605A]", pill: "bg-[#E0605A]/15 text-[#E0605A] border-[#E0605A]/30" },
};

function statusInfo(status) {
  return STATUS[status] || STATUS.pending;
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
    <main className="min-h-screen bg-[#0B0E14]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-1 flex items-baseline justify-between">
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-[#E6E8EB]">
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
        <p className="mb-10 text-sm text-[#7C8494]">
          Every task runs in its own isolated branch. Nothing merges until you review it.
        </p>

        {/* Composer */}
        <form onSubmit={handleSubmit} className="mb-14 rounded-lg border border-[#232935] bg-[#12161F] p-5">
          <textarea
            className="w-full resize-none rounded-md border border-[#232935] bg-[#0B0E14] p-3 font-mono text-sm text-[#E6E8EB] placeholder:text-[#4B5563] focus:outline-none focus:ring-1 focus:ring-[#E8A33D]/60"
            rows={3}
            placeholder="In src/components/login.jsx, add a password length check…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-5 text-sm text-[#9AA1AC]">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value="edit"
                  checked={mode === "edit"}
                  onChange={() => setMode("edit")}
                  className="accent-[#E8A33D]"
                />
                Edit — agent writes the change
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value="suggest"
                  checked={mode === "suggest"}
                  onChange={() => setMode("suggest")}
                  className="accent-[#E8A33D]"
                />
                Suggest — agent proposes only
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting || !description.trim()}
              className="rounded-md bg-[#E8A33D] px-4 py-2 text-sm font-medium text-[#0B0E14] transition hover:bg-[#F0B15A] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Starting…" : "Start task"}
            </button>
          </div>

          {submitError && (
            <p className="mt-3 text-sm text-[#E0605A]">Couldn't start the task — {submitError}</p>
          )}
        </form>

        {/* Task list */}
        <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#7C8494]">
          Tasks
        </h2>

        {isLoading && <p className="text-sm text-[#7C8494]">Loading…</p>}
        {error && (
          <p className="text-sm text-[#E0605A]">Couldn't load tasks. Check that the API is running.</p>
        )}
        {tasks?.length === 0 && (
          <p className="text-sm text-[#7C8494]">
            No tasks yet. Describe one above to send an agent into its own branch.
          </p>
        )}

        {tasks?.length > 0 && (
          <div className="relative">
            <div className="absolute bottom-3 left-[5px] top-3 w-px bg-[#232935]" />
            <div className="space-y-3">
              {tasks.map((task) => {
                const s = statusInfo(task.status);
                return (
                  <Link key={task.id} href={`/tasks/${task.id}`} className="group flex items-start gap-4">
                    <span
                      className={`relative z-10 mt-[22px] h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-[#0B0E14] ${s.dot}`}
                    />
                    <div className="flex-1 rounded-lg border border-[#232935] bg-[#12161F] p-4 transition group-hover:border-[#3A4150]">
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