# ---- BookVibe KYC / Verification Service (FastAPI + DeepFace) ----
# NOTE: deepface pulls in TensorFlow → this image is large (~2-4 GB) and the
# first build is slow. That is expected for an ML service.
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System libraries required by opencv-headless / Pillow / TensorFlow runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first for layer caching.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 5001

# DeepFace downloads model weights into /root/.deepface on first use.
# docker-compose mounts a named volume there so they survive restarts.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001"]
