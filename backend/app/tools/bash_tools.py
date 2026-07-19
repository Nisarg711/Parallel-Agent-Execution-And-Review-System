"""Wraps a shell command as a LangChain tool, pinned to the worktree's
folder via cwd so commands only ever touch that task's own checkout.

NOTE: this runs shell commands directly on the host, scoped only by cwd.
It is safe for a task you wrote yourself against your own repo, but it is
NOT a real sandbox — a container boundary (a later build step) is required
before pointing this at untrusted tasks or repos."""
import subprocess
from pathlib import Path
from typing import List, Union
from langchain_core.tools import tool

# Some models (e.g. gpt-oss-120b) pass timeout in milliseconds out of habit
# (100000 for a 100s test run). Cap hard regardless of what's requested, so a
# hallucinated huge value can't hang the process for real.
MAX_TIMEOUT_SECONDS = 120


def make_bash_tool(worktree_path: Path):
    @tool
    def run_bash(command: Union[str, List[str]], timeout: int = 30) -> str:
        """Run a shell command inside the task's isolated repo checkout (cwd is the repo
        root). Use it to inspect the tree, run linters, or run tests. `command` can be a
        single shell string (e.g. "npm test --silent") or a list of args
        (e.g. ["npm", "test", "--silent"]). `timeout` is in seconds (default 30, capped at
        120)."""
        use_shell = isinstance(command, str)
        timeout = min(timeout, MAX_TIMEOUT_SECONDS)
        try:
            result = subprocess.run(
                command,
                shell=use_shell,
                cwd=worktree_path,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired:
            return f"ERROR: command timed out after {timeout}s"
        if result.returncode != 0:
            return f"EXIT CODE {result.returncode}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        return result.stdout or "(no output)"

    return run_bash
