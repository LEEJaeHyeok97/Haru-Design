    -- 이메일 구독: 상단 공지에서 남긴 이메일을 저장하고, 관리자만 본다.
    -- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.

    create table if not exists public.subscribers (
      id bigint generated always as identity primary key,
      created_at timestamptz not null default now(),
      email text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
      user_id uuid default auth.uid()
    );

    -- 대소문자만 다른 같은 주소는 한 번만 받는다
    create unique index if not exists subscribers_email_key on public.subscribers (lower(email));

    alter table public.subscribers enable row level security;

    -- 누구나 남길 수 있지만(자기 user_id 로만), 읽기·삭제는 관리자만
    drop policy if exists "anyone can subscribe" on public.subscribers;
    create policy "anyone can subscribe" on public.subscribers
      for insert to anon, authenticated
      with check (user_id is null or user_id = auth.uid());

    drop policy if exists "admins read subscribers" on public.subscribers;
    create policy "admins read subscribers" on public.subscribers
      for select to authenticated
      using (public.is_admin());

    drop policy if exists "admins delete subscribers" on public.subscribers;
    create policy "admins delete subscribers" on public.subscribers
      for delete to authenticated
      using (public.is_admin());

    -- 운영 지표에 '이메일 구독' 요청을 더한다
    alter table public.events drop constraint if exists events_type_check;
    alter table public.events
      add constraint events_type_check
      check (type in ('view', 'post_create', 'comment_create', 'like', 'ai_review', 'subscribe'));
