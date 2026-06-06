-- ============================================================================
-- Courses / Modules / Lessons.
--
-- The init schema shipped a FLAT `videos` table only; the product promises
-- "videos & courses". This migration adds the structured course hierarchy that
-- the progress + certificates migration (20260605120200) and the course-level
-- entitlements resolver depend on:
--
--   courses  1───*  modules  1───*  lessons
--                                      │
--                                      └── video_id ──► videos (playback)
--
-- A lesson plays an existing `videos` row (reusing Stream playback, signing,
-- thumbnails, view/like counters). lessons.course_id is denormalised from the
-- parent module so progress FKs/rollups stay O(1) and the save/recompute RPCs
-- can bind directly to (user, course). A trigger keeps that denormalised
-- column honest. Access/monetization mirror the videos vocabulary
-- (free | subscribers | purchase) so the entitlements logic is uniform.
--
-- RLS model matches the init schema exactly: enabled on every table,
-- deny-by-default, with anon SELECT only for content belonging to a
-- *published + public* course. All writes go through the service role.
-- ============================================================================

-- ===========================================================================
-- courses
-- ===========================================================================
create table public.courses (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  slug              text not null unique,
  description       text not null default '',
  -- markdown body for a rich course landing page (sanitized on render, M4).
  body              text not null default '',
  custom_poster_url text,
  -- reuse the videos publish lifecycle so scheduling/cron treat them alike.
  publish_status    text not null default 'draft'
                      check (publish_status in ('draft','scheduled','published')),
  visibility        text not null default 'public'
                      check (visibility in ('public','unlisted')),
  -- monetization, identical vocabulary to public.videos.access.
  access            text not null default 'free'
                      check (access in ('free','subscribers','purchase')),
  required_plan_ids text[] not null default '{}',
  polar_product_id  text,
  price_amount      integer,
  -- drip: when true, lessons unlock progressively per lesson.drip_days.
  drip_enabled      boolean not null default false,
  category_id       uuid references public.categories (id) on delete set null,
  tags              text[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  publish_at        timestamptz,
  published_at      timestamptz,
  search            tsvector generated always as (
                      to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,''))
                    ) stored
);

create index courses_published_at_idx   on public.courses (published_at desc nulls last);
create index courses_created_at_idx      on public.courses (created_at desc);
create index courses_publish_status_idx  on public.courses (publish_status);
create index courses_category_idx        on public.courses (category_id);
create index courses_tags_idx            on public.courses using gin (tags);
create index courses_search_idx          on public.courses using gin (search);

alter table public.courses enable row level security;

-- Public can read published, public-visibility courses. Unlisted courses are
-- reachable by direct slug through the service role but not listed via the API.
create policy "published courses are public"
  on public.courses for select
  using (publish_status = 'published' and visibility = 'public');

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- modules (ordered sections within a course)
-- ===========================================================================
create table public.modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  title       text not null,
  description text not null default '',
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index modules_course_position_idx on public.modules (course_id, position);

alter table public.modules enable row level security;

-- A module is visible iff its course is published + public.
create policy "modules of published courses are public"
  on public.modules for select
  using (
    exists (
      select 1 from public.courses c
      where c.id = modules.course_id
        and c.publish_status = 'published'
        and c.visibility = 'public'
    )
  );

create trigger modules_set_updated_at
  before update on public.modules
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- lessons (ordered items within a module; each plays one video)
-- ===========================================================================
create table public.lessons (
  id             uuid primary key default gen_random_uuid(),
  module_id      uuid not null references public.modules (id) on delete cascade,
  -- denormalised parent course, kept in sync by the trigger below. Progress
  -- tables FK this directly so per-course rollups never need a module join.
  course_id      uuid not null references public.courses (id) on delete cascade,
  -- the video this lesson plays. set null (not cascade) so deleting a video
  -- leaves the lesson shell rather than silently dropping curriculum.
  video_id       uuid references public.videos (id) on delete set null,
  title          text not null,
  description    text not null default '',
  slug           text not null,
  position       integer not null default 0,
  publish_status text not null default 'draft'
                   check (publish_status in ('draft','scheduled','published')),
  -- drip: days after course start before this lesson unlocks (0 = immediate).
  drip_days      integer not null default 0 check (drip_days >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- lesson slugs are unique within a course (stable deep-link target).
  unique (course_id, slug)
);

create index lessons_module_position_idx on public.lessons (module_id, position);
create index lessons_course_idx          on public.lessons (course_id);
create index lessons_course_published_idx on public.lessons (course_id, publish_status);
create index lessons_video_idx           on public.lessons (video_id);

alter table public.lessons enable row level security;

-- A lesson is visible iff it is published AND its course is published + public.
-- (Gating of *playback* for paid courses happens server-side in the watch
-- loader via resolveCourseAccess; this policy only governs metadata listing.)
create policy "published lessons of published courses are public"
  on public.lessons for select
  using (
    lessons.publish_status = 'published'
    and exists (
      select 1 from public.courses c
      where c.id = lessons.course_id
        and c.publish_status = 'published'
        and c.visibility = 'public'
    )
  );

create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Keep lessons.course_id consistent with the parent module's course, so the
-- denormalised column (relied on by progress FKs + the save/recompute RPCs)
-- can never drift from the module hierarchy, even on a service-role write.
-- ---------------------------------------------------------------------------
create or replace function public.lessons_sync_course_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select m.course_id into new.course_id
    from public.modules m where m.id = new.module_id;
  if new.course_id is null then
    raise exception 'lesson module % has no course', new.module_id
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create trigger lessons_sync_course_id_biu
  before insert or update of module_id on public.lessons
  for each row execute function public.lessons_sync_course_id();
