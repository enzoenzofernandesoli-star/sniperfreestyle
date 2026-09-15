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
