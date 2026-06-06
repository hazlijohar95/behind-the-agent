-- ============================================================================
-- C1 (CRITICAL) privilege-escalation lockdown.
--
-- The init schema's "users can update own profile" policy only checked
-- `auth.uid() = id`, which let an authenticated user UPDATE *any* column of
-- their own profiles row through the public Data API — including `role` and
-- `banned`. A user could therefore self-promote to admin or self-unban with a
-- single PostgREST request.
--
-- Authoritative role/ban writes already go exclusively through the service
-- role (profiles.setRole / profiles.setBanned), so end users never need to
-- mutate those two columns. We replace the policy with one whose WITH CHECK
-- equality-guards `role` and `banned` against their currently-persisted values
-- (read back via a SECURITY DEFINER helper, so the guard itself is not subject
-- to RLS recursion). A self-update that leaves role/banned untouched still
-- succeeds; any attempt to change them is rejected.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Read the caller's own current role/banned, bypassing RLS, for use inside the
-- profiles UPDATE policy. SECURITY DEFINER + a pinned search_path; STABLE so it
-- can be referenced from the WITH CHECK expression without re-evaluation churn.
-- Revoked from anon/authenticated as a Data-API callable function: it is only
-- ever invoked implicitly by the policy under the table owner's rights.
-- ---------------------------------------------------------------------------
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_profile_banned()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select banned from public.profiles where id = auth.uid();
$$;

revoke execute on function public.current_profile_role() from anon, authenticated;
revoke execute on function public.current_profile_banned() from anon, authenticated;

-- Replace the over-broad self-update policy.
drop policy if exists "users can update own profile" on public.profiles;

create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- role and banned must equal their currently-stored values: a self-update
    -- can edit name/image/email but can never change authorization state.
    and role = public.current_profile_role()
    and banned = public.current_profile_banned()
  );
