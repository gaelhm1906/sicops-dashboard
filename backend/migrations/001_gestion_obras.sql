-- ============================================================
-- MIGRACIÓN 001 — Módulo Gestión Controlada de Obras
-- Ejecutar en el servidor PostgreSQL como usuario con permisos
-- sobre el schema sig_sobse.
-- ============================================================
-- IMPORTANTE: Ejecutar dentro de una transacción para poder
-- hacer rollback si algo falla.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. TABLA MAESTRA DE CLAVES ÚNICAS
--    Fuente de verdad: una clave_unica solo puede existir una
--    vez en todo el sistema, independiente del tipo de geometría.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sig_sobse.catalogo_obras (
    clave_unica          TEXT         PRIMARY KEY,
    tipo_geometria       TEXT         NOT NULL
                                      CHECK (tipo_geometria IN ('PUNTO','LINEA','POLIGONO')),
    tabla_actual         TEXT         NOT NULL
                                      CHECK (tabla_actual IN ('obras_puntos','obras_lineas','obras_poligonos')),
    estatus_registro     TEXT         NOT NULL DEFAULT 'ACTIVO'
                                      CHECK (estatus_registro IN ('ACTIVO','INACTIVO','MIGRADO')),
    creado_por           TEXT,
    fecha_creacion       TIMESTAMPTZ  DEFAULT NOW(),
    actualizado_por      TEXT,
    fecha_actualizacion  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_catalogo_obras_estatus
    ON sig_sobse.catalogo_obras(estatus_registro);

-- ────────────────────────────────────────────────────────────
-- 2. TABLA DE SOLICITUDES / BORRADORES
--    Borradores previos a publicación en producción.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sig_sobse.obras_solicitudes (
    id                   SERIAL       PRIMARY KEY,
    tipo_operacion       TEXT         NOT NULL
                                      CHECK (tipo_operacion IN (
                                          'ALTA','MODIFICACION','BAJA_LOGICA',
                                          'REACTIVACION','CAMBIO_TIPO_GEOMETRICO'
                                      )),
    tipo_geometria       TEXT         CHECK (tipo_geometria IN ('PUNTO','LINEA','POLIGONO')),
    estado               TEXT         NOT NULL DEFAULT 'BORRADOR'
                                      CHECK (estado IN ('BORRADOR','PUBLICADO','CANCELADO')),

    -- Referencia a obra existente (para MODIFICACION / BAJA / REACTIVACION)
    clave_unica_ref      TEXT,

    -- Datos propuestos
    clave_unica          TEXT,
    nombre_obra          TEXT,
    programa             TEXT,
    dg                   TEXT,
    seguimiento          TEXT,
    alcaldia             TEXT,
    geom                 GEOMETRY(Geometry, 4326),
    atributos_json       JSONB,        -- campos adicionales sin columna propia

    -- Baja lógica
    motivo_baja          TEXT,         -- código del catálogo
    observaciones_baja   TEXT,         -- texto libre (obligatorio si motivo = 'OTRO')

    -- Metadatos de workflow
    usuario_creacion     TEXT,
    fecha_creacion       TIMESTAMPTZ   DEFAULT NOW(),
    usuario_publicacion  TEXT,
    fecha_publicacion    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_estado
    ON sig_sobse.obras_solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario
    ON sig_sobse.obras_solicitudes(usuario_creacion);
CREATE INDEX IF NOT EXISTS idx_solicitudes_clave_ref
    ON sig_sobse.obras_solicitudes(clave_unica_ref);

-- ────────────────────────────────────────────────────────────
-- 3. TABLA DE AUDITORÍA (registro inmutable)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sig_sobse.obras_auditoria (
    id                   BIGSERIAL    PRIMARY KEY,
    tabla                TEXT         NOT NULL,
    operacion            TEXT         NOT NULL
                                      CHECK (operacion IN (
                                          'ALTA','MODIFICACION','BAJA_LOGICA',
                                          'REACTIVACION','CAMBIO_TIPO_GEOMETRICO',
                                          'CORRECCION_CLAVE_UNICA','MODIFICACION_GEOMETRIA'
                                      )),
    clave_unica          TEXT,
    usuario              TEXT,
    fecha                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    origen               TEXT         DEFAULT 'SICOPS'
                                      CHECK (origen IN ('SICOPS','QGIS','API','SQL','TRIGGER','OTRO')),
    ip_origen            TEXT,
    motivo               TEXT,
    solicitud_id         INTEGER      REFERENCES sig_sobse.obras_solicitudes(id),
    valores_antes        JSONB,
    valores_despues      JSONB,
    geom_antes           TEXT,        -- ST_AsText(geom) de la versión anterior
    geom_despues         TEXT         -- ST_AsText(geom) de la versión nueva
);

CREATE INDEX IF NOT EXISTS idx_auditoria_clave
    ON sig_sobse.obras_auditoria(clave_unica);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha
    ON sig_sobse.obras_auditoria(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario
    ON sig_sobse.obras_auditoria(usuario);
CREATE INDEX IF NOT EXISTS idx_auditoria_operacion
    ON sig_sobse.obras_auditoria(operacion);

-- ────────────────────────────────────────────────────────────
-- 4. COLUMNAS NUEVAS EN TABLAS PRODUCTIVAS
--    Todas con DEFAULT para no romper registros existentes.
-- ────────────────────────────────────────────────────────────

ALTER TABLE sig_sobse.obras_puntos
    ADD COLUMN IF NOT EXISTS estatus_registro   TEXT         DEFAULT 'ACTIVO',
    ADD COLUMN IF NOT EXISTS motivo_baja        TEXT,
    ADD COLUMN IF NOT EXISTS observaciones_baja TEXT,
    ADD COLUMN IF NOT EXISTS fecha_baja         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS usuario_baja       TEXT,
    ADD COLUMN IF NOT EXISTS creado_por         TEXT,
    ADD COLUMN IF NOT EXISTS fecha_creacion     TIMESTAMPTZ;

ALTER TABLE sig_sobse.obras_lineas
    ADD COLUMN IF NOT EXISTS estatus_registro   TEXT         DEFAULT 'ACTIVO',
    ADD COLUMN IF NOT EXISTS motivo_baja        TEXT,
    ADD COLUMN IF NOT EXISTS observaciones_baja TEXT,
    ADD COLUMN IF NOT EXISTS fecha_baja         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS usuario_baja       TEXT,
    ADD COLUMN IF NOT EXISTS creado_por         TEXT,
    ADD COLUMN IF NOT EXISTS fecha_creacion     TIMESTAMPTZ;

ALTER TABLE sig_sobse.obras_poligonos
    ADD COLUMN IF NOT EXISTS estatus_registro   TEXT         DEFAULT 'ACTIVO',
    ADD COLUMN IF NOT EXISTS motivo_baja        TEXT,
    ADD COLUMN IF NOT EXISTS observaciones_baja TEXT,
    ADD COLUMN IF NOT EXISTS fecha_baja         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS usuario_baja       TEXT,
    ADD COLUMN IF NOT EXISTS creado_por         TEXT,
    ADD COLUMN IF NOT EXISTS fecha_creacion     TIMESTAMPTZ;

-- ────────────────────────────────────────────────────────────
-- 5. POBLAR catalogo_obras DESDE LOS DATOS EXISTENTES
--    ON CONFLICT DO NOTHING: si ya fue insertado, no falla.
--    Prioridad: obras_puntos > obras_lineas > obras_poligonos
--    (la primera que registra una clave "gana")
-- ────────────────────────────────────────────────────────────
INSERT INTO sig_sobse.catalogo_obras
    (clave_unica, tipo_geometria, tabla_actual, estatus_registro)
SELECT DISTINCT
    BTRIM(clave_unica::TEXT),
    'PUNTO',
    'obras_puntos',
    'ACTIVO'
FROM sig_sobse.obras_puntos
WHERE clave_unica IS NOT NULL
  AND BTRIM(clave_unica::TEXT) <> ''
ON CONFLICT (clave_unica) DO NOTHING;

INSERT INTO sig_sobse.catalogo_obras
    (clave_unica, tipo_geometria, tabla_actual, estatus_registro)
SELECT DISTINCT
    BTRIM(clave_unica::TEXT),
    'LINEA',
    'obras_lineas',
    'ACTIVO'
FROM sig_sobse.obras_lineas
WHERE clave_unica IS NOT NULL
  AND BTRIM(clave_unica::TEXT) <> ''
ON CONFLICT (clave_unica) DO NOTHING;

INSERT INTO sig_sobse.catalogo_obras
    (clave_unica, tipo_geometria, tabla_actual, estatus_registro)
SELECT DISTINCT
    BTRIM(clave_unica::TEXT),
    'POLIGONO',
    'obras_poligonos',
    'ACTIVO'
FROM sig_sobse.obras_poligonos
WHERE clave_unica IS NOT NULL
  AND BTRIM(clave_unica::TEXT) <> ''
ON CONFLICT (clave_unica) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 6. TRIGGER DE AUDITORÍA AUTOMÁTICA
--    Captura TODO cambio en tablas productivas,
--    independientemente del origen (SICOPS, QGIS, psql).
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sig_sobse.fn_audit_obras()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_clave     TEXT;
    v_operacion TEXT;
    v_origen    TEXT;
    v_usuario   TEXT;
    v_antes     JSONB;
    v_despues   JSONB;
    v_geom_ant  TEXT;
    v_geom_des  TEXT;
BEGIN
    -- Detectar clave_unica de la fila afectada
    IF TG_OP = 'DELETE' THEN
        v_clave := BTRIM(OLD.clave_unica::TEXT);
    ELSE
        v_clave := BTRIM(NEW.clave_unica::TEXT);
    END IF;

    -- Detectar operación semántica
    IF TG_OP = 'INSERT' THEN
        v_operacion := 'ALTA';
        v_antes     := NULL;
        v_despues   := to_jsonb(NEW) - 'geom';
        v_geom_ant  := NULL;
        v_geom_des  := ST_AsText(NEW.geom);

    ELSIF TG_OP = 'UPDATE' THEN
        -- Determinar si es baja lógica o modificación
        IF NEW.estatus_registro = 'INACTIVO' AND
           (OLD.estatus_registro IS DISTINCT FROM 'INACTIVO') THEN
            v_operacion := 'BAJA_LOGICA';
        ELSIF NEW.estatus_registro = 'ACTIVO' AND
              (OLD.estatus_registro = 'INACTIVO') THEN
            v_operacion := 'REACTIVACION';
        ELSIF NEW.clave_unica IS DISTINCT FROM OLD.clave_unica THEN
            v_operacion := 'CORRECCION_CLAVE_UNICA';
        ELSIF ST_Equals(NEW.geom, OLD.geom) IS DISTINCT FROM TRUE THEN
            v_operacion := 'MODIFICACION_GEOMETRIA';
        ELSE
            v_operacion := 'MODIFICACION';
        END IF;
        v_antes    := to_jsonb(OLD) - 'geom';
        v_despues  := to_jsonb(NEW) - 'geom';
        v_geom_ant := ST_AsText(OLD.geom);
        v_geom_des := ST_AsText(NEW.geom);

    ELSIF TG_OP = 'DELETE' THEN
        v_operacion := 'BAJA_LOGICA';
        v_antes     := to_jsonb(OLD) - 'geom';
        v_despues   := NULL;
        v_geom_ant  := ST_AsText(OLD.geom);
        v_geom_des  := NULL;
    END IF;

    -- Detectar origen: si SICOPS seteó la variable de sesión, usarla
    v_origen  := COALESCE(
        current_setting('application.origen',  true),
        CASE WHEN current_setting('application_name', true) ILIKE '%qgis%' THEN 'QGIS' ELSE 'SQL' END
    );
    v_usuario := COALESCE(
        current_setting('application.user', true),
        current_user
    );

    INSERT INTO sig_sobse.obras_auditoria
        (tabla, operacion, clave_unica, usuario, origen,
         valores_antes, valores_despues, geom_antes, geom_despues)
    VALUES
        (TG_TABLE_NAME, v_operacion, v_clave, v_usuario, v_origen,
         v_antes, v_despues, v_geom_ant, v_geom_des);

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- Aplicar trigger a las tres tablas
DROP TRIGGER IF EXISTS trg_audit_obras_puntos    ON sig_sobse.obras_puntos;
DROP TRIGGER IF EXISTS trg_audit_obras_lineas    ON sig_sobse.obras_lineas;
DROP TRIGGER IF EXISTS trg_audit_obras_poligonos ON sig_sobse.obras_poligonos;

CREATE TRIGGER trg_audit_obras_puntos
    AFTER INSERT OR UPDATE OR DELETE ON sig_sobse.obras_puntos
    FOR EACH ROW EXECUTE FUNCTION sig_sobse.fn_audit_obras();

CREATE TRIGGER trg_audit_obras_lineas
    AFTER INSERT OR UPDATE OR DELETE ON sig_sobse.obras_lineas
    FOR EACH ROW EXECUTE FUNCTION sig_sobse.fn_audit_obras();

CREATE TRIGGER trg_audit_obras_poligonos
    AFTER INSERT OR UPDATE OR DELETE ON sig_sobse.obras_poligonos
    FOR EACH ROW EXECUTE FUNCTION sig_sobse.fn_audit_obras();

-- ────────────────────────────────────────────────────────────
-- 7. VERIFICACIÓN FINAL
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_catalogo   INTEGER;
    v_solicitudes INTEGER;
    v_auditoria  INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_catalogo   FROM sig_sobse.catalogo_obras;
    SELECT COUNT(*) INTO v_solicitudes FROM sig_sobse.obras_solicitudes;
    SELECT COUNT(*) INTO v_auditoria   FROM sig_sobse.obras_auditoria;

    RAISE NOTICE '✓ catalogo_obras:    % registros', v_catalogo;
    RAISE NOTICE '✓ obras_solicitudes: % registros', v_solicitudes;
    RAISE NOTICE '✓ obras_auditoria:   % registros', v_auditoria;
    RAISE NOTICE '✓ Migración completada exitosamente';
END;
$$;

COMMIT;
