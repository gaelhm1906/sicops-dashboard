-- ============================================================
-- MIGRACIÓN 005 — Trigger robusto: no aborta UPDATEs existentes
-- Envuelve to_jsonb y ST_Equals en bloques EXCEPTION para que
-- cualquier error en el trigger NO interrumpa la operación original.
-- ============================================================

BEGIN;

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
    /* ── clave_unica de la fila afectada ── */
    BEGIN
        v_clave := BTRIM(CASE WHEN TG_OP = 'DELETE' THEN OLD.clave_unica ELSE NEW.clave_unica END::TEXT);
    EXCEPTION WHEN OTHERS THEN
        v_clave := NULL;
    END;

    /* ── tipo de operación ── */
    IF TG_OP = 'INSERT' THEN
        v_operacion := 'ALTA';

    ELSIF TG_OP = 'DELETE' THEN
        v_operacion := 'BAJA_LOGICA';

    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.estatus_registro = 'INACTIVO' AND
           (OLD.estatus_registro IS DISTINCT FROM 'INACTIVO') THEN
            v_operacion := 'BAJA_LOGICA';
        ELSIF NEW.estatus_registro = 'ACTIVO' AND
              (OLD.estatus_registro = 'INACTIVO') THEN
            v_operacion := 'REACTIVACION';
        ELSIF NEW.clave_unica IS DISTINCT FROM OLD.clave_unica THEN
            v_operacion := 'CORRECCION_CLAVE_UNICA';
        ELSE
            /* Verificar cambio de geometría de forma segura */
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
    END IF;

    /* ── snapshot antes / después (sin geom para evitar problemas de cast) ── */
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
        /* Si to_jsonb falla (ej. problema con algún tipo), guardar NULL
           para que el UPDATE original NO sea abortado. */
        v_antes   := NULL;
        v_despues := NULL;
    END;

    /* ── geometría como texto WKT ── */
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

    /* ── usuario y origen ── */
    v_origen  := COALESCE(
        current_setting('application.origen', true),
        CASE WHEN current_setting('application_name', true) ILIKE '%qgis%'
             THEN 'QGIS' ELSE 'SQL' END
    );
    v_usuario := COALESCE(current_setting('application.geo_usuario', true), current_user);
    v_motivo  := current_setting('application.motivo', true);

    /* ── INSERT en auditoría (no abortar si falla) ── */
    BEGIN
        INSERT INTO sig_sobse.obras_auditoria
            (tabla, operacion, clave_unica, usuario, origen,
             motivo, valores_antes, valores_despues, geom_antes, geom_despues)
        VALUES
            (TG_TABLE_NAME, v_operacion, v_clave, v_usuario, v_origen,
             v_motivo, v_antes, v_despues, v_geom_ant, v_geom_des);
    EXCEPTION WHEN OTHERS THEN
        /* La auditoría falla silenciosamente — la operación original continúa */
        NULL;
    END;

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

DO $$ BEGIN
  RAISE NOTICE '✓ fn_audit_obras — versión robusta (EXCEPTION en to_jsonb y ST_Equals)';
END; $$;

COMMIT;
