"""Commits an approved edit-mode task's worktree changes, pushes the branch
to GitHub, and opens a PR — this is what actually lands agent work in the
real repo, completing the loop the "Approve" button implies. Suggest-mode
tasks never call any of this: nothing was ever written to disk for them.

Auth note: the token is passed as a short-lived `http.extraHeader` scoped to
a single git invocation, not embedded in the remote URL — so it never ends
up in `git remote -v`. Error messages use a fixed `label`, never the raw
`args` (which carry the auth header) or unscrubbed subprocess output.
"""
import base64
import subprocess
import requests
from app.config import GITHUB_TOKEN

BOT_NAME = "Agent Bot"
BOT_EMAIL = "agent-bot@users.noreply.github.com"


def _run_git(args, cwd, label, secret=None):
    """`label` (not `args`) is what goes into any error message — `args` may
    contain the auth header and must never be echoed back, logged, or
    returned in an API response. `secret`, if given, is also scrubbed out of
    git's own stderr as a second layer of defense."""
    result = subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        stderr = result.stderr.strip()
        if secret:
            stderr = stderr.replace(secret, "[REDACTED]")
        raise RuntimeError(f"git {label} failed: {stderr}")
    return result.stdout


def commit_and_push(worktree_path: str, branch_name: str, commit_message: str, repo_slug: str) -> bool:
    """Returns False if there's genuinely nothing to land on this branch
    (no uncommitted changes AND no commits ahead of main — e.g. the agent
    made no changes at all), True if it pushed something.

    Always re-checks "ahead of main" rather than only reacting to
    uncommitted changes, so a retry after a failed push (commit already
    happened, only the push failed) still pushes instead of silently
    no-op'ing because there's nothing *new* to commit this time."""
    _run_git(["add", "-A"], cwd=worktree_path, label="add")

    status = _run_git(["status", "--porcelain"], cwd=worktree_path, label="status")
    if status.strip():
        _run_git(
            [
                "-c", f"user.name={BOT_NAME}",
                "-c", f"user.email={BOT_EMAIL}",
                "commit", "-m", commit_message,
            ],
            cwd=worktree_path,
            label="commit",
        )

    ahead = _run_git(["rev-list", "--count", "HEAD", "^main"], cwd=worktree_path, label="rev-list")
    if int(ahead.strip() or "0") == 0:
        return False

    basic_auth = base64.b64encode(f"x-access-token:{GITHUB_TOKEN}".encode()).decode()
    _run_git(
        [
            "-c", f"http.extraHeader=AUTHORIZATION: basic {basic_auth}",
            "push", f"https://github.com/{repo_slug}.git",
            f"{branch_name}:{branch_name}",
        ],
        cwd=worktree_path,
        label="push",
        secret=basic_auth,
    )
    return True


def create_pull_request(branch_name: str, title: str, body: str, repo_slug: str, base: str = "main") -> str:
    """Returns the new PR's URL."""
    resp = requests.post(
        f"https://api.github.com/repos/{repo_slug}/pulls",
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


import re

def parse_github_url(url: str):
    """Extracts (owner, name) from a github.com URL, with or without .git."""
    match = re.match(r"^https://github\.com/([^/]+)/([^/]+?)(\.git)?/?$", url.strip())
    if not match:
        raise ValueError(f"'{url}' doesn't look like a GitHub repo URL")
    return match.group(1), match.group(2)


def check_repo_write_access(owner: str, name: str) -> bool:
    """True only if GITHUB_TOKEN itself has push access — not the visitor,
    since visitors never authenticate in this design (see conversation)."""
    resp = requests.get(
        f"https://api.github.com/repos/{owner}/{name}",
        headers={"Authorization": f"Bearer {GITHUB_TOKEN}"},
        timeout=10,
    )
    if resp.status_code != 200:
        return False
    return resp.json().get("permissions", {}).get("push", False)