-- 설계 시뮬레이션 2단계
-- 1) 캔버스로 그려 올린 글은 그림 데이터(JSON)도 posts.diagram 에 함께 저장해, 다른 사람도 그 설계를 시뮬레이션해 볼 수 있게 한다.
--    (컬럼이 없어도 앱은 그림 데이터 없이 올리므로 깨지지 않는다)
-- 2) 시뮬레이션 실행을 운영 지표에 simulate 로 남긴다. path 는 'canvas'(내 설계) 또는 'post'(올라온 설계).
-- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다. (mail_click 까지 포함)

alter table public.posts add column if not exists diagram jsonb;

alter table public.posts drop constraint if exists posts_diagram_check;
alter table public.posts
  add constraint posts_diagram_check
  check (diagram is null or (jsonb_typeof(diagram) = 'object' and pg_column_size(diagram) <= 32768));

alter table public.events drop constraint if exists events_type_check;
alter table public.events
  add constraint events_type_check
  check (type in ('view', 'post_create', 'comment_create', 'like', 'ai_review', 'subscribe', 'sponsor_click', 'feedback', 'ai_interview', 'mail_click', 'simulate'));
