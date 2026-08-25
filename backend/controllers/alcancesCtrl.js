/**
 * controllers/alcancesCtrl.js
 * Catálogo dinámico de alcances + historial operativo.
 * Tablas: catalogo_alcances (catálogo maestro), alcances_obras (registros operativos).
 *         alcances_obras_tipo (clasificación PROYECTADO/EJECUTADO por obra).
 */

const { query, SCHEMA } = require("../config/pg");

const ACTIVIDAD_MAP = {
  actividad_instalacion:     "INSTALACIÓN",
  actividad_construccion:    "CONSTRUCCIÓN",
  actividad_rehabilitacion:  "REHABILITACIÓN",
  actividad_aplicacion:      "APLICACIÓN",
  actividad_reubicacion:     "REUBICACIÓN",
  actividad_diagnostico:     "DIAGNÓSTICO",
  actividad_mantenimiento:   "MANTENIMIENTO",
  actividad_refuerzo:        "REFUERZO",
  actividad_colocacion:      "COLOCACIÓN",
  actividad_encamisado:      "ENCAMISADO",
  actividad_pintura:         "PINTURA",
  actividad_demolicion:      "DEMOLICIÓN",
  actividad_montaje:         "MONTAJE",
  actividad_aplanado:        "APLANADO",
  actividad_relleno:         "RELLENO",
  actividad_repavimentacion: "REPAVIMENTACIÓN",
  actividad_mejoramiento:    "MEJORAMIENTO",
  actividad_habilitado:      "HABILITADO",
  actividad_sustitucion:     "SUSTITUCIÓN",
  actividad_habilitacion:    "HABILITACIÓN",
  actividad_renovacion:      "RENOVACIÓN",
};

function extractActividades(row) {
  return Object.entries(ACTIVIDAD_MAP)
    .filter(([col]) => row[col] === true)
    .map(([, label]) => label);
}

