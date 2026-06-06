-- ============================================================================
-- Learner progress + completion certificates.
--
-- Depends on 20260605120100_courses.sql:
--   public.courses(id, title), public.modules(id),
--   public.lessons(id, module_id, course_id, video_id, publish_status).
--
-- Mirrors the init model: RLS on every table, reads via the service role,
-- user-scoped read-own policies, all writes through SECURITY DEFINER RPCs /
-- triggers (EXECUTE revoked from anon + authenticated). The save RPC is the
-- single write path for the low-write progress beacon; it is idempotent
-- (UPSERT keyed (user, lesson)) so re-saves cost one row and never grow.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- lesson_progress: one row per (user, lesson). Resume position + completion.
-- Cheap to write: a single UPSERT per beacon, never grows beyond one row/lesson.
-- ---------------------------------------------------------------------------
create table public.lesson_progress (
  user_id          uuid not null references public.profiles (id) on delete cascade,
  lesson_id        uuid not null references public.lessons (id) on delete cascade,
  course_id        uuid not null references public.courses (id) on delete cascade,
  position_seconds double precision not null default 0,
  duration_seconds double precision,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- 'continue learning' + per-course rollup both query by (user, course).
create index lesson_progress_user_course_idx
  on public.lesson_progress (user_id, course_id);
create index lesson_progress_user_updated_idx
  on public.lesson_progress (user_id, updated_at desc);

alter table public.lesson_progress enable row level security;
-- Read-own only. All writes go through the service role (progress endpoint).
create policy "users read own lesson progress"
  on public.lesson_progress for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- course_progress: denormalized per-course rollup so percent reads are O(1)
-- (no fan-out COUNT on the hot account/rail path). Maintained by trigger.
-- ---------------------------------------------------------------------------
create table public.course_progress (
  user_id           uuid not null references public.profiles (id) on delete cascade,
  course_id         uuid not null references public.courses (id) on delete cascade,
  completed_lessons integer not null default 0,
  total_lessons     integer not null default 0,
  percent           integer not null default 0 check (percent between 0 and 100),
  last_lesson_id    uuid references public.lessons (id) on delete set null,
  completed_at      timestamptz,
  updated_at        timestamptz not null default now(),
  primary key (user_id, course_id)
);

create index course_progress_user_updated_idx
  on public.course_progress (user_id, updated_at desc);

alter table public.course_progress enable row level security;
create policy "users read own course progress"
  on public.course_progress for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- certificates: minted once per (user, course) at 100%. `serial` is the
-- public, immutable, shareable id used by the /cert/$serial verify page.
-- Display fields are snapshotted so a later rename can't mutate an issued cert.
-- The serial carries >=80 bits of entropy (see issue_certificate) so it can't
-- be feasibly guessed; the public cert routes are also IP-rate-limited (M2).
-- ---------------------------------------------------------------------------
create table public.certificates (
  id             uuid primary key default gen_random_uuid(),
  serial         text not null unique,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  course_id      uuid not null references public.courses (id) on delete cascade,
  recipient_name text not null default '',
  course_title   text not null default '',
  issued_at      timestamptz not null default now(),
  unique (user_id, course_id)
);

create index certificates_user_idx on public.certificates (user_id);

alter table public.certificates enable row level security;
-- Public can read by serial for verification. Only the snapshot fields
-- (recipient_name, course_title) are exposed — these are meant to appear on
-- the certificate. Serials are random (10 bytes / 80 bits) so they are not
-- enumerable, and the public cert routes rate-limit guesses by client IP (M2).
create policy "certificates are verifiable by serial"
  on public.certificates for select using (true);

-- ---------------------------------------------------------------------------
-- Recompute a user's course rollup. SECURITY DEFINER so the COUNT over
-- published lessons runs in Postgres regardless of RLS. total = published
-- lessons in the course; percent = completed / total, floored, capped at 100.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_course_progress(
  p_user_id uuid,
  p_course_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total     integer;
  v_done      integer;
  v_pct       integer;
  v_last      uuid;
  v_completed timestamptz;
begin
  -- If the course or user no longer exists, there is nothing to roll up and the
  -- course_progress upsert below would violate its FKs. This fires from the
  -- lesson_progress rollup trigger during a CASCADE delete of the course/user
  -- (parent gone before the AFTER-DELETE trigger runs) — no-op in that case so
  -- deleting a course/user that has learner progress doesn't error out.
  if not exists (select 1 from public.courses where id = p_course_id)
     or not exists (select 1 from public.profiles where id = p_user_id) then
    return;
  end if;

  select count(*) into v_total
    from public.lessons l
    where l.course_id = p_course_id
      and l.publish_status = 'published';

  select count(*) into v_done
    from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id
    where lp.user_id = p_user_id
      and lp.course_id = p_course_id
      and lp.completed_at is not null
      and l.publish_status = 'published';

  v_pct := case when v_total > 0
                then least(100, floor((v_done::numeric / v_total) * 100)::int)
                else 0 end;

  -- most-recently-touched lesson = resume target for the 'continue' rail.
  select lp.lesson_id into v_last
    from public.lesson_progress lp
    where lp.user_id = p_user_id and lp.course_id = p_course_id
    order by lp.updated_at desc
    limit 1;

  v_completed := case when v_total > 0 and v_done >= v_total then now() else null end;

  insert into public.course_progress as cp
    (user_id, course_id, completed_lessons, total_lessons, percent,
     last_lesson_id, completed_at, updated_at)
  values
    (p_user_id, p_course_id, v_done, v_total, v_pct, v_last, v_completed, now())
  on conflict (user_id, course_id) do update set
    completed_lessons = excluded.completed_lessons,
    total_lessons     = excluded.total_lessons,
    percent           = excluded.percent,
    last_lesson_id    = excluded.last_lesson_id,
    -- keep the first completion timestamp once set (don't bump on re-watch).
    completed_at      = coalesce(cp.completed_at, excluded.completed_at),
    updated_at        = now();
end;
$$;

revoke execute on function public.recompute_course_progress(uuid, uuid) from anon, authenticated;

create or replace function public.lesson_progress_rollup_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_course_progress(old.user_id, old.course_id);
  else
    perform public.recompute_course_progress(new.user_id, new.course_id);
  end if;
  return null;
end;
$$;

create trigger lesson_progress_rollup_aiud
  after insert or update or delete on public.lesson_progress
  for each row execute function public.lesson_progress_rollup_trigger();

-- keep lesson_progress.updated_at fresh on every upsert touch.
create trigger lesson_progress_set_updated_at
  before update on public.lesson_progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Atomic, idempotent progress upsert RPC. Validates the lesson actually
-- belongs to a published course server-side (client never picks course_id).
-- Returns the resulting course_progress row so the client can update the rail
-- without a second round-trip. SECURITY DEFINER + revoked from public roles.
--
-- COMPLETION IS SERVER-AUTHORITATIVE (C1/H1). The lesson's true length comes
-- from its backing video (`videos.duration`, set by the Stream webhook at
-- encode time) — NEVER from the client. The caller's `p_duration` is accepted
-- only as a fallback display hint stored in `duration_seconds`; it is IGNORED
-- for the completion decision. We also CLAMP the reported position to the real
-- duration (H1) so a forged `{position: 1e9}` beacon can't fake "watched past
-- the end". Completion is asserted only when:
--   - the backing video has a known, positive duration, AND
--   - the clamped position reaches within 5s of the end OR >= 95% of it.
-- If the video has no known duration (still processing, or no video wired up),
-- a single beacon can NOT assert completion — `v_complete` stays false.
-- ---------------------------------------------------------------------------
create or replace function public.save_lesson_progress(
  p_user_id uuid,
  p_lesson_id uuid,
  p_position double precision,
  p_duration double precision
)
returns table (course_id uuid, percent integer, completed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_duration  double precision;  -- authoritative length from the backing video
  v_position  double precision;  -- clamped to [0, v_duration]
  v_complete  boolean;
begin
  -- Authoritative lesson->course mapping + the backing video's true duration.
  -- Reject unknown/unpublished lessons. LEFT JOIN so a lesson with no video (or
  -- a video still processing) still records a position — it just can't complete.
  select l.course_id, v.duration
    into v_course_id, v_duration
    from public.lessons l
    left join public.videos v on v.id = l.video_id
    where l.id = p_lesson_id and l.publish_status = 'published';
  if v_course_id is null then
    raise exception 'lesson not found or not published' using errcode = 'P0002';
  end if;

  -- H1: never trust the client's position past the real length. Clamp to the
  -- server duration when known; otherwise just floor at 0.
  v_position := greatest(p_position, 0);
  if v_duration is not null and v_duration > 0 then
    v_position := least(v_position, v_duration);
  end if;

  -- C1: completion is decided ONLY from the server-owned duration. The client's
  -- p_duration never enters this test. No known duration => not assertible.
  v_complete := v_duration is not null and v_duration > 0
    and (v_position >= v_duration - 5 or v_position >= v_duration * 0.95);

  insert into public.lesson_progress as lp
    (user_id, lesson_id, course_id, position_seconds, duration_seconds,
     completed_at, updated_at)
  values
    (p_user_id, p_lesson_id, v_course_id,
     v_position,
     -- Prefer the authoritative video duration for the stored hint; fall back
     -- to the client value only when the video length isn't known yet.
     coalesce(v_duration, nullif(p_duration, 0)),
     case when v_complete then now() else null end, now())
  on conflict (user_id, lesson_id) do update set
    -- monotonic resume: never rewind the saved position on a stray beacon.
    position_seconds = greatest(lp.position_seconds, excluded.position_seconds),
    duration_seconds = coalesce(excluded.duration_seconds, lp.duration_seconds),
    completed_at     = coalesce(lp.completed_at,
                                case when v_complete then now() else null end),
    updated_at       = now();

  return query
    select cp.course_id, cp.percent, (cp.completed_at is not null)
    from public.course_progress cp
    where cp.user_id = p_user_id and cp.course_id = v_course_id;
end;
$$;

revoke execute on function public.save_lesson_progress(uuid, uuid, double precision, double precision) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Mint-certificate RPC: only succeeds if the course is actually 100% for the
-- user (server-checked, not client-asserted). Idempotent on (user, course):
-- a second call returns the existing serial rather than minting a new one.
-- ---------------------------------------------------------------------------
create or replace function public.issue_certificate(
  p_user_id uuid,
  p_course_id uuid
)
returns table (serial text, issued_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_done  boolean;
  v_serial text;
  v_name  text;
  v_title text;
begin
  select (cp.completed_at is not null) into v_done
    from public.course_progress cp
    where cp.user_id = p_user_id and cp.course_id = p_course_id;
  if not coalesce(v_done, false) then
    raise exception 'course not complete' using errcode = 'P0001';
  end if;

  select p.name into v_name from public.profiles p where p.id = p_user_id;
  select c.title into v_title from public.courses c where c.id = p_course_id;

  -- serial: human-shareable, collision-resistant, no PII. 10 random bytes =
  -- 80 bits of entropy (20 hex chars), well beyond online-guessing range (M2).
  v_serial := 'BTA-' || upper(encode(gen_random_bytes(10), 'hex'));

  insert into public.certificates
    (serial, user_id, course_id, recipient_name, course_title)
  values (v_serial, p_user_id, p_course_id, coalesce(v_name,''), coalesce(v_title,''))
  on conflict (user_id, course_id) do nothing;

  return query
    select c.serial, c.issued_at from public.certificates c
    where c.user_id = p_user_id and c.course_id = p_course_id;
end;
$$;

revoke execute on function public.issue_certificate(uuid, uuid) from anon, authenticated;
