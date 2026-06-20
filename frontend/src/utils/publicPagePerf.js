/**
 * @file publicPagePerf.js
 * @description Performance utilities for public pages.
 *
 * Injects Cloudinary on-the-fly transformations into a stored secure_url.
 * Reduces payload from a raw upload (~2-5 MB) to a compressed, resized image
 * (~30-80 KB) — the single biggest LCP/CLS win for listing pages.
 */

// --- Cloudinary Utilities ---

/**
 * @function cloudinaryTransform
 * @description Injects Cloudinary on-the-fly transformations into a stored secure_url.
 * @param {string} url - Raw Cloudinary secure_url from the database.
 * @param {string} params - Cloudinary transformation string.
 * @returns {string} The transformed URL.
 */
export const cloudinaryTransform = (url, params = "f_auto,q_auto,w_600,c_fill") => {
  if (!url?.includes("/upload/")) {
    return url || "";
  }
  return url.replace("/upload/", `/upload/${params}/`);
};

// --- Hero Asset Constants ---

/** @constant {string} ABOUT_HERO_SRC */
export const ABOUT_HERO_SRC = "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80";

/** @constant {string} CONTACT_HERO_SRC */
export const CONTACT_HERO_SRC = "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1600&q=80";

// --- Private Helpers ---

/**
 * @function appendHeadLink
 * @description Appends a link element to the document head.
 * @param {Object} params - Parameters for the link element.
 */
const appendHeadLink = ({ rel, href, as, crossOrigin }) => {
  if (typeof document === "undefined" || !href) {
    return;
  }
  const selector = `link[rel="${rel}"][href="${href}"]`;
  if (document.head.querySelector(selector)) {
    return;
  }
  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  if (as) {
    link.as = as;
  }
  if (crossOrigin) {
    link.crossOrigin = crossOrigin;
  }
  document.head.appendChild(link);
};

// --- Performance Utilities ---

/**
 * @function preconnectPublicImages
 * @description Preconnects to the Unsplash image domain.
 */
export const preconnectPublicImages = () => {
  appendHeadLink({
    rel: "preconnect",
    href: "https://images.unsplash.com",
    crossOrigin: "anonymous",
  });
};

/**
 * @function preloadImage
 * @description Preloads an image.
 * @param {string} src - The image source URL.
 */
export const preloadImage = (src) => {
  if (typeof window === "undefined" || !src) {
    return;
  }
  const img = new Image();
  img.decoding = "async";
  img.src = src;
};

/**
 * @function preloadAboutPage
 * @description Preloads assets for the About page.
 * @returns {Promise} The dynamic import promise.
 */
export const preloadAboutPage = () => {
  preconnectPublicImages();
  preloadImage(ABOUT_HERO_SRC);
  return import("../pages/About");
};

/**
 * @function preloadContactPage
 * @description Preloads assets for the Contact page.
 * @returns {Promise} The dynamic import promise.
 */
export const preloadContactPage = () => {
  preconnectPublicImages();
  preloadImage(CONTACT_HERO_SRC);
  return import("../pages/Contact");
};

/**
 * @function warmPublicPage
 * @description Warms up a public page by preloading its assets.
 * @param {string} path - The page path.
 * @returns {Promise|null} The preload promise or null.
 */
export const warmPublicPage = (path) => {
  if (path === "/about") {
    return preloadAboutPage();
  }
  if (path === "/contact") {
    return preloadContactPage();
  }
  return null;
};
