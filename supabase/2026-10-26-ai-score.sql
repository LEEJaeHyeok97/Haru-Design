-- AI 평가 점수: 올라온 글마다 AI 가 한 번 채점한 결과를 저장한다.
-- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.
-- 값은 서버 함수(api/review.js 의 postId 요청)가 service_role 키로만 쓴다.

alter table public.posts
  add column if not exists ai_score integer,
  add column if not exists ai_review jsonb,
  add column if not exists ai_review_status text,
  add column if not exists ai_review_at timestamptz;

alter table public.posts drop constraint if exists posts_ai_review_status_check;
alter table public.posts
  add constraint posts_ai_review_status_check
  check (ai_review_status is null or ai_review_status in ('pending', 'done', 'failed'));

-- 일반 사용자가 insert/update 로 점수를 직접 채우지 못하게 막는다
create or replace function public.guard_ai_review()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.ai_score := null;
    new.ai_review := null;
    new.ai_review_status := null;
    new.ai_review_at := null;
  else
    new.ai_score := old.ai_score;
    new.ai_review := old.ai_review;
    new.ai_review_status := old.ai_review_status;
    new.ai_review_at := old.ai_review_at;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_guard_ai_review on public.posts;
create trigger posts_guard_ai_review
  before insert or update on public.posts
  for each row execute function public.guard_ai_review();
