"""Git worktree management: this is the actual isolation mechanism — each
task gets its own branch checked out into its own folder, sharing the same
underlying .git object store but never sharing working files with another
task's agent."""
import shutil
from git import Repo
from app.config import PROJECT_ROOT
import subprocess
BASES_DIR = PROJECT_ROOT / "workspaces" / "bases"
WORKTREES_ROOT = PROJECT_ROOT / "workspaces" / "worktrees"
from pathlib import Path



def clone_repo(repo_id: str, clone_url: str) -> Path:
    base_path = BASES_DIR / repo_id
    if base_path.exists():
        return base_path
    base_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["git", "clone", clone_url, str(base_path)], check=True)
    return base_path

def run_setup_command(base_path: Path, setup_command: str | None):
    """One-time dependency install for a repo, e.g. npm install. Skips if
    already done — mirrors the earlier single-repo version, just per-repo now."""
    if not setup_command:
        return
    node_modules = base_path / "node_modules"
    if node_modules.exists():
        return
    result = subprocess.run(
        setup_command, shell=True, cwd=base_path, capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"Setup command failed:\n{result.stderr}")

def ensure_base_repo_dependencies():
    """Runs SETUP_COMMAND once against the base repo clone, but only if its
    dependency folder doesn't exist yet. Means a fresh clone of the target
    repo works with zero manual setup — no one has to remember to run
    `npm install` by hand. Every task's worktree then symlinks this single
    shared install (see create_task_worktree) rather than reinstalling per
    task, which is what actually keeps disk usage and per-task time down."""
    from app.config import SETUP_COMMAND
    node_modules = BASES_DIR / "node_modules"
    if node_modules.exists() or not SETUP_COMMAND:
        return
    print(f"[setup] Installing base repo dependencies: {SETUP_COMMAND}")
    result = subprocess.run(
        SETUP_COMMAND, shell=True, cwd=BASES_DIR, capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"[setup] WARNING: setup command failed:\n{result.stderr}")


def create_task_worktree(task_id: str, repo_id: str, base_path: Path):
    branch = f"agent/{task_id}"
    worktree_path = WORKTREES_ROOT / repo_id / task_id

    WORKTREES_ROOT.joinpath(repo_id).mkdir(parents=True, exist_ok=True)
    base_repo = Repo(base_path)

    if worktree_path.exists():
        base_repo.git.worktree("remove", "--force", str(worktree_path))
        shutil.rmtree(worktree_path, ignore_errors=True)

    local_branches = [b.name for b in base_repo.branches]
    if branch in local_branches:
        base_repo.git.branch("-D", branch)

    # This is a cleanup step for local git branches, separate from the 
    # worktree-folder cleanup right above it. It's asking: "does a local '
    # 'branch named agent/<task-id> already exist in the base repo's git
    # history, from a previous run of this same task id?" If so, delete 
    # it (-D force-deletes, since it might not be fully merged).

    base_repo.git.worktree("add", "-b", branch, str(worktree_path))

    base_node_modules = base_path / "node_modules"
    worktree_node_modules = worktree_path / "node_modules"
    if base_node_modules.exists() and not worktree_node_modules.exists():
        worktree_node_modules.symlink_to(base_node_modules, target_is_directory=True)

    return branch, worktree_path


def remove_task_worktree(task_id: str, repo_id: str, base_path: Path):
    worktree_path = WORKTREES_ROOT / repo_id / task_id
    base_repo = Repo(base_path)
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

