"""Commits an approved edit-mode task's worktree changes, pushes the branch
to GitHub, and opens a PR — this is what actually lands agent work in the
real repo, completing the loop the "Approve" button implies. Suggest-mode
tasks never call any of this: nothing was ever written to disk for them.

Auth note: the token is passed as a short-lived `http.extraHeader` scoped to
a single git invocation, not embedded in the remote URL — so it never ends
up in `git remote -v`, error messages, or anything we might log to the
task's error_log.
"""
import base64
import subprocess
import requests
from app.config import GITHUB_TOKEN, GITHUB_REPO

BOT_NAME = "Agent Bot"
BOT_EMAIL = "agent-bot@users.noreply.github.com"


def _run_git(args, cwd):
    result = subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args[:2])} failed: {result.stderr.strip()}")
    return result.stdout


def commit_and_push(worktree_path: str, branch_name: str, commit_message: str) -> bool:
    """Returns False if there was nothing to commit (e.g. the agent made no
    changes), True if a commit was made and pushed."""
    _run_git(["add", "-A"], cwd=worktree_path)

    status = _run_git(["status", "--porcelain"], cwd=worktree_path)
    if not status.strip():
        return False

    _run_git(
        [
            "-c", f"user.name={BOT_NAME}",
            "-c", f"user.email={BOT_EMAIL}",
            "commit", "-m", commit_message,
        ],
        cwd=worktree_path,
    )

    basic_auth = base64.b64encode(f"x-access-token:{GITHUB_TOKEN}".encode()).decode()
    _run_git(
        [
            "-c", f"http.extraHeader=AUTHORIZATION: basic {basic_auth}",
            "push", f"https://github.com/{GITHUB_REPO}.git",
            f"{branch_name}:{branch_name}",
        ],
        cwd=worktree_path,
    )
    return True


def create_pull_request(branch_name: str, title: str, body: str, base: str = "main") -> str:
    """Returns the new PR's URL."""
    resp = requests.post(
        f"https://api.github.com/repos/{GITHUB_REPO}/pulls",
        headers={
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        json={"title": title[:255], "head": branch_name, "base": base, "body": body or ""},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["html_url"]
