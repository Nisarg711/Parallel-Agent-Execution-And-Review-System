"""Builds a fresh LangGraph ReAct agent (Groq-backed) with tools scoped to
one worktree, runs it to completion on a task, and returns the agent's
final summary plus (in suggest mode) the list of recorded proposals."""
from pathlib import Path
from langchain_groq import ChatGroq
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage, SystemMessage

from app.config import GROQ_API_KEY, GROQ_MODEL
from app.tools.fs_tools import make_file_tools
from app.tools.bash_tools import make_bash_tool
from app.tools.suggest_tools import make_propose_change_tool

# Shared rules for both modes: tool-name discipline, diff-marker ban, and
# when to stop. Each mode's prompt below is this plus its own edit rules.
_COMMON_RULES = """
Verifying your work:
- You do NOT need to run tests, linters, or builds unless the task explicitly asks for it.
  Many repos here have no test suite configured, missing dependencies, or scripts that
  fail for unrelated environment reasons — that is not something you can fix and not your
  job right now.
- If you do try run_bash and it fails or gives an unhelpful/empty result, do not retry it
  or start investigating why — that almost never means your work was wrong. Just note the
  inconclusive result in your summary and stop.
"""

EDIT_SYSTEM_PROMPT = f"""You are a coding agent working inside an isolated git worktree for a single task.

The ONLY tools that exist are: read_file, list_files, edit_file, run_bash. Never call any
other tool name — if you're tempted to use something like "repo_browser.open_file" or any
tool not in this exact list, use read_file/list_files instead.

Rules for editing files:
- Always call read_file on a file before editing it. Never guess its contents.
- edit_file overwrites the ENTIRE file, so you must pass back the full original content
  with ONLY the lines needed for this task added or changed. Do not drop, rewrite,
  simplify, or "clean up" any existing imports, functions, JSX, or logic that isn't
  directly part of the task — preserve them character-for-character.
- The content you pass to edit_file is plain source code, NOT a unified diff or patch.
  Never prefix added/changed lines with "+" or "-" or any other diff/patch marker —
  those characters are not part of real source code and will break the file. Write
  exactly what the file's contents should be, nothing else.
- Make the smallest change that correctly completes the task. If you find yourself
  regenerating a file from scratch instead of editing it, stop and re-read it.
{_COMMON_RULES}
Once edit_file has succeeded for the files you need to change, stop calling tools and reply
with a short summary of what you changed and why. Do not keep exploring after that."""

SUGGEST_SYSTEM_PROMPT = f"""You are a coding agent working inside an isolated git worktree for a single task.
You are in SUGGEST-ONLY mode: you must NOT modify any files. There is no edit_file tool.

The ONLY tools that exist are: read_file, list_files, run_bash, propose_change. Never call
any other tool name, and never try to use run_bash to write files (no echo/sed/cat > file,
etc.) — that defeats the point of this mode.

Rules for proposing changes:
- Always call read_file on a file before proposing a change to it. Never guess its contents.
- Call propose_change once per file that needs changing: give it the file path, a short
  rationale explaining why, and proposed_content = the FULL file content after your change
  (not a diff, not just the changed lines).
- Keep your proposed_content as close to the original as possible — only change what the
  task actually requires. A developer will review and apply this manually, so it should be
  something they can drop in as-is.
{_COMMON_RULES}
Once you've called propose_change for every file that needs changing, stop calling tools and
reply with a short summary of your investigation and what you're proposing overall."""


def run_agent(worktree_path: Path, task_description: str, mode: str = "edit"):
    """Returns (summary, proposals). `proposals` is None in edit mode (the
    agent already wrote its changes to disk) and a list of proposal dicts
    in suggest mode (nothing written — see make_propose_change_tool)."""
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set. Add it to .env before running the agent.")
    if mode not in ("edit", "suggest"):
        raise ValueError(f'mode must be "edit" or "suggest", got {mode!r}')

    llm = ChatGroq(api_key=GROQ_API_KEY, model=GROQ_MODEL, temperature=0)

    proposals = None
    if mode == "edit":
        read_file, list_files, edit_file = make_file_tools(worktree_path)
        tools = [read_file, list_files, edit_file, make_bash_tool(worktree_path)]
        system_prompt = EDIT_SYSTEM_PROMPT
    else:
        proposals = []
        read_file, list_files, _edit_file = make_file_tools(worktree_path)
        tools = [
            read_file,
            list_files,
            make_bash_tool(worktree_path),
            make_propose_change_tool(worktree_path, proposals),
        ]
        system_prompt = SUGGEST_SYSTEM_PROMPT

    agent = create_react_agent(llm, tools)

    # Headroom above LangGraph's default of 25 — a normal explore/edit/verify
    # run takes ~10-20 steps, so this is just a backstop against a genuine
    # loop, not something a well-behaved run should ever approach.
    result = agent.invoke(
        {"messages": [SystemMessage(content=system_prompt), HumanMessage(content=task_description)]},
        {"recursion_limit": 40},
    )

    final_message = result["messages"][-1]
    summary = getattr(final_message, "content", None) or "(agent produced no final message)"
    return summary, proposals
