'''
SQLModel is a modern Python library designed to interact with SQL databases 
using standard Python objects
The tool serves as an Object-Relational Mapper (ORM). 
It allows you to write Python classes that simultaneously define your database tables and validate incoming API data.
'''
from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
import uuid

class Task(SQLModel, table=True):
    '''
    id's default_factory=lambda: str(uuid.uuid4()) means if you create a Task() without passing an id, SQLModel auto-generates a UUID.
    '''
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    description: str
    mode: str  # "edit" or "suggest"
    status: str = "pending"  # pending -> running -> needs_review -> approved/rejected/failed
    branch_name: Optional[str] = None
    worktree_path: Optional[str] = None
    diff: Optional[str] = None
    proposals: Optional[str] = None  # store as JSON string
    error_log: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    summary: Optional[str] = None