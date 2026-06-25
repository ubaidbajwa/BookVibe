/**
 * @file LivenessCheck.jsx
 * @description Reusable Amazon Rekognition Face Liveness widget.
 *
 * Flow:
 *   1. On mount, ask the backend to create a Face Liveness session.
 *   2. Render <FaceLivenessDetector/>, which runs the interactive video
 *      challenge in the browser (streamed straight to AWS).
 *   3. When AWS finishes, fetch the session result from the backend. The
 *      result (live / not-live, confidence, and the live reference frame) is
 *      authoritative because it comes from AWS — the client cannot fake it.
 *   4. On a live result, hand the captured frame back to the parent as a File
 *      (`selfieFile`) so it can be reused as the selfie for face-matching.
 *
 * Props:
 *   onSuccess({ selfieFile, confidence, sessionId })  — liveness passed
 *   onFail(message)                                    — liveness failed
 *   onError(message)                                   — technical/config error
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FaceLivenessDetector } from '@aws-amplify/ui-react-liveness';
import '@aws-amplify/ui-react/styles.css';
import { isLivenessConfigured, DEFAULT_LIVENESS_REGION } from '../utils/amplifyConfig';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * Converts a base64 JPEG string into a File object.
 * @param {string} base64 - Raw base64 (no data: prefix).
 * @param {string} filename
 * @returns {File}
 */
function base64ToFile(base64, filename = 'selfie.jpg') {
  const binary = atob(base64);
  let n = binary.length;
  const bytes = new Uint8Array(n);
  while (n--) {
    bytes[n] = binary.charCodeAt(n);
  }
  return new File([bytes], filename, { type: 'image/jpeg' });
}

export default function LivenessCheck({ onSuccess, onFail, onError }) {
  const [sessionId, setSessionId] = useState(null);
  const [region, setRegion] = useState(DEFAULT_LIVENESS_REGION);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState('');

  // 1. Create a session as soon as the widget mounts.
  useEffect(() => {
    let cancelled = false;

    const createSession = async () => {
      setLoading(true);
      setFatalError('');
      try {
        const { data } = await axios.post(
          `${BASE_URL}/verify/liveness/session`,
          {},
          { withCredentials: false }
        );
        if (cancelled) return;
        if (data.success && data.sessionId) {
          setSessionId(data.sessionId);
          if (data.region) setRegion(data.region);
        } else {
          throw new Error(data.message || 'Could not start liveness session');
        }
      } catch (err) {
        if (cancelled) return;
        const msg =
          err.response?.data?.message ||
          err.message ||
          'Could not start liveness check.';
        setFatalError(msg);
        onError?.(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (isLivenessConfigured) {
      createSession();
    } else {
      setLoading(false);
      setFatalError('Liveness is not configured.');
    }

    return () => {
      cancelled = true;
    };
  }, [onError]);

  // 3 + 4. AWS finished streaming — fetch the verified result from our backend.
  const handleAnalysisComplete = useCallback(async () => {
    try {
      const { data } = await axios.post(
        `${BASE_URL}/verify/liveness/session-result`,
        { sessionId },
        { withCredentials: false }
      );

      if (data.success && data.isLive && data.referenceImageBase64) {
        const selfieFile = base64ToFile(data.referenceImageBase64);
        onSuccess?.({ selfieFile, confidence: data.confidence ?? 0, sessionId });
      } else {
        onFail?.(data.message || 'Liveness check failed. Please try again.');
      }
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || 'Could not verify liveness.';
      onError?.(msg);
    }
  }, [sessionId, onSuccess, onFail, onError]);

  const handleDetectorError = useCallback(
    (err) => {
      const msg = err?.error?.message || err?.message || 'Camera / liveness error.';
      onError?.(msg);
    },
    [onError]
  );

  if (!isLivenessConfigured) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        Live identity check is not configured on this deployment. Please contact support.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-8 text-sm text-[var(--bv-text-muted)]">
        Starting secure liveness check…
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        {fatalError}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl">
      <FaceLivenessDetector
        sessionId={sessionId}
        region={region}
        onAnalysisComplete={handleAnalysisComplete}
        onError={handleDetectorError}
      />
    </div>
  );
}
