-- Três coisas que o placar precisava para acompanhar o jogo:
--   1. a classe INVOCADOR, que não existia quando a tabela nasceu e por isso
--      fazia toda run dela ser recusada pelo CHECK;
--   2. o teto de onda 100, que é onde a corrida termina hoje;
--   3. acesso pelo Neon Data API: leitura pública do ranking e gravação de uma
--      linha por vez, com as CHECKs fazendo o papel que a API fazia no servidor.
BEGIN;

ALTER TABLE public.placar_sobrecarga
  DROP CONSTRAINT IF EXISTS placar_sobrecarga_classe_check;
ALTER TABLE public.placar_sobrecarga
  ADD CONSTRAINT placar_sobrecarga_classe_check
  CHECK (classe = ANY (ARRAY['SNIPER', 'GUARDIÃO', 'ESPECTRO', 'ARCANO', 'INVOCADOR']));

ALTER TABLE public.placar_sobrecarga
  DROP CONSTRAINT IF EXISTS placar_sobrecarga_onda_40_check;
ALTER TABLE public.placar_sobrecarga
  DROP CONSTRAINT IF EXISTS placar_sobrecarga_onda_infinita_check;
ALTER TABLE public.placar_sobrecarga
  ADD CONSTRAINT placar_sobrecarga_onda_check CHECK (onda BETWEEN 1 AND 100);

-- Nome continua limitado, mas agora a regra mora no banco e não só na API:
-- sem espaço duplo, sem caractere fora da faixa e sempre em maiúsculas.
ALTER TABLE public.placar_sobrecarga
  DROP CONSTRAINT IF EXISTS placar_sobrecarga_nome_check;
ALTER TABLE public.placar_sobrecarga
  ADD CONSTRAINT placar_sobrecarga_nome_check
  CHECK (nome ~ '^[A-Z0-9 ._-]{1,12}$');

COMMIT;

-- Acesso pelo Data API (aplicado em 15/09/2026). O papel `anonymous` do Neon
-- recebe o mínimo: ler tudo, inserir uma linha que passe nas checagens, e nada
-- mais. Sem grant de UPDATE/DELETE, sem poder escrever id nem criado_em.
ALTER TABLE public.placar_sobrecarga ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO anonymous;
GRANT SELECT ON public.placar_sobrecarga TO anonymous;
GRANT INSERT (nome, pontos, classe, onda, nivel, tempo, abates, venceu)
  ON public.placar_sobrecarga TO anonymous;

DROP POLICY IF EXISTS placar_leitura_publica ON public.placar_sobrecarga;
CREATE POLICY placar_leitura_publica ON public.placar_sobrecarga
  FOR SELECT TO anonymous USING (true);

DROP POLICY IF EXISTS placar_gravacao_publica ON public.placar_sobrecarga;
CREATE POLICY placar_gravacao_publica ON public.placar_sobrecarga
  FOR INSERT TO anonymous WITH CHECK (
    nome ~ '^[A-Z0-9 ._-]{1,12}$'
    AND replace(replace(replace(replace(nome, ' ', ''), '.', ''), '_', ''), '-', '')
        !~ '(VIADO|PUTA|CARALHO|BUCETA|PORRA|FDP|MACACO|NAZI|HITLER)'
    AND classe = ANY (ARRAY['SNIPER','GUARDIÃO','ESPECTRO','ARCANO','INVOCADOR'])
    AND onda BETWEEN 1 AND 100
    AND pontos BETWEEN 0 AND 5000000
    AND nivel BETWEEN 1 AND 99
    AND tempo BETWEEN 0 AND 86400
    AND abates BETWEEN 0 AND 100000
  );
