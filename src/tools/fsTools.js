//it's the most important file for safety.
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

/*Below function resolves the relative path to absolute path
// and checks whether its in worktree root. If the agent tries accessing
 outside sandbox this function throws, instead of reading/writing there
Every tool below routes through this before touching the filesystem — that's the right pattern (single choke point, not a check duplicated per-tool).
*/
function resolveScoped(worktreePath, relativePath) {
  const root = path.resolve(worktreePath);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path "${relativePath}" escapes the task's worktree — not allowed.`);
  }
  return resolved;
}

/*It's a function that, when called, builds and returns three tool objects — it doesn't just return references to 
some pre-existing tools.
Compare this to the alternative design — a single shared tool where the agent has to tell you which worktree it means each time:
javascript// NOT what you have — hypothetical bad version
const readFile = tool(async ({ path, worktreePath }) => {
  const abs = resolveScoped(worktreePath, path);
  ...
});
Here, worktreePath comes from the model's own tool call arguments. That's dangerous: 
the model itself decides which worktree to read from on every call. A bug, a confused agent, or an adversarial prompt 
injection inside a file it read could cause it to pass a different task's worktree path and 
read/write across task boundaries — exactly the kind of leak you're trying to prevent when
 running multiple agents in parallel.

 IMPPP:  three agents running concurrently for three different tasks,
  each worker process calls makeFileTools(thatTask'sWorktreePath) once at the start of that task's run, 
  and hands the resulting three tools to that one agent instance.
*/

export function makeFileTools(worktreePath) {
  const readFile = tool(
    async ({ path: relPath }) => {
      const abs = resolveScoped(worktreePath, relPath);
      if (!fs.existsSync(abs)) return `ERROR: file not found: ${relPath}`;
      return fs.readFileSync(abs, "utf-8");
    },
    {
      name: "read_file",
      description: "Read a file's contents by path, relative to the task's repo checkout root.",
      schema: z.object({ path: z.string().describe("Path relative to the repo root") }),
    }
  );

  const listFiles = tool(
    async ({ path: relPath }) => {
      const abs = resolveScoped(worktreePath, relPath || ".");
      if (!fs.existsSync(abs)) return `ERROR: path not found: ${relPath}`;
      return fs.readdirSync(abs).join("\n");
    },
    {
      name: "list_files",
      description: "List files/directories at a path relative to the repo root (defaults to root).",
      schema: z.object({
        path: z.string().optional().describe("Path relative to the repo root"),
      }),
    }
  );

  const editFile = tool(
    async ({ path: relPath, content }) => {
      const abs = resolveScoped(worktreePath, relPath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, "utf-8");
      return `Wrote ${content.length} bytes to ${relPath}`;
    },
    {
      name: "edit_file",
      description:
        "Overwrite a file with new content, relative to the repo root. Creates the file (and parent dirs) if it doesn't exist. Always write the FULL new file content, not a diff.",
      schema: z.object({
        path: z.string().describe("Path relative to the repo root"),
        content: z.string().describe("The full new content of the file"),
      }),
    }
  );

  return [readFile, listFiles, editFile];
}
/*each agent instance's tools are hardwired to exactly one worktree path; the model can't override or redirect that.
resolveScoped's runtime check — even within that one fixed worktree, if the model tries a sneaky
 relative path like ../../task-2/secrets.env, the resolved absolute path is checked against the root and rejected.
*/