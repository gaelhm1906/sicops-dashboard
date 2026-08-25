-- ============================================================
-- MIGRACIÓN 008 — Snapshots semanales de FRENTES (UTOPÍAS)
-- Crea: sig_sobse.snapshots_frentes_utopias
--
-- Tabla hija dedicada para el histórico de avance por frente de
-- uto_2025, separada de snapshots_semanales (que es compartida con
-- obras_puntos/lineas/poligonos). Se crea aparte para que:
--   1. El backfill de históricos curados (herramienta de curación
--      temporal, fuera de este repo) nunca compita por filas con lo
--      que capture el cron en producción.
--   2. Quede trazabilidad explícita de qué insertó cada fila
--      (columna `origen`), algo que snapshots_semanales no tiene.
--   3. clave_unica quede denormalizado en cada fila — no hace falta
--      cruzar contra uto_2025 en vivo para saber a qué obra pertenece
--      un frente histórico.
--
-- uto_2025 se excluye explícitamente de la captura genérica de
-- snapshots_semanales en services/semanaService.js (TABLAS_EXCLUIDAS)
-- como parte de este mismo cambio — antes de esta migración, uto_2025
-- ya cumplía los requisitos del detector genérico (id/avance_real/
-- estatus) y se capturaba ahí sin que nadie lo usara.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sig_sobse.snapshots_frentes_utopias (
    id               SERIAL        PRIMARY KEY,
    clave_unica      TEXT          NOT NULL,
    frente_id        INTEGER       NOT NULL,  -- uto_2025.id en el momento de la captura
    frente_nombre    TEXT,                    -- uto_2025.frente, trazabilidad si el id cambia
    avance           REAL,
    estatus          TEXT,
    semana           INTEGER       NOT NULL,
    anio             INTEGER       NOT NULL,
    fecha            DATE,
    origen           TEXT          NOT NULL DEFAULT 'cron',  -- 'cron' | 'backfill'
    curacion_run_id  INTEGER,                 -- referencia informativa, solo si origen='backfill'
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (frente_id, semana, anio)
);

CREATE INDEX IF NOT EXISTS idx_snap_frentes_clave
    ON sig_sobse.snapshots_frentes_utopias(clave_unica);
CREATE INDEX IF NOT EXISTS idx_snap_frentes_origen
    ON sig_sobse.snapshots_frentes_utopias(origen);

DO $$ BEGIN
  RAISE NOTICE '✓ snapshots_frentes_utopias creada';
END; $$;

COMMIT;
