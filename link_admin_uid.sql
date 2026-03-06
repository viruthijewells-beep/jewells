-- ═══════════════════════════════════════════════════════════════════════
-- 🔗 LINK AUTHENTICATION UID TO PUBLIC ADMIN USER
-- Run this in the Supabase SQL Editor to make the newly created 
-- auth.users account the actual Database Admin.
-- ═══════════════════════════════════════════════════════════════════════

-- Update the auto-generated ID to match your Supabase Auth UID
UPDATE public.users 
SET id = 'e8a37458-9279-474e-9509-8d2c28aa5555' 
WHERE email = 'viruthijewells@gmail.com';

-- Just to verify it worked:
SELECT id, email, name FROM public.users WHERE email = 'viruthijewells@gmail.com';
