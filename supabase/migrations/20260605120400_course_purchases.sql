-- ============================================================================
-- course_purchases (one-time course purchases)
--
-- A course is sellable as a single product (courses.access = 'purchase',
-- courses.polar_product_id set). The existing `public.purchases` table is hard-
-- keyed to a video (PK (user_id, video_id), FK -> videos), so it cannot record
-- a course-level entitlement. This is the course analogue: one row per
-- (user, course), written by the Polar webhook on `order.paid`, read by the
-- course-access resolver (entitlements.resolveCourseAccess ->
-- hasPurchasedCourse).
--
-- RLS model is identical to public.purchases: enabled, deny-by-default, the
-- buyer may read their own rows, and all writes go through the service role
-- (the webhook handler). Nothing here is writable by anon/authenticated.
-- ============================================================================
create table public.course_purchases (
  user_id          uuid not null references public.profiles (id) on delete cascade,
  course_id        uuid not null references public.courses (id) on delete cascade,
  polar_order_id   text,
  amount           integer not null default 0,
  currency         text not null default 'usd',
  created_at       timestamptz not null default now(),
  primary key (user_id, course_id)
);

-- 'my courses' / entitlement lookups query by buyer.
create index course_purchases_user_idx on public.course_purchases (user_id);

alter table public.course_purchases enable row level security;

create policy "users read own course purchases"
  on public.course_purchases for select using (auth.uid() = user_id);
