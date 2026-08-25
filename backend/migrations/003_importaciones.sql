-- ============================================================
-- MIGRACIÓN 003 — Importación masiva de obras
-- Crea: secuencia seq_clave_obras + tabla obras_importaciones
-- ============================================================

BEGIN;

/* Secuencia para el sufijo único de clave_unica */
CREATE SEQUENCE IF NOT EXISTS sig_sobse.seq_clave_obras
    START WITH 1 INCREMENT BY 1 NO MAXVALUE CACHE 10;

/* Historial de importaciones por lote */
CREATE TABLE IF NOT EXISTS sig_sobse.obras_importaciones (
    id                SERIAL       PRIMARY KEY,
    lote_id           TEXT         NOT NULL UNIQUE,  -- IMP-{usuario}-{timestamp}
    usuario           TEXT,
    fecha             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    nombre_archivo    TEXT,
    total_enviadas    INTEGER      NOT NULL DEFAULT 0,
    total_importadas  INTEGER      NOT NULL DEFAULT 0,
    total_errores     INTEGER      NOT NULL DEFAULT 0,
    total_avisos      INTEGER      NOT NULL DEFAULT 0,
    claves_insertadas TEXT[]       DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_importaciones_usuario
    ON sig_sobse.obras_importaciones(usuario);
CREATE INDEX IF NOT EXISTS idx_importaciones_fecha
    ON sig_sobse.obras_importaciones(fecha DESC);

DO $$ BEGIN
  RAISE NOTICE '✓ seq_clave_obras creada';
  RAISE NOTICE '✓ obras_importaciones creada';
END; $$;

COMMIT;
