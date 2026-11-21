# Supplier Service

## Local run
```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Swagger: http://localhost:8000/docs  
Health: http://localhost:8000/health

Data is currently stored in memory and is lost when the process restarts.
PostgreSQL persistence is a separate next step.
