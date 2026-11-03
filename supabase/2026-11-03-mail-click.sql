-- 문제 메일 유입: 메일 속 링크(?from=mail&d=날짜)로 들어온 방문을 운영 지표에 mail_click 으로 남긴다.
-- path 는 메일 날짜(지난 문제 링크면 '날짜 archive'). 새 테이블은 없다.
-- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다. (ai_interview 까지 포함)
alter table public.events drop constraint if exists events_type_check;
alter table public.events
  add constraint events_type_check
  check (type in ('view', 'post_create', 'comment_create', 'like', 'ai_review', 'subscribe', 'sponsor_click', 'feedback', 'ai_interview', 'mail_click'));
