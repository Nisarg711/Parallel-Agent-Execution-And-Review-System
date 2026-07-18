import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

export const GROQ_API_KEY = process.env.GROQ_API_KEY;
export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

export const BASE_REPO_PATH =
  process.env.TARGET_REPO_PATH ||
  path.join(projectRoot, "workspaces", "base", "Password_Manager");

export const WORKTREES_DIR = path.join(projectRoot, "workspaces", "worktrees");
