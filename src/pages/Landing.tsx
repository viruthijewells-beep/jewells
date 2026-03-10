import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
    ChevronRight, MapPin, Phone, MessageCircle, Lock, Diamond,
    Award, ShieldCheck, Star, Gem, Quote, Navigation, Instagram,
    ChevronLeft, Sparkles, Crown, ArrowRight, Heart,
} from 'lucide-react'
import { ROUTES } from '@/lib/routes'
import BrandIntro from '@/components/BrandIntro'

/* ═══════════════════════════════════════════════════════════════════
   1️⃣ LUXURY NAVBAR — Centered Navigation (no logo, branding in hero only)
   ═══════════════════════════════════════════════════════════════════ */
const NAV_LINKS = [
    { label: 'Home', href: '#hero' },
    { label: 'Collection', href: '#collections' },
    { label: 'Bridal', href: '#bridal' },
    { label: 'About', href: '#about' },
    { label: 'Contact', href: '#contact' },
]

function Navbar() {
    const [scrolled, setScrolled] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    // Lock body scroll when menu is open
    useEffect(() => {
        document.body.style.overflow = mobileOpen ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [mobileOpen])

    const handleNav = (href: string) => {
        setMobileOpen(false)
        const el = document.querySelector(href)
        if (el) el.scrollIntoView({ behavior: 'smooth' })
    }

    return (
        <>
            {/* ─── Sticky Header ─── */}
            <header
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled
                    ? 'bg-black/95 backdrop-blur-md border-b border-gold/10 py-3'
                    : 'bg-transparent py-5'
                    }`}
            >
                {/* Desktop centered nav */}
                <nav className="hidden md:flex items-center justify-center gap-12 px-8">
                    {NAV_LINKS.map(link => (
                        <button
                            key={link.label}
                            onClick={() => handleNav(link.href)}
                            className="text-[11px] tracking-[0.3em] uppercase font-light text-white/60 hover:text-gold transition-colors duration-300 relative group"
                        >
                            {link.label}
                            <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-gold group-hover:w-full transition-all duration-500" />
                        </button>
                    ))}
                </nav>

                {/* Mobile hamburger — always visible on mobile */}
                <div className="flex md:hidden items-center justify-between px-6">
                    <span className="text-[10px] tracking-[0.3em] uppercase text-gold/60 font-light">Menu</span>
                    <button
                        onClick={() => setMobileOpen(v => !v)}
                        className="flex flex-col gap-[5px] p-2 z-[110] relative"
                        aria-label="Toggle menu"
                    >
                        <span className={`block w-5 h-[1px] bg-white/70 transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-[6px]' : ''}`} />
                        <span className={`block w-5 h-[1px] bg-white/70 transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
                        <span className={`block w-5 h-[1px] bg-white/70 transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-[6px]' : ''}`} />
                    </button>
                </div>
            </header>

            {/* ─── Mobile Full-Screen Overlay ─── OUTSIDE header to avoid backdrop-filter CSS trap ─── */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'tween', duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed inset-0 z-[200] bg-[#050505] flex flex-col md:hidden"
                        style={{ touchAction: 'none' }}
                    >
                        {/* Top bar */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.05]">
                            <span className="text-xs tracking-[0.3em] uppercase text-gold/50 font-light">Virudti Jewells</span>
                            <button
                                onClick={() => setMobileOpen(false)}
                                className="w-10 h-10 flex items-center justify-center border border-white/10 hover:border-gold/30 transition-colors duration-300 relative"
                                aria-label="Close menu"
                            >
                                <span className="absolute w-4 h-[1px] bg-white/70 rotate-45" />
                                <span className="absolute w-4 h-[1px] bg-white/70 -rotate-45" />
                            </button>
                        </div>

                        {/* Nav links */}
                        <div className="flex flex-col items-start justify-center flex-1 px-10 gap-0">
                            {NAV_LINKS.map((link, i) => (
                                <motion.button
                                    key={link.label}
                                    initial={{ opacity: 0, x: 40 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.06 + i * 0.07, duration: 0.35 }}
                                    onClick={() => handleNav(link.href)}
                                    className="text-[2.6rem] font-serif text-white/50 hover:text-gold py-4 transition-colors duration-300 tracking-wide w-full text-left border-b border-white/[0.05] last:border-0"
                                >
                                    {link.label}
                                </motion.button>
                            ))}
                        </div>

                        {/* Footer strip */}
                        <div className="px-10 py-8 border-t border-white/[0.05] flex items-center justify-between">
                            <p className="text-[10px] tracking-[0.2em] uppercase text-white/15">Madurai · Tamil Nadu</p>
                            <p className="text-[10px] tracking-[0.15em] uppercase text-gold/20">Since 1998</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}


/* ═══════════════════════════════════════════════════════════════════
   ANNOUNCEMENT BAR — Slim gold strip (purely centered text, no logo)
   ═══════════════════════════════════════════════════════════════════ */
function AnnouncementBar() {
    const announcements = [
        '✨ Bridal Collections Now Available',
        '✨ Custom Temple Jewellery Orders Open',
    ]
    const [current, setCurrent] = useState(0)

    useEffect(() => {
        const timer = setInterval(() => setCurrent(i => (i + 1) % announcements.length), 4000)
        return () => clearInterval(timer)
    }, [])

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-sm border-t border-gold/10 overflow-hidden">
            <div className="py-2 flex items-center justify-center h-8">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={current}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.5 }}
                        className="text-[10px] md:text-xs tracking-[0.2em] text-gold/70 font-light uppercase"
                    >
                        {announcements[current]}
                    </motion.p>
                </AnimatePresence>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   2️⃣ HERO SECTION — Full-Bleed Cinematic Entry
   ═══════════════════════════════════════════════════════════════════ */
function HeroSection() {
    return (
        <section
            id="hero"
            className="relative w-screen h-screen overflow-hidden"
            style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)' }}
        >
            {/* Layer 1: Hero Background — FULL BLEED with Ken Burns animation */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/hero-jewelry.png"
                    alt="Virudti Jewells — Premium Gold and Silver Collection"
                    className="hero-ken-burns w-full h-full object-cover object-center"
                    loading="eager"
                    fetchPriority="high"
                    draggable={false}
                />
            </div>

            {/* Layer 2: Cinematic Overlay System — Deep contrast for true luxury feel */}
            {/* Base darkening gradient for universal contrast */}
            <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/65 via-black/75 to-black/85 md:opacity-100 opacity-85" />

            {/* Center luxury radial glow behind title */}
            <div className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.18)_0%,transparent_60%)] mix-blend-screen" />

            {/* Bottom transition fade */}
            <div className="absolute bottom-0 left-0 right-0 h-48 z-[3] bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent" />

            {/* Depth blur specifically behind the text focal area */}
            <div className="absolute inset-0 z-[1] backdrop-blur-[2px] opacity-40 mix-blend-overlay" />

            {/* Gold floating particles */}
            <div className="absolute inset-0 z-[4] pointer-events-none">
                {[...Array(12)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute rounded-full"
                        style={{
                            left: `${10 + Math.random() * 80}%`,
                            top: `${15 + Math.random() * 65}%`,
                            width: `${1.5 + Math.random() * 2.5}px`,
                            height: `${1.5 + Math.random() * 2.5}px`,
                            background: `radial-gradient(circle, rgba(212,175,55,0.6), transparent)`,
                        }}
                        animate={{
                            y: [0, -(12 + Math.random() * 25), 0],
                            opacity: [0.15, 0.35, 0.15],
                        }}
                        transition={{
                            duration: 10 + Math.random() * 8,
                            repeat: Infinity,
                            delay: Math.random() * 4,
                            ease: "easeInOut",
                        }}
                    />
                ))}
            </div>

            {/* Layer 3: Center Content — breathable luxury typography */}
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6"
            >
                <div className="max-w-3xl">
                    {/* Crown icon */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                    >
                        <Crown className="w-8 h-8 md:w-10 md:h-10 text-gold/50 mx-auto mb-6 md:mb-8" strokeWidth={1} />
                    </motion.div>

                    {/* Brand Name */}
                    <h1
                        className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-serif text-white mb-2 md:mb-3 tracking-tight leading-[0.9]"
                        style={{ textShadow: '0 4px 25px rgba(0,0,0,0.7), 0 0 35px rgba(212,175,55,0.15)' }}
                    >
                        VIRUDTI
                    </h1>
                    <p
                        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif text-white/90 mb-6 md:mb-8 tracking-[0.35em]"
                        style={{ textShadow: '0 4px 25px rgba(0,0,0,0.7)' }}
                    >
                        JEWELLS
                    </p>

                    {/* Tagline */}
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.6 }}
                        className="text-gold/80 text-[11px] md:text-sm tracking-[0.3em] uppercase mb-6 md:mb-8 font-light"
                    >
                        Timeless Gold · Trusted Purity
                    </motion.p>

                    {/* Divider */}
                    <div className="w-20 h-[1px] bg-gradient-to-r from-transparent via-[#CFAF5A] to-transparent mx-auto mb-8 md:mb-10 opacity-70" />

                    {/* Quote */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.9 }}
                        className="text-base md:text-lg lg:text-xl font-serif text-white/70 italic mb-12 md:mb-14 font-light max-w-xl mx-auto"
                        style={{ textShadow: '0 2px 15px rgba(0,0,0,0.8)' }}
                    >
                        "Crafting elegance for generations in Madurai."
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 1.1 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 md:mb-10"
                    >
                        <motion.button
                            onClick={() => { const el = document.querySelector('#collections'); el?.scrollIntoView({ behavior: 'smooth' }) }}
                            whileHover={{ scale: 1.04, boxShadow: '0 0 35px rgba(212,175,55,0.55)' }}
                            whileTap={{ scale: 0.97 }}
                            className="w-full sm:w-auto px-10 py-4 text-black font-semibold tracking-[0.12em] text-sm uppercase"
                            style={{
                                background: 'linear-gradient(135deg, #CFAF5A, #F4E6A1, #B8963D)',
                                boxShadow: '0 0 20px rgba(212,175,55,0.4)'
                            }}
                        >
                            Explore Collection
                        </motion.button>
                        <motion.button
                            onClick={() => { const el = document.querySelector('#contact'); el?.scrollIntoView({ behavior: 'smooth' }) }}
                            whileHover={{ scale: 1.03, borderColor: 'rgba(212,175,55,0.6)', color: '#CFAF5A' }}
                            whileTap={{ scale: 0.97 }}
                            className="w-full sm:w-auto px-10 py-4 border border-white/20 text-white/90 font-medium tracking-[0.12em] text-sm uppercase flex items-center justify-center gap-3"
                        >
                            <MapPin className="w-3.5 h-3.5" />
                            Visit Our Store
                        </motion.button>
                    </motion.div>

                    {/* Micro trust badge */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: 1.4 }}
                        className="text-[11px] text-white/25 tracking-[0.1em] flex items-center justify-center gap-2"
                    >
                        <Star className="w-3 h-3 text-gold/50 fill-gold/50" />
                        4.8 Rated · Trusted by Families in Madurai
                    </motion.p>
                </div>
            </motion.div>

            {/* Scroll indicator */}
            <motion.div
                className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, y: [0, 8, 0] }}
                transition={{ opacity: { delay: 2, duration: 1 }, y: { duration: 2.5, repeat: Infinity, ease: "easeInOut" } }}
            >
                <span className="text-[9px] uppercase tracking-[0.3em] text-white/20">Scroll</span>
                <div className="w-[1px] h-8 bg-gradient-to-b from-white/20 to-transparent" />
            </motion.div>
        </section>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   3️⃣ ABOUT SECTION — Legacy Split Layout
   ═══════════════════════════════════════════════════════════════════ */
