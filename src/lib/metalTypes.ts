// ─── Multi-Metal Type Constants ──────────────────────────────────
// Single source of truth for all metal/purity logic across the app.

export const METAL_TYPES = ['Gold', 'Silver', 'Platinum'] as const
export type MetalType = typeof METAL_TYPES[number]

export const PURITY_OPTIONS: Record<MetalType, string[]> = {
    Gold: ['24K', '22K', '18K', '14K'],
    Silver: ['999', '925', '900'],
    Platinum: ['950', '900'],
}

export const DEFAULT_PURITY: Record<MetalType, string> = {
    Gold: '22K',
    Silver: '925',
    Platinum: '950',
}

// Tailwind colour classes per metal
export const METAL_BADGE_COLORS: Record<MetalType, string> = {
    Gold: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    Silver: 'bg-slate-400/10 text-slate-300 border-slate-400/20',
    Platinum: 'bg-blue-400/10 text-blue-300 border-blue-400/20',
}

export const METAL_ICON_COLORS: Record<MetalType, string> = {
    Gold: 'text-yellow-400',
    Silver: 'text-slate-300',
    Platinum: 'text-blue-300',
}

// Emoji/symbol for quick visual identification
export const METAL_EMOJI: Record<MetalType, string> = {
    Gold: '🥇',
    Silver: '🥈',
    Platinum: '💎',
}

// Default metal rates (fallback only — true values come from DB)
export const DEFAULT_METAL_RATES: Record<MetalType, number> = {
    Gold: 7245,
    Silver: 92,
    Platinum: 3200,
}

// Guard: check if a string is a valid MetalType
export function isMetalType(v: string): v is MetalType {
    return METAL_TYPES.includes(v as MetalType)
}

// Get purity options for a given metal (safe — falls back to Gold)
export function getPurityOptions(metal: string): string[] {
    if (!isMetalType(metal)) return PURITY_OPTIONS.Gold
    return PURITY_OPTIONS[metal]
}

// Get default purity when metal changes
export function getDefaultPurity(metal: string): string {
    if (!isMetalType(metal)) return DEFAULT_PURITY.Gold
    return DEFAULT_PURITY[metal]
}
