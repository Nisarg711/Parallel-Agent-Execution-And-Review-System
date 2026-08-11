"""Reusable task execution logic — same core mechanic as step1.py, but writes
results to a DB row instead of printing to stdout. Called directly for now
(Step 3), and will later be called from a background worker (Step 4).
"""
import json
import traceback
from datetime import datetime
from sqlmodel import Session
from app.db.session import engine
from app.db.models import Task,Repository
from app.git.worktree import create_task_worktree, get_worktree_diff
from app.agent import run_agent
from app.test_runner import run_tests
from pathlib import Path

def _proposals_to_json(proposals):
    """Serialize proposals list to a JSON string for storage.
    Stored as-is (path, rationale, original_content, proposed_content) so the
    dashboard can reconstruct the same diff view print_proposals() builds."""
    return json.dumps(proposals or [])


def run_task(task_id: str, description: str, mode: str):
    """Runs a single task end-to-end and persists the result to the tasks
    table. Must always be called fresh per task — do not reuse across
    concurrent tasks (breaks worktree/tool isolation, see agent.py notes)."""


    '''Here, its assumed that a row with that task id already exists, else raises.
    So, the request to Post /tasks will insert a row, and then run task() would be invoked.'''
    with Session(engine) as session:
        task = session.get(Task, task_id)
        if task is None:
            raise ValueError(f"Task {task_id} not found in DB")
        if task.repo_id is None:
            raise ValueError(f"Task {task_id} has no repo_id set")
        repository = session.get(Repository, task.repo_id)
        if repository is None or repository.status != "ready":
            raise ValueError(f"Repo {task.repo_id} is not ready")
        # Capture plain values before the session closes below — SQLAlchemy
        # expires an object's attributes on commit, and once the session
        # itself exits there's nothing left to refresh them from, so
        # `repository.whatever` raises DetachedInstanceError afterward.
        repo_id = repository.id
        base_path = Path(repository.local_path)
        test_command = repository.test_command

        task.status = "running"
        task.updated_at = datetime.utcnow()
        session.add(task)
        session.commit()

    try:
        branch, worktree_path = create_task_worktree(task_id, repo_id, base_path)

        with Session(engine) as session:
            task = session.get(Task, task_id)
            task.branch_name = branch
            task.worktree_path = str(worktree_path)   # <-- convert Path to str
            task.updated_at = datetime.utcnow()
            session.add(task)
            session.commit()

        summary, proposals = run_agent(worktree_path, description, mode=mode)

        with Session(engine) as session:
            task = session.get(Task, task_id)
            task.summary = summary

            if mode == "edit":
                task.diff = get_worktree_diff(worktree_path)
                if task.diff:
                    # Tests run against whatever's on disk right now — no
                    # commit needed. Committing only ever happens at
                    # approval time (see github_integration.commit_and_push),
                    # with the bot identity, so attribution stays correct
                    # and this never depends on git config being set up
                    # wherever the worker happens to run.
                    test_status, test_output = run_tests(str(worktree_path), test_command)
                    task.test_status = test_status
                    task.test_output = test_output
            else:
                task.proposals = _proposals_to_json(proposals)

            task.status = "needs_review"
            task.updated_at = datetime.utcnow()
            session.add(task)
            session.commit()

    except Exception:
        with Session(engine) as session:
            task = session.get(Task, task_id)
            task.status = "failed"
            task.error_log = traceback.format_exc()
            task.updated_at = datetime.utcnow()
            session.add(task)
            session.commit()