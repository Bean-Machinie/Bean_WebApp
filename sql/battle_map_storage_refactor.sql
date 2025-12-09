-- Battle map widget storage refactor
-- Run this in Supabase SQL editor or psql. Safe to re-run.

create extension if not exists "pgcrypto";

begin;

create table if not exists public.battle_map_configs (
  project_id uuid primary key references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  grid_columns integer not null default 12,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.battle_map_widgets (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  x integer not null default 0,
  y integer not null default 0,
  w integer not null default 1,
  h integer not null default 1,
  content text not null default '',
  sort_index integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists battle_map_widgets_project_idx
  on public.battle_map_widgets(project_id, user_id, sort_index);

create index if not exists battle_map_widgets_updated_idx
  on public.battle_map_widgets(updated_at desc);

alter table public.battle_map_configs enable row level security;
alter table public.battle_map_widgets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'battle_map_configs' and policyname = 'Owners manage battle map configs'
  ) then
    create policy "Owners manage battle map configs"
      on public.battle_map_configs
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'battle_map_widgets' and policyname = 'Owners manage battle map widgets'
  ) then
    create policy "Owners manage battle map widgets"
      on public.battle_map_widgets
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Backfill from legacy projects.battle_map_config JSON column
insert into public.battle_map_configs (project_id, user_id, grid_columns, version, updated_at)
select
  p.id as project_id,
  p.user_id,
  coalesce((p.battle_map_config->>'gridColumns')::integer, 12) as grid_columns,
  1 as version,
  now() as updated_at
from public.projects p
where p.project_type = 'battle-maps'
  and p.battle_map_config is not null
on conflict (project_id) do update
set grid_columns = excluded.grid_columns,
    updated_at = now(),
    version = public.battle_map_configs.version + 1;

with legacy_widgets as (
  select
    p.id as project_id,
    p.user_id,
    widgets.elem as widget,
    widgets.ordinality - 1 as sort_index
  from public.projects p
  cross join lateral jsonb_array_elements(coalesce(p.battle_map_config->'widgets', '[]'::jsonb)) with ordinality as widgets(elem, ordinality)
  where p.project_type = 'battle-maps'
    and p.battle_map_config is not null
)
insert into public.battle_map_widgets (id, project_id, user_id, x, y, w, h, content, sort_index, updated_at)
select
  coalesce((widget->>'id')::uuid, gen_random_uuid()) as id,
  project_id,
  user_id,
  coalesce((widget->>'x')::integer, 0) as x,
  coalesce((widget->>'y')::integer, 0) as y,
  coalesce((widget->>'w')::integer, 1) as w,
  coalesce((widget->>'h')::integer, 1) as h,
  coalesce(widget->>'content', '') as content,
  sort_index,
  now() as updated_at
from legacy_widgets
on conflict (id) do update
set
  x = excluded.x,
  y = excluded.y,
  w = excluded.w,
  h = excluded.h,
  content = excluded.content,
  sort_index = excluded.sort_index,
  updated_at = excluded.updated_at;

commit;
