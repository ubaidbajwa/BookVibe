/**
 * @file Cloudinary Configuration Middleware
 * @description Configures Cloudinary for media uploads using environment variables.
 */

// Section: Imports
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

// Section: Initialization
dotenv.config();

/**
 * Cloudinary Configuration
 * Sets up the Cloudinary SDK with credentials from environment variables.
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Cloudinary instance configured for use in the application.
 * @type {import('cloudinary').v2}
 */
export default cloudinary;
