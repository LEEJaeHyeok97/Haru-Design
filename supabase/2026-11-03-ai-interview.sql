-- AI와 대화하며 쓰기: 운영 지표에 'AI 대화'(ai_interview, path 는 turn | finish) 를 더한다.
-- 대화 내용은 저장하지 않으므로 새 테이블은 없다.
-- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.
alter table public.events drop constraint if exists events_type_check;
alter table public.events
  add constraint events_type_check
  check (type in ('view', 'post_create', 'comment_create', 'like', 'ai_review', 'subscribe', 'sponsor_click', 'feedback', 'ai_interview'));
