import { ChatGroq } from "@langchain/groq";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GROQ_API_KEY, GROQ_MODEL } from "./config.js";
import { makeFileTools } from "./tools/fsTools.js";
import { makeBashTool } from "./tools/bashTools.js";

const SYSTEM_PROMPT = `You are a coding agent working inside an isolated git worktree for a single task.
- Your tools (read_file, list_files, edit_file, run_bash) are scoped to this checkout only.
- Explore with list_files/read_file before editing, so your change fits the existing code style.
- Make the smallest change that correctly completes the task.
- When you are done, stop calling tools and reply with a short summary of what you changed and why.`;

// Builds a fresh LangGraph ReAct agent (Groq-backed) with tools scoped to
// this one worktree, runs it to completion on the task, and returns the
// agent's final natural-language summary of what it changed.
export async function runEditAgent({ worktreePath, taskDescription }) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set. Add it to .env before running the agent.");
  }

  const llm = new ChatGroq({ apiKey: GROQ_API_KEY, model: GROQ_MODEL, temperature: 0 });
  const tools = [...makeFileTools(worktreePath), makeBashTool(worktreePath)];
  const agent = createReactAgent({ llm, tools });

  const result = await agent.invoke({
    messages: [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(taskDescription)],
  });

  const finalMessage = result.messages[result.messages.length - 1];
  return finalMessage?.content ?? "(agent produced no final message)";
}
