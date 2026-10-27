# Muhurtham App — production container
# Single-server architecture: FastAPI serves the API and the webapp static tree.
FROM python:3.11-slim

WORKDIR /app

# System deps (none required beyond python — swisseph ships compiled wheels)
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt

# App code
COPY backend/app backend/app
COPY webapp webapp

# Ephemeris files (if the project stores them under backend/scripts or data)
COPY backend/scripts backend/scripts

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    MUHURTHAM_CORS_ORIGINS="" \
    MUHURTHAM_ENABLE_DEV_PDF=0 \
    PORT=8000

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers ${MUHURTHAM_WORKERS:-2}"]
