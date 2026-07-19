"""Scoped file tools the agent is allowed to call. Every tool routes through
resolve_scoped() first — that's the sandboxing boundary: it resolves a
relative path against the worktree root and raises if the result would land
outside it (e.g. "../../other-task/secrets")."""
from pathlib import Path
from langchain_core.tools import tool


def resolve_scoped(worktree_path: Path, relative_path: str) -> Path:
    root = worktree_path.resolve()
    resolved = (root / relative_path).resolve()
    if not resolved.is_relative_to(root):
        raise ValueError(f'Path "{relative_path}" escapes the task\'s worktree — not allowed.')
    return resolved


def make_file_tools(worktree_path: Path):
    """Factory: builds three tools hardwired to one worktree path via
    closure. The model never gets to pass "which worktree" itself — that's
    what stops one task's agent from reading/writing another task's files,
    even if it tried a sneaky relative path."""

    @tool
    def read_file(path: str) -> str:
        """Read a file's contents by path, relative to the task's repo checkout root."""
        abs_path = resolve_scoped(worktree_path, path)
        if not abs_path.exists():
            return f"ERROR: file not found: {path}"
        return abs_path.read_text(encoding="utf-8")

    @tool
    def list_files(path: str = ".") -> str:
        """List files/directories at a path relative to the repo root (defaults to root)."""
        abs_path = resolve_scoped(worktree_path, path)
        if not abs_path.exists():
            return f"ERROR: path not found: {path}"
        return "\n".join(sorted(p.name for p in abs_path.iterdir()))

    @tool
    def edit_file(path: str, content: str) -> str:
        """Overwrite a file with new content, relative to the repo root. Creates the file
        (and parent dirs) if it doesn't exist. Always write the FULL new file content, not a diff."""
        abs_path = resolve_scoped(worktree_path, path)
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        abs_path.write_text(content, encoding="utf-8")
        return f"Wrote {len(content)} bytes to {path}"

    return [read_file, list_files, edit_file]
