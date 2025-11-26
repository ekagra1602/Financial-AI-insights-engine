# Backend - Qualcomm AI Financial Insights Engine

A FastAPI-based backend service providing AI-powered financial insights, news summarization, and real-time market data.

## Features

- **News Summarization**: AI-powered summarization of financial news articles
- **Stock Analysis**: Real-time stock data and analysis
- **Market Insights**: AI-generated market insights and trends
- **RESTful API**: Clean, documented API endpoints

## Tech Stack

- **FastAPI**: Modern, high-performance web framework
- **Python 3.13**: Latest Python features
- **OpenAI/Anthropic**: AI-powered text generation and summarization
- **Uvicorn**: ASGI server for production
- **Pydantic**: Data validation and settings management

## Project Structure

```
Backend/
├── app/
│   ├── api/
│   │   └── routes/          # API route handlers
│   │       └── news.py      # News summarization endpoints
│   ├── core/                # Core configuration
│   │   └── config.py        # App configuration
│   ├── models/              # Data models
│   │   └── news.py          # News-related models
│   ├── services/            # Business logic
│   │   └── news_service.py  # News summarization service
│   └── utils/               # Utility functions
├── main.py                  # Application entry point
├── requirements.txt         # Python dependencies
└── README.md               # This file
```

## Getting Started

### Prerequisites

- Python 3.13 or higher
- pip (Python package manager)
- Virtual environment (recommended)

### Installation

1. **Navigate to the Backend directory:**
   ```bash
   cd Backend
   ```

2. **Create a virtual environment:**
   ```bash
   python3 -m venv venv
   ```

3. **Activate the virtual environment:**
   ```bash
   # On macOS/Linux
   source venv/bin/activate

   # On Windows
   venv\Scripts\activate
   ```

4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Set up environment variables:**
   Create a `.env` file in the Backend directory:
   ```env
   # API Keys
   OPENAI_API_KEY=your_openai_api_key_here
   ANTHROPIC_API_KEY=your_anthropic_api_key_here

   # App Configuration
   APP_NAME="Qualcomm Financial Insights Engine"
   DEBUG=True
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
   ```

### Running the Server

1. **Start the development server:**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Access the API:**
   - API: http://localhost:8000
   - Interactive API docs: http://localhost:8000/docs
   - Alternative docs: http://localhost:8000/redoc

## API Endpoints

### News Summarization

#### POST /api/news/summarize
Summarize a financial news article.

**Request Body:**
```json
{
  "title": "Apple Reports Record Q4 Earnings",
  "content": "Apple Inc. today announced financial results...",
  "url": "https://example.com/article",
  "source": "Reuters"
}
```

**Response:**
```json
{
  "summary": "Apple reported record Q4 earnings with revenue up 8%...",
  "key_points": [
    "Revenue increased 8% year-over-year",
    "iPhone sales exceeded expectations",
    "Services segment showed strong growth"
  ],
  "sentiment": "positive",
  "symbols_mentioned": ["AAPL"],
  "processing_time": 1.23
}
```

#### POST /api/news/summarize-batch
Summarize multiple news articles at once.

**Request Body:**
```json
{
  "articles": [
    {
      "title": "Article 1",
      "content": "Content 1...",
      "url": "https://example.com/1"
    },
    {
      "title": "Article 2",
      "content": "Content 2...",
      "url": "https://example.com/2"
    }
  ]
}
```

#### GET /api/news/health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "news-summarization",
  "timestamp": "2025-11-25T21:30:00Z"
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for GPT models | None (required) |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | None (optional) |
| `APP_NAME` | Application name | "Financial Insights Engine" |
| `DEBUG` | Debug mode | False |
| `ALLOWED_ORIGINS` | CORS allowed origins | http://localhost:3000 |
| `MAX_SUMMARY_LENGTH` | Max summary length | 500 |
| `AI_MODEL` | AI model to use | gpt-4o-mini |

### CORS Configuration

The backend is configured to accept requests from the frontend. Update `ALLOWED_ORIGINS` in your `.env` file to match your frontend URL.

## Development

### Running Tests
```bash
pytest tests/
```

### Code Formatting
```bash
# Install formatting tools
pip install black isort

# Format code
black .
isort .
```

### Type Checking
```bash
# Install mypy
pip install mypy

# Run type checker
mypy app/
```

## Deployment

### Production Server

For production, use Gunicorn with Uvicorn workers:

```bash
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Docker Deployment

```dockerfile
FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:
```bash
docker build -t financial-insights-backend .
docker run -p 8000:8000 --env-file .env financial-insights-backend
```

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

These provide interactive API documentation where you can test endpoints directly.

## Error Handling

The API uses standard HTTP status codes:
- `200`: Success
- `400`: Bad Request (invalid input)
- `401`: Unauthorized (missing/invalid API key)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

Error responses follow this format:
```json
{
  "detail": "Error message here",
  "error_code": "INVALID_INPUT",
  "timestamp": "2025-11-25T21:30:00Z"
}
```

## Performance Optimization

- **Caching**: Redis caching for frequently accessed data
- **Rate Limiting**: Prevent API abuse
- **Connection Pooling**: Database connection optimization
- **Async Operations**: Non-blocking I/O for better performance

## Security

- Environment variables for sensitive data
- CORS protection
- Rate limiting
- Input validation with Pydantic
- API key authentication (planned)

## Troubleshooting

### Common Issues

**Issue**: `ModuleNotFoundError: No module named 'fastapi'`
- **Solution**: Activate virtual environment and run `pip install -r requirements.txt`

**Issue**: `CORS error from frontend`
- **Solution**: Check `ALLOWED_ORIGINS` in `.env` file matches your frontend URL

**Issue**: `OpenAI API key error`
- **Solution**: Ensure `OPENAI_API_KEY` is set in `.env` file

**Issue**: Port 8000 already in use
- **Solution**: Use a different port: `uvicorn main:app --port 8001`

## Contributing

This is a capstone project for Qualcomm. For questions or contributions, please contact the development team.

## License

© 2025 Qualcomm AI Financial Insights Engine - Capstone Project
