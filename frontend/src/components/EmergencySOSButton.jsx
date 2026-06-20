/**
 * @file EmergencySOSButton.jsx
 * @description Guest-facing emergency SOS trigger component, displayed inside an active booking
 * detail panel. Tapping the button enters a two-step confirmation flow to avoid
 * accidental triggers. On confirmation the SOS is POSTed to the backend which
 * instantly alerts the host via Socket.io. The response may include a list of
 * nearby medical facilities that are then rendered with emergency hotline numbers.
 */

import { useState } from 'react';
import axios from 'axios';
import { ShieldAlert, Loader2, Phone, AlertCircle, Info } from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * @component EmergencySOSButton
 * @description Component for triggering a medical SOS alert.
 * @param {Object} props - Component props.
 * @param {string} props.bookingId - ID of the current booking.
 * @returns {JSX.Element} The EmergencySOSButton component.
 */
const EmergencySOSButton = ({ bookingId }) => {
  /* -------------------------------------------------------------------------- */
  /*                                    STATE                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * @description True while the SOS API call is in progress.
   */
  const [loading, setLoading] = useState(false);

  /**
   * @description Controls visibility of the two-step confirmation panel.
   */
  const [showConfirm, setShowConfirm] = useState(false);

  /**
   * @description Optional free-text description of the emergency typed by guest.
   */
  const [message, setMessage] = useState('');

  /**
   * @description Nearby medical facilities returned by the backend after SOS.
   */
  const [facilities, setFacilities] = useState([]);

  /* -------------------------------------------------------------------------- */
  /*                                   HANDLERS                                 */
  /* -------------------------------------------------------------------------- */

  /**
   * @description Fire the SOS API call.
   * On success, a persistent toast is shown and nearby facilities are stored in state.
   */
  const triggerSOS = async () => {
    setLoading(true);

    try {
      const res = await axios.post(
        `${BASE}/emergency/sos`,
        {
          bookingId,
          // Fall back to a generic message if the guest didn't type one
          message: message || 'Medical Emergency! Immediate assistance required.',
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        setFacilities(res.data.nearbyFacilities || []);
        setShowConfirm(false);
      }
    } catch {
      // error silently handled
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                                   RENDER                                   */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="space-y-4">
      {/* Primary SOS button — only shown before confirmation flow and before facilities load */}
      {!showConfirm && facilities.length === 0 && (
        <button
          onClick={() => {
            setShowConfirm(true);
          }}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-red-600/20 animate-pulse transition"
        >
          <ShieldAlert size={24} />
          MEDICAL SOS
        </button>
      )}

      {/* Confirmation panel — requires explicit intent before firing the SOS */}
      {showConfirm && (
        <div className="bv-card-static p-6 border-red-500/30 bg-red-500/5 bv-animate-in">
          <div className="flex items-center gap-3 text-red-500 mb-4">
            <ShieldAlert size={24} />
            <h3 className="font-black uppercase tracking-tighter text-lg">Confirm Medical Emergency</h3>
          </div>

          <p className="text-sm text-[var(--bv-text)] mb-4">
            This will instantly alert the Host and our emergency response team. Only use for genuine medical crises.
          </p>

          {/* Optional emergency description */}
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
            }}
            placeholder="Optional: Briefly describe the emergency (e.g., Heart patient, accidental fall)..."
            className="w-full bg-white/10 border border-red-500/20 rounded-xl p-3 text-sm mb-4 outline-none focus:border-red-500 transition"
            rows={2}
          />

          <div className="flex gap-3">
            {/* Confirm — fires the real SOS */}
            <button
              onClick={() => {
                triggerSOS();
              }}
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldAlert size={18} />}
              Trigger Now
            </button>

            {/* Cancel — go back to the primary button */}
            <button
              onClick={() => {
                setShowConfirm(false);
              }}
              disabled={loading}
              className="flex-1 bv-btn-outline py-3 rounded-xl font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Nearby facilities panel — shown after a successful SOS trigger */}
      {facilities.length > 0 && (
        <div className="bv-card-static p-6 border-emerald-500/20 bg-emerald-500/5 bv-animate-in">
          <div className="flex items-center gap-2 text-emerald-500 mb-4">
            <Info size={20} />
            <h3 className="font-bold text-sm uppercase">Nearby Medical Facilities</h3>
          </div>

          <div className="space-y-3">
            {facilities.map((f, i) => {
              return (
                <div
                  key={i}
                  className="p-3 bg-white/20 rounded-xl border border-emerald-500/10 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-bold text-[var(--bv-text)]">{f.name}</p>
                    <p className="text-[10px] text-[var(--bv-text-dim)] uppercase font-bold">
                      {f.type} · {f.distance}
                    </p>
                  </div>

                  {/* Tap-to-call link for immediate dialing */}
                  <a
                    href={`tel:${f.phone}`}
                    className="p-2 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white transition"
                  >
                    <Phone size={16} />
                  </a>
                </div>
              );
            })}
          </div>

          {/* Pakistani national emergency hotlines */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="p-3 bg-red-600 rounded-xl text-white text-center">
              <p className="text-[10px] font-bold opacity-80 uppercase">Ambulance</p>
              <p className="text-lg font-black mt-1">1122</p>
            </div>
            <div className="p-3 bg-blue-600 rounded-xl text-white text-center">
              <p className="text-[10px] font-bold opacity-80 uppercase">Police</p>
              <p className="text-lg font-black mt-1">15</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencySOSButton;
