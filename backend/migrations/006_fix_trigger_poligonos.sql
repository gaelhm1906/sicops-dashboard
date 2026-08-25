-- ============================================================
-- MIGRACIÓN 006 — Eliminar TODOS los triggers legacy en las
-- tres tablas de obras y reemplazar con versión robusta.
--
-- Problema: obras_poligonos tenía un trigger anterior a las
-- migraciones 001-005 que accedía NEW.dg (lowercase).
-- La columna en obras_poligonos es "DG" (uppercase), lo que
-- causaba: record "new" has no field "dg" en cualquier INSERT.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. Eliminar TODOS los triggers (conocidos y legacy) en las
--    tres tablas de obras, sin importar su nombre.
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT t.tgname, c.relname
        FROM   pg_trigger t
        JOIN   pg_class   c ON c.oid = t.tgrelid
        JOIN   pg_namespace n ON n.oid = c.relnamespace
        WHERE  n.nspname = 'sig_sobse'
          AND  c.relname IN ('obras_puntos', 'obras_lineas', 'obras_poligonos')
          AND  NOT t.tgisinternal
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS %I ON sig_sobse.%I',
            r.tgname, r.relname
        );
        RAISE NOTICE 'Eliminado trigger % en %', r.tgname, r.relname;
    END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 2. Reemplazar fn_audit_obras con versión robusta (005).
--    Usa EXCEPTION en cada bloque que accede a NEW/OLD.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sig_sobse.fn_audit_obras()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_clave     TEXT;
    v_operacion TEXT;
    v_origen    TEXT;
    v_usuario   TEXT;
    v_motivo    TEXT;
    v_antes     JSONB;
    v_despues   JSONB;
    v_geom_ant  TEXT;
    v_geom_des  TEXT;
BEGIN
    /* ── clave_unica ── */
    BEGIN
        v_clave := BTRIM(
            CASE WHEN TG_OP = 'DELETE'
                 THEN OLD.clave_unica
                 ELSE NEW.clave_unica
            END::TEXT
        );
    EXCEPTION WHEN OTHERS THEN
        v_clave := NULL;
    END;

    /* ── operación semántica ── */
    BEGIN
        IF TG_OP = 'INSERT' THEN
            v_operacion := 'ALTA';

        ELSIF TG_OP = 'DELETE' THEN
            v_operacion := 'BAJA_LOGICA';

        ELSIF TG_OP = 'UPDATE' THEN
            BEGIN
                IF NEW.estatus_registro = 'INACTIVO' AND
                   (OLD.estatus_registro IS DISTINCT FROM 'INACTIVO') THEN
                    v_operacion := 'BAJA_LOGICA';
                ELSIF NEW.estatus_registro = 'ACTIVO' AND
                      (OLD.estatus_registro = 'INACTIVO') THEN
                    v_operacion := 'REACTIVACION';
                ELSIF NEW.clave_unica IS DISTINCT FROM OLD.clave_unica THEN
                    v_operacion := 'CORRECCION_CLAVE_UNICA';
                ELSE
                    BEGIN
                        IF ST_Equals(NEW.geom, OLD.geom) IS DISTINCT FROM TRUE THEN
                            v_operacion := 'MODIFICACION_GEOMETRIA';
                        ELSE
                            v_operacion := 'MODIFICACION';
                        END IF;
                    EXCEPTION WHEN OTHERS THEN
                        v_operacion := 'MODIFICACION';
                    END;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_operacion := 'MODIFICACION';
            END;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_operacion := 'MODIFICACION';
    END;

    /* ── snapshots antes/después (sin geom) ── */
    BEGIN
        IF TG_OP = 'INSERT' THEN
            v_antes   := NULL;
            v_despues := to_jsonb(NEW) - 'geom';
        ELSIF TG_OP = 'DELETE' THEN
            v_antes   := to_jsonb(OLD) - 'geom';
            v_despues := NULL;
        ELSE
            v_antes   := to_jsonb(OLD) - 'geom';
            v_despues := to_jsonb(NEW) - 'geom';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_antes   := NULL;
        v_despues := NULL;
    END;

    /* ── geometría como WKT ── */
    BEGIN
        IF TG_OP = 'DELETE' THEN
            v_geom_ant := ST_AsText(OLD.geom);
            v_geom_des := NULL;
        ELSIF TG_OP = 'INSERT' THEN
            v_geom_ant := NULL;
            v_geom_des := ST_AsText(NEW.geom);
        ELSE
            v_geom_ant := ST_AsText(OLD.geom);
            v_geom_des := ST_AsText(NEW.geom);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_geom_ant := NULL;
        v_geom_des := NULL;
    END;

    /* ── variables de sesión ── */
    v_origen  := COALESCE(
        current_setting('application.origen', true),
        CASE WHEN current_setting('application_name', true) ILIKE '%qgis%'
             THEN 'QGIS' ELSE 'SQL' END
    );
    v_usuario := COALESCE(
        current_setting('application.geo_usuario', true),
        current_user
    );
    v_motivo  := current_setting('application.motivo', true);

    /* ── INSERT en auditoría (silencioso si falla) ── */
    BEGIN
        INSERT INTO sig_sobse.obras_auditoria
            (tabla, operacion, clave_unica, usuario, origen,
             motivo, valores_antes, valores_despues, geom_antes, geom_despues)
        VALUES
            (TG_TABLE_NAME, v_operacion, v_clave, v_usuario, v_origen,
             v_motivo, v_antes, v_despues, v_geom_ant, v_geom_des);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 3. Recrear triggers en las tres tablas
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER trg_audit_obras_puntos
    AFTER INSERT OR UPDATE OR DELETE ON sig_sobse.obras_puntos
    FOR EACH ROW EXECUTE FUNCTION sig_sobse.fn_audit_obras();

CREATE TRIGGER trg_audit_obras_lineas
    AFTER INSERT OR UPDATE OR DELETE ON sig_sobse.obras_lineas
    FOR EACH ROW EXECUTE FUNCTION sig_sobse.fn_audit_obras();

CREATE TRIGGER trg_audit_obras_poligonos
    AFTER INSERT OR UPDATE OR DELETE ON sig_sobse.obras_poligonos
    FOR EACH ROW EXECUTE FUNCTION sig_sobse.fn_audit_obras();

DO $$ BEGIN
    RAISE NOTICE '✓ Migración 006 completada — triggers robustos recreados en las 3 tablas';
END; $$;

COMMIT;
