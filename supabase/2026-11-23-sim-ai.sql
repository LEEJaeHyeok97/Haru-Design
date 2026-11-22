-- 설계 시뮬레이션 3단계: 문제마다 AI 가 만든 시뮬레이션 상황을 한 번만 만들어 저장한다.
-- 값은 서버 함수(api/simulate.js)가 service_role 키로만 쓴다. 관리자가 문제 제목·설명을 고치면 다시 만들도록 비운다.
-- AI 해설 실행은 events.type 'simulate'(path 'explain')로 남기므로 이벤트 종류는 그대로다.
-- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.

alter table public.topics
  add column if not exists sim_scenario jsonb,
  add column if not exists sim_scenario_status text,
  add column if not exists sim_scenario_at timestamptz;

alter table public.topics drop constraint if exists topics_sim_scenario_status_check;
alter table public.topics
  add constraint topics_sim_scenario_status_check
  check (sim_scenario_status is null or sim_scenario_status in ('pending', 'done', 'failed'));

create or replace function public.guard_sim_scenario()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.sim_scenario := null;
    new.sim_scenario_status := null;
    new.sim_scenario_at := null;
  elsif new.title is distinct from old.title or new.description is distinct from old.description then
    -- 문제가 바뀌었으니 다음에 다시 만든다
    new.sim_scenario := null;
    new.sim_scenario_status := null;
    new.sim_scenario_at := null;
  else
    new.sim_scenario := old.sim_scenario;
    new.sim_scenario_status := old.sim_scenario_status;
    new.sim_scenario_at := old.sim_scenario_at;
  end if;
  return new;
end;
$$;

drop trigger if exists topics_guard_sim_scenario on public.topics;
create trigger topics_guard_sim_scenario
  before insert or update on public.topics
  for each row execute function public.guard_sim_scenario();
