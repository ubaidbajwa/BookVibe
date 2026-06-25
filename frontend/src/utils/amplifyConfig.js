/**
 * @file amplifyConfig.js
 * @description AWS Amplify configuration for Amazon Rekognition Face Liveness.
 *
 * The browser's FaceLivenessDetector streams the live video challenge directly
 * to AWS Rekognition. To do that it needs temporary AWS credentials, which it
 * obtains from a Cognito Identity Pool (guest / unauthenticated access).
 *
 * Required env (see AWS_FACE_LIVENESS_SETUP.md):
 *   VITE_COGNITO_IDENTITY_POOL_ID   e.g. us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *   VITE_AWS_REGION                 (optional) fallback region for the detector
 *
 * If the identity pool id is absent, Liveness is treated as "not configured"
 * and the UI shows a graceful message instead of crashing.
 */

import { Amplify } from 'aws-amplify';

const identityPoolId = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID;

/** Whether Face Liveness is configured (Cognito Identity Pool present). */
export const isLivenessConfigured = Boolean(identityPoolId);

/** Default AWS region for the detector when the backend doesn't supply one. */
export const DEFAULT_LIVENESS_REGION = import.meta.env.VITE_AWS_REGION || 'us-east-1';

if (isLivenessConfigured) {
  // The region is encoded in the identity pool id (e.g. "us-east-1:..."),
  // so Amplify Auth only needs the pool id plus guest access enabled.
  Amplify.configure({
    Auth: {
      Cognito: {
        identityPoolId,
        allowGuestAccess: true,
      },
    },
  });
}
