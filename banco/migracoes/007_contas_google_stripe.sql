create table if not exists public.contas_jogador (
  id uuid primary key,
  google_sub text not null unique,
  nome text not null check (char_length(nome) between 1 and 80),
  email text not null check (char_length(email) between 3 and 254),
  foto text not null default '',
  nucleus bigint not null default 0 check (nucleus >= 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.sessoes_jogador (
  token_hash char(64) primary key,
  conta_id uuid not null references public.contas_jogador(id) on delete cascade,
  expira_em timestamptz not null,
  criado_em timestamptz not null default now()
);

create index if not exists sessoes_jogador_conta on public.sessoes_jogador(conta_id);
create index if not exists sessoes_jogador_expira on public.sessoes_jogador(expira_em);

create table if not exists public.compras_stripe (
  sessao_stripe text primary key,
  conta_id uuid not null references public.contas_jogador(id),
  produto text not null check (produto in ('nucleus_700', 'nucleus_1500', 'nucleus_2200')),
  nucleus integer not null check (nucleus in (700, 1500, 2200)),
  criado_em timestamptz not null default now()
);

revoke all on public.contas_jogador from public, anonymous;
revoke all on public.sessoes_jogador from public, anonymous;
revoke all on public.compras_stripe from public, anonymous;
