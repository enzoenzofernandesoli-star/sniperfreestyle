alter table public.placar_sobrecarga
  add column if not exists conta_id bigint references public.contas_jogador(id) on delete set null;

create index if not exists placar_sobrecarga_conta_temporada_idx
  on public.placar_sobrecarga (conta_id, temporada, pontos desc)
  where conta_id is not null;
