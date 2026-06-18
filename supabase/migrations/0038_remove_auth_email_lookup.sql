-- Linted 0038: remove public-signup email enumeration support.
-- The app must not expose account existence, confirmation status, or providers
-- before a user proves control of an identity.

drop function if exists public.get_auth_email_state(text);

notify pgrst, 'reload schema';
