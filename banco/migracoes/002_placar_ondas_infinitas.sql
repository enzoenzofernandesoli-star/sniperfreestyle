-- Libera o placar para registrar runs do modo infinito sem apagar resultados antigos.
BEGIN;

ALTER TABLE public.placar_sobrecarga
  DROP CONSTRAINT IF EXISTS placar_sobrecarga_onda_40_check;
ALTER TABLE public.placar_sobrecarga
  ADD CONSTRAINT placar_sobrecarga_onda_infinita_check CHECK (onda BETWEEN 1 AND 9999);

ALTER TABLE public.placar_sobrecarga
  DROP CONSTRAINT IF EXISTS placar_sobrecarga_pontos_check;
ALTER TABLE public.placar_sobrecarga
  ADD CONSTRAINT placar_sobrecarga_pontos_check CHECK (pontos BETWEEN 0 AND 2000000000);

COMMIT;
