-- Targeted, idempotent hardening; no personal records are read or deleted.
begin;
revoke all on table public.ielts_profiles, public.ielts_materials,
  public.ielts_bookings, public.ielts_rate_limits, public.ielts_verification_codes
  from public, anon, authenticated;
drop policy if exists "users create own IELTS bookings" on public.ielts_bookings;
revoke all on function public.claim_ielts_rate_limit(text, integer, integer)
  from public, anon, authenticated;
commit;
