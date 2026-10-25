-- AI 아키텍처: 다이어그램 없이 올라온 글에 AI 가 그린 그림을 저장한다.
-- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.
-- 값은 서버 함수(api/diagram.js)가 service_role 키로만 쓴다.

alter table public.posts
  add column if not exists ai_diagram jsonb,
  add column if not exists ai_diagram_status text,
  add column if not exists ai_diagram_at timestamptz;

alter table public.posts drop constraint if exists posts_ai_diagram_status_check;
alter table public.posts
  add constraint posts_ai_diagram_status_check
  check (ai_diagram_status is null or ai_diagram_status in ('pending', 'done', 'failed'));

-- 일반 사용자가 insert/update 로 AI 컬럼을 직접 채우지 못하게 막는다
create or replace function public.guard_ai_diagram()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.ai_diagram := null;
    new.ai_diagram_status := null;
    new.ai_diagram_at := null;
  else
    new.ai_diagram := old.ai_diagram;
    new.ai_diagram_status := old.ai_diagram_status;
    new.ai_diagram_at := old.ai_diagram_at;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_guard_ai_diagram on public.posts;
create trigger posts_guard_ai_diagram
  before insert or update on public.posts
  for each row execute function public.guard_ai_diagram();
