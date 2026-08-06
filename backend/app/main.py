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
from app.queue import task_queue
from app.db.session import engine, init_db
from app.db.models import Task
from app.task_runner import run_task


from fastapi.middleware.cors import CORSMiddleware

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


'''
Task is a SQLModel, FastAPI can use it directly as both the DB model and the API response schema
'''
@app.post("/tasks", response_model=Task)
def create_task(description: str, mode: str):
    if mode not in ("edit", "suggest"):
        raise HTTPException(status_code=400, detail='mode must be "edit" or "suggest"')

    task = Task(description=description, mode=mode)
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


@app.get("/tasks/{task_id}", response_model=Task)
def get_task(task_id: str):
    with Session(engine) as session:
        task = session.get(Task, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        return task


'''This is a guardrail to ensure that we don't accidently approve a task still running'''
@app.post("/tasks/{task_id}/approve", response_model=Task)
def approve_task(task_id: str):
    with Session(engine) as session:
        task = session.get(Task, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        if task.status != "needs_review":
            raise HTTPException(status_code=400, detail=f"Task is '{task.status}', not ready for approval")
        task.status = "approved"
        session.add(task)
        session.commit()
        session.refresh(task)
        return task


@app.post("/tasks/{task_id}/reject", response_model=Task)
def reject_task(task_id: str):
    with Session(engine) as session:
        task = session.get(Task, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        task.status = "rejected"
        session.add(task)
        session.commit()
        session.refresh(task)
        return task