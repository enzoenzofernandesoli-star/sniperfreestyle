create table if not exists public.compras_google_play (
  token_hash text primary key,
  instalacao text not null,
  produto text not null check (produto in ('nucleus_700', 'nucleus_1500', 'nucleus_2200')),
  nucleus integer not null check (nucleus in (700, 1500, 2200)),
  pedido_google text not null default '',
  criado_em timestamptz not null default now()
);

revoke all on public.compras_google_play from public, anonymous;
