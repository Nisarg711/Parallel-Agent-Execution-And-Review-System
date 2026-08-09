"""Git worktree management: this is the actual isolation mechanism — each
task gets its own branch checked out into its own folder, sharing the same
underlying .git object store but never sharing working files with another
task's agent."""
import shutil
from git import Repo
from app.config import BASE_REPO_PATH, WORKTREES_DIR
import subprocess




def ensure_base_repo_dependencies():
    """Runs SETUP_COMMAND once against the base repo clone, but only if its
    dependency folder doesn't exist yet. Means a fresh clone of the target
    repo works with zero manual setup — no one has to remember to run
    `npm install` by hand. Every task's worktree then symlinks this single
    shared install (see create_task_worktree) rather than reinstalling per
    task, which is what actually keeps disk usage and per-task time down."""
    from app.config import SETUP_COMMAND
    node_modules = BASE_REPO_PATH / "node_modules"
    if node_modules.exists() or not SETUP_COMMAND:
        return
    print(f"[setup] Installing base repo dependencies: {SETUP_COMMAND}")
    result = subprocess.run(
        SETUP_COMMAND, shell=True, cwd=BASE_REPO_PATH, capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"[setup] WARNING: setup command failed:\n{result.stderr}")


def create_task_worktree(task_id: str):
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

    # node_modules is gitignored, so a fresh worktree never has it —
    # symlink the base clone's install instead of reinstalling per task.
    base_node_modules = BASE_REPO_PATH / "node_modules"
    worktree_node_modules = worktree_path / "node_modules"
    if base_node_modules.exists() and not worktree_node_modules.exists():
        worktree_node_modules.symlink_to(base_node_modules, target_is_directory=True)

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