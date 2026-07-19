"""End-to-end proof of the core mechanic: isolate (worktree) -> agent works ->
show the result. No queue, no containers, no UI yet — those are later steps.

Usage: python step1.py [--task-id ID] [--mode edit|suggest] "task description"

Flags must come before the description. argparse can only fill a variable-
length positional (the description) from one contiguous run of non-flag
tokens, so putting flags after it splits that run and breaks parsing.
"""
import argparse
import difflib
import sys
from app.git.worktree import create_task_worktree, get_worktree_diff
from app.agent import run_agent

DEFAULT_TASK_DESCRIPTION = (
    "In src/components/login.jsx, add a client-side check that the password "
    "field is at least 6 characters long before allowing submit, showing an "
    "inline error message if not."
)


def parse_args():
    parser = argparse.ArgumentParser(description="Run a single task in its own worktree.")
    parser.add_argument("--task-id", dest="task_id", default="task-1")
    parser.add_argument("--mode", choices=["edit", "suggest"], default="edit")
    parser.add_argument("description", nargs="*", default=None)
    return parser.parse_args()


def print_proposals(proposals):
    if not proposals:
        print("(agent made no proposals)")
        return
    for p in proposals:
        print(f"\n--- Proposal for {p['path']} ---")
        print(f"Rationale: {p['rationale']}\n")
        diff = difflib.unified_diff(
            p["original_content"].splitlines(keepends=True),
            p["proposed_content"].splitlines(keepends=True),
            fromfile=f"a/{p['path']}",
            tofile=f"b/{p['path']}",
        )
        print("".join(diff) or "(no textual difference)")


def main():
    args = parse_args()
    task_description = " ".join(args.description) if args.description else DEFAULT_TASK_DESCRIPTION

    print(f'\n[1/3] Creating worktree for "{args.task_id}" (mode: {args.mode})...')
    branch, worktree_path = create_task_worktree(args.task_id)
    print(f"      branch: {branch}")
    print(f"      path:   {worktree_path}")

    print(f'\n[2/3] Running agent on task: "{task_description}"')
    summary, proposals = run_agent(worktree_path, task_description, mode=args.mode)
    print(f"\n      Agent summary:\n{summary}")

    if args.mode == "edit":
        print(f"\n[3/3] Diff produced on branch {branch}:\n")
        diff = get_worktree_diff(worktree_path)
        print(diff or "(no changes made)")
    else:
        print(f"\n[3/3] Proposals (nothing written to disk — branch {branch} is unmodified):")
        print_proposals(proposals)


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print(f"\nStep 1 failed: {err}", file=sys.stderr)
        sys.exit(1)
