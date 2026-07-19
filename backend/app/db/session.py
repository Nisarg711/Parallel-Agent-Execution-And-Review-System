from sqlmodel import create_engine, Session, SQLModel
import os

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(DATABASE_URL, echo=True)

def init_db():
    SQLModel.metadata.create_all(engine)  # creates tables if they don't exist

def get_session():
    with Session(engine) as session:
        yield session