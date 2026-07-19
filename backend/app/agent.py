"""Builds a fresh LangGraph ReAct agent (Groq-backed) with tools scoped to
one worktree, runs it to completion on a task, and returns the agent's
final natural-language summary of what it changed."""
from pathlib import Path
from langchain_groq import ChatGroq
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage, SystemMessage

from app.config import GROQ_API_KEY, GROQ_MODEL
from app.tools.fs_tools import make_file_tools
from app.tools.bash_tools import make_bash_tool

SYSTEM_PROMPT = """You are a coding agent working inside an isolated git worktree for a single task.

The ONLY tools that exist are: read_file, list_files, edit_file, run_bash. Never call any
other tool name — if you're tempted to use something like "repo_browser.open_file" or any
tool not in this exact list, use read_file/list_files instead.

Rules for editing files:
- Always call read_file on a file before editing it. Never guess its contents.
- edit_file overwrites the ENTIRE file, so you must pass back the full original content
  with ONLY the lines needed for this task added or changed. Do not drop, rewrite,
  simplify, or "clean up" any existing imports, functions, JSX, or logic that isn't
  directly part of the task — preserve them character-for-character.
- Make the smallest change that correctly completes the task. If you find yourself
  regenerating a file from scratch instead of editing it, stop and re-read it.

When you are done, stop calling tools and reply with a short summary of what you changed and why."""


def run_edit_agent(worktree_path: Path, task_description: str) -> str:
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set. Add it to .env before running the agent.")

    llm = ChatGroq(api_key=GROQ_API_KEY, model=GROQ_MODEL, temperature=0)
    tools = [*make_file_tools(worktree_path), make_bash_tool(worktree_path)]
    agent = create_react_agent(llm, tools)

    result = agent.invoke(
        {"messages": [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=task_description)]}
    )

    final_message = result["messages"][-1]
    return getattr(final_message, "content", None) or "(agent produced no final message)"
