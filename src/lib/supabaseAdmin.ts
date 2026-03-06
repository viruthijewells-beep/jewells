import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

/**
 * Admin Supabase client using the Service Role Key.
 * This bypasses RLS and can create auth users directly.
 * Used as a fallback when edge functions are not deployed.
 *
 * ⚠️  Only use for admin operations (user creation, password reset).
 */
export const supabaseAdmin = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
    : null

/**
 * Create a new auth user + profile in one step.
 * Uses direct Admin API — no edge function required.
 */
export async function adminCreateUser(params: {
    email: string
    password: string
    name: string
    role_id: string
    branch_id?: string | null
}) {
    if (!supabaseAdmin) {
        throw new Error(
            'Service role key not configured. Add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env file.'
        )
    }

    // Step 1: Create auth user
    const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
            email: params.email,
            password: params.password,
            email_confirm: true,
            user_metadata: { name: params.name },
        })

    if (authError) throw authError

    // Step 2: Insert user profile
    const { error: dbError } = await supabaseAdmin.from('users').insert({
        id: authData.user.id,
        email: params.email,
        name: params.name,
        role_id: params.role_id,
        branch_id: params.branch_id || null,
    })

    if (dbError) {
        // Rollback: delete auth user if profile insert fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        throw dbError
    }

    return { success: true, user: authData.user }
}

/**
 * Reset a user's password directly via Admin API.
 */
export async function adminResetPassword(userId: string, newPassword: string) {
    if (!supabaseAdmin) {
        throw new Error(
            'Service role key not configured. Add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env file.'
        )
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
    })

    if (error) throw error
    return { success: true }
}
