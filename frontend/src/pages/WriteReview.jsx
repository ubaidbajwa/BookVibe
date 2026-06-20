/**
 * @file WriteReview.jsx
 * @description Review submission page for a completed booking. 
 * Guests can rate the overall stay (1-5 stars) plus five sub-categories 
 * (cleanliness, accuracy, communication, location, value), add a title 
 * and free-text comment, then submit.
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { getAuthConfig } from '../utils/authConfig';
import { Star, ArrowLeft, Send, Loader2 } from 'lucide-react';

/**
 * Base API URL derived from environment variables.
 * @constant {string}
 */
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * WriteReview Component
 * @returns {JSX.Element} The rendered component.
 */
const WriteReview = () => {
  // --- Hooks ---

  /**
   * Hook to access URL parameters, specifically the bookingId.
   */
  const { bookingId } = useParams();

  /**
   * Navigation hook for programmatic routing.
   */
  const nav = useNavigate();

  /**
   * State for the overall numeric rating (1-5).
   */
  const [rating, setRating] = useState(0);

  /**
   * State for the hovered star rating (for interactive feedback).
   */
  const [hover, setHover] = useState(0);

  /**
   * State for the review title.
   */
  const [title, setTitle] = useState('');

  /**
   * State for the review comment body.
   */
  const [comment, setComment] = useState('');

  /**
   * State for sub-category ratings.
   */
  const [categories, setCategories] = useState({
    cleanliness: 0,
    accuracy: 0,
    communication: 0,
    location: 0,
    value: 0,
  });

  /**
   * State to track the submission status.
   */
  const [loading, setLoading] = useState(false);

  // --- Logic ---

  /**
   * Submits the review to the server.
   * @param {Event} e - Form submission event.
   * @async
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!rating) {
      return;
    }

    try {
      setLoading(true);
      await axios.post(
        `${BASE}/reviews`,
        { bookingId, rating, title, comment, categories },
        getAuthConfig()
      );
      nav('/my-bookings');
    } catch {
      // error silently handled
    } finally {
      setLoading(false);
    }
  };

  /**
   * Internal sub-component: CategoryRating
   * A row with a label and 5 clickable star buttons for a specific category.
   * 
   * @param {Object} props - Component props.
   * @param {string} props.label - Display label for the category.
   * @param {string} props.k - The state key for this category.
   * @returns {JSX.Element}
   */
  const CategoryRating = ({ label, k }) => {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-[var(--bv-text-muted)]">{label}</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => {
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  return setCategories((p) => {
                    return { ...p, [k]: s };
                  });
                }}
                className="p-0.5"
              >
                <Star
                  size={14}
                  className={s <= categories[k] ? 'text-[var(--bv-gold)]' : 'text-[var(--bv-surface)]'}
                  fill={s <= categories[k] ? 'var(--bv-gold)' : 'none'}
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // --- Render ---

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-xl mx-auto">
        <button
          onClick={() => {
            return nav(-1);
          }}
          className="flex items-center gap-2 text-[var(--bv-text-dim)] hover:text-[var(--bv-gold)] text-sm mb-6 transition"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="font-display text-3xl text-[var(--bv-text)] mb-8">
          Write a <span className="text-[var(--bv-gold)]">Review</span>
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Overall star rating section */}
          <div className="bv-card-static p-6 text-center">
            <p className="bv-label mb-3">Overall Rating *</p>
            <div className="flex justify-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map((s) => {
                return (
                  <button
                    key={s}
                    type="button"
                    onMouseEnter={() => {
                      return setHover(s);
                    }}
                    onMouseLeave={() => {
                      return setHover(0);
                    }}
                    onClick={() => {
                      return setRating(s);
                    }}
                    className="p-1"
                  >
                    <Star
                      size={32}
                      className={s <= (hover || rating) ? 'text-[var(--bv-gold)]' : 'text-[var(--bv-surface)]'}
                      fill={s <= (hover || rating) ? 'var(--bv-gold)' : 'none'}
                    />
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-[var(--bv-text-muted)]">
              {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating] || 'Tap to rate'}
            </p>
          </div>

          {/* Per-category ratings section */}
          <div className="bv-card-static p-6">
            <p className="bv-label mb-3">Rate Categories</p>
            <CategoryRating label="Cleanliness" k="cleanliness" />
            <CategoryRating label="Accuracy" k="accuracy" />
            <CategoryRating label="Communication" k="communication" />
            <CategoryRating label="Location" k="location" />
            <CategoryRating label="Value for Money" k="value" />
          </div>

          {/* Title and comment text section */}
          <div className="bv-card-static p-6 space-y-4">
            <div>
              <label className="bv-label">Review Title</label>
              <input
                value={title}
                onChange={(e) => {
                  return setTitle(e.target.value);
                }}
                placeholder="Summarize your experience"
                className="bv-input"
                maxLength={100}
              />
            </div>
            <div>
              <label className="bv-label">Your Review</label>
              <textarea
                value={comment}
                onChange={(e) => {
                  return setComment(e.target.value);
                }}
                rows={4}
                placeholder="Tell others about your stay..."
                className="bv-input resize-none"
                maxLength={1000}
              />
              <p className="text-[10px] text-[var(--bv-text-dim)] text-right mt-1">
                {comment.length}/1000
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !rating}
            className="w-full bv-btn-gold py-3.5 text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <Send size={16} /> Submit Review
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default WriteReview;
