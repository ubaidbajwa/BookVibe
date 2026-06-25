import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """
    Application configuration settings using Pydantic BaseSettings.
    Loads values from environment variables or a .env file.

    Attributes:
        AWS_ACCESS_KEY_ID (Optional[str]): AWS access key for Rekognition.
        AWS_SECRET_ACCESS_KEY (Optional[str]): AWS secret key for Rekognition.
        AWS_REGION (str): AWS region for Rekognition.
        GOOGLE_APPLICATION_CREDENTIALS (Optional[str]): Path to Google Cloud credentials JSON.
        THRESHOLD_APPROVED (float): Confidence score required for auto-approval.
        THRESHOLD_REJECTED (float): Confidence score below which verification is rejected.
        ALLOWED_ORIGINS (str): Comma-separated list of allowed CORS origins.
    """

    # AWS Credentials
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"

    # Google Cloud Credentials
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None

    # Decision Thresholds
    THRESHOLD_APPROVED: float = 85.0
    THRESHOLD_REJECTED: float = 50.0

    # CORS — comma-separated list of allowed Node backend origins.
    # Only the Node backend should ever call this service; wildcard is intentionally removed.
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


# Global settings instance
settings = Settings()

# Pydantic reads .env into the Settings object but does NOT update os.environ.
# The Google Cloud SDK reads GOOGLE_APPLICATION_CREDENTIALS from os.environ,
# so we must propagate it manually.
if settings.GOOGLE_APPLICATION_CREDENTIALS:
    os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", settings.GOOGLE_APPLICATION_CREDENTIALS)
