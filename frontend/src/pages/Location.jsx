/**
 * Location.jsx - User Location Service
 *
 * Utilizes the Geolocation API and OpenStreetMap Reverse Geocoding
 * to display the user's current physical address.
 */

import React, { useEffect, useState } from "react";

// ==========================================
// UseLocationAddress Component
// ==========================================

/**
 * UseLocationAddress - Fetches and displays user location details.
 * @returns {JSX.Element}
 */
export default function UseLocationAddress() {
    // --- State ---
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [address, setAddress] = useState(null);

    /**
     * Effect: Fetch user coordinates and perform reverse geocoding.
     */
    useEffect(
        () => {
            // Setup
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const { latitude, longitude } = position.coords;

                        // Call Reverse Geocoding API (OpenStreetMap)
                        const res = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
                        );

                        const data = await res.json();
                        setAddress(data.address);
                        setLoading(false);
                    } catch {
                        setError("Unable to fetch address");
                        setLoading(false);
                    }
                },
                () => {
                    setError("Location permission denied");
                    setLoading(false);
                }
            );
        },
        // Dependencies
        []
    );

    // --- Render Helpers ---

    if (loading) {
        return (
            <p>Getting your location...</p>
        )
    }

    if (error) {
        return (
            <p style={{ color: "red" }}>{error}</p>
        )
    }

    return (
        <div className="mt-25 p-4 bg-white shadow-md rounded-xl max-w-md mx-auto mt-4">
            <h2 className="text-xl font-semibold mb-2">Your Location Details</h2>
            <p><strong>City:</strong> {address?.city || "N/A"}</p>
            <p><strong>Area:</strong> {address?.suburb || "N/A"}</p>
            <p><strong>Street:</strong> {address?.road || "N/A"}</p>
            <p><strong>State:</strong> {address?.state || "N/A"}</p>
            <p><strong>Country:</strong> {address?.country || "N/A"}</p>
            <p><strong>Postal Code:</strong> {address?.postcode || "N/A"}</p>
        </div>
    )
}
