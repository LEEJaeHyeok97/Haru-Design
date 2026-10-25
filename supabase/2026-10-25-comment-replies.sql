-- 대댓글: 댓글에 parent_id 를 두고, 한 단계(댓글 → 답글)까지만 허용한다.
-- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.

alter table public.comments
  add column if not exists parent_id bigint references public.comments(id) on delete cascade;

create index if not exists comments_parent_id_idx on public.comments (parent_id);

-- 답글은 같은 글의 최상위 댓글에만 달 수 있다
create or replace function public.check_comment_parent()
returns trigger
language plpgsql
as $$
declare
  parent record;
begin
  if new.parent_id is null then
    return new;
  end if;
  select post_id, parent_id into parent from public.comments where id = new.parent_id;
  if not found then
    raise exception 'parent comment not found';
  end if;
  if parent.post_id <> new.post_id then
    raise exception 'parent comment belongs to another post';
  end if;
  if parent.parent_id is not null then
    raise exception 'replies can only be one level deep';
  end if;
  return new;
end;
$$;

drop trigger if exists comments_check_parent on public.comments;
create trigger comments_check_parent
  before insert or update of parent_id, post_id on public.comments
  for each row execute function public.check_comment_parent();
