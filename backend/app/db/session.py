from sqlmodel import create_engine, Session, SQLModel
import os
from app.config import PROJECT_ROOT  # or just import app.config to trigger its load_dotenv() call
from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / ".env")

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(DATABASE_URL, echo=True)

def init_db():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session