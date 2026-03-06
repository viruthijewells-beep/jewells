import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'

/**
 * BrandIntro — Luxury cinematic opening animation
 * 
 * Full-screen overlay with:
 * - Black background
 * - Banner card scales up with gold shine sweep
 * - Smooth fade-out transition into the website
 */
export default function BrandIntro({ onComplete }: { onComplete: () => void }) {
    // Phase 1: Card appears (0–0.8s)
    // Phase 2: Shine sweeps (0.8–2.2s)  
    // Phase 3: Fade out (2.5–3.3s)
    const [phase, setPhase] = useState<'enter' | 'shine' | 'exit'>('enter')

    useEffect(() => {
        const t1 = setTimeout(() => setPhase('shine'), 800)
        const t2 = setTimeout(() => setPhase('exit'), 2500)
        const t3 = setTimeout(() => onComplete(), 3300)
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    }, [onComplete])

    return (
        <AnimatePresence>
            {phase !== 'exit' ? null : null}
            <motion.div
                key="brand-intro"
                initial={{ opacity: 1 }}
                animate={{ opacity: phase === 'exit' ? 0 : 1 }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
                className="brand-intro-overlay"
            >
                {/* Radial gold glow behind card */}
                <div className="brand-intro-glow" />

                {/* Banner card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.88, y: 20 }}
                    animate={{
                        opacity: 1,
                        scale: phase === 'exit' ? 1.05 : 1,
                        y: 0,
                    }}
                    transition={{
                        opacity: { duration: 0.6, ease: 'easeOut' },
                        scale: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
                        y: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
                    }}
                    className="brand-intro-card"
                >
                    <img
                        src="/virudti-banner.png"
                        alt="Virudti Jewells — Timeless Gold, Trusted Purity"
                        className="brand-intro-image"
                        draggable={false}
                    />
                    {/* Gold shine sweep */}
                    <div className={`brand-intro-shine ${phase === 'shine' || phase === 'exit' ? 'active' : ''}`} />
                </motion.div>

                {/* Subtle gold particles */}
                <div className="brand-intro-particles">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <motion.span
                            key={i}
                            className="brand-intro-particle"
                            initial={{ opacity: 0, y: 0 }}
                            animate={{
                                opacity: [0, 0.8, 0],
                                y: [-20 - i * 15, -60 - i * 20],
                            }}
                            transition={{
                                duration: 2,
                                delay: 0.5 + i * 0.15,
                                ease: 'easeOut',
                            }}
                        />
                    ))}
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
