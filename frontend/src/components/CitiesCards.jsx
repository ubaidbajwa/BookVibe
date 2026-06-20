/**
 * CitiesCards.jsx
 *
 * Horizontal-scrolling section that showcases popular Pakistani cities.
 * Each card is clickable and navigates to the view-all-properties page
 * pre-filtered by the selected city.
 */

import { MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/** Static list of featured cities with hero images and approximate property counts. */
const cities = [
    { name: 'Islamabad', img: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800', count: 150 },
    { name: 'Lahore', img: 'https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?w=800', count: 300 },
    { name: 'Karachi', img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800', count: 200 },
    { name: 'Gujranwala', img: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800', count: 80 },
    { name: 'Skardu', img: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800', count: 40 },
    { name: 'Peshawar', img: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800', count: 90 },
    { name: 'Quetta', img: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800', count: 60 },
    { name: 'Rawalpindi', img: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800', count: 120 },
]

const CitiesCards = () => {
    const nav = useNavigate()

    return (
        <section className="py-20 px-6">
            <div className="max-w-7xl mx-auto">
                {/* Section label and heading */}
                <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-2">
                    Destinations
                </p>
                <h2 className="font-display text-3xl sm:text-4xl text-[var(--bv-text)] mb-10">
                    Explore <span className="text-[var(--bv-gold)]">Pakistan</span>
                </h2>

                {/* Horizontally scrollable row of city cards */}
                <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide">
                    {cities.map((c) => (
                        <div
                            key={c.name}
                            onClick={() => nav(`/view-all-properties?city=${c.name}`)}
                            className="min-w-[240px] md:min-w-[280px] relative rounded-2xl overflow-hidden cursor-pointer group flex-shrink-0"
                        >
                            {/* City hero image with zoom-on-hover effect */}
                            <img
                                src={c.img}
                                alt={c.name}
                                className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-700"
                                loading="lazy"
                            />

                            {/* Gradient overlay so the text is legible over the photo */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                            {/* City name and property count */}
                            <div className="absolute bottom-5 left-5">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <MapPin size={14} className="text-[var(--bv-gold)]" />
                                    {c.name}
                                </h3>
                                <p className="text-xs text-white/60 mt-0.5">{c.count} properties</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default CitiesCards
