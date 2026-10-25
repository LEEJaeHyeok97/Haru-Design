    -- 스폰서 칸 2: 여러 광고를 순서대로 보여주고, 광고마다 이미지 비율·맞춤·보일 위치를 정한다.
    -- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.
    -- (2026-10-25-sponsors.sql 을 먼저 실행해 둔 상태여야 합니다)

    alter table public.sponsors
      add column if not exists sort_order integer not null default 0,
      -- { ratio: 'auto' | '1.91' | '4/3' | '1', fit: 'cover' | 'contain', x: 0~100, y: 0~100 }
      add column if not exists image_style jsonb;
