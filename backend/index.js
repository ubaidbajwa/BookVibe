// --- Imports ---

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import expressfileupload from 'express-fileupload';
import http from 'http';
import os from 'os';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import propertyRouter from './routers/property.routes.js';
import foodMenuRouter from './routers/food-menu.routes.js';
import userRouter from './routers/user.routes.js';
import bookingRouter from './routers/booking.routes.js';
import complaintRouter from './routers/complaint.routes.js';
import webhookRouter from './routers/webhook.routes.js';
import verificationRouter from './routers/verification.routes.js';
import notificationRoutes from './routers/notification.routes.js';
import reviewRouter from './routers/review.routes.js';
import wishlistRouter from './routers/wishlist.routes.js';
import hostPaymentRouter from './routers/host-payment.routes.js';
import emergencyRouter from './routers/emergency.routes.js';
import adminRoutes from './routers/admin.routes.js';
import conciergeRouter from './routers/concierge.routes.js';
import pushRouter from './routers/push.routes.js';
import {
  initSocket
} from './config/socket.js';
import {
  connectDB
} from './config/Db.js';
import {
  checkHealth as checkVerificationHealth
} from './utils/verificationService.js';
import initCronJobs from './utils/cron.js';
import dotenv from 'dotenv';

// --- Configuration ---

dotenv.config();

/**
 * Main application instance
 */
const app = express();

/**
 * Trust the first proxy hop (Nginx reverse proxy in the Docker/EC2 setup).
 * Without this, express-rate-limit and req.ip see only the proxy's IP, so
 * every client shares one rate-limit bucket and X-Forwarded-* is ignored.
 * `1` = trust exactly one hop (our Nginx), which is safe against spoofing.
 */
app.set('trust proxy', 1);

/**
 * HTTP server instance
 */
const server = http.createServer(app);

/**
 * Socket.io initialization
 */
const io = initSocket(server);

// Initialize lifecycle crons
initCronJobs();

// --- Process Guards ---

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason);
  server.close(() => {
    process.exit(1);
  });
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err);
  server.close(() => {
    process.exit(1);
  });
});

// --- Rate Limiters ---

/**
 * Global rate limiter for all routes
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
});

/**
 * Strict rate limiter for sensitive endpoints
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS', // Don't count preflight OPTIONS requests
  message: {
    success: false,
    message: 'Too many attempts, please try again later.'
  },
});

const PORT = process.env.PORT || 3000;

/**
 * List of allowed origins for CORS
 */
const allowedOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_URLS ?
    process.env.CLIENT_URLS.split(',').map(o => o.trim()) :
    []
  ),
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
].filter(Boolean);

// --- Middleware Setup ---

app.use(helmet());

/**
 * CORS Middleware configuration
 * Moved to the top to ensure all responses (including rate limiters)
 * include the necessary CORS headers.
 */
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: [
    'GET',
    'PUT',
    'POST',
    'DELETE',
    'PATCH'
  ],
  credentials: true,
}));

/* ══════════════════════════════════════════════════════════
   ✅ CRITICAL: Stripe Webhook must be registered BEFORE
   express.json() because Stripe requires the raw body
   to verify the webhook signature.
   If express.json() runs first, req.body is parsed and
   signature verification will FAIL.
══════════════════════════════════════════════════════════ */
app.use(
  '/api/v1/webhook/stripe',
  express.raw({
    type: 'application/json'
  }),
  webhookRouter
);

app.use(globalLimiter);

// Stricter limits on auth and booking-creation endpoints
app.use('/api/v1/user/login', strictLimiter);
app.use('/api/v1/user/send-email-otp', strictLimiter);
app.use('/api/v1/booking/create-booking', strictLimiter);

app.use(express.json());
app.use(cookieParser());

/**
 * File upload middleware
 */
app.use(expressfileupload({
  useTempFiles: true,
  tempFileDir: os.tmpdir(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }, // 50MB max (allows short complaint-evidence videos)
}));

// --- Routes ---

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  return res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/v1/property', propertyRouter);
app.use('/api/v1/foodmenu', foodMenuRouter);
// IMPORTANT: adminRoutes must be mounted BEFORE userRouter.
// Both share the /api/v1/user prefix, so the more-specific /api/v1/user/admin
// prefix must be registered first or userRouter will shadow admin routes.
app.use('/api/v1/user/admin', adminRoutes);
app.use('/api/v1/user', userRouter);
app.use('/api/v1/booking', bookingRouter);
app.use('/api/v1/complaints', complaintRouter);
app.use('/api/v1/verify', verificationRouter);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/wishlist', wishlistRouter);
app.use('/api/v1/host-payments', hostPaymentRouter);
app.use('/api/v1/emergency', emergencyRouter);
app.use('/api/v1/concierge', conciergeRouter);
app.use('/api/v1/push', pushRouter);

// --- Error Handling ---

/**
 * 404 Not Found handler
 */
app.use((req, res) => {
  res.status(404).json({
    message: `Route ${req.method} ${req.path} not found`,
    success: false
  });
});

/**
 * Global error handler
 */
app.use((err, req, res, next) => {
  console.error('[GlobalError]', err);
  res.status(500).json({
    message: 'Internal Server Error',
    success: false
  });
});

// --- Server Start ---

/**
 * Connect to database and start the server
 */
connectDB().then(async () => {
  if (!process.env.ADMIN_PIN) {
    console.warn('[Security] ADMIN_PIN is not set in .env — the default "000000" is active. Set a strong PIN before deploying to production.');
  }

  // Connectivity check for Python KYC microservice
  const vHealth = await checkVerificationHealth();
  if (vHealth.reachable) {
    console.log(`[Verification] Service reachable (Status: ${vHealth.status}, Providers: ${vHealth.providers})`);
  } else {
    console.warn(`[Verification] Service UNREACHABLE: ${vHealth.error} — identity verification features will fail.`);
  }

  server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log('[Socket.io] Real-time ready');
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});
