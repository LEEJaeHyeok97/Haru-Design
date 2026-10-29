-- 개발자 혼내러가기: 상단 버튼 창에서 남긴 건의·문의·개선 의견을 저장하고, 관리자만 본다.
-- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('suggest', 'question', 'improve')),
  body text not null check (char_length(body) between 1 and 2000),
  contact text check (char_length(contact) <= 254),
  nickname text check (char_length(nickname) <= 20),
  user_id uuid default auth.uid()
);

alter table public.feedback enable row level security;

-- 누구나 남길 수 있지만(자기 user_id 로만), 읽기·삭제는 관리자만
drop policy if exists "anyone sends feedback" on public.feedback;
create policy "anyone sends feedback" on public.feedback
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "admins read feedback" on public.feedback;
create policy "admins read feedback" on public.feedback
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admins delete feedback" on public.feedback;
create policy "admins delete feedback" on public.feedback
  for delete to authenticated
  using (public.is_admin());

-- 운영 지표에 '의견 남기기' 를 더한다 (앞선 sponsor_click 까지 포함)
alter table public.events drop constraint if exists events_type_check;
alter table public.events
  add constraint events_type_check
  check (type in ('view', 'post_create', 'comment_create', 'like', 'ai_review', 'subscribe', 'sponsor_click', 'feedback'));
