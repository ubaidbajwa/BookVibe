/**
 * @fileoverview Utility for sanitizing host profile data for public viewing
 * @module utils/publicHostProfile
 */

/* -------------------------------------------------------------------------- */
/*                                Sanitization                                */
/* -------------------------------------------------------------------------- */

/**
 * Filters host document fields based on user privacy settings
 * @param {Object} host - The raw host document from DB
 * @returns {Object} Sanitized host object for public API responses
 */
const sanitizePublicHost = (host) => {
  if (!host) return host;

  const settings = host.settings || {};
  const privacy = settings.privacy || {};

  if (privacy.profilePublic === false) {
    return {
      _id: host._id,
      username: host.username,
      profileImage: host.profileImage,
    };
  }

  return {
    _id: host._id,
    username: host.username,
    profileImage: host.profileImage,
    ...(privacy.showEmail ? { email: host.email } : {}),
    ...(privacy.showPhone ? { phone: host.phone } : {}),
  };
};

export { sanitizePublicHost };
