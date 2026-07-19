"""The suggest-mode counterpart to edit_file: instead of writing to disk, it
records a proposed change (path, rationale, full proposed content) into an
in-memory list the caller owns. Nothing on disk ever changes in this mode —
a human applies the suggestion themselves if they agree with it."""
from pathlib import Path
from langchain_core.tools import tool
from app.tools.fs_tools import resolve_scoped


def make_propose_change_tool(worktree_path: Path, collector: list):
    """Factory, same pattern as make_file_tools: the collector list is
    captured by closure so each task's proposals land in that task's own
    list, never mixed up with another task running in parallel."""

    @tool
    def propose_change(path: str, rationale: str, proposed_content: str) -> str:
        """Propose a change to a file WITHOUT writing it to disk (you are in suggest-only
        mode — there is no edit_file tool). `path` is relative to the repo root, `rationale`
        is a short explanation of why this change is needed, and `proposed_content` is the
        FULL file content after your change (not a diff). Call this once per file that
        needs changing."""
        abs_path = resolve_scoped(worktree_path, path)
        original_content = abs_path.read_text(encoding="utf-8") if abs_path.exists() else ""
        collector.append(
            {
                "path": path,
                "rationale": rationale,
                "original_content": original_content,
                "proposed_content": proposed_content,
            }
        )
        return f"Recorded proposal for {path}. Nothing was written to disk."

    return propose_change
