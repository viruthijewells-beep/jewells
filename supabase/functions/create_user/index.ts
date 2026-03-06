import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Initialize Supabase admin client to bypass RLS and create Auth users
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const body = await req.json()

        // Handle password reset action
        if (body.action === 'reset_password') {
            const { user_id, password } = body
            if (!user_id || !password) {
                return new Response(JSON.stringify({ error: 'Missing user_id or password' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                })
            }
            const { error } = await supabaseClient.auth.admin.updateUserById(user_id, { password })
            if (error) throw error
            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        const { email, password, role_id, branch_id, name } = body

        if (!email || !password || !role_id || !name) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            })
        }

        // 1. Create the user in Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name }
        })

        if (authError) throw authError

        // 2. Insert into the public.users table (keeping IDs in sync)
        const { error: dbError } = await supabaseClient.from('users').insert({
            id: authData.user.id,
            email,
            name,
            role_id,
            branch_id: branch_id || null, // null if Super Admin/global manager
        })

        if (dbError) {
            // Rollback: delete from auth if public table insert fails
            await supabaseClient.auth.admin.deleteUser(authData.user.id)
            throw dbError
        }

        return new Response(JSON.stringify({ success: true, user: authData.user }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
