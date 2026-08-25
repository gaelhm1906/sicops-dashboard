-- Corrige el indice unico de uto_2025: estaba en (clave_unica, frente) sin
-- contrato, lo que colapsaba frentes legitimamente distintos que comparten
-- nombre (ej. 3 contratos de "Supervision Externa" bajo la misma utopia).
-- importarDesdeExcel() usaba ON CONFLICT (clave_unica, frente) -- cada carga
-- semanal pisaba el frente anterior con el mismo nombre, perdiendo datos de
-- los demas contratos silenciosamente. Detectado 2026-06-25 comparando los
-- tableros de control contra uto_2025 (Coyoacan, Injuve, Parque Japon, El
-- Triangulo, Topilejo, Tecomitl con frentes "faltantes").
--
-- COALESCE(contrato, '') en vez de contrato crudo: evita que NULL != NULL
-- (semantica normal de indices unicos) genere filas placeholder duplicadas
-- en cada carga cuando un frente no tiene contrato capturado todavia.
BEGIN;

DROP INDEX IF EXISTS sig_sobse.idx_uto_2025_clave_frente;

CREATE UNIQUE INDEX IF NOT EXISTS idx_uto_2025_clave_frente_contrato
  ON sig_sobse.uto_2025 (clave_unica, frente, (COALESCE(contrato, '')));

COMMIT;
