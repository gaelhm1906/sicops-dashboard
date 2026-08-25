-- Motor configurable de cálculo de avance por obra.
-- Permite decidir, obra por obra, si el avance mostrado viene de:
--   GENERAL  → avance_real almacenado directamente (comportamiento actual, default)
--   FRENTES  → promedio ponderado por monto calculado desde frentes_obra
--
-- DEFAULT 'GENERAL' garantiza cero impacto en obras existentes.
-- Solo obras configuradas explícitamente como FRENTES cambiarán de comportamiento.

BEGIN;

ALTER TABLE sig_sobse.obras_puntos
  ADD COLUMN IF NOT EXISTS modo_calculo_avance TEXT
    NOT NULL DEFAULT 'GENERAL'
    CHECK (modo_calculo_avance IN ('GENERAL', 'FRENTES'));

ALTER TABLE sig_sobse.obras_lineas
  ADD COLUMN IF NOT EXISTS modo_calculo_avance TEXT
    NOT NULL DEFAULT 'GENERAL'
    CHECK (modo_calculo_avance IN ('GENERAL', 'FRENTES'));

ALTER TABLE sig_sobse.obras_poligonos
  ADD COLUMN IF NOT EXISTS modo_calculo_avance TEXT
    NOT NULL DEFAULT 'GENERAL'
    CHECK (modo_calculo_avance IN ('GENERAL', 'FRENTES'));

COMMENT ON COLUMN sig_sobse.obras_puntos.modo_calculo_avance
  IS 'GENERAL = avance_real directo. FRENTES = ponderado desde frentes_obra por monto_contr.';
COMMENT ON COLUMN sig_sobse.obras_lineas.modo_calculo_avance
  IS 'GENERAL = avance_real directo. FRENTES = ponderado desde frentes_obra por monto_contr.';
COMMENT ON COLUMN sig_sobse.obras_poligonos.modo_calculo_avance
  IS 'GENERAL = avance_real directo. FRENTES = ponderado desde frentes_obra por monto_contr.';

COMMIT;
