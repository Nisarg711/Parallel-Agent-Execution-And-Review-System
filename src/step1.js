import "dotenv/config";
import { createTaskWorktree, getWorktreeDiff } from "./git/worktree.js";
import { runEditAgent } from "./agent.js";

const TASK_ID = process.argv[2] || "task-1";
const TASK_DESCRIPTION =
  process.argv.slice(3).join(" ") ||
  "In src/components/login.jsx, add a client-side check that the password field is at least 6 characters long before allowing submit, showing an inline error message if not.";

// End-to-end proof of the core mechanic: isolate (worktree) -> agent edits ->
// show the diff. No queue, no containers, no UI yet — those are later steps.
async function main() {
  console.log(`\n[1/3] Creating worktree for "${TASK_ID}"...`);
  const { branch, worktreePath } = await createTaskWorktree(TASK_ID);
  console.log(`      branch: ${branch}`);
  console.log(`      path:   ${worktreePath}`);

  console.log(`\n[2/3] Running agent on task: "${TASK_DESCRIPTION}"`);
  const summary = await runEditAgent({ worktreePath, taskDescription: TASK_DESCRIPTION });
  console.log(`\n      Agent summary:\n${summary}`);

  console.log(`\n[3/3] Diff produced on branch ${branch}:\n`);
  const diff = await getWorktreeDiff(worktreePath);
  console.log(diff || "(no changes made)");
}

main().catch((err) => {
  console.error("\nStep 1 failed:", err.message);
  process.exit(1);
});
