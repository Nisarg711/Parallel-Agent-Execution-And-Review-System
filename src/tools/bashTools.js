import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execFile } from "node:child_process";

// NOTE: this runs shell commands directly on the host, scoped only by `cwd`.
// It is safe for a task you wrote yourself against your own repo, but it is
// NOT a real sandbox — a container boundary (Step 6+ in the build plan)
// is required before pointing this at untrusted tasks or repos.
// Wraps `bash -c <command>` as a LangChain tool, pinned to the worktree's
// folder via `cwd` so commands only ever touch that task's own checkout.
export function makeBashTool(worktreePath) {
  return tool(
    ({ command }) =>
      new Promise((resolve) => {
        execFile(
          "/bin/bash",
          ["-c", command],
          { cwd: worktreePath, timeout: 30_000, maxBuffer: 1024 * 1024 },
          (error, stdout, stderr) => {
            if (error) {
              resolve(`EXIT CODE ${error.code ?? 1}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
            } else {
              resolve(stdout || "(no output)");
            }
          }
        );
      }),
    {
      name: "run_bash",
      description:
        "Run a shell command inside the task's isolated repo checkout (cwd is the repo root). Use it to inspect the tree, run linters, or run tests.",
      schema: z.object({ command: z.string().describe("The shell command to run") }),
    }
  );
}
