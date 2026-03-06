import { supabase } from '../supabase'

const DEFAULT_RATE = 7245.00

// ─── Auto-seed: ensure gold_settings has exactly one row ────────
async function ensureGoldSettingsRow() {
    // Check if row exists
    const { data, error } = await supabase
        .from('gold_settings')
        .select('id')
        .limit(1)

    if (error) {
        console.warn('gold_settings table may not exist:', error.message)
        return false
    }

    // If no rows, seed one
    if (!data || data.length === 0) {
        const { error: insertError } = await supabase
            .from('gold_settings')
            .insert({ current_rate: DEFAULT_RATE })

        if (insertError) {
            console.warn('Could not seed gold_settings:', insertError.message)
            return false
        }
    }

    return true
}

// ─── Fetch current gold rate (defensive) ────────────────────────
export async function fetchGoldRate() {
    try {
        const { data, error } = await supabase
            .from('gold_settings')
            .select('id, current_rate, last_updated_at, updated_by')
            .limit(1)

        // Table doesn't exist or query failed
        if (error) {
            console.warn('fetchGoldRate error:', error.message)
            return { id: null, current_rate: DEFAULT_RATE, last_updated_at: null, updated_by: null }
        }

        // No row → auto-seed and retry
        if (!data || data.length === 0) {
            const seeded = await ensureGoldSettingsRow()
            if (seeded) {
                const retry = await supabase
                    .from('gold_settings')
                    .select('id, current_rate, last_updated_at, updated_by')
                    .limit(1)
                if (retry.data && retry.data.length > 0) {
                    return retry.data[0]
                }
            }
            return { id: null, current_rate: DEFAULT_RATE, last_updated_at: null, updated_by: null }
        }

        return data[0]
    } catch {
        return { id: null, current_rate: DEFAULT_RATE, last_updated_at: null, updated_by: null }
    }
}

// ─── Fetch gold rate history (last 30 entries, defensive) ───────
export async function fetchGoldRateHistory(limit = 30) {
    try {
        const { data, error } = await supabase
            .from('gold_rate_history')
            .select('rate, changed_at, changed_by')
            .order('changed_at', { ascending: true })
            .limit(limit)

        if (error) {
            console.warn('gold_rate_history query error:', error.message)
            return []
        }
        return data ?? []
    } catch {
        return []
    }
}

// ─── Update gold rate (Admin only, defensive) ───────────────────
export async function updateGoldRate(rate: number, userId: string) {
    if (rate <= 0 || rate > 99999) {
        throw new Error('Gold rate must be between 0 and 99,999')
    }

    // Ensure row exists first
    await ensureGoldSettingsRow()

    // Get the row ID
    const { data: existing, error: fetchError } = await supabase
        .from('gold_settings')
        .select('id')
        .limit(1)

    if (fetchError) {
        throw new Error(`Cannot access gold_settings: ${fetchError.message}. Run the permissions fix SQL.`)
    }
    if (!existing || existing.length === 0) {
        throw new Error('No gold_settings row found. Run the migration SQL to seed the default rate.')
    }

    const rowId = existing[0].id

    const { data, error } = await supabase
        .from('gold_settings')
        .update({
            current_rate: rate,
            last_updated_at: new Date().toISOString(),
            updated_by: userId,
        })
        .eq('id', rowId)
        .select()
        .single()

    if (error) {
        throw new Error(`Failed to update gold rate: ${error.message}`)
    }
    return data
}