function AboutSection() {
    return (
        <section id="about" className="py-28 px-6 bg-[#050505] relative overflow-hidden">
            <div className="absolute left-0 top-0 w-1/4 h-full opacity-[0.02] bg-cover bg-center" style={{ backgroundImage: 'url(/hero-jewelry.png)' }} />

            <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center relative z-10">
                {/* Left — Image placeholder */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 1.2 }}
                    className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl border border-yellow-500/20 group"
                >
                    <img
                        src="/images/virudti-art.jpg"
                        alt="Virudti Jewells — South Indian Temple Necklace"
                        className="rounded-2xl object-cover w-full h-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                        <p className="text-[10px] tracking-[0.2em] uppercase text-gold/60">Since 1998</p>
                    </div>
                </motion.div>

                {/* Right — Story */}
                <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 1 }}
                    className="space-y-8"
                >
                    <p className="text-xs tracking-[0.3em] uppercase text-gold/50 font-light">About Us</p>
                    <h2 className="text-3xl md:text-4xl font-serif text-white leading-snug">
                        The Art of <span className="text-gold">Virudti</span>
                    </h2>
                    <div className="w-10 h-[1px] bg-gold/30" />
                    <p className="text-base text-white/45 leading-[1.9] font-light">
                        At Virudti Jewells, we blend tradition with contemporary elegance.
                        From intricate temple jewellery to trend-inspired bridal designs,
                        every piece reflects craftsmanship, purity, and timeless beauty.
                    </p>
                    <p className="text-base text-white/45 leading-[1.9] font-light">
                        Rooted in the heritage of Madurai, our designs carry the soul
                        of South Indian artistry — each piece a testament to our
                        unwavering commitment to excellence.
                    </p>

                    <div className="flex flex-wrap gap-6 pt-6">
                        {[
                            { icon: ShieldCheck, label: 'BIS Hallmark Certified' },
                            { icon: Gem, label: 'Transparent Pricing' },
                            { icon: Heart, label: 'Personalized Service' },
                        ].map(({ icon: Icon, label }) => (
                            <div key={label} className="flex items-center gap-2 text-xs text-white/40 tracking-wide">
                                <Icon className="w-3.5 h-3.5 text-gold/50" />
                                <span>{label}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </section>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   4️⃣ FEATURED COLLECTIONS GRID
   ═══════════════════════════════════════════════════════════════════ */
function CollectionsSection() {
    const collections = [
        { name: 'Temple Jewellery', desc: 'Timeless devotion in gold', image: '/images/collection-temple.jpg' },
        { name: 'Bridal Gold', desc: 'Elegance for your special day', image: '/images/collection-bridal.jpg' },
        { name: 'Modern Trend', desc: 'Contemporary luxury designs', image: '/images/collection-modern.jpg' },
        { name: 'Silver Elegance', desc: 'Refined silver craftsmanship', image: '/images/collection-silver.jpg' },
    ]

    return (
        <section id="collections" className="py-28 px-6 bg-[#080808]">
            <div className="max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1 }}
                    className="text-center mb-16"
                >
                    <p className="text-xs tracking-[0.3em] uppercase text-gold/50 font-light mb-4">Our Collections</p>
                    <h2 className="text-4xl md:text-5xl font-serif text-white">Featured Collections</h2>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {collections.map((col, idx) => (
                        <motion.div
                            key={col.name}
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            whileTap={{ scale: 0.98 }}
                            transition={{ duration: 0.65, delay: idx * 0.08 }}
                            className="group relative aspect-[16/10] bg-[#0A0A0A] border border-white/[0.03] hover:border-gold/30 rounded-2xl overflow-hidden cursor-pointer shadow-2xl"
                        >
                            {/* Background Image */}
                            <img
                                src={col.image}
                                alt={col.name}
                                className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-90 group-hover:scale-110 transition-all duration-1000 ease-out"
                            />

                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 group-hover:from-black/70 transition-all duration-700" />

                            {/* Text Content — always visible on mobile */}
                            <div className="absolute bottom-0 left-0 p-6 md:p-8 z-10 w-full">
                                <p className="text-[9px] tracking-[0.25em] uppercase text-gold/70 mb-2 font-medium">Collection</p>
                                <h3 className="text-xl md:text-2xl font-serif text-white group-hover:text-gold transition-colors duration-500 mb-1">
                                    {col.name}
                                </h3>
                                <p className="text-sm text-white/50 font-light">{col.desc}</p>
                            </div>

                            {/* Gold bottom line */}
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   5️⃣ WHY CHOOSE VIRUDTI
   ═══════════════════════════════════════════════════════════════════ */
function WhyChooseSection() {
    const reasons = [
        {
            icon: ShieldCheck,
            stat: '100%',
            title: 'Certified Gold Purity',
            desc: 'Every piece is BIS Hallmark certified — guaranteed purity with every gram.',
            color: 'from-gold/10 to-transparent',
        },
        {
            icon: Gem,
            stat: '500+',
            title: 'Handcrafted Designs',
            desc: 'Unique artistry in every detail, crafted by skilled artisans.',
            color: 'from-gold/10 to-transparent',
        },
        {
            icon: Award,
            stat: '₹0',
            title: 'Transparent Pricing',
            desc: 'Zero hidden charges. What you see is what you pay — always.',
            color: 'from-gold/10 to-transparent',
        },
        {
            icon: Crown,
            stat: '26+',
            title: 'Trusted Since 1998',
            desc: '26 years of excellence. Trusted by thousands of families in Madurai.',
            color: 'from-gold/10 to-transparent',
        },
    ]

    return (
        <section className="py-32 px-6 bg-[#050505] relative overflow-hidden">
            {/* Ambient gold glow behind section */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(212,175,55,0.06),transparent_65%)] pointer-events-none" />
            {/* Top decorative line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-20 bg-gradient-to-b from-transparent via-gold/30 to-transparent" />

            <div className="max-w-7xl mx-auto relative z-10">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9 }}
                    className="text-center mb-20"
                >
                    <p className="text-[10px] tracking-[0.45em] uppercase text-gold/50 font-light mb-5 flex items-center justify-center gap-3">
                        <span className="inline-block w-8 h-[1px] bg-gold/30" />
                        Our Promise
                        <span className="inline-block w-8 h-[1px] bg-gold/30" />
                    </p>
                    <h2 className="text-4xl md:text-6xl font-serif text-white mb-5 tracking-tight">
                        Why Choose <span className="text-gold">Virudti</span>
                    </h2>
                    <p className="text-sm text-white/35 font-light max-w-md mx-auto leading-relaxed">
                        Decades of trust, unmatched craftsmanship and complete transparency in every purchase.
                    </p>
                </motion.div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {reasons.map(({ icon: Icon, stat, title, desc }, idx) => (
                        <motion.div
                            key={title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -10, boxShadow: '0 24px 48px rgba(212,175,55,0.18), 0 0 0 1px rgba(212,175,55,0.18)' }}
                            whileTap={{ scale: 0.97, boxShadow: '0 8px 20px rgba(212,175,55,0.12)' }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: idx * 0.08 }}
                            className="relative group flex flex-col p-8 border border-white/[0.05] hover:border-gold/25 transition-colors duration-500 overflow-hidden"
                            style={{ background: 'linear-gradient(160deg, rgba(212,175,55,0.04) 0%, rgba(10,10,10,0.9) 50%)' }}
                        >
                            {/* Stat number — large background watermark */}
                            <span className="absolute top-4 right-5 text-7xl font-serif text-gold/[0.07] leading-none select-none pointer-events-none group-hover:text-gold/[0.12] transition-colors duration-700">
                                {stat}
                            </span>

                            {/* Icon container */}
                            <motion.div
                                whileHover={{ scale: 1.1, rotate: 6 }}
                                transition={{ type: 'spring', stiffness: 280, damping: 14 }}
                                className="w-14 h-14 mb-7 flex items-center justify-center border border-gold/20 bg-gold/[0.06] group-hover:bg-gold/[0.12] group-hover:border-gold/40 transition-all duration-500"
                                style={{ borderRadius: '2px' }}
                            >
                                <Icon className="w-6 h-6 text-gold/70 group-hover:text-gold transition-colors duration-400" strokeWidth={1.2} />
                            </motion.div>

                            {/* Stat */}
                            <p className="text-3xl font-serif text-gold mb-1 tracking-tight" style={{ textShadow: '0 0 20px rgba(212,175,55,0.3)' }}>
                                {stat}
                            </p>

                            {/* Title */}
                            <h3 className="text-base font-serif text-white mb-3 leading-snug">{title}</h3>

                            {/* Desc */}
                            <p className="text-xs text-white/40 font-light leading-[1.8] flex-1">{desc}</p>

                            {/* Bottom gold accent line */}
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        </motion.div>
                    ))}
                </div>

                {/* Bottom Stats Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="mt-16 border border-white/[0.04] grid grid-cols-2 md:grid-cols-4 divide-x divide-white/[0.04]"
                >
                    {[
                        { value: '10,000+', label: 'Happy Families' },
                        { value: '500+', label: 'Unique Designs' },
                        { value: '3', label: 'Showrooms' },
                        { value: '4.8 ★', label: 'Customer Rating' },
                    ].map(({ value, label }) => (
                        <div key={label} className="py-8 text-center group hover:bg-gold/[0.03] transition-colors duration-500">
                            <p className="text-2xl md:text-3xl font-serif text-gold mb-1 group-hover:text-gold transition-colors" style={{ textShadow: '0 0 15px rgba(212,175,55,0.25)' }}>{value}</p>
                            <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-light">{label}</p>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    )
}


/* ═══════════════════════════════════════════════════════════════════
   6️⃣ CUSTOMER REVIEWS
   ═══════════════════════════════════════════════════════════════════ */
function ReviewsSection() {
    const reviews = [
        { name: 'Priya M.', text: 'Good quality and customer satisfaction. The temple jewellery designs are absolutely stunning.', rating: 5 },
        { name: 'Lakshmi R.', text: 'Collections are always in trend. My bridal set from Virudti was the highlight of my wedding.', rating: 5 },
        { name: 'Kavitha S.', text: 'Excellent customer treatment and new designs every season. Truly trustworthy.', rating: 5 },
    ]
    const [active, setActive] = useState(0)

    useEffect(() => {
        const timer = setInterval(() => setActive(i => (i + 1) % reviews.length), 5000)
        return () => clearInterval(timer)
    }, [])

    return (
        <section id="bridal" className="py-28 px-6 bg-[#050505] relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.02),transparent_50%)]" />

            <div className="max-w-3xl mx-auto text-center relative z-10">
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1 }}
                >
                    <p className="text-xs tracking-[0.3em] uppercase text-gold/50 font-light mb-4">Testimonials</p>
                    <h2 className="text-4xl font-serif text-white mb-4">What Our Customers Say</h2>
                    <div className="flex items-center justify-center gap-1 mb-12">
                        {[...Array(5)].map((_, i) => (
                            <Star key={i} className="w-4 h-4 text-gold fill-gold" />
                        ))}
                        <span className="ml-2 text-sm text-white/50 font-light">4.8 / 5</span>
                    </div>
                </motion.div>

                <div className="relative min-h-[200px] flex items-center justify-center">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={active}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.5 }}
                            className="space-y-6"
                        >
                            <Quote className="w-8 h-8 text-gold/20 mx-auto" />
                            <p className="text-lg md:text-xl text-white/60 font-serif italic leading-relaxed">
                                "{reviews[active].text}"
                            </p>
                            <p className="text-sm text-gold/60 tracking-[0.15em] uppercase font-light">
                                — {reviews[active].name}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Dots */}
                <div className="flex items-center justify-center gap-3 mt-8">
                    {reviews.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setActive(i)}
                            className={`w-2 h-2 rounded-full transition-all duration-500 ${i === active ? 'bg-gold w-6' : 'bg-white/15 hover:bg-white/30'}`}
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   7️⃣ VISIT OUR SHOWROOM
   ═══════════════════════════════════════════════════════════════════ */
function ShowroomSection() {
    return (
        <section id="contact" className="py-28 px-6 bg-[#050505]">
            <div className="max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1 }}
                    className="text-center mb-16"
                >
                    <p className="text-xs tracking-[0.3em] uppercase text-gold/50 font-light mb-4">Find Us</p>
                    <h2 className="text-4xl md:text-5xl font-serif text-white">Visit Our Showroom</h2>
                </motion.div>

                <div className="grid md:grid-cols-2 gap-8 items-center">
                    {/* Map Embed */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="aspect-[4/3] bg-neutral-900 border border-white/[0.03] overflow-hidden"
                    >
                        <iframe
                            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3930.0!2d78.1498095!3d9.9528782!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3b00c55883a017d3%3A0xc376c921db7d709c!2sVirudti%20Jewells!5e0!3m2!1sen!2sin!4v1709337600000"
                            width="100%"
                            height="100%"
                            style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg) contrast(0.9)' }}
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title="Virudti Jewells Location"
                        />
                    </motion.div>

                    {/* Address Info */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="space-y-8"
                    >
                        <div className="p-8 border border-white/[0.04] space-y-6">
                            <div className="flex items-start gap-4">
                                <MapPin className="w-5 h-5 text-gold/60 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-white font-medium mb-1">Virudti Jewells</p>
                                    <p className="text-white/40 text-sm font-light leading-relaxed">
                                        Nicholson School Complex<br />
                                        Moondrumavadi, Madurai – 625007<br />
                                        Tamil Nadu, India
                                    </p>
                                </div>
                            </div>

                            <div className="h-[1px] bg-white/[0.04]" />

                            <div className="flex flex-col gap-4">
                                <a href="tel:+919600996579" className="flex items-center gap-3 text-sm text-white/50 hover:text-gold transition-colors duration-300">
                                    <Phone className="w-4 h-4 text-gold/50" />
                                    <span>+91 96009 96579</span>
                                </a>
                                <a href="https://wa.me/919600996579" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-emerald-500/80 hover:text-emerald-400 transition-colors duration-300">
                                    <MessageCircle className="w-4 h-4" />
                                    <span>WhatsApp Us</span>
                                </a>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <a href="tel:+919600996579" className="flex-1 px-6 py-3.5 bg-gold/90 text-black text-sm font-medium tracking-[0.1em] uppercase text-center hover:bg-gold transition-all duration-500 flex items-center justify-center gap-2">
                                <Phone className="w-3.5 h-3.5" />
                                Call Now
                            </a>
                            <a href="https://www.google.com/maps/dir//Virudti+jewells,+Nicholson+school+complex,+8,+Moondrumavadi,+Madurai,+Tamil+Nadu+625007/@9.9178368,78.1228236,9z/data=!4m8!4m7!1m0!1m5!1m1!1s0x3b00c55883a017d3:0xc376c921db7d709c!2m2!1d78.1498095!2d9.9528782" target="_blank" rel="noopener noreferrer" className="flex-1 px-6 py-3.5 border border-white/15 text-white/80 text-sm font-medium tracking-[0.1em] uppercase text-center hover:border-gold/40 hover:text-gold transition-all duration-500 flex items-center justify-center gap-2">
                                <Navigation className="w-3.5 h-3.5" />
                                Get Directions
                            </a>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   9️⃣ CALL TO ACTION
   ═══════════════════════════════════════════════════════════════════ */
function CTASection() {
    return (
        <section className="py-28 px-6 bg-black relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.05),transparent_60%)]" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 1 }}
                className="max-w-2xl mx-auto text-center relative z-10"
            >
                <Sparkles className="w-8 h-8 text-gold/40 mx-auto mb-8" strokeWidth={1} />
                <h2 className="text-3xl md:text-5xl font-serif text-white mb-6 leading-tight">
                    Discover Jewellery That<br />
                    <span className="text-gold">Tells Your Story</span>
                </h2>
                <p className="text-sm text-white/35 font-light mb-12 max-w-md mx-auto leading-relaxed">
                    Walk into our showroom and experience the art of fine Indian jewellery — crafted with love, worn with pride.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <motion.button
                        onClick={() => { const el = document.querySelector('#contact'); el?.scrollIntoView({ behavior: 'smooth' }) }}
                        whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(212,175,55,0.35)' }}
                        whileTap={{ scale: 0.97 }}
                        className="w-full sm:w-auto px-10 py-4 bg-gold/90 text-black font-medium tracking-[0.1em] text-sm uppercase flex items-center justify-center gap-2 hover:bg-gold transition-colors duration-300"
                    >
                        <MapPin className="w-4 h-4" />
                        Visit Store Today
                    </motion.button>
                    <motion.a
                        href="tel:+919600996579"
                        whileHover={{ scale: 1.03, boxShadow: '0 0 20px rgba(212,175,55,0.15)' }}
                        whileTap={{ scale: 0.97 }}
                        className="w-full sm:w-auto px-10 py-4 border border-white/15 text-white/80 font-medium tracking-[0.1em] text-sm uppercase hover:border-gold/40 hover:text-gold transition-all duration-500 flex items-center justify-center gap-2"
                    >
                        <Phone className="w-4 h-4" />
                        Call Now
                    </motion.a>
                </div>
            </motion.div>
        </section>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   🔐 STAFF LOGIN — Hidden Gateway
   ═══════════════════════════════════════════════════════════════════ */
function StaffPortal() {
    return (
        <section className="py-20 px-6 bg-[#050505] border-t border-white/[0.03]">
            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="max-w-sm mx-auto text-center"
            >
                <Link
                    to={ROUTES.LOGIN}
                    className="inline-flex items-center gap-3 text-xs text-white/20 hover:text-gold/60 transition-colors duration-500 tracking-[0.15em] uppercase"
                >
                    <Lock className="w-3 h-3" />
                    Staff Portal — Secure Access
                    <ChevronRight className="w-3 h-3" />
                </Link>
            </motion.div>
        </section>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   🔟 FOOTER
   ═══════════════════════════════════════════════════════════════════ */
function Footer() {
    return (
        <footer className="py-16 px-6 bg-black border-t border-white/[0.03]">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
                    {/* About */}
                    <div>
                        <h4 className="text-xs tracking-[0.2em] uppercase text-white/50 mb-5 font-medium">About</h4>
                        <ul className="space-y-3 text-sm text-white/30 font-light">
                            <li className="hover:text-gold/60 cursor-pointer transition-colors">Our Story</li>
                            <li className="hover:text-gold/60 cursor-pointer transition-colors">Craftsmanship</li>
                            <li className="hover:text-gold/60 cursor-pointer transition-colors">Heritage</li>
                            <li>
                                <Link
                                    to={ROUTES.LOGIN}
                                    className="hover:text-gold/60 transition-colors duration-300"
                                >
                                    Staff Login
                                </Link>
                            </li>
                        </ul>
                    </div>
                    {/* Collections */}
                    <div>
                        <h4 className="text-xs tracking-[0.2em] uppercase text-white/50 mb-5 font-medium">Collections</h4>
                        <ul className="space-y-3 text-sm text-white/30 font-light">
                            <li className="hover:text-gold/60 cursor-pointer transition-colors">Temple Jewellery</li>
                            <li className="hover:text-gold/60 cursor-pointer transition-colors">Bridal Gold</li>
                            <li className="hover:text-gold/60 cursor-pointer transition-colors">Silver Elegance</li>
                        </ul>
                    </div>
                    {/* Location */}
                    <div>
                        <h4 className="text-xs tracking-[0.2em] uppercase text-white/50 mb-5 font-medium">Location</h4>
                        <ul className="space-y-3 text-sm text-white/30 font-light">
                            <li>Moondrumavadi</li>
                            <li>Madurai – 625007</li>
                            <li>Tamil Nadu</li>
                        </ul>
                    </div>
                    {/* Contact */}
                    <div>
                        <h4 className="text-xs tracking-[0.2em] uppercase text-white/50 mb-5 font-medium">Connect</h4>
                        <div className="flex gap-4 mb-4">
                            <a href="#" className="w-9 h-9 border border-white/[0.06] hover:border-gold/30 flex items-center justify-center transition-colors duration-500">
                                <Instagram className="w-4 h-4 text-white/30 hover:text-gold/60" />
                            </a>
                            <a href="https://wa.me/919600996579" className="w-9 h-9 border border-white/[0.06] hover:border-gold/30 flex items-center justify-center transition-colors duration-500">
                                <MessageCircle className="w-4 h-4 text-white/30 hover:text-gold/60" />
                            </a>
                            <a href="tel:+919600996579" className="w-9 h-9 border border-white/[0.06] hover:border-gold/30 flex items-center justify-center transition-colors duration-500">
                                <Phone className="w-4 h-4 text-white/30 hover:text-gold/60" />
                            </a>
                        </div>
                    </div>
                </div>

                <div className="h-[1px] bg-white/[0.03] mb-8" />

                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-[10px] text-white/15 tracking-[0.2em] uppercase">
                        © {new Date().getFullYear()} Virudti Jewells — Madurai
                    </p>
                    <Diamond className="w-4 h-4 text-gold/10" strokeWidth={0.5} />
                </div>
            </div>
        </footer>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   🏠 LANDING PAGE — Main Export
   ═══════════════════════════════════════════════════════════════════ */
export default function Landing() {
    const [showIntro, setShowIntro] = useState(true)
    const handleIntroComplete = useCallback(() => setShowIntro(false), [])

    useEffect(() => {
        document.title = "Virudti Jewells — Timeless Gold, Trusted Purity | Madurai"
        return () => { document.title = "VIRUDTI JEWELLS | Jewells ERP" }
    }, [])

    return (
        <>
            {showIntro && <BrandIntro onComplete={handleIntroComplete} />}
            <div className="min-h-screen bg-[#050505] text-white selection:bg-gold/30 font-sans antialiased overflow-x-hidden">
                <style>{`
                @keyframes scrollGallery {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                @keyframes heroKenBurns {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.06); }
                    100% { transform: scale(1); }
                }
                .hero-ken-burns {
                    animation: heroKenBurns 25s ease-in-out infinite;
                    will-change: transform;
                }
            `}</style>
                <Navbar />
                <AnnouncementBar />
                <HeroSection />
                <AboutSection />
                <CollectionsSection />
                <WhyChooseSection />
                <ReviewsSection />
                <ShowroomSection />
                <CTASection />
                <Footer />
            </div>
        </>
    )
}
