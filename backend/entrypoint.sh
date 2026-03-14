#!/bin/sh
set -e

echo "Waiting for database..."
while ! nc -z db 5432; do
  sleep 0.5
done
echo "Database is ready"

echo "Running migrations..."
cd /app
python -c "
from app.database import Base, engine
from app.models import *
import asyncio
async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
asyncio.run(init())
"
echo "Tables created"

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
