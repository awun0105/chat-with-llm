# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: Build Backend and Final Image
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies if any
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY app/requirements.txt ./app/
RUN pip install --no-cache-dir -r app/requirements.txt

# Copy backend code
COPY app/ ./app/

# Copy built frontend from Stage 1
COPY --from=frontend-builder /build/dist ./web/dist

# Expose port
EXPOSE 8765

# Set default environment variables
ENV CHAT_INCLUDE_UI=true
ENV CHAT_DATA_DIR=/app/app/data

# Run uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8765"]
