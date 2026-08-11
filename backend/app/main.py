"""FastAPI app: exposes task creation, listing, and 
review actions.
Agent execution happens in the background via BackgroundTasks — 
this is a stand-in for a real job queue (Step 4), but 
keeps the same API shape.
FastAPI provides a built-in BackgroundTasks class 
that allows you to trigger operations after 
returning an HTTP response to the client. This keeps your 
application fast and responsive because the user doesn't have to 
wait for time-consuming operations to finish.
"""
from fastapi import FastAPI, BackgroundTasks, HTTPException
from sqlmodel import Session, select
from rq import Worker
from app.queue import task_queue, redis_conn
from app.db.session import engine, init_db
from app.db.models import Task,Repository
from app.task_runner import run_task
from app.github_integration import commit_and_push, create_pull_request
from app.git.worktree import remove_task_worktree
from fastapi.middleware.cors import CORSMiddleware
from app.git.worktree import ensure_base_repo_dependencies
from app.git.worktree import clone_repo, run_setup_command
from app.github_integration import parse_github_url, check_repo_write_access
from pathlib import Path
import traceback

app = FastAPI(title="Multi-Agent Task Isolation and Review System")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


@app.post("/repos", response_model=Repository)
def register_repo(github_url: str, test_command: str = None, setup_command: str = None):
    try:
        owner, name = parse_github_url(github_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not check_repo_write_access(owner, name):
        raise HTTPException(
            status_code=403,
            detail="This app's GitHub token doesn't have write access to that repo. "
                   "Add it as a collaborator, or use a repo you already own.",
        )

    repository = Repository(
        github_url=github_url, owner=owner, name=name,
        test_command=test_command, setup_command=setup_command,
    )
    with Session(engine) as session:
        session.add(repository)
        session.commit()
        session.refresh(repository)

    try:
        base_path = clone_repo(repository.id, github_url)
        run_setup_command(base_path, setup_command)
        with Session(engine) as session:
            repository = session.get(Repository, repository.id)
            repository.local_path = str(base_path)
            repository.status = "ready"
            session.add(repository)
            session.commit()
            session.refresh(repository)
    except Exception:
        with Session(engine) as session:
            repository = session.get(Repository, repository.id)
            repository.status = "failed"
            repository.error_log = traceback.format_exc()
            session.add(repository)
            session.commit()
            session.refresh(repository)

    return repository

@app.get("/repos", response_model=list[Repository])
def list_repos():
    with Session(engine) as session:
        return session.exec(select(Repository).order_by(Repository.created_at.desc())).all()

    
'''
Task is a SQLModel, FastAPI can use it directly as both the DB model and the API response schema
'''
@app.post("/tasks", response_model=Task)
def create_task(description: str, mode: str, repo_id: str, background_tasks: BackgroundTasks):
    if mode not in ("edit", "suggest"):
        raise HTTPException(status_code=400, detail='mode must be "edit" or "suggest"')
    with Session(engine) as session:
        repository = session.get(Repository, repo_id)
    if repository is None or repository.status != "ready":
        raise HTTPException(status_code=400, detail="Repo not found or not ready")
    task = Task(description=description, mode=mode, repo_id=repo_id)
    with Session(engine) as session:
        session.add(task)
        session.commit()
        session.refresh(task)

    # run_task looks up the row itself, so passing the id is enough
    task_queue.enqueue(run_task, task.id, description, mode)
    return task


@app.get("/tasks", response_model=list[Task])
def list_tasks():
    with Session(engine) as session:
        return session.exec(select(Task).order_by(Task.created_at.desc())).all()


'''Reads live state straight from RQ/Redis — not the tasks table — so this
reflects the actual queue/worker mechanics (who's idle, who's crunching what),
not just what each task row says about itself.'''
@app.get("/queue/status")
def queue_status():
    workers = []
    for w in Worker.all(connection=redis_conn):
        job = w.get_current_job()
        workers.append({
            "name": w.name,
            "state": w.get_state(),
            "current_task_id": job.args[0] if job else None,
            "current_description": job.args[1] if job else None,
        })
    return {"queued_count": task_queue.count, "workers": workers}


@app.get("/tasks/{task_id}", response_model=Task)
def get_task(task_id: str):
    with Session(engine) as session:
        task = session.get(Task, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        return task


'''This is a guardrail to ensure that we don't accidently approve a task still running.

For edit-mode tasks, approving is what actually lands the change: commit the
worktree, push the branch, open a PR. Suggest-mode tasks never wrote
anything to disk, so there's nothing to push — approving one just records
the decision. If the git/GitHub steps fail, the task stays "needs_review"
(not "approved") so it can be retried, rather than silently approving
something that never actually made it to GitHub.'''
@app.post("/tasks/{task_id}/approve", response_model=Task)
def approve_task(task_id: str):
    with Session(engine) as session:
        task = session.get(Task, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        if task.status != "needs_review":
            raise HTTPException(status_code=400, detail=f"Task is '{task.status}', not ready for approval")

        # Repo-aware: which repo a task's push/PR/cleanup target depends on
        # this row, not a single global env var — multiple repos can have
        # tasks in flight at once.
        repository = session.get(Repository, task.repo_id) if task.repo_id else None

        if task.mode == "edit" and task.worktree_path and task.branch_name and repository:
            try:
                pushed = commit_and_push(
                    task.worktree_path,
                    task.branch_name,
                    commit_message=f"Agent: {task.description[:72]}",
                    repo_slug=f"{repository.owner}/{repository.name}",
                )
                if pushed:
                    task.pr_url = create_pull_request(
                        task.branch_name,
                        title=task.description[:72],
                        body=task.summary or "Agent-generated change.",
                        repo_slug=f"{repository.owner}/{repository.name}",
                    )
            except Exception as err:
                raise HTTPException(
                    status_code=502,
                    detail=f"Approved locally but failed to push/open PR: {err}",
                )

        task.status = "approved"
        session.add(task)
        session.commit()
        session.refresh(task)

        # Worktree's job is done once it's been committed/pushed (or if
        # suggest mode, it was never written to anyway) — safe to clean up.
        try:
            if repository and repository.local_path:
                remove_task_worktree(task_id, repository.id, Path(repository.local_path))
        except Exception:
            pass  # best-effort; a leftover folder is harmless, don't fail the request over it
        return task


@app.post("/tasks/{task_id}/reject", response_model=Task)
def reject_task(task_id: str):
    with Session(engine) as session:
        task = session.get(Task, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        repository = session.get(Repository, task.repo_id) if task.repo_id else None
        task.status = "rejected"
        session.add(task)
        session.commit()
        session.refresh(task)
        try:
            if repository and repository.local_path:
                remove_task_worktree(task_id, repository.id, Path(repository.local_path))
        except Exception:
            pass
        return task