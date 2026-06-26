import logging
import httpx
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict

from config import settings
from providers import (
    OCRProvider, FaceMatchingProvider,
    GoogleVisionOCRProvider, AwsRekognitionProvider, MockKycProvider
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("kyc_service")

app = FastAPI(title="BookVibe Advanced KYC Service", version="4.1.0")

# Issue 10 fix: restrict CORS to the Node backend only — no wildcard.
# Set ALLOWED_ORIGINS in .env, e.g.: ALLOWED_ORIGINS=http://localhost:3000,https://api.bookvibe.pk
_allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "Authorization"],
)


# --- Provider factory (Strict Factory Pattern) ---

def get_ocr_provider() -> OCRProvider:
    """
    Factory function to retrieve the configured OCR provider.

    Returns:
        OCRProvider: An instance of either a mock or production OCR provider.
    """
    if settings.USE_MOCK_PROVIDERS:
        return MockKycProvider()
    return GoogleVisionOCRProvider()


def get_face_provider() -> FaceMatchingProvider:
    """
    Factory function to retrieve the configured face matching provider.

    Returns:
        FaceMatchingProvider: An instance of either a mock or production face provider.
    """
    if settings.USE_MOCK_PROVIDERS:
        return MockKycProvider()
    return AwsRekognitionProvider()


# --- Authentication Middleware ---

async def verify_api_secret(request: Request):
    """
    Verifies the shared secret provided in the X-API-Key header.
    """
    secret = settings.VERIFICATION_SERVICE_SECRET
    if not secret:
        # If no secret is configured, we assume the service is in a secure
        # internal network or local dev, and allow the request.
        return

    provided_secret = request.headers.get("X-API-Key")
    if provided_secret != secret:
        logger.warning(f"Unauthorized access attempt from {request.client.host}")
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid API Key")


# --- Request models ---

class VerificationRequest(BaseModel):
    """
    Model for CNIC verification requests.

    Attributes:
        image_url (str): The URL of the CNIC image to process.
    """
    image_url: str


class FaceMatchRequest(BaseModel):
    """
    Model for face matching requests.

    Attributes:
        selfie_url (str): The URL of the user's selfie.
        cnic_url (str): The URL of the CNIC image for comparison.
    """
    selfie_url: str
    cnic_url: str


class LivenessRequest(BaseModel):
    """
    Model for liveness check requests.

    Attributes:
        selfie_url (str): The URL of the selfie to check for liveness.
    """
    selfie_url: str


# --- Helpers ---

async def download_image(url: str) -> bytes:
    """
    Downloads an image from a URL asynchronously.

    Args:
        url (str): The URL of the image to download.

    Returns:
        bytes: The raw content of the image.

    Raises:
        HTTPException: If the download fails or returns a non-200 status.
    """
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.content
    except Exception as e:
        logger.error(f"Failed to download image from {url}: {e}")
        raise HTTPException(status_code=400, detail=f"Image download failed: {url}")


# Issue 7 fix: blend provider's native confidence with field-coverage ratio.
# Updated to use snake_case keys consistent with the providers
CRITICAL_FIELDS = ("cnic_number", "full_name", "date_of_birth")


def calculate_confidence(provider_confidence: float, extracted_data: Dict[str, Any]) -> float:
    """
    Calculates a blended confidence score based on provider metrics and field coverage.

    Args:
        provider_confidence (float): The base confidence from the OCR provider (0-1).
        extracted_data (Dict[str, Any]): The map of extracted fields.

    Returns:
        float: A final confidence score between 0 and 100.
    """
    # Handle both camelCase and snake_case for backward compatibility if needed,
    # but standardize on snake_case
    success_count = 0
    for field in CRITICAL_FIELDS:
        if extracted_data.get(field):
            success_count += 1
        elif field == "cnic_number" and extracted_data.get("cnicNumber"):
            success_count += 1
        elif field == "full_name" and extracted_data.get("fullName"):
            success_count += 1
        elif field == "date_of_birth" and (extracted_data.get("dob") or extracted_data.get("dateOfBirth")):
            success_count += 1

    if success_count == 0:
        return 0.0

    field_pct = (success_count / len(CRITICAL_FIELDS)) * 100
    if provider_confidence > 0:
        # 60% provider quality signal (0–1 scale → ×100), 40% field coverage
        return round((provider_confidence * 100 * 0.6) + (field_pct * 0.4), 2)
    return round(field_pct, 2)


