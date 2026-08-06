'''This gives you one shared Queue object your API can enqueue jobs onto, and your worker process will listen to.'''

import os
import redis
from rq import Queue
from app.config import PROJECT_ROOT
from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / ".env")

redis_conn = redis.from_url(os.environ["REDIS_URL"])
task_queue = Queue("tasks", connection=redis_conn)

