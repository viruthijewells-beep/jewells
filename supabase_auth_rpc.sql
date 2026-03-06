-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- This creates a login RPC function that checks bcrypt passwords server-side

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION authenticate_user(user_email TEXT, user_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  found_user RECORD;
  is_valid BOOLEAN := FALSE;
BEGIN
  -- Find user by email (with role)
  SELECT u.id, u.email, u.name, u.password, u."branchId",
         r.name AS role_name
  INTO found_user
  FROM "User" u
  LEFT JOIN "Role" r ON u."roleId" = r.id
  WHERE u.email = user_email
  LIMIT 1;

  IF found_user IS NULL THEN
    RETURN json_build_object('error', 'Invalid credentials');
  END IF;

  -- Check password: bcrypt hash or plain text fallback
  IF found_user.password LIKE '$2%' THEN
    -- bcrypt comparison using pgcrypto
    is_valid := (found_user.password = crypt(user_password, found_user.password));
  ELSE
    -- Plain text fallback
    is_valid := (found_user.password = user_password);
  END IF;

  IF NOT is_valid THEN
    RETURN json_build_object('error', 'Invalid credentials');
  END IF;

  -- Return user profile (no password)
  RETURN json_build_object(
    'id', found_user.id,
    'email', found_user.email,
    'name', found_user.name,
    'role', found_user.role_name,
    'branchId', found_user."branchId"
  );
END;
$$;
