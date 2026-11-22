-- 구독 카드의 "OO에 다니는 분들도 받아보고 있어요" 에 돌아가며 보여줄 회사 이름.
-- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.
-- 관리자 페이지의 '이메일 구독자' 칸에서 회사 이름만 넣고 뺀다. 읽기는 누구나.

create table if not exists public.sub_companies (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null unique check (char_length(name) between 1 and 30)
);

alter table public.sub_companies enable row level security;

drop policy if exists "anyone reads sub companies" on public.sub_companies;
create policy "anyone reads sub companies" on public.sub_companies
  for select to anon, authenticated
  using (true);

drop policy if exists "admins add sub companies" on public.sub_companies;
create policy "admins add sub companies" on public.sub_companies
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "admins delete sub companies" on public.sub_companies;
create policy "admins delete sub companies" on public.sub_companies
  for delete to authenticated
  using (public.is_admin());
