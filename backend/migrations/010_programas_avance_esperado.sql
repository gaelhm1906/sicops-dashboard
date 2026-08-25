-- Tabla de referencia para "Focos Amarillos" (avance esperado vs avance real).
-- Decision 2026-06-25: la brecha se mide semana vs semana anterior (no desde
-- una fecha de inicio fija, que no existe de forma confiable en obras_lineas/
-- puntos/poligonos) — se compara la variacion_semanal real contra el ritmo
-- esperado de aqui.
--
-- modo:
--   PORCENTAJE -> avance_semanal_pct ya es el % esperado por semana, fijo
--                 para todas las obras de ese programa.
--   KM         -> el % esperado se calcula POR OBRA: semanas = obra."long (km)"
--                 / constante_km_semana; % semanal = 100 / semanas. Aplica a
--                 obras tipo linea con longitud capturada.
--   NO_APLICA  -> el programa queda excluido del foco amarillo (igual que
--                 PROGRAMAS_SIN_ALERTAS para el foco rojo en otro contexto).
BEGIN;

CREATE TABLE IF NOT EXISTS sig_sobse.programas_avance_esperado (
  id                  SERIAL PRIMARY KEY,
  programa            TEXT NOT NULL UNIQUE,
  modo                TEXT NOT NULL CHECK (modo IN ('PORCENTAJE', 'KM', 'NO_APLICA')),
  avance_semanal_pct  NUMERIC(5,2),
  constante_km_semana NUMERIC(6,3),
  nota                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sig_sobse.programas_avance_esperado (programa, modo, avance_semanal_pct, constante_km_semana, nota) VALUES
  ('CONSTRUCCION DE UTOPIAS', 'PORCENTAJE', 2.0, NULL, '1 año'),
  ('SISTEMA PUBLICO DE CUIDADOS "CASA DE LAS 3RS"', 'PORCENTAJE', 4.0, NULL, '6 meses'),
  ('CONSTRUCCION DE CLINICAS CONDESA', 'PORCENTAJE', 2.0, NULL, '1 año'),
  ('CABLEBUS', 'PORCENTAJE', 1.0, NULL, '2 años'),
  ('TROLEBUS RUTA 14', 'NO_APLICA', NULL, NULL, NULL),
  ('MODERNIZACION DEL TREN LIGERO', 'NO_APLICA', NULL, NULL, 'CSV original decía "TREN LIGERO"'),
  ('METROBUS', 'NO_APLICA', NULL, NULL, NULL),
  ('REHABILITACION Y CONSTRUCCION DE PUENTES PEATONALES', 'PORCENTAJE', 8.0, NULL, '3 meses'),
  ('REHABILITACION Y CONSTRUCCION DE PUENTES VEHICULARES', 'PORCENTAJE', 8.0, NULL, '3 meses'),
  ('MANTENIMIENTO A MERCADOS PUBLICOS', 'PORCENTAJE', 8.0, NULL, '3 meses'),
  ('MANTENIMIENTO A MERCADOS PUBLICOS (CAPTACION DE AGUA DE LLUVIA EN MERCADOS)', 'PORCENTAJE', 4.0, NULL, '6 meses'),
  ('ALDEA JUVENIL', 'PORCENTAJE', 4.0, NULL, '6 meses; sin obras en vivo todavía'),
  ('OBRAS ADICIONALES', 'PORCENTAJE', 12.5, NULL, '2 meses; pendiente excepción por obra: Rehabilitación de Banquetas U.H. Nonoalco Tlatelolco y Taller Tatuado son NO_APLICA a nivel obra, no implementado en v1'),
  ('CIUDAD ILUMINADA, CAMINA LIBRE, CAMINA SEGURA', 'KM', NULL, 0.345, '1.5 km/mes ≈ 0.345 km/semana en CSV original'),
  ('CIUDAD ILUMINADA: COMUNIDAD SEGURA', 'PORCENTAJE', 12.5, NULL, '2 meses'),
  ('YOLOTL ANAHUAC', 'PORCENTAJE', 8.0, NULL, '3 meses'),
  ('TERRITORIOS DE PAZ E IGUALDAD', 'NO_APLICA', NULL, NULL, 'sin obras en vivo todavía'),
  ('PARQUES ALEGRIA', 'PORCENTAJE', 8.0, NULL, '3 meses'),
  ('1,2,3 POR MI ESCUELA RENOVAR PARA TRANSFORMAR', 'PORCENTAJE', 4.0, NULL, '6 meses'),
  ('MODULOS DE POLICIAS', 'PORCENTAJE', 12.5, NULL, '2 meses'),
  ('RECREA REGENERACIÓN DE ESPACIOS SUSCEPTIBLES A RIESGOS GEOLÓGICOS', 'NO_APLICA', NULL, NULL, 'sin obras en vivo todavía'),
  ('REHABILITACION DE INFRAESTRUCTURA PUBLICA (ALBERGUES)', 'PORCENTAJE', 2.0, NULL, '1 año'),
  ('ILUMINACION DE CALLES DEL CENTRO HISTORICO', 'NO_APLICA', NULL, NULL, NULL),
  ('ILUMINACION ARTISTICA DE EDIFICIOS DEL CENTRO HISTORICO', 'NO_APLICA', NULL, NULL, NULL),
  ('EL BALON VUELVE AL BARRIO', 'PORCENTAJE', 25.0, NULL, '1 mes'),
  ('PARQUE ELEVADO DE LA CALZADA DE TLALPAN', 'NO_APLICA', NULL, NULL, NULL),
  ('REHABILITACION DE PASOS A DESNIVEL', 'PORCENTAJE', 12.5, NULL, '2 meses'),
  ('CICLOVIAS COMPLEMENTARIAS A CALZ DE TLALPAN', 'KM', NULL, 0.345, 'sin obras en vivo todavía'),
  ('CICLOVIA "LA GRAN TENOCHTITLAN"', 'KM', NULL, 0.345, NULL),
  ('BALIZAMIENTO DE VIALIDADES', 'NO_APLICA', NULL, NULL, NULL),
  ('REHABILITACIÓN CETRAM', 'PORCENTAJE', 4.0, NULL, '6 meses'),
  ('MERCADO HUIPULCO', 'PORCENTAJE', 4.0, NULL, '6 meses; sin obras en vivo todavía'),
  ('UNIVERSIDAD DE LAS ARTES', 'PORCENTAJE', 2.0, NULL, '1 año'),
  -- Programas en vivo sin dato en el CSV original — default NO_APLICA hasta
  -- que se confirme su ritmo esperado (decisión 2026-06-25).
  ('BICIESTACIONAMIENTOS', 'NO_APLICA', NULL, NULL, 'sin dato en CSV original, default'),
  ('CENTRO DE RESGUARDO TEMPORAL', 'NO_APLICA', NULL, NULL, 'sin dato en CSV original, default'),
  ('INSTALACIONES ADMINISTRATIVAS DEL SSC', 'NO_APLICA', NULL, NULL, 'sin dato en CSV original, default'),
  ('MANTENIMIENTO A UTOPIAS', 'NO_APLICA', NULL, NULL, 'sin dato en CSV original, default'),
  ('REPAVIMENTACION', 'NO_APLICA', NULL, NULL, 'sin dato en CSV original, default')
ON CONFLICT (programa) DO NOTHING;

COMMIT;
