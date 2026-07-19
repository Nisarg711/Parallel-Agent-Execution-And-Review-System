"""End-to-end proof of the core mechanic: isolate (worktree) -> agent edits ->
show the diff. No queue, no containers, no UI yet — those are later steps.

Usage: python step1.py [task-id] [task description...]
"""
import sys
from app.git.worktree import create_task_worktree, get_worktree_diff
from app.agent import run_edit_agent

DEFAULT_TASK_DESCRIPTION = (
    "In src/components/login.jsx, add a client-side check that the password "
    "field is at least 6 characters long before allowing submit, showing an "
    "inline error message if not."
)


def main():
    task_id = sys.argv[1] if len(sys.argv) > 1 else "task-1"
    task_description = " ".join(sys.argv[2:]) or DEFAULT_TASK_DESCRIPTION

    print(f'\n[1/3] Creating worktree for "{task_id}"...')
    branch, worktree_path = create_task_worktree(task_id)
    print(f"      branch: {branch}")
    print(f"      path:   {worktree_path}")

    print(f'\n[2/3] Running agent on task: "{task_description}"')
    summary = run_edit_agent(worktree_path, task_description)
    print(f"\n      Agent summary:\n{summary}")

    print(f"\n[3/3] Diff produced on branch {branch}:\n")
    diff = get_worktree_diff(worktree_path)
    print(diff or "(no changes made)")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print(f"\nStep 1 failed: {err}", file=sys.stderr)
        sys.exit(1)
