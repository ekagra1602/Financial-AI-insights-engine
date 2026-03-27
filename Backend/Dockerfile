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

# Source code is bind-mounted via docker-compose for hot-reload
EXPOSE 8000

CMD ["uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
