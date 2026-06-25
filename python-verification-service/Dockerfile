# ---- BookVibe KYC / Verification Service (FastAPI) ----
# OCR via Google Cloud Vision, face match + liveness via AWS Rekognition.
# All inference is done by cloud APIs, so this is a lightweight image
# (no TensorFlow / OpenCV / local models).
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install Python deps first for layer caching.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 5001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001"]
