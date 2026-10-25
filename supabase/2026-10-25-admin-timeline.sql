-- 요청 모니터링: 관리자 페이지에서 요청을 시간대별로 보고, 최근 요청 로그를 본다.
-- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.
-- (2026-10-25-admin-metrics.sql 의 events 테이블과 is_admin() 을 쓴다)

create or replace function public.admin_timeline(hours integer default 24)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- 24시간은 1시간, 7일은 6시간, 30일은 1일 단위. 한국 시간 0시에 맞춰 자른다.
  bucket integer;
  since timestamptz;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  hours := case when hours <= 24 then 24 when hours <= 168 then 168 else 720 end;
  bucket := case hours when 24 then 3600 when 168 then 21600 else 86400 end;
  since := to_timestamp(floor((extract(epoch from now()) + 32400) / bucket) * bucket - 32400) - make_interval(secs => bucket * (hours * 3600 / bucket - 1));

  with ev as (
    select e.*, (floor((extract(epoch from e.created_at) + 32400) / bucket) * bucket - 32400)::bigint * 1000 as ts
    from public.events e
    where e.created_at >= since
  ),
  series as (
    select ts, type, count(*) as count, count(*) filter (where status >= 400) as errors
    from ev
    group by ts, type
  ),
  recent as (
    select created_at, type, coalesce(path, '') as path, status, duration_ms,
           left(visitor_id, 6) as visitor, user_id is not null as signed_in
    from ev
    order by created_at desc
    limit 200
  )
  select jsonb_build_object(
    'hours', hours,
    'bucket_ms', bucket * 1000,
    'since', (extract(epoch from since) * 1000)::bigint,
    'series', coalesce((select jsonb_agg(series order by series.ts) from series), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(recent order by recent.created_at desc) from recent), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_timeline(integer) from public, anon;
grant execute on function public.admin_timeline(integer) to authenticated;
