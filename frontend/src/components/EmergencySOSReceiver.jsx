/**
 * @file EmergencySOSReceiver.jsx
 * @description Host-side real-time SOS alert receiver. Listens to the Socket.io
 * 'emergency:sos' event emitted by the backend when a guest triggers a
 * medical SOS. On receipt it plays an audio alert, fires a native browser
 * notification, and renders a full-screen blocking modal with guest and property details.
 */

import { useState, useEffect } from 'react';
import { ShieldAlert, X, Phone, MapPin, AlertTriangle, ExternalLink, Siren } from 'lucide-react';
import { useNotifications } from '../components/SocketContext';

/**
 * @component EmergencySOSReceiver
 * @description Component that listens for and displays emergency SOS alerts.
 * @returns {JSX.Element|null} The EmergencySOSReceiver component or null if no active SOS.
 */
const EmergencySOSReceiver = () => {
  /* -------------------------------------------------------------------------- */
  /*                                    HOOKS                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * @description Socket instance obtained from notification context.
   */
  const { socket } = useNotifications();

  /* -------------------------------------------------------------------------- */
  /*                                    STATE                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * @description The SOS payload received from the server.
   * Contains guestName, guestPhone, propertyName, address, coordinates, and message.
   */
  const [sosData, setSosData] = useState(null);

  /**
   * @description Controls whether the full-screen alert overlay is rendered.
   */
  const [show, setShow] = useState(false);

  /**
   * @description Audio object created once and reused across alerts.
   */
  const [audio] = useState(new Audio('/sos-alert.mp3'));

  /* -------------------------------------------------------------------------- */
  /*                                    EFFECTS                                 */
  /* -------------------------------------------------------------------------- */

  /**
   * @hook useEffect
   * @description Register the Socket.io listener for incoming SOS alerts.
   * Cleans up the listener on unmount or socket change.
   */
  useEffect(
    () => {
      // No socket yet — skip registration
      if (!socket) {
        return;
      }

      /**
       * @description Handler for the 'emergency:sos' socket event.
       * @param {Object} data - The SOS alert data.
       */
      const handleSOS = (data) => {
        setSosData(data);
        setShow(true);

        // Attempt to play looping alert audio; browsers may block autoplay
        audio.loop = true;
        audio
          .play()
          .catch(() => {
            // Autoplay blocked — silently ignore; visual alert still shows
          });

        // Fire a native browser notification if permission was previously granted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('MEDICAL SOS ALERT', {
            body: `${data.guestName} at ${data.propertyName} needs immediate help!`,
            icon: '/favicon.ico',
            requireInteraction: true,
          });
        }
      };

      socket.on('emergency:sos', handleSOS);

      // Cleanup: remove listener to prevent duplicate handlers on re-render
      return () => {
        socket.off('emergency:sos', handleSOS);
      };
    },
    // Dependencies: re-register if socket or audio instance changes
    [socket, audio]
  );

  /* -------------------------------------------------------------------------- */
  /*                                   HANDLERS                                 */
  /* -------------------------------------------------------------------------- */

  /**
   * @description Stop the audio alert and hide the modal.
   * Called when the host clicks "I am handling it".
   */
  const closeAlert = () => {
    audio.pause();
    audio.currentTime = 0;
    setShow(false);
  };

  /* -------------------------------------------------------------------------- */
  /*                                   RENDER                                   */
  /* -------------------------------------------------------------------------- */

  // Nothing to render when there is no active SOS
  if (!show || !sosData) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Pulsing red backdrop to convey urgency */}
      <div className="absolute inset-0 bg-red-950/80 backdrop-blur-xl animate-pulse" />

      {/* Alert card */}
      <div className="relative w-full max-w-lg bg-[var(--bv-card)] border-4 border-red-600 rounded-3xl p-8 shadow-[0_0_50px_rgba(220,38,38,0.5)] bv-animate-in">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Animated siren icon */}
          <div className="w-24 h-24 rounded-full bg-red-600 flex items-center justify-center animate-bounce shadow-lg shadow-red-600/40">
            <Siren size={48} className="text-white" />
          </div>

          {/* Alert title */}
          <div>
            <h2 className="text-3xl font-black text-red-600 tracking-tighter uppercase italic">Medical SOS Alert</h2>
            <p className="text-sm text-[var(--bv-text-dim)] font-bold mt-1 uppercase tracking-widest">
              Immediate Action Required
            </p>
          </div>

          {/* Details card */}
          <div className="w-full bv-card-static p-6 bg-red-600/5 border-red-600/20 text-left space-y-4">
            {/* Property name */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-600 rounded-lg text-white">
                <ShieldAlert size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-red-600 uppercase">Emergency at</p>
                <p className="text-lg font-black text-[var(--bv-text)]">{sosData.propertyName}</p>
              </div>
            </div>

            {/* Guest name + phone */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-[10px] font-bold text-[var(--bv-text-dim)] uppercase">Guest Name</p>
                <p className="font-bold text-[var(--bv-text)]">{sosData.guestName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--bv-text-dim)] uppercase">Phone</p>
                <a
                  href={`tel:${sosData.guestPhone}`}
                  className="font-bold text-red-600 flex items-center gap-1 hover:underline"
                >
                  <Phone size={14} /> {sosData.guestPhone}
                </a>
              </div>
            </div>

            {/* Property address */}
            <div className="pt-2">
              <p className="text-[10px] font-bold text-[var(--bv-text-dim)] uppercase">Location</p>
              <p className="text-xs text-[var(--bv-text)] flex items-start gap-1.5 mt-1">
                <MapPin size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                {sosData.address}
              </p>
            </div>

            {/* Optional guest-typed emergency message */}
            {sosData.message && (
              <div className="pt-2">
                <p className="text-[10px] font-bold text-[var(--bv-text-dim)] uppercase italic">Guest Message</p>
                <p className="text-sm font-medium text-[var(--bv-text)] bg-white/5 p-3 rounded-xl mt-1 border border-red-600/10">
                  &ldquo;{sosData.message}&rdquo;
                </p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="w-full flex flex-col gap-3">
            {/* Deep-link into Google Maps directions */}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${sosData.coordinates?.lat},${sosData.coordinates?.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition"
            >
              <ExternalLink size={20} /> Open Directions
            </a>

            {/* Dismiss alert and stop audio */}
            <button
              onClick={() => {
                closeAlert();
              }}
              className="w-full bv-btn-outline py-4 rounded-2xl font-black text-red-600 border-red-600/30 hover:bg-red-600/5 transition uppercase tracking-widest"
            >
              I am handling it (Stop Alert)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencySOSReceiver;
