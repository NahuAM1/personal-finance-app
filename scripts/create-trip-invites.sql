-- ============================================
-- Trip invitations for registered users
-- Run this in the Supabase SQL Editor AFTER migrate-split-to-trips.sql
-- and create-notifications-table.sql.
-- ============================================

-- Resolves a registered user's id from their email.
-- SECURITY DEFINER because auth.users is not readable by API roles.
-- Only the service role (server-side API routes) may execute it, so clients
-- cannot use it to enumerate registered emails.
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO service_role;

-- Speeds up finding the invitation notification of a given trip member.
CREATE INDEX IF NOT EXISTS idx_notifications_member_id
  ON public.notifications ((data->>'member_id'))
  WHERE type = 'trip_invite';
