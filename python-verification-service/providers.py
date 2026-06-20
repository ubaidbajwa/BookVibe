import abc
import logging
import os
import boto3
import re
from google.cloud import vision
from typing import Dict, Any, Optional
from config import settings

logger = logging.getLogger("kyc_providers")


class OCRProvider(abc.ABC):
    """
    Abstract base class for OCR (Optical Character Recognition) providers.
    """

    @abc.abstractmethod
    async def extract_text(self, image_content: bytes) -> Dict[str, Any]:
        """
        Extracts text and structured data from an image.

        Args:
            image_content (bytes): The raw bytes of the image.

        Returns:
            Dict[str, Any]: A dictionary containing raw_text, extracted_data, and confidence.
        """
        pass


class FaceMatchingProvider(abc.ABC):
    """
    Abstract base class for face matching and liveness detection providers.
    """

    @abc.abstractmethod
    async def match_faces(self, selfie_content: bytes, id_content: bytes) -> Dict[str, Any]:
        """
        Compares two faces to determine if they belong to the same person.

        Args:
            selfie_content (bytes): raw bytes of the selfie image.
            id_content (bytes): raw bytes of the ID image.

        Returns:
            Dict[str, Any]: Comparison results including match status and confidence.
        """
        pass

    @abc.abstractmethod
    async def detect_liveness(self, selfie_content: bytes) -> Dict[str, Any]:
        """
        Performs a liveness check on a selfie to prevent spoofing.

        Args:
            selfie_content (bytes): raw bytes of the selfie image.

        Returns:
            Dict[str, Any]: Liveness check results.
        """
        pass


# --- Google Cloud Vision Provider ---

