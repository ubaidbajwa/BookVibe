/**
 * @file PushSubscriptionModel.js
 * @description Mongoose model for Web Push subscriptions — one document per
 * browser/device a user has granted push permission on. A user can have several
 * (phone + laptop + multiple browsers), so this is not unique per user.
 */

import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAndHost',
    required: true,
    index: true,
  },
  endpoint: {
    type: String,
    required: true,
    unique: true,
  },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  userAgent: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

const PushSubscription = mongoose.models.PushSubscription || mongoose.model('PushSubscription', pushSubscriptionSchema);

export default PushSubscription;
