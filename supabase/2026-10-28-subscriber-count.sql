-- 구독자 수 공개: 상단 구독 공지에 "N명이 받아보고 있어요"를 보여준다.
-- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.
-- subscribers 는 관리자만 읽을 수 있으므로, 이메일은 감춘 채 숫자만 돌려주는 함수를 연다.

create or replace function public.subscriber_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.subscribers;
$$;

revoke all on function public.subscriber_count() from public;
grant execute on function public.subscriber_count() to anon, authenticated;
