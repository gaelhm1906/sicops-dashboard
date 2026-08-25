-- ============================================================
-- MIGRACIÓN 004 — Renombrar application.user → application.geo_usuario
-- "user" es keyword reservada en PostgreSQL — causa syntax error.
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
    IF TG_OP = 'DELETE' THEN
        v_clave := BTRIM(OLD.clave_unica::TEXT);
    ELSE
        v_clave := BTRIM(NEW.clave_unica::TEXT);
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_operacion := 'ALTA';
        v_antes     := NULL;
        v_despues   := to_jsonb(NEW) - 'geom';
        v_geom_ant  := NULL;
        v_geom_des  := ST_AsText(NEW.geom);

    ELSIF TG_OP = 'UPDATE' THEN
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

    v_origen  := COALESCE(
        current_setting('application.origen', true),
        CASE WHEN current_setting('application_name', true) ILIKE '%qgis%' THEN 'QGIS' ELSE 'SQL' END
    );
    /* geo_usuario evita conflicto con la keyword reservada "user" */
    v_usuario := COALESCE(current_setting('application.geo_usuario', true), current_user);
    v_motivo  := current_setting('application.motivo', true);

    INSERT INTO sig_sobse.obras_auditoria
        (tabla, operacion, clave_unica, usuario, origen,
         motivo, valores_antes, valores_despues, geom_antes, geom_despues)
    VALUES
        (TG_TABLE_NAME, v_operacion, v_clave, v_usuario, v_origen,
         v_motivo, v_antes, v_despues, v_geom_ant, v_geom_des);

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

DO $$ BEGIN
  RAISE NOTICE '✓ fn_audit_obras actualizada — application.geo_usuario (sin keyword reservada)';
END; $$;

COMMIT;
