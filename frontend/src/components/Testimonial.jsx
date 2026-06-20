import { Star } from 'lucide-react'

const data = [
    { name: 'Ayesha R.', city: 'Lahore', text: 'The homemade food service was a game changer. Host was incredibly welcoming!', rating: 5 },
    { name: 'Bilal K.', city: 'Islamabad', text: 'Smooth booking and the property was exactly as shown. Will definitely return.', rating: 5 },
    { name: 'Sarah M.', city: 'Karachi', text: 'Best platform for local stays in Pakistan. Clean, secure, and affordable.', rating: 4 },
    { name: 'Usman A.', city: 'Skardu', text: 'Mountain retreat was breathtaking. BookVibe made finding it so easy.', rating: 5 },
    { name: 'Fatima Z.', city: 'Peshawar', text: 'The KYC verification gave me confidence. Felt safe throughout my stay.', rating: 5 },
    { name: 'Hassan T.', city: 'Gujranwala', text: 'Affordable rooms with great amenities. The medicine delivery was a lifesaver!', rating: 4 },
]

const Card = ({ d }) => (
    <div className="bv-card-static p-6 w-80 flex-shrink-0 mx-3">
        <div className="flex gap-1 mb-3">{Array(d.rating).fill(0).map((_, i) => <Star key={i} size={12} className="text-[var(--bv-gold)]" fill="var(--bv-gold)" />)}</div>
        <p className="text-sm text-[var(--bv-text-muted)] leading-relaxed mb-4">"{d.text}"</p>
        <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center text-[var(--bv-bg)] font-bold text-xs">{d.name.charAt(0)}</div>
            <div><p className="text-sm font-bold text-[var(--bv-text)]">{d.name}</p><p className="text-xs text-[var(--bv-text-dim)]">{d.city}</p></div>
        </div>
    </div>
)

const Testimonial = () => (
    <section className="py-20 overflow-hidden">
        <div className="text-center mb-12 px-6">
            <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-2">Testimonials</p>
            <h2 className="font-display text-3xl sm:text-4xl text-[var(--bv-text)]">What Our Guests Say</h2>
        </div>
        <style>{`@keyframes bv-m{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}.bv-marquee{animation:bv-m 35s linear infinite}.bv-marquee-r{animation-direction:reverse}`}</style>
        {[false, true].map((rev, i) => (
            <div key={i} className="relative mb-4">
                <div className="absolute left-0 top-0 h-full w-24 z-10 pointer-events-none bg-gradient-to-r from-[var(--bv-bg)] to-transparent" />
                <div className={`bv-marquee ${rev ? 'bv-marquee-r' : ''} flex min-w-[200%] py-2`}>
                    {[...data, ...data].map((d, j) => <Card key={j} d={d} />)}
                </div>
                <div className="absolute right-0 top-0 h-full w-24 z-10 pointer-events-none bg-gradient-to-l from-[var(--bv-bg)] to-transparent" />
            </div>
        ))}
    </section>
)

export default Testimonial