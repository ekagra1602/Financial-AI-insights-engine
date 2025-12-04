# Qualcomm Financial Insights Engine - Backend

This directory contains the backend API for the Qualcomm Financial Insights Engine, built with FastAPI.

## Prerequisites

- Python 3.8+
- pip

## Setup

1.  Navigate to the `Backend` directory:

    ```bash
    cd Backend
    ```

2.  Create a virtual environment:

    ```bash
    python -m venv venv
    ```

3.  Activate the virtual environment:

    - **Mac/Linux:**
      ```bash
      source venv/bin/activate
      ```
    - **Windows:**
      ```bash
      venv\Scripts\activate
      ```

4.  Install dependencies:

    ```bash
    pip install -r requirements.txt
    ```

5.  **Environment Variables:**
    Create a `.env` file in the `Backend` directory. You can copy the example file:

    ```bash
    cp .env.example .env
    ```

    The required variables are:

    ```bash
    # Finnhub API (Required)
    FINNHUB_API_KEY=your_finnhub_key_here

    # Supabase (Required)
    SUPABASE_URL=https://your-project.supabase.co
    SUPABASE_KEY=your_supabase_key_here

    # AI100 / Cirrascale (Required for summarization)
    AI100_API_KEY=your_ai100_key_here
    ```

    Optional variables:

    ```bash
    # AI100 Configuration
    AI100_BASE_URL=https://aisuite.cirrascale.com/apis/v2
    AI100_MODEL=meta-llama/Llama-3.1-8B-Instruct
    ```

## Running the Server

Start the development server with hot-reload:

```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`.

## API Documentation

Once the server is running, you can access the interactive API documentation at:

- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

## Project Structure

- `main.py`: Entry point of the application. Configures FastAPI, CORS, and routers.
- `models.py`: Pydantic models for data validation and serialization.
- `services/`: Contains business logic and external API clients (e.g., `finnhub_client.py`).
- `requirements.txt`: Python dependencies.
