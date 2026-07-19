"""Central place for env vars + filesystem paths used across the backend."""
import os
from pathlib import Path
from dotenv import load_dotenv

# backend/app/config.py -> backend/app -> backend -> project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")

# Where the target repo (Password Manager) is cloned once, and worktrees
# for individual tasks get created underneath. Shared with any other
# backend/frontend, so it lives at the project root, not inside backend/.
BASE_REPO_PATH = Path(
    os.environ.get("TARGET_REPO_PATH")
    or PROJECT_ROOT / "workspaces" / "base" / "Password_Manager"
)
WORKTREES_DIR = PROJECT_ROOT / "workspaces" / "worktrees"
