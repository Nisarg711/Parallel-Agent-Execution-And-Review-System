"""Central place for env vars + filesystem paths used across the backend."""
import os
from pathlib import Path
from dotenv import load_dotenv

# backend/app/config.py -> backend/app -> backend -> project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

REDIS_URL = os.environ.get("REDIS_URL")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")

# Used to commit/push an approved task's branch and open a PR (see
# app/github_integration.py). Only needed for edit-mode approvals.
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO = os.environ.get("GITHUB_REPO")  # "owner/repo" form

# Where the target repo (Password Manager) is cloned once, and worktrees
# for individual tasks get created underneath. Shared with any otxher
# backend/frontend, so it lives at the project root, not inside backend/.
BASE_REPO_PATH = Path(
    os.environ.get("TARGET_REPO_PATH")
    or PROJECT_ROOT / "workspaces" / "base" / "Password_Manager"
)
WORKTREES_DIR = PROJECT_ROOT / "workspaces" / "worktrees"
#WORKTREES_DIR is where per-task copies get created.