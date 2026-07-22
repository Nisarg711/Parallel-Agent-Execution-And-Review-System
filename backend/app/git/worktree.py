"""Git worktree management: this is the actual isolation mechanism — each
task gets its own branch checked out into its own folder, sharing the same
underlying .git object store but never sharing working files with another
task's agent."""
import shutil
from git import Repo
from app.config import BASE_REPO_PATH, WORKTREES_DIR


def create_task_worktree(task_id: str):
    """Runs `git worktree add -b agent/<task_id>` against the base clone,
    clearing out any leftover worktree/branch from a previous run of the
    same task id first, so re-running a task id during development is safe."""
    branch = f"agent/{task_id}"
    worktree_path = WORKTREES_DIR / task_id

    if not BASE_REPO_PATH.exists():
        raise FileNotFoundError(
            f"Base repo not found at {BASE_REPO_PATH}. Clone the target repo there "
            "first (see TARGET_REPO_PATH in .env)."
        )

    WORKTREES_DIR.mkdir(parents=True, exist_ok=True)
    base_repo = Repo(BASE_REPO_PATH)

    if worktree_path.exists():
        base_repo.git.worktree("remove", "--force", str(worktree_path))
        shutil.rmtree(worktree_path, ignore_errors=True)

    local_branches = [b.name for b in base_repo.branches]
    if branch in local_branches:
        base_repo.git.branch("-D", branch)

    base_repo.git.worktree("add", "-b", branch, str(worktree_path))

    return branch, worktree_path


def remove_task_worktree(task_id: str):
    """Tears down the worktree folder and its git registration. Call this
    once a task's branch has been reviewed/merged/pushed."""
    worktree_path = WORKTREES_DIR / task_id
    base_repo = Repo(BASE_REPO_PATH)
    try:
        base_repo.git.worktree("remove", "--force", str(worktree_path))
    except Exception:
        pass
    shutil.rmtree(worktree_path, ignore_errors=True)


def get_worktree_diff(worktree_path) -> str:
    """Returns the unstaged diff for a worktree — this is what the
    dashboard's diff viewer (Step 5) will render for human review.
    Repo class abstracts the repository data and allows us to manage branches
    merges, commits etc.
    """
    repo = Repo(worktree_path)

    return repo.git.diff()