class GoogleVisionOCRProvider(OCRProvider):
    """
    OCR Provider implementation using Google Cloud Vision API.
    """

    def __init__(self):
        """
        Initializes the Google Vision OCR Provider.
        """
        self._client = None

    @property
    def client(self):
        """
        Lazy initialization for the Google Vision client.

        Returns:
            vision.ImageAnnotatorClient: The initialized client.

        Raises:
            RuntimeError: If GOOGLE_APPLICATION_CREDENTIALS is not set or file is missing.
        """
        if self._client is None:
            creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
            if not creds_path:
                raise RuntimeError(
                    "GOOGLE_APPLICATION_CREDENTIALS is not configured. "
                    "Add the path to your Google service account JSON file in "
                    "python-verification-service/.env"
                )
            if not os.path.isfile(creds_path):
                raise RuntimeError(
                    f"Google credentials file not found at: '{creds_path}'. "
                    "Ensure the path in GOOGLE_APPLICATION_CREDENTIALS is correct and the file exists."
                )
            self._client = vision.ImageAnnotatorClient()
        return self._client

    async def extract_text(self, image_content: bytes) -> Dict[str, Any]:
        """
        Extracts text from an image using Google Vision and validates it against CNIC patterns.

        Args:
            image_content (bytes): raw bytes of the image.

        Returns:
            Dict[str, Any]: Structured data extracted from the CNIC.

        Raises:
            Exception: If an API error occurs or if the document type is invalid.
        """
        image = vision.Image(content=image_content)

        # Request both TEXT_DETECTION and LABEL_DETECTION
        features = [
            {"type_": vision.Feature.Type.TEXT_DETECTION},
            {"type_": vision.Feature.Type.LABEL_DETECTION}
        ]
        request = {"image": image, "features": features}
        response = self.client.annotate_image(request=request)

        if response.error.message:
            logger.error(f"Google Vision API Error: {response.error.message}")
            raise Exception(f"OCR Error: {response.error.message}")

        # 1. Label Detection (Safety Guard)
        labels = [label.description.lower() for label in response.label_annotations]
        is_document = any(l in labels for l in ["document", "id card", "identity document", "passport", "driving license"])

        # 2. Text Detection & Keyword Validation
        texts = response.text_annotations
        if not texts:
            if not is_document:
                raise Exception("INVALID_DOCUMENT_TYPE")
            return {"raw_text": "", "extracted_data": {}, "confidence": 0}

        full_text = texts[0].description
        full_text_lower = full_text.lower()

        # Mandatory Keywords for Pakistani CNIC
        keywords = ["pakistan", "national identity", "identity card", "government of pakistan"]
        has_keywords = any(k in full_text_lower for k in keywords)

        # CNIC Regex Pattern
        cnic_pattern = r"\b\d{5}-\d{7}-\d\b"
        has_cnic_pattern = re.search(cnic_pattern, full_text) is not None

        # STRICT GUARD: If no labels match AND no keywords/regex match, it's junk
        if not (is_document or has_keywords or has_cnic_pattern):
            logger.warning("Guard Triggered: Image does not appear to be a Pakistani CNIC.")
            raise Exception("INVALID_DOCUMENT_TYPE")

        # Standardized parsing for Pakistani CNIC
        # Standardized on snake_case keys for cross-service consistency
        extracted = {
            "cnic_number":   self._extract_regex(full_text, cnic_pattern),
            "full_name":     self._extract_regex(full_text, r"(?im)^Name\s*[:/]?\s*(.+)$"),
            "father_name":   self._extract_regex(full_text, r"(?im)^Father['\s]*s?\s*Name\s*[:/]?\s*(.+)$"),
            "date_of_birth": self._extract_regex(full_text, r"(?i)Date\s*of\s*Birth\s*[:/]?\s*(\d{2}[./-]\d{2}[./-]\d{4})"),
            "gender":        self._extract_regex(full_text, r"(?i)Gender\s*[:/]?\s*(Male|Female|M|F)\b"),
            "address":       self._extract_regex(full_text, r"(?im)Address\s*[:/]?\s*(.+)$"),
        }

        return {
            "raw_text": full_text,
            "extracted_data": extracted,
            "confidence": 0.95
        }

    def _extract_regex(self, text: str, pattern: str) -> Optional[str]:
        """
        Utility to extract a string using a regex pattern.

        Args:
            text (str): The text to search within.
            pattern (str): The regex pattern to use.

        Returns:
            Optional[str]: The extracted string or None.
        """
        match = re.search(pattern, text)
        if not match:
            return None

        if match.lastindex:
            result = match.group(1).strip()
        else:
            result = match.group(0).strip()

        if not result:
            return None

        return result


# --- AWS Rekognition Provider ---

class AwsRekognitionProvider(FaceMatchingProvider):
    """
    Face matching provider implementation using AWS Rekognition.
    """

    def __init__(self):
        """
        Initializes the AWS Rekognition Provider.
        """
        self._client = None

    @property
    def client(self):
        """
        Lazy initialization for the Boto3 Rekognition client.

        Returns:
            boto3.client: The initialized client.

        Raises:
            RuntimeError: If AWS credentials are not configured.
        """
        if self._client is None:
            _PLACEHOLDER = ("", None, "your_aws_access_key_here", "your_aws_secret_key_here")
            if settings.AWS_ACCESS_KEY_ID in _PLACEHOLDER:
                raise RuntimeError(
                    "AWS_ACCESS_KEY_ID is not configured. "
                    "Add your real AWS credentials in python-verification-service/.env"
                )
            if settings.AWS_SECRET_ACCESS_KEY in _PLACEHOLDER:
                raise RuntimeError(
                    "AWS_SECRET_ACCESS_KEY is not configured. "
                    "Add your real AWS credentials in python-verification-service/.env"
                )
            self._client = boto3.client(
                'rekognition',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION
            )
        return self._client

    async def match_faces(self, selfie_content: bytes, id_content: bytes) -> Dict[str, Any]:
        """
        Matches faces using AWS Rekognition.

        Args:
            selfie_content (bytes): raw bytes of the selfie.
            id_content (bytes): raw bytes of the ID photo.

        Returns:
            Dict[str, Any]: Match result dictionary.
        """
        response = self.client.compare_faces(
            SourceImage={'Bytes': id_content},
            TargetImage={'Bytes': selfie_content},
            SimilarityThreshold=50.0
        )

        matches = response.get('FaceMatches', [])
        if not matches:
            return {"matched": False, "confidence": 0}

        match = matches[0]
        return {
            "matched": match['Similarity'] > 80,
            "confidence": match['Similarity'],
            "details": match
        }

    async def detect_liveness(self, selfie_content: bytes) -> Dict[str, Any]:
        """
        Performs basic face quality checks as a proxy for liveness.

        Args:
            selfie_content (bytes): raw bytes of the selfie.

        Returns:
            Dict[str, Any]: Liveness result dictionary.
        """
        response = self.client.detect_faces(
            Image={'Bytes': selfie_content},
            Attributes=['ALL']
        )

        faces = response.get('FaceDetails', [])
        if len(faces) != 1:
            return {"is_live": False, "confidence": 0}

        face = faces[0]
        quality = face.get('Quality', {})
        brightness = quality.get('Brightness', 0)
        sharpness = quality.get('Sharpness', 0)
        face_confidence = face.get('Confidence', 0)

        # Basic heuristic for spoofing detection
        quality_ok = brightness >= 40 and sharpness >= 40 and face_confidence >= 90
        composite_confidence = (brightness + sharpness + face_confidence) / 3

        return {
            "is_live": quality_ok,
            "confidence": round(composite_confidence, 2)
        }


