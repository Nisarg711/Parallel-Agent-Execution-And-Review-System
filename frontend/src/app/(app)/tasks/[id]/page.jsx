"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import ReactDiffViewer from "react-diff-viewer-continued";
import { fetcher, approveTask, rejectTask } from "@/lib/api";
import { UnifiedDiff } from "@/components/unifiedDiff";

const STATUS = {
  pending: { label: "Queued", pill: "bg-[#545B68]/15 text-[#9AA1AC] border-[#545B68]/30" },
  running: { label: "Running", pill: "bg-[#3FA9C9]/15 text-[#3FA9C9] border-[#3FA9C9]/30" },
  needs_review: { label: "Needs review", pill: "bg-[#E8A33D]/15 text-[#E8A33D] border-[#E8A33D]/30" },
  approved: { label: "Approved", pill: "bg-[#4FB477]/15 text-[#4FB477] border-[#4FB477]/30" },
  rejected: { label: "Rejected", pill: "bg-[#E0605A]/15 text-[#E0605A] border-[#E0605A]/30" },
  failed: { label: "Failed", pill: "bg-[#E0605A]/15 text-[#E0605A] border-[#E0605A]/30" },
};

function statusInfo(status) {
  return STATUS[status] || STATUS.pending;
}

export default function TaskDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const { data: task, error, isLoading, mutate } = useSWR(`/tasks/${id}`, fetcher, {
    refreshInterval: (data) =>
      data && ["needs_review", "approved", "rejected", "failed"].includes(data.status) ? 0 : 2000,
  });

  /*
  The mutate function in useSWR allows you to manually update cached data instead of waiting for 
  automatic revalidation. This is primarily used to achieve optimistic UI updates, which make your 
  application feel instantaneous by rendering new data before the server confirms it
  
  The polling logic is smarter than the list page's flat refreshInterval. 
  SWR's refreshInterval here is a function of the current data: it keeps polling every 2s 
  while the task is still pending/running, but stops polling (0) once it reaches a 
  terminal-ish state (needs_review, approved, rejected, failed). No point hammering 
  the API for a task that's done changing.*/
  const [actionError, setActionError] = useState(null);
  const [acting, setActing] = useState(false);

  async function handleApprove() {
    setActing(true);
    setActionError(null);
    try {
      await approveTask(id);
      mutate();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    setActing(true);
    setActionError(null);
    try {
      await rejectTask(id);
      mutate();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActing(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#0B0E14] px-6 py-16">
        <p className="mx-auto max-w-4xl text-sm text-[#7C8494]">Loading…</p>
      </main>
    );
  }

  if (error || !task) {
    return (
      <main className="min-h-screen bg-[#0B0E14] px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm text-[#E0605A]">Couldn't load this task.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-[#7C8494] hover:text-[#E6E8EB]">
            ← Back to tasks
          </Link>
        </div>
      </main>
    );
  }

  const s = statusInfo(task.status);
  let proposals = [];
  if (task.mode === "suggest" && task.proposals) {
    try {
      proposals = JSON.parse(task.proposals);
    } catch {
      proposals = [];
    }
  }

  return (
    <main className="min-h-screen bg-[#0B0E14] px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-[#7C8494] hover:text-[#E6E8EB]">
          ← Back to tasks
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-lg font-semibold text-[#E6E8EB]">{task.description}</h1>
            <p className="mt-2 font-mono text-xs text-[#7C8494]">
              {task.mode === "edit" ? "edit mode" : "suggest mode"}
              {task.branch_name && <> · {task.branch_name}</>}
            </p>
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1 font-mono text-xs ${s.pill}`}>
            {s.label}
          </span>
        </div>

        {task.pr_url && (
          <a
            href={task.pr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[#4FB477]/40 bg-[#4FB477]/10 px-3 py-1.5 text-sm text-[#4FB477] transition hover:bg-[#4FB477]/20"
          >
            View PR on GitHub <span aria-hidden>↗</span>
          </a>
        )}

        {task.summary && (
          <div className="mt-6 rounded-lg border border-[#232935] bg-[#12161F] p-4">
            <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-[#7C8494]">
              Agent summary
            </h2>
            <p className="whitespace-pre-wrap text-sm text-[#E6E8EB]">{task.summary}</p>
          </div>
        )}

        {task.status === "failed" && task.error_log && (
          <div className="mt-6 rounded-lg border border-[#E0605A]/30 bg-[#E0605A]/10 p-4">
            <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-[#E0605A]">
              Error
            </h2>
            <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-[#E6E8EB]">
              {task.error_log}
            </pre>
          </div>
        )}

       
       {/* Edit mode: diff viewer */}
{task.mode === "edit" && task.diff && (
  <div className="mt-6 overflow-hidden rounded-lg border border-[#232935]">
    <h2 className="border-b border-[#232935] bg-[#12161F] px-4 py-2 font-mono text-xs uppercase tracking-widest text-[#7C8494]">
      Diff
    </h2>
    <UnifiedDiff diffText={task.diff} />
  </div>
)}

        {/* Suggest mode: proposal cards */}
        {task.mode === "suggest" && proposals.length > 0 && (
          <div className="mt-6 space-y-4">
            <h2 className="font-mono text-xs uppercase tracking-widest text-[#7C8494]">
              Proposals ({proposals.length})
            </h2>
            {proposals.map((p, i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-[#232935]">
                <div className="border-b border-[#232935] bg-[#12161F] px-4 py-3">
                  <p className="font-mono text-sm text-[#E6E8EB]">{p.path}</p>
                  <p className="mt-1 text-xs text-[#7C8494]">{p.rationale}</p>
                </div>
                <ReactDiffViewer
                  oldValue={p.original_content}
                  newValue={p.proposed_content}
                  splitView={true}
                  useDarkTheme={true}
                />
              </div>
            ))}
          </div>
        )}

        {task.mode === "suggest" && task.status === "needs_review" && proposals.length === 0 && (
          <p className="mt-6 text-sm text-[#7C8494]">Agent made no proposals for this task.</p>
        )}

        {/* Review actions */}
        {task.status === "needs_review" && (
          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={handleApprove}
              disabled={acting}
              className="rounded-md bg-[#4FB477] px-4 py-2 text-sm font-medium text-[#0B0E14] transition hover:bg-[#5FC488] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {acting ? "Working…" : "Approve"}
            </button>
            <button
              onClick={handleReject}
              disabled={acting}
              className="rounded-md border border-[#E0605A]/40 px-4 py-2 text-sm font-medium text-[#E0605A] transition hover:bg-[#E0605A]/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reject
            </button>
          </div>
        )}

        {actionError && <p className="mt-3 text-sm text-[#E0605A]">{actionError}</p>}
      </div>
    </main>
  );
}