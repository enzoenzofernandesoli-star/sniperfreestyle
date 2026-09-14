-- Execute com o proprietário da tabela no Neon antes de publicar a API de 40 ondas.
-- Preserva resultados existentes e mantém o nome histórico da tabela.
BEGIN;

CREATE TABLE IF NOT EXISTS public.placar_sobrecarga (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome varchar(12) NOT NULL,
  pontos integer NOT NULL CHECK (pontos BETWEEN 0 AND 5000000),
  classe varchar(20) NOT NULL CHECK (classe IN ('SNIPER', 'GUARDIÃO', 'ESPECTRO', 'ARCANO')),
  onda smallint NOT NULL,
  nivel smallint NOT NULL CHECK (nivel BETWEEN 1 AND 99),
  tempo integer NOT NULL CHECK (tempo BETWEEN 0 AND 86400),
  abates integer NOT NULL CHECK (abates BETWEEN 0 AND 100000),
  venceu boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.placar_sobrecarga
  DROP CONSTRAINT IF EXISTS placar_sobrecarga_onda_check;
ALTER TABLE public.placar_sobrecarga
  DROP CONSTRAINT IF EXISTS placar_sobrecarga_onda_40_check;
ALTER TABLE public.placar_sobrecarga
  ADD CONSTRAINT placar_sobrecarga_onda_40_check CHECK (onda BETWEEN 1 AND 40);

CREATE INDEX IF NOT EXISTS placar_sobrecarga_ranking_idx
  ON public.placar_sobrecarga (pontos DESC, criado_em ASC);

COMMIT;
