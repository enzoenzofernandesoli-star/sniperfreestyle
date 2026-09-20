begin;

alter table public.contas_jogador
  add column if not exists classes_desbloqueadas text[] not null default '{}';

alter table public.contas_jogador
  drop constraint if exists contas_jogador_classes_validas;
alter table public.contas_jogador
  add constraint contas_jogador_classes_validas check (
    classes_desbloqueadas <@ array['classe-espectro', 'classe-invocador', 'classe-desenvolvedor']::text[]
  );

alter table public.placar_sobrecarga
  drop constraint if exists placar_sobrecarga_classe_check;
alter table public.placar_sobrecarga
  add constraint placar_sobrecarga_classe_check check (
    classe = any (array['SNIPER', 'GUARDIÃO', 'ESPECTRO', 'ARCANO', 'INVOCADOR', 'DESENVOLVEDOR'])
  );

commit;
