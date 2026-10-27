-- 문제 메일 발송 기록: 매일 오전 9시 구독자에게 보내는 메일을 문제마다 한 번만 보내게 한다.
-- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.
-- 쓰기는 서버 함수(api/newsletter.js)가 service_role 키로만 한다. 관리자는 마지막 발송 결과를 볼 수 있다.

create table if not exists public.newsletter_sends (
  topic_id bigint primary key references public.topics (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  sent integer not null default 0,
  failed integer not null default 0,
  error text
);

alter table public.newsletter_sends enable row level security;

drop policy if exists "admins read newsletter sends" on public.newsletter_sends;
create policy "admins read newsletter sends" on public.newsletter_sends
  for select to authenticated
  using (public.is_admin());
