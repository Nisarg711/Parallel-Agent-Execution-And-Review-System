"""Runs the target repo's configured test command inside a task's worktree,
after the agent has finished. Deterministic backend logic, not an agent
tool — same reasoning as the git commit step.

Results are informational only. A failing or missing test suite never
blocks a task from reaching review — it's one more thing for the human
reviewer to see, not an automated gate."""
import subprocess
from app.config import TEST_COMMAND, TEST_TIMEOUT_SECONDS


def run_tests(worktree_path: str, test_command: str | None):
    if not test_command:
        return "skipped", "No test command configured for this repo."
    try:
        result = subprocess.run(
            test_command, shell=True, cwd=worktree_path,
            capture_output=True, text=True, timeout=TEST_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        return "error", f"Test command timed out after {TEST_TIMEOUT_SECONDS}s."
    except Exception as e:
        return "error", f"Failed to run test command: {e}"

    output = (result.stdout or "") + (result.stderr or "")
    status = "passed" if result.returncode == 0 else "failed"
    return status, output[-5000:]