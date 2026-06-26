/**
 * @fileoverview Utility for interacting with the Python verification microservice
 * @module utils/verificationService
 */

import axios from 'axios';

const PYTHON_URL = process.env.PYTHON_VERIFICATION_URL || process.env.PYTHON_VERIFY_URL || 'http://localhost:5001';
const TIMEOUT = 15000; // 15 s per attempt — hard cap prevents event-loop stall
const MAX_RETRIES = 2; // Total 3 attempts (1 + 2 retries) — worst case: 3×15s + 2×4s = 53s
const RETRY_DELAY = 4000; // 4 s — gives Cloudinary CDN propagation time

// Shared secret sent on every call so the Python service can reject any request
// that did not originate from this backend. Must match INTERNAL_API_KEY in the
// python-verification-service .env. No-op (header omitted) if unset.
const INTERNAL_KEY = process.env.PYTHON_INTERNAL_KEY || '';
const internalHeaders = INTERNAL_KEY ? { 'X-Internal-Key': INTERNAL_KEY } : {};

/* -------------------------------------------------------------------------- */
/*                                Retry Logic                                 */
/* -------------------------------------------------------------------------- */

/**
 * Determines if an error from the verification service is retriable
 * @param {Error} error - The error object
 * @returns {boolean} True if the error is retriable
 */
const isRetriableError = (error) => {
  // Network/connection errors (DNS, timeout, etc.)
  const code = error?.code;
  if (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNABORTED' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNRESET' ||
    code === 'EAI_AGAIN'
  ) return true;

  // Python returned 400 because it couldn't download image from Cloudinary
  const detail = error?.response?.data?.detail || '';
  if (error?.response?.status === 400) {
    if (detail.includes('Image download failed')) return true;
    if (detail.includes('404')) return true;
    if (detail.includes('NameResolution')) return true;
    if (detail.includes('Connection')) return true;
    if (detail.includes('timed out')) return true;
  }

  return false;
};

/**
 * Wrapper for API calls with automatic retry logic
 * @param {Function} fn - The async function to execute
 * @param {string} label - Label for logging
 * @returns {Promise<any>} Response from the function
 */
const callWithRetry = async (fn, label = 'Verification') => {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetriableError(error) || attempt === MAX_RETRIES) {
        throw error;
      }

      await new Promise(r => setTimeout(r, RETRY_DELAY));
    }
  }

  throw lastError;
};

/* -------------------------------------------------------------------------- */
/*                                Verification API                             */
/* -------------------------------------------------------------------------- */

/**
 * Extracts data from a CNIC image using OCR
 * @param {Object} params - Parameters object
 * @param {string} params.image_url - URL of the CNIC image
 * @returns {Promise<Object>} Extracted OCR data
 */
const verifyCnic = async ({ image_url }) => {
  const response = await callWithRetry(
    () => axios.post(`${PYTHON_URL}/verify-cnic`, { image_url }, { timeout: TIMEOUT, headers: internalHeaders }),
    'OCR'
  );
  return response.data;
};

/**
 * Matches a selfie image against a CNIC image
 * @param {Object} params - Parameters object
 * @param {string} params.selfie_url - URL of the selfie image
 * @param {string} params.cnic_url - URL of the CNIC image
 * @returns {Promise<Object>} Face match results
 */
const verifyFaceMatch = async ({ selfie_url, cnic_url }) => {
  const response = await callWithRetry(
    () => axios.post(`${PYTHON_URL}/face-match`, { selfie_url, cnic_url }, { timeout: TIMEOUT, headers: internalHeaders }),
    'FaceMatch'
  );
  return response.data;
};

/**
 * Performs a liveness check on a selfie image
 * @param {Object} params - Parameters object
 * @param {string} params.selfie_url - URL of the selfie image
 * @returns {Promise<Object>} Liveness check results
 */
const verifyLiveness = async ({ selfie_url }) => {
  const response = await callWithRetry(
    () => axios.post(`${PYTHON_URL}/liveness-check`, { selfie_url }, { timeout: TIMEOUT, headers: internalHeaders }),
    'Liveness'
  );
  return response.data;
};

/**
 * Creates an Amazon Rekognition Face Liveness session.
 * The browser streams the interactive video challenge directly to AWS using
 * the returned session id; the backend never sees the video.
 * @returns {Promise<Object>} { success, session_id, region }
 */
const createLivenessSession = async () => {
  const response = await callWithRetry(
    () => axios.post(`${PYTHON_URL}/liveness/create-session`, {}, { timeout: TIMEOUT, headers: internalHeaders }),
    'LivenessCreateSession'
  );
  return response.data;
};

/**
 * Fetches the verified result of a completed Face Liveness session from AWS.
 * The result (including the live reference image) is authoritative — it comes
 * from AWS, so a client cannot fabricate a "live" outcome or selfie.
 * @param {Object} params - Parameters object
 * @param {string} params.session_id - The Rekognition Face Liveness session id
 * @returns {Promise<Object>} { success, is_live, status, confidence, reference_image_base64 }
 */
const getLivenessSessionResults = async ({ session_id }) => {
  const response = await callWithRetry(
    () => axios.post(`${PYTHON_URL}/liveness/session-result`, { session_id }, { timeout: TIMEOUT, headers: internalHeaders }),
    'LivenessSessionResult'
  );
  return response.data;
};

/**
 * Pings the Python service's /health endpoint to confirm connectivity.
 * Uses a short timeout and no retries — this is a fast liveness probe meant
 * to run once at startup, not a request that should block boot for ~50s.
 * @returns {Promise<{reachable: boolean, status?: string, providers?: string, error?: string}>}
 *   On success: `reachable: true` plus the service's reported status/providers.
 *   On failure: `reachable: false` plus a short error message (never throws).
 */
const checkHealth = async () => {
  try {
    const response = await axios.get(`${PYTHON_URL}/health`, { timeout: 5000 });
    return {
      reachable: true,
      status: response.data?.status ?? 'unknown',
      providers: response.data?.providers ?? 'unknown',
    };
  } catch (error) {
    return {
      reachable: false,
      error: error?.code || error?.message || 'Unknown error',
    };
  }
};

export {
  verifyCnic,
  verifyFaceMatch,
  verifyLiveness,
  createLivenessSession,
  getLivenessSessionResults,
  checkHealth,
};
