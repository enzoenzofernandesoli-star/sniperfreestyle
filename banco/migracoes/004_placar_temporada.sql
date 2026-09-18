-- Temporada no placar: cada atualização do jogo abre um ranking novo.
--
-- A coluna entra com DEFAULT 'T1' porque tudo que já foi jogado aconteceu
-- antes desta regra existir — vira, por definição, a temporada 1. Cliente
-- antigo que grave sem o campo continua caindo em T1 e não é recusado.
--
-- O formato é curto e fechado por CHECK ('T' e até três dígitos) para que a
-- coluna não vire texto livre entrando pelo Data API, onde quem valida é o
-- banco e não a API.
BEGIN;

ALTER TABLE public.placar_sobrecarga
  ADD COLUMN IF NOT EXISTS temporada text NOT NULL DEFAULT 'T1';

ALTER TABLE public.placar_sobrecarga
  DROP CONSTRAINT IF EXISTS placar_sobrecarga_temporada_check;
ALTER TABLE public.placar_sobrecarga
  ADD CONSTRAINT placar_sobrecarga_temporada_check
  CHECK (temporada ~ '^T[0-9]{1,3}$');

-- O ranking é sempre lido por temporada e ordenado por pontos: este índice é
-- exatamente a consulta da tela de RECORDES.
CREATE INDEX IF NOT EXISTS placar_sobrecarga_temporada_pontos_idx
  ON public.placar_sobrecarga (temporada, pontos DESC, criado_em ASC);

COMMIT;
