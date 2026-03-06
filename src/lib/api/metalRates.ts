import { supabase } from '../supabase'
import { type MetalType, DEFAULT_METAL_RATES } from '../metalTypes'

// ─── Fetch all metal rates ────────────────────────────────────────
export async function fetchAllMetalRates(): Promise<Record<MetalType, number>> {
    try {
        const { data, error } = await supabase
            .from('metal_rates')
            .select('metal_type, rate')

        if (error || !data || data.length === 0) {
            console.warn('metal_rates fetch failed, using defaults:', error?.message)
            return { ...DEFAULT_METAL_RATES }
        }

        const result: Record<string, number> = { ...DEFAULT_METAL_RATES }
        data.forEach((row: any) => { result[row.metal_type] = Number(row.rate) })
        return result as Record<MetalType, number>
    } catch {
        return { ...DEFAULT_METAL_RATES }
    }
}

// ─── Fetch single metal rate ──────────────────────────────────────
export async function fetchMetalRate(metalType: MetalType): Promise<number> {
    try {
        const { data, error } = await supabase
            .from('metal_rates')
            .select('rate, last_updated_at, updated_by')
            .eq('metal_type', metalType)
            .single()

        if (error || !data) return DEFAULT_METAL_RATES[metalType]
        return Number(data.rate)
    } catch {
        return DEFAULT_METAL_RATES[metalType]
    }
}

// ─── Fetch rate row with metadata ────────────────────────────────
export async function fetchMetalRateRow(metalType: MetalType) {
    try {
        const { data, error } = await supabase
            .from('metal_rates')
            .select('id, metal_type, rate, last_updated_at, updated_by')
            .eq('metal_type', metalType)
            .single()

        if (error || !data) return { id: null, rate: DEFAULT_METAL_RATES[metalType], last_updated_at: null }
        return data
    } catch {
        return { id: null, rate: DEFAULT_METAL_RATES[metalType], last_updated_at: null }
    }
}

// ─── Fetch all 3 rate rows with metadata ─────────────────────────
export async function fetchAllMetalRateRows() {
    try {
        const { data, error } = await supabase
            .from('metal_rates')
            .select('id, metal_type, rate, last_updated_at, updated_by')
            .order('metal_type')

        if (error || !data || data.length === 0) {
            return [
                { id: null, metal_type: 'Gold', rate: DEFAULT_METAL_RATES.Gold, last_updated_at: null },
                { id: null, metal_type: 'Silver', rate: DEFAULT_METAL_RATES.Silver, last_updated_at: null },
                { id: null, metal_type: 'Platinum', rate: DEFAULT_METAL_RATES.Platinum, last_updated_at: null },
            ]
        }
        return data
    } catch {
        return [
            { id: null, metal_type: 'Gold', rate: DEFAULT_METAL_RATES.Gold, last_updated_at: null },
            { id: null, metal_type: 'Silver', rate: DEFAULT_METAL_RATES.Silver, last_updated_at: null },
            { id: null, metal_type: 'Platinum', rate: DEFAULT_METAL_RATES.Platinum, last_updated_at: null },
        ]
    }
}

// ─── Update metal rate (Admin only) ──────────────────────────────
export async function updateMetalRate(metalType: MetalType, rate: number, userId: string) {
    if (rate <= 0 || rate > 9_999_999) {
        throw new Error(`Rate must be between 1 and 9,999,999`)
    }

    // Try update first
    const { data: existing } = await supabase
        .from('metal_rates')
        .select('id')
        .eq('metal_type', metalType)
        .single()

    if (existing?.id) {
        const { data, error } = await supabase
            .from('metal_rates')
            .update({ rate, last_updated_at: new Date().toISOString(), updated_by: userId })
            .eq('id', existing.id)
            .select()
            .single()

        if (error) throw new Error(`Failed to update ${metalType} rate: ${error.message}`)
        return data
    } else {
        // Row doesn't exist → insert
        const { data, error } = await supabase
            .from('metal_rates')
            .insert({ metal_type: metalType, rate, updated_by: userId })
            .select()
            .single()

        if (error) throw new Error(`Failed to insert ${metalType} rate: ${error.message}`)
        return data
    }
}

// ─── Backward-compat: fetchGoldRate() still works ────────────────
export async function fetchGoldRate() {
    return fetchMetalRateRow('Gold')
}

export async function updateGoldRate(rate: number, userId: string) {
    return updateMetalRate('Gold', rate, userId)
}
