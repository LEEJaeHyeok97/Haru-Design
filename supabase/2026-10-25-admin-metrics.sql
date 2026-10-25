-- 관리자 지표: 방문과 주요 요청을 events 에 기록하고, 관리자만 admin_metrics() 로 집계해 본다.
-- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.
-- 개인정보: IP·기기 정보는 남기지 않고, 브라우저마다 만든 임의의 visitor_id 만 저장한다.

create table if not exists public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  visitor_id text not null check (char_length(visitor_id) between 8 and 64),
  user_id uuid default auth.uid(),
  type text not null check (type in ('view', 'post_create', 'comment_create', 'like', 'ai_review')),
  path text check (char_length(path) <= 64),
  status smallint,
  duration_ms integer check (duration_ms between 0 and 600000)
);

create index if not exists events_created_at_idx on public.events (created_at);

alter table public.events enable row level security;

-- 누구나 기록은 할 수 있지만(자기 user_id 로만), 읽기 정책은 두지 않는다. 조회는 아래 함수로만.
drop policy if exists "anyone can insert events" on public.events;
create policy "anyone can insert events" on public.events
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

create or replace function public.admin_metrics(days integer default 14)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  first_day date;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  days := least(greatest(coalesce(days, 14), 1), 90);
  first_day := today - (days - 1);

  with ev as (
    select e.*, (e.created_at at time zone 'Asia/Seoul')::date as day
    from public.events e
    where e.created_at >= (first_day::timestamp at time zone 'Asia/Seoul')
  ),
  daily as (
    select to_char(d.day, 'YYYY-MM-DD') as day,
           count(distinct ev.visitor_id) filter (where ev.type = 'view') as visitors,
           count(ev.id) filter (where ev.type = 'view') as views
    from generate_series(first_day, today, interval '1 day') as d(day)
    left join ev on ev.day = d.day::date
    group by d.day
    order by d.day
  ),
  endpoints as (
    select type, coalesce(path, '') as path,
           count(*) as count,
           count(*) filter (where day = today) as today,
           count(*) filter (where status >= 400) as errors,
           round(avg(duration_ms))::integer as avg_ms
    from ev
    group by type, coalesce(path, '')
    order by count(*) desc
  )
  select jsonb_build_object(
    'days', days,
    'today', today,
    'daily', coalesce((select jsonb_agg(daily order by daily.day) from daily), '[]'::jsonb),
    'endpoints', coalesce((select jsonb_agg(endpoints order by endpoints.count desc) from endpoints), '[]'::jsonb),
    'range', jsonb_build_object(
      'visitors', (select count(distinct visitor_id) from ev where type = 'view'),
      'views', (select count(*) from ev where type = 'view')
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_metrics(integer) from public, anon;
grant execute on function public.admin_metrics(integer) to authenticated;