# --- Mock Provider for Local Testing ---

class MockKycProvider(OCRProvider, FaceMatchingProvider):
    """
    Mock implementation of KYC providers for local development and testing.
    """

    async def extract_text(self, image_content: bytes) -> Dict[str, Any]:
        """
        Returns realistic Pakistani CNIC data in snake_case.
        CNIC number is derived from a hash of the image bytes so that:
          - the same image always yields the same CNIC (uniqueness check works)
          - different images yield different CNICs (multiple test users work)

        Args:
            image_content (bytes): raw bytes of the image.

        Returns:
            Dict[str, Any]: Mocked OCR result.
        """
        import hashlib
        h = hashlib.md5(image_content).hexdigest()
        area   = str(int(h[0:5],  16) % 90000   + 10000)   # 5-digit area code
        serial = str(int(h[5:12], 16) % 9000000 + 1000000) # 7-digit serial
        check  = str(int(h[12],   16) % 9        + 1)       # 1-digit check digit
        mock_cnic = f"{area}-{serial}-{check}"

        return {
            "raw_text": f"GOVERNMENT OF PAKISTAN NATIONAL IDENTITY CARD NAME: MUHAMMAD AHMAD FATHER NAME: ABDUL KHAN DATE OF BIRTH: 15.08.1992 GENDER: MALE CNIC: {mock_cnic} ADDRESS: House 123, Street 4, Sector F-10, Islamabad",
            "extracted_data": {
                "cnic_number": mock_cnic,
                "full_name": "MUHAMMAD AHMAD",
                "father_name": "ABDUL KHAN",
                "date_of_birth": "15.08.1992",
                "gender": "Male",
                "address": "House 123, Street 4, Sector F-10, Islamabad"
            },
            "confidence": 0.98
        }

    async def match_faces(self, selfie_content: bytes, id_content: bytes) -> Dict[str, Any]:
        """
        Returns a successful mock face match.

        Args:
            selfie_content (bytes): raw bytes.
            id_content (bytes): raw bytes.

        Returns:
            Dict[str, Any]: Mocked match result.
        """
        return {
            "matched": True,
            "confidence": 94.5,
            "decision": "approved"
        }

    async def detect_liveness(self, selfie_content: bytes) -> Dict[str, Any]:
        """
        Returns a successful mock liveness check.

        Args:
            selfie_content (bytes): raw bytes.

        Returns:
            Dict[str, Any]: Mocked liveness result.
        """
        return {
            "is_live": True,
            "confidence": 97.2
        }