/* ── GET /api/alcances/sugerencias?q=texto ── */
exports.getSugerencias = async (req, res) => {
  const q = String(req.query.q || "").trim();
  try {
    const result = await query(
      `SELECT DISTINCT concepto
       FROM ${SCHEMA}.catalogo_alcances
       WHERE activo = true
         AND ($1 = '' OR concepto ILIKE $2)
       ORDER BY concepto
       LIMIT 20`,
      [q, `%${q}%`]
    );
    res.json({ success: true, data: result.rows.map((r) => r.concepto) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/alcances/programas ── */
exports.getProgramas = async (_req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT programa
       FROM ${SCHEMA}.catalogo_alcances
       WHERE activo = true AND programa IS NOT NULL
       ORDER BY programa`
    );
    res.json({ success: true, data: result.rows.map((r) => r.programa) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/alcances/conceptos?programa=X[&area=Y] ── */
exports.getConceptos = async (req, res) => {
  const { programa, area } = req.query;
  if (!programa) return res.status(400).json({ success: false, message: "programa requerido" });
  try {
    const params = [programa];
    let sql = "SELECT DISTINCT concepto FROM " + SCHEMA + ".catalogo_alcances WHERE programa = $1 AND activo = true";
    if (area) { params.push(area); sql += " AND area = $2"; }
    sql += " ORDER BY concepto";
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows.map((r) => r.concepto) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/alcances/detalle?programa=X&concepto=Y[&area=Z] ── */
exports.getDetalle = async (req, res) => {
  const { programa, concepto, area } = req.query;
  if (!programa || !concepto)
    return res.status(400).json({ success: false, message: "programa y concepto requeridos" });
  try {
    const params = [programa, concepto];
    let areaClause = "";
    let areaSubClause = "";
    if (area) {
      params.push(area);
      areaClause    = " AND area = $3";
      areaSubClause = " AND u.area = $3";
    }
    const sql = "SELECT c.*,"
      + " (SELECT array_agg(DISTINCT u.unidad_medida ORDER BY u.unidad_medida)"
      + " FROM " + SCHEMA + ".catalogo_alcances u"
      + " WHERE u.programa = $1 AND u.concepto = $2 AND u.activo = true"
      + " AND u.unidad_medida IS NOT NULL AND u.unidad_medida <> ''"
      + areaSubClause + ") AS unidades_disponibles"
      + " FROM " + SCHEMA + ".catalogo_alcances c"
      + " WHERE c.programa = $1 AND c.concepto = $2 AND c.activo = true"
      + areaClause + " LIMIT 1";
    const result = await query(sql, params);
    if (!result.rows.length)
      return res.status(404).json({ success: false, message: "Concepto no encontrado" });

    const row     = result.rows[0];
    const unidades = row.unidades_disponibles || [];
    res.json({
      success: true,
      data: {
        unidad_medida:        row.unidad_medida || "",
        unidades_disponibles: unidades.length ? unidades : (row.unidad_medida ? [row.unidad_medida] : []),
        area:                 row.area || "",
        actividades:          extractActividades(row),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── POST /api/alcances/guardar ── */
exports.guardar = async (req, res) => {
  const {
    clave_unica, nombre_obra, programa, dg,
    accion, concepto, cantidad, unidad,
    usuario_actualizacion,
  } = req.body;

  if (!clave_unica || !concepto || !accion || !cantidad) {
    return res.status(400).json({
      success: false,
      message: "clave_unica, concepto, accion y cantidad son requeridos",
    });
  }
  if (isNaN(Number(cantidad)) || Number(cantidad) <= 0) {
    return res.status(400).json({ success: false, message: "cantidad debe ser un número positivo" });
  }

  try {
    const result = await query(
      `INSERT INTO ${SCHEMA}.alcances_obras
         (clave_unica, nombre_obra, programa, dg, accion, concepto, cantidad, unidad, usuario_actualizacion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, fecha_captura`,
      [
        clave_unica,
        nombre_obra || null,
        programa    || null,
        dg          || null,
        accion,
        concepto,
        Number(cantidad),
        unidad      || null,
        usuario_actualizacion || null,
      ]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/alcances/historial?clave_unica=X ── */
exports.getHistorial = async (req, res) => {
  const { clave_unica } = req.query;
  if (!clave_unica)
    return res.status(400).json({ success: false, message: "clave_unica requerida" });
  try {
    const result = await query(
      `SELECT id, accion, concepto, cantidad, unidad, tipo_alcance,
              usuario_actualizacion, fecha_captura,
              usuario_edicion, fecha_edicion
       FROM ${SCHEMA}.alcances_obras
       WHERE clave_unica = $1
       ORDER BY fecha_captura DESC`,
      [clave_unica]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/alcances/config ── */
exports.getConfigEdicion = async (_req, res) => {
  try {
    const result = await query(
      `SELECT permitir_edicion_alcances, usuario_admin, fecha_actualizacion
       FROM ${SCHEMA}.configuracion_sistema
       ORDER BY id LIMIT 1`
    );
    const row = result.rows[0] || { permitir_edicion_alcances: false };
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── POST /api/alcances/config  (ADMIN only) ── */
exports.updateConfigEdicion = async (req, res) => {
  const { permitir_edicion_alcances } = req.body;
  const usuario = req.user?.email || req.user?.username || "admin";
  try {
    const check = await query(`SELECT id FROM ${SCHEMA}.configuracion_sistema ORDER BY id LIMIT 1`);
    if (!check.rows.length) {
      await query(
        `INSERT INTO ${SCHEMA}.configuracion_sistema (permitir_edicion_alcances, usuario_admin) VALUES ($1, $2)`,
        [!!permitir_edicion_alcances, usuario]
      );
    } else {
      await query(
        `UPDATE ${SCHEMA}.configuracion_sistema
         SET permitir_edicion_alcances = $1, usuario_admin = $2, fecha_actualizacion = NOW()
         WHERE id = (SELECT id FROM ${SCHEMA}.configuracion_sistema ORDER BY id LIMIT 1)`,
        [!!permitir_edicion_alcances, usuario]
      );
    }
    res.json({ success: true, permitir_edicion_alcances: !!permitir_edicion_alcances });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── PUT /api/alcances/editar/:id ── */
exports.editarAlcance = async (req, res) => {
  const { id } = req.params;
  const { cantidad, unidad, accion, usuario_edicion } = req.body;

  if (!cantidad || isNaN(Number(cantidad)) || Number(cantidad) <= 0) {
    return res.status(400).json({ success: false, message: "cantidad debe ser un número positivo" });
  }

  try {
    const configRes = await query(
      `SELECT permitir_edicion_alcances FROM ${SCHEMA}.configuracion_sistema ORDER BY id LIMIT 1`
    );
    const permitido = configRes.rows[0]?.permitir_edicion_alcances ?? false;
    if (!permitido) {
      return res.status(403).json({
        success: false,
        message: "La edición de alcances está bloqueada por el administrador.",
        code:    "EDICION_BLOQUEADA",
      });
    }

    const result = await query(
      `UPDATE ${SCHEMA}.alcances_obras
       SET cantidad = $1, unidad = $2, accion = $3,
           usuario_edicion = $4, fecha_edicion = NOW()
       WHERE id = $5
       RETURNING id`,
      [Number(cantidad), unidad || null, accion || null, usuario_edicion || null, id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, message: "Registro no encontrado" });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── DELETE /api/alcances/eliminar/:id ── */
exports.eliminarAlcance = async (req, res) => {
  const { id } = req.params;
  try {
    const configRes = await query(
      `SELECT permitir_edicion_alcances FROM ${SCHEMA}.configuracion_sistema ORDER BY id LIMIT 1`
    );
    const permitido = configRes.rows[0]?.permitir_edicion_alcances ?? false;
    if (!permitido) {
      return res.status(403).json({
        success: false,
        message: "La edición de alcances está bloqueada por el administrador.",
        code:    "EDICION_BLOQUEADA",
      });
    }
    await query(`DELETE FROM ${SCHEMA}.alcances_obras WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/alcances/unidades ── */
exports.getUnidades = async (_req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT unidad_medida
       FROM ${SCHEMA}.catalogo_alcances
       WHERE unidad_medida IS NOT NULL AND unidad_medida <> ''
       ORDER BY unidad_medida`
    );
    res.json({ success: true, data: result.rows.map((r) => r.unidad_medida) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── PATCH /api/alcances/tipo-individual/:id — clasificación individual de un registro ── */
exports.updateTipoIndividual = async (req, res) => {
  const { id } = req.params;
  const { tipo_alcance, usuario_edicion } = req.body;

  if (tipo_alcance !== null && tipo_alcance !== undefined && !["PROYECTADO", "EJECUTADO"].includes(tipo_alcance)) {
    return res.status(400).json({ success: false, message: "tipo_alcance debe ser PROYECTADO, EJECUTADO o null" });
  }

  try {
    const configRes = await query(
      `SELECT permitir_edicion_alcances FROM ${SCHEMA}.configuracion_sistema ORDER BY id LIMIT 1`
    );
    const permitido = configRes.rows[0]?.permitir_edicion_alcances ?? false;
    if (!permitido) {
      return res.status(403).json({
        success: false,
        message: "La edición de alcances está bloqueada por el administrador.",
        code:    "EDICION_BLOQUEADA",
      });
    }

    const result = await query(
      `UPDATE ${SCHEMA}.alcances_obras
       SET tipo_alcance = $1, usuario_edicion = $2, fecha_edicion = NOW()
       WHERE id = $3
       RETURNING id`,
      [tipo_alcance || null, usuario_edicion || null, id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, message: "Registro no encontrado" });

    res.json({ success: true, tipo_alcance: tipo_alcance || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── GET /api/alcances/tipo/:clave — clasificación PROYECTADO/EJECUTADO de la obra ── */
exports.getTipoObra = async (req, res) => {
  const clave = String(req.params.clave || "").trim();
  if (!clave) return res.status(400).json({ success: false, message: "clave requerida" });
  try {
    const result = await query(
      `SELECT tipo_alcance, usuario, fecha
       FROM ${SCHEMA}.alcances_obras_tipo
       WHERE clave_unica = $1`,
      [clave]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── PUT /api/alcances/tipo/:clave ── */
exports.updateTipoObra = async (req, res) => {
  const clave   = String(req.params.clave || "").trim();
  const { tipo_alcance, usuario } = req.body;

  if (!clave) return res.status(400).json({ success: false, message: "clave requerida" });
  if (!["PROYECTADO", "EJECUTADO"].includes(tipo_alcance)) {
    return res.status(400).json({ success: false, message: "tipo_alcance debe ser PROYECTADO o EJECUTADO" });
  }

  try {
    await query(
      `INSERT INTO ${SCHEMA}.alcances_obras_tipo (clave_unica, tipo_alcance, usuario)
       VALUES ($1, $2, $3)
       ON CONFLICT (clave_unica)
       DO UPDATE SET tipo_alcance = $2, usuario = $3, fecha = NOW()`,
      [clave, tipo_alcance, usuario || null]
    );
    res.json({ success: true, tipo_alcance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
