import { simpleGit } from "simple-git";
import fs from "node:fs";
import path from "node:path";
import { BASE_REPO_PATH, WORKTREES_DIR } from "../config.js";

// Creates a fresh branch (agent/<taskId>) and checks it out into its own
// folder via `git worktree add`, so this task's agent never shares a
// working directory with any other task running in parallel.
export async function createTaskWorktree(taskId) {
  const branch = `agent/${taskId}`;
  const worktreePath = path.join(WORKTREES_DIR, taskId);

  if (!fs.existsSync(BASE_REPO_PATH)) {
    throw new Error(
      `Base repo not found at ${BASE_REPO_PATH}. Clone the target repo there first (see TARGET_REPO_PATH in .env).`
    );
  }

  fs.mkdirSync(WORKTREES_DIR, { recursive: true });

  const baseGit = simpleGit(BASE_REPO_PATH);

  // Clear out any leftovers from a previous run of the same task id.
  if (fs.existsSync(worktreePath)) {
    await baseGit.raw(["worktree", "remove", "--force", worktreePath]).catch(() => {});
    fs.rmSync(worktreePath, { recursive: true, force: true });
  }
  const branches = await baseGit.branchLocal();
  if (branches.all.includes(branch)) {
    await baseGit.raw(["branch", "-D", branch]).catch(() => {});
  }

  await baseGit.raw(["worktree", "add", "-b", branch, worktreePath]);

  return { branch, worktreePath };
}

// Tears down the worktree folder and its git registration. Call this once a
// task's branch has been reviewed/merged/pushed, so it stops taking up disk.
export async function removeTaskWorktree(taskId) {
  const worktreePath = path.join(WORKTREES_DIR, taskId);
  const baseGit = simpleGit(BASE_REPO_PATH);
  await baseGit.raw(["worktree", "remove", "--force", worktreePath]).catch(() => {});
  fs.rmSync(worktreePath, { recursive: true, force: true });
}

// Returns the unstaged diff for a worktree — this is what the dashboard's
// diff viewer (Step 5) will render for human review.
export async function getWorktreeDiff(worktreePath) {
  const git = simpleGit(worktreePath);
  return git.diff();
}
