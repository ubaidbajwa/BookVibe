/**
 * @file ProcessedWebhookEvent.js
 * @description Mongoose model for tracking processed Stripe webhook events to ensure idempotency.
 */

import mongoose from 'mongoose';

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ProcessedWebhookEvent
 * @property {string} eventId - Unique Stripe event ID.
 * @property {string} eventType - Type of Stripe event.
 * @property {Date} processedAt - Timestamp when event was processed.
 */
const processedWebhookEventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true
  },
  eventType: {
    type: String
  },
  processedAt: {
    type: Date,
    default: Date.now
  },
}, {
  timestamps: false
});

// ─── INDEXES ─────────────────────────────────────────────────────────────────

// TTL: auto-delete after 30 days
processedWebhookEventSchema.index({
  processedAt: 1
}, {
  expireAfterSeconds: 60 * 60 * 24 * 30
});

// ─── MODELS ──────────────────────────────────────────────────────────────────

/**
 * ProcessedWebhookEvent model.
 */
const ProcessedWebhookEvent = mongoose.model('ProcessedWebhookEvent', processedWebhookEventSchema);

export default ProcessedWebhookEvent;
