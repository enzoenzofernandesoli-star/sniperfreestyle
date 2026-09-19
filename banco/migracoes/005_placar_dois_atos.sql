-- Ato II: a corrida não termina mais na onda 100.
--
-- Derrubar o CEIFADOR abre o Interstício Violeta, e de lá a partida atravessa
-- para NÁDIR e continua da onda 101 à 200 — mesma run, mesma pontuação, mesmo
-- placar. Sem este teto novo o CHECK recusa toda linha do Ato II, e recusa
-- exatamente as melhores: quem chegou mais longe é quem some do ranking.
--
-- O teto é 200 e não 9999 de propósito: a coluna continua sendo um número de
-- onda que existe no jogo, e não texto livre entrando pelo Data API.
BEGIN;

ALTER TABLE public.placar_sobrecarga
  DROP CONSTRAINT IF EXISTS placar_sobrecarga_onda_check;
ALTER TABLE public.placar_sobrecarga
  ADD CONSTRAINT placar_sobrecarga_onda_check CHECK (onda BETWEEN 1 AND 200);

COMMIT;
