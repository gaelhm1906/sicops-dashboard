-- Clasificación individual por alcance (PROYECTADO / EJECUTADO).
-- NULL = hereda del nivel de obra (alcances_obras_tipo).
ALTER TABLE sig_sobse.alcances_obras
  ADD COLUMN IF NOT EXISTS tipo_alcance text NULL
  CHECK (tipo_alcance IN ('PROYECTADO', 'EJECUTADO'));
