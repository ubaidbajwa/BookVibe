import { Send } from 'lucide-react'

const SubscribeLetter = () => (
    <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
            <div className="bv-card-static p-10 sm:p-14 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[var(--bv-gold)]/5 rounded-full blur-3xl" />
                <div className="relative z-10">
                    <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3">Stay Updated</p>
                    <h2 className="font-display text-3xl text-[var(--bv-text)] mb-3">Get Exclusive Deals</h2>
                    <p className="text-sm text-[var(--bv-text-muted)] mb-8 max-w-md mx-auto">Subscribe for handpicked stays, seasonal discounts, and travel inspiration.</p>
                    <div className="flex items-center max-w-md mx-auto bg-[var(--bv-bg)] border border-[var(--bv-border)] rounded-full overflow-hidden focus-within:border-[var(--bv-gold)] transition h-12">
                        <input type="email" placeholder="Enter your email" className="flex-1 bg-transparent text-[var(--bv-text)] placeholder-[var(--bv-text-dim)] text-sm px-5 outline-none" />
                        <button className="h-10 px-5 mr-1 rounded-full bg-gradient-to-r from-[var(--bv-gold)] to-[var(--bv-gold-light)] text-[var(--bv-bg)] font-bold text-sm flex items-center gap-2 hover:shadow-lg transition"><Send size={14} /> Subscribe</button>
                    </div>
                </div>
            </div>
        </div>
    </section>
)

export default SubscribeLetter