def calculate_status(confidence: float) -> str:
    """
    Maps a confidence score to a verification status string.

    Args:
        confidence (float): The confidence score (0-100).

    Returns:
        str: One of 'verified', 'pending_admin_review', or 'rejected'.
    """
    if confidence >= settings.THRESHOLD_APPROVED:
        return "verified"
    elif confidence >= settings.THRESHOLD_REJECTED:
        return "pending_admin_review"
    else:
        return "rejected"


# --- Routes ---

@app.get("/health")
async def health():
    """
    Basic health check endpoint.

    Returns:
        Dict[str, Any]: Service health status and configuration summary.
    """
    return {
        "status": "healthy",
        "providers": "mock" if settings.USE_MOCK_PROVIDERS else "production",
        "allowed_origins": _allowed_origins,
    }


@app.post("/verify-cnic", dependencies=[Depends(verify_api_secret)])
async def verify_cnic(req: VerificationRequest):
    """
    Performs OCR and verification on a CNIC image.

    Args:
        req (VerificationRequest): The request containing the image URL.

    Returns:
        Dict[str, Any]: The extracted data and verification status.

    Raises:
        HTTPException: If OCR processing fails.
    """
    logger.info(f"Processing CNIC OCR for: {req.image_url}")
    content = await download_image(req.image_url)

    ocr = get_ocr_provider()
    try:
        result = await ocr.extract_text(content)
    except RuntimeError as e:
        logger.error(f"Provider configuration error: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        if "INVALID_DOCUMENT_TYPE" in str(e):
            logger.warning(f"CNIC document guard triggered for: {req.image_url}")
            raise HTTPException(status_code=400, detail="INVALID_DOCUMENT_TYPE")
        logger.error(f"OCR processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    data = result.get("extracted_data", {})
    provider_conf = result.get("confidence", 0)
    confidence = calculate_confidence(provider_conf, data)

    return {
        "success": True,
        "status": calculate_status(confidence),
        "data": data,
        "raw_text": result.get("raw_text"),
        "confidence": confidence,
    }


@app.post("/face-match", dependencies=[Depends(verify_api_secret)])
async def face_match(req: FaceMatchRequest):
    """
    Compares a selfie against a CNIC photo.

    Args:
        req (FaceMatchRequest): The request containing selfie and CNIC URLs.

    Returns:
        Dict[str, Any]: The match results and decision.
    """
    logger.info(f"Processing Face Match: {req.selfie_url} vs {req.cnic_url}")
    selfie_content = await download_image(req.selfie_url)
    id_content = await download_image(req.cnic_url)

    face_provider = get_face_provider()
    try:
        result = await face_provider.match_faces(selfie_content, id_content)
    except RuntimeError as e:
        logger.error(f"Provider configuration error: {e}")
        raise HTTPException(status_code=503, detail=str(e))

    confidence = result.get("confidence", 0)
    decision = result.get("decision") or calculate_status(confidence)

    return {
        "matched": result.get("matched", False),
        "status": decision,
        "confidence": confidence,
        "decision": decision,
    }


@app.post("/liveness-check", dependencies=[Depends(verify_api_secret)])
async def liveness_check(req: LivenessRequest):
    """
    Performs a liveness check on a selfie.

    Args:
        req (LivenessRequest): The request containing the selfie URL.

    Returns:
        Dict[str, Any]: Liveness detection results.
    """
    logger.info(f"Processing Liveness Check for: {req.selfie_url}")
    content = await download_image(req.selfie_url)

    face_provider = get_face_provider()
    try:
        result = await face_provider.detect_liveness(content)
    except RuntimeError as e:
        logger.error(f"Provider configuration error: {e}")
        raise HTTPException(status_code=503, detail=str(e))

    confidence = result.get("confidence", 0)

    return {
        "is_live": result.get("is_live", False),
        "status": calculate_status(confidence),
        "confidence": confidence,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
