const Spinner = ({ size = 32, className = '' }) => (
    <div className={`flex items-center justify-center ${className}`}>
        <div className="border-2 border-transparent rounded-full animate-spin" style={{ width: size, height: size, borderTopColor: 'var(--bv-gold)', borderRightColor: 'var(--bv-gold)' }} />
    </div>
)
export default Spinner