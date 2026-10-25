-- 스폰서 칸: 관리자가 등록한 광고를 화면 오른쪽(좁은 화면은 본문 아래)에 띄운다.
-- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.
-- 이미지는 기존 designs 버킷에 관리자 id 폴더로 올라간다 (글 이미지와 같은 방식).

create table if not exists public.sponsors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  title text not null check (char_length(title) between 1 and 60),
  body text check (char_length(body) <= 200),
  link_url text not null check (link_url ~* '^https?://' and char_length(link_url) <= 500),
  image_path text,
  active boolean not null default true
);

alter table public.sponsors enable row level security;

-- 켜진 광고는 누구나 보고, 꺼진 것까지 보기·등록·수정·삭제는 관리자만
drop policy if exists "anyone reads active sponsors" on public.sponsors;
create policy "anyone reads active sponsors" on public.sponsors
  for select to anon, authenticated
  using (active or public.is_admin());

drop policy if exists "admins manage sponsors" on public.sponsors;
create policy "admins manage sponsors" on public.sponsors
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 운영 지표에 '스폰서 클릭' 을 더한다 (앞선 subscribe 까지 포함)
alter table public.events drop constraint if exists events_type_check;
alter table public.events
  add constraint events_type_check
  check (type in ('view', 'post_create', 'comment_create', 'like', 'ai_review', 'subscribe', 'sponsor_click'));
