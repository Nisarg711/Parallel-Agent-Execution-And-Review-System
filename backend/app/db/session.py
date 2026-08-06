from sqlmodel import create_engine, Session, SQLModel
import os
from app.config import PROJECT_ROOT  # or just import app.config to trigger its load_dotenv() call
from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / ".env")

DATABASE_URL = os.environ["DATABASE_URL"]
# pool_pre_ping: test a pooled connection is still alive before handing it
# out, reconnecting if not. Needed because Neon (serverless Postgres) can
# drop idle connections or suspend its compute — without this, a worker
# that's been idle for a while hands out a dead connection and the very
# next query fails with "server closed the connection unexpectedly."
# pool_recycle: also proactively retire connections older than 5 minutes,
# regardless of whether pre-ping happens to catch them.
engine = create_engine(DATABASE_URL, echo=True, pool_pre_ping=True, pool_recycle=300)

def init_db():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

#In SQLModel, the engine is the central object that manages the connection to your SQL database.