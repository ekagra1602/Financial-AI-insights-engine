FROM python:3.11-slim

# System deps for newspaper3k / lxml C extensions
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libxml2-dev libxslt1-dev gcc g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps (layer cache — only re-runs when requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code into the image (was bind-mounted in dev via docker-compose)
COPY . .

# Render sets $PORT at runtime; default to 8000 for local docker run
EXPOSE 8000

# Shell-form CMD so ${PORT} env var resolves at runtime
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
