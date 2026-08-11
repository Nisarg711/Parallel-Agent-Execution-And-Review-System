#!/bin/bash
rq worker tasks --url "$REDIS_URL" &
python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT