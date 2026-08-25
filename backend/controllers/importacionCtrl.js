/**
 * controllers/importacionCtrl.js
 * Importación masiva de obras desde CSV.
 *
 * POST /api/geoestadistica/importacion/preview   → valida sin insertar
 * POST /api/geoestadistica/importacion/ejecutar  → inserta + integridad
 * GET  /api/geoestadistica/importacion/plantilla → descarga CSV template
 */

const { pool, query, SCHEMA } = require("../config/pg");

const DGS_VALIDAS = new Set([
  "DGCOP","DGOIV","DGOT","DGPEST","DGSUS","ILIFE","IECM",
  "FIDERE","SACMEX","DGODU","IECM",
]);
const ALCALDIAS_VALIDAS = new Set([
  "ÁLVARO OBREGÓN","ALVARO OBREGON",
  "AZCAPOTZALCO","BENITO JUÁREZ","BENITO JUAREZ",
  "COYOACÁN","COYOACAN","CUAJIMALPA DE MORELOS",
  "CUAUHTÉMOC","CUAUHTEMOC","GUSTAVO A. MADERO",
  "IZTACALCO","IZTAPALAPA","LA MAGDALENA CONTRERAS",
  "MIGUEL HIDALGO","MILPA ALTA",
  "TLÁHUAC","TLAHUAC","TLALPAN",
  "VENUSTIANO CARRANZA","XOCHIMILCO",
]);
const ESTATUSES_VALIDOS = new Set([
  "SIN INICIAR","EN PROCESO","TERMINADA","INAUGURADA","CANCELADA",
]);
const TIPO_GEOM_VALIDOS = new Set(["PUNTO","LINEA","POLIGONO"]);
const WKT_PREFIX = { PUNTO: "POINT", LINEA: "LINESTRING", POLIGONO: "POLYGON" };
/* PUNTO admite además MULTIPOINT: obras con varias ubicaciones (luminarias,
   módulos, equipamiento distribuido) que siguen siendo una sola obra/clave_unica. */
const WKT_PREFIX_ALT = { PUNTO: "MULTIPOINT" };

const TABLA_GEOM = {
  PUNTO:    "obras_puntos",
  LINEA:    "obras_lineas",
  POLIGONO: "obras_poligonos",
};

/* ── Genera clave_unica sin fecha: PLATSOBSE_{DG}_{PROG}_{SEQ5} ── */
async function generarClave(client, dg, programa) {
  const dgSlug   = (dg || "XX").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const progSlug = (programa || "OBR")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "").toUpperCase()
    .replace(/\s+/g, "_").slice(0, 25)
    .replace(/_+$/, "");
  const seq = await client.query(
    `SELECT nextval('${SCHEMA}.seq_clave_obras') AS val`
  );
  const n = String(seq.rows[0].val).padStart(5, "0");
  return `PLATSOBSE_${dgSlug}_${progSlug}_${n}`;
}

/* ── Normaliza alcaldía para comparación ── */
function normAlcaldia(a) {
  return String(a || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().trim();
}

/* ── Verifica tipo de WKT vs tipo_geometria ── */
function wktMatchesTipo(wkt, tipo) {
  const w = String(wkt || "").toUpperCase().trim();
  const expected = WKT_PREFIX[tipo];
  if (!expected) return false;
  if (w.startsWith(expected)) return true;
  const alt = WKT_PREFIX_ALT[tipo];
  return alt ? w.startsWith(alt) : false;
}

/* ════════════════════════════════════════════════
   POST /api/geoestadistica/importacion/preview
   Valida todas las filas SIN insertar nada.
   Retorna: { validas, errores, avisos, resumen }
════════════════════════════════════════════════ */
exports.preview = async (req, res) => {
  const { filas = [] } = req.body;

  if (!Array.isArray(filas) || filas.length === 0)
    return res.status(400).json({ success: false, message: "No se recibieron filas." });
  if (filas.length > 1000)
    return res.status(400).json({ success: false, message: "Máximo 1,000 filas por importación." });

  /* Cargar programas conocidos (para avisos) */
  let programasConocidos = new Set();
  try {
    const r = await query(
      `SELECT DISTINCT "PROGRAMA" FROM "${SCHEMA}".obras_puntos WHERE "PROGRAMA" IS NOT NULL LIMIT 200`
    );
    r.rows.forEach((p) => programasConocidos.add(p.PROGRAMA));
  } catch { /* silently ignore — no bloquea la validación */ }

  /* ── Validación por fila ── */
  const resultados = [];
  const clavesProvisionalesSet = new Set();

  /* Separar WKTs válidos por tipo para chequeo espacial en lote */
  const wktsPuntoIdx    = [];
  const wktsLineaIdx    = [];
  const wktsPoligonoIdx = [];

  for (let i = 0; i < filas.length; i++) {
    const fila     = filas[i];
    const fila_num = i + 2; /* +2 porque fila 1 = headers */
    const errores  = [];
    const avisos   = [];

    /* ── Campos obligatorios ── */
    const tipo_geometria = String(fila.tipo_geometria || "").toUpperCase().trim();
    const nombre_obra    = String(fila.nombre_obra    || "").trim();
    const programa       = String(fila.programa       || "").trim();
    const dg             = String(fila.dg             || "").toUpperCase().trim();
    const seguimiento    = String(fila.seguimiento    || "").toUpperCase().trim();
    const alcaldia_raw   = String(fila.alcaldia       || "").trim();
    const wkt            = String(fila.wkt            || "").trim();
    const estatus        = String(fila.estatus        || "SIN INICIAR").toUpperCase().trim();

    if (!TIPO_GEOM_VALIDOS.has(tipo_geometria))
      errores.push(`tipo_geometria "${tipo_geometria}" inválido. Valores: PUNTO, LINEA, POLIGONO`);
    if (!nombre_obra)    errores.push("nombre_obra vacío");
    if (!programa)       errores.push("programa vacío");
    if (!DGS_VALIDAS.has(dg))
      errores.push(`DG "${dg}" no reconocida. Válidas: ${[...DGS_VALIDAS].join(", ")}`);
    if (!DGS_VALIDAS.has(seguimiento))
      errores.push(`seguimiento "${seguimiento}" no reconocido`);

    const alcNorm = normAlcaldia(alcaldia_raw);
    const alcaldiaOk = [...ALCALDIAS_VALIDAS].some((a) => normAlcaldia(a) === alcNorm);
    if (!alcaldiaOk) errores.push(`alcaldia "${alcaldia_raw}" no reconocida`);

    if (!wkt) {
      errores.push("Campo wkt vacío");
    } else if (!wktMatchesTipo(wkt, tipo_geometria)) {
      const alt = WKT_PREFIX_ALT[tipo_geometria];
      const esperado = alt
        ? `${WKT_PREFIX[tipo_geometria]}(...) o ${alt}(...)`
        : `${WKT_PREFIX[tipo_geometria]}(...)`;
      errores.push(`WKT no coincide con tipo_geometria: se esperaba ${esperado}`);
    }

    if (estatus && !ESTATUSES_VALIDOS.has(estatus))
      errores.push(`estatus "${estatus}" no válido. Opciones: ${[...ESTATUSES_VALIDOS].join(", ")}`);

    /* ── Programa desconocido → aviso, NO error ── */
    if (programa && programasConocidos.size > 0 && !programasConocidos.has(programa))
      avisos.push(`Programa "${programa}" no está registrado previamente. Se importará igualmente.`);

    /* ── Duplicado dentro del mismo CSV ── */
    const keyInterna = `${nombre_obra}|${programa}|${dg}`.toUpperCase();
    if (clavesProvisionalesSet.has(keyInterna))
      avisos.push("Posible duplicado interno: misma combinación nombre+programa+DG ya aparece en el CSV.");
    else
      clavesProvisionalesSet.add(keyInterna);

    /* Acumular WKTs válidos para chequeo espacial en lote */
    if (errores.length === 0 && wkt) {
      if (tipo_geometria === "PUNTO")    wktsPuntoIdx.push({ idx: i, wkt });
      if (tipo_geometria === "LINEA")    wktsLineaIdx.push({ idx: i, wkt });
      if (tipo_geometria === "POLIGONO") wktsPoligonoIdx.push({ idx: i, wkt });
    }

    resultados.push({
      fila_num,
      datos:       fila,
      tipo_geometria, nombre_obra, programa, dg, seguimiento,
      alcaldia:    alcaldia_raw, wkt,
      estatus:     ESTATUSES_VALIDOS.has(estatus) ? estatus : "SIN INICIAR",
      errores,
      avisos,
      estado:      errores.length > 0 ? "ERROR" : (avisos.length > 0 ? "AVISO" : "VALIDO"),
    });
  }

  /* ── Chequeo geométrico en BD: validez WKT + duplicados geográficos ── */
  try {
    /* 1. Validar WKT con PostGIS (batch para puntos) */
    for (const grupo of [
      { items: wktsPuntoIdx,    tabla: "obras_puntos",    distancia: 50  },
      { items: wktsLineaIdx,    tabla: "obras_lineas",    distancia: null },
      { items: wktsPoligonoIdx, tabla: "obras_poligonos", distancia: null },
    ]) {
      if (!grupo.items.length) continue;

      /* Validar ST_IsValid para cada WKT */
      const validRes = await query(
        `SELECT
           ordinality - 1                         AS idx,
           ST_IsValid(ST_GeomFromText(wkt, 4326))  AS valida,
           ST_GeometryType(ST_GeomFromText(wkt, 4326)) AS geom_tipo
         FROM unnest($1::text[]) WITH ORDINALITY AS t(wkt, ordinality)`,
        [grupo.items.map((g) => g.wkt)]
      );

      for (const row of validRes.rows) {
        const pos = grupo.items[row.idx]?.idx;
        if (pos === undefined) continue;
        if (!row.valida)
          resultados[pos].errores.push("Geometría WKT inválida según PostGIS (ST_IsValid = false).");
      }

      /* Detección de duplicados geográficos */
      try {
        let dupQuery;
        if (grupo.distancia) {
          /* Puntos: ST_DWithin 50 metros */
          dupQuery = await query(
            `WITH nuevos AS (
               SELECT ordinality - 1 AS idx, ST_GeomFromText(wkt, 4326) AS geom
               FROM unnest($1::text[]) WITH ORDINALITY AS t(wkt, ordinality)
             )
             SELECT DISTINCT n.idx, e.clave_unica, e."NOMBRE_OBRA"
             FROM nuevos n
             JOIN "${SCHEMA}".${grupo.tabla} e
               ON ST_DWithin(n.geom::geography, e.geom::geography, $2)
             LIMIT 50`,
            [grupo.items.map((g) => g.wkt), grupo.distancia]
          );
        } else {
          /* Líneas / Polígonos: ST_Intersects */
          dupQuery = await query(
            `WITH nuevos AS (
               SELECT ordinality - 1 AS idx, ST_GeomFromText(wkt, 4326) AS geom
               FROM unnest($1::text[]) WITH ORDINALITY AS t(wkt, ordinality)
             )
             SELECT DISTINCT n.idx, e.clave_unica, e."NOMBRE_OBRA"
             FROM nuevos n
             JOIN "${SCHEMA}".${grupo.tabla} e
               ON ST_Intersects(n.geom, e.geom)
             LIMIT 50`,
            [grupo.items.map((g) => g.wkt)]
          );
        }

        for (const dup of dupQuery.rows) {
          const pos = grupo.items[dup.idx]?.idx;
          if (pos === undefined) continue;
          resultados[pos].avisos.push(
            `Duplicado geográfico: existe "${dup.NOMBRE_OBRA}" (${dup.clave_unica}) en la misma ubicación.`
          );
          if (resultados[pos].estado === "VALIDO") resultados[pos].estado = "AVISO";
        }
      } catch { /* spatial check no bloquea si falla */ }
    }
  } catch { /* BD no disponible — continuar con validación local */ }

  /* Actualizar estados finales */
  for (const r of resultados) {
    if (r.errores.length > 0) r.estado = "ERROR";
    else if (r.avisos.length > 0) r.estado = "AVISO";
    else r.estado = "VALIDO";
  }

  const validas   = resultados.filter((r) => r.estado !== "ERROR");
  const errores   = resultados.filter((r) => r.estado === "ERROR");
  const avisos    = resultados.filter((r) => r.estado === "AVISO");

  res.json({
    success: true,
    resumen: {
      total:          filas.length,
      validas:        validas.length,
      con_errores:    errores.length,
      con_avisos:     avisos.length,
    },
    resultados,
  });
};

/* ════════════════════════════════════════════════
   POST /api/geoestadistica/importacion/ejecutar
   Inserta solo las filas válidas + verifica integridad.
════════════════════════════════════════════════ */
exports.ejecutar = async (req, res) => {
  const { filas = [], nombre_archivo = "importacion.csv" } = req.body;
  const usuario = req.user?.email || req.user?.usuario || "sistema";

  if (!Array.isArray(filas) || !filas.length)
    return res.status(400).json({ success: false, message: "No hay filas para importar." });

  const lote_id    = `IMP-${(usuario.split("@")[0] || "geo")}-${Date.now()}`;
  const insertadas = [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('application.geo_usuario', $1, true)`, [usuario]);
    await client.query(`SELECT set_config('application.origen', 'SICOPS', true)`);
    await client.query(`SELECT set_config('application.motivo', $1, true)`,
      [`Importación masiva CSV — lote ${lote_id}`]);

    for (const fila of filas) {
      const tipo_geometria = String(fila.tipo_geometria || "").toUpperCase().trim();
      const tabla          = TABLA_GEOM[tipo_geometria];
      if (!tabla) continue;

      const nombre_obra    = String(fila.nombre_obra    || "").trim();
      const programa       = String(fila.programa       || "").trim();
      const dg             = String(fila.dg             || "").toUpperCase().trim();
      const seguimiento    = String(fila.seguimiento    || "").toUpperCase().trim();
      const alcaldia       = String(fila.alcaldia       || "").trim();
      const wkt            = String(fila.wkt            || "").trim();
      const estatus        = String(fila.estatus        || "SIN INICIAR").toUpperCase().trim();
      const colonia        = String(fila.colonia        || "").trim() || null;
      const calle          = String(fila.calle_domicilio|| fila.calle || "").trim() || null;
      const url            = String(fila.url_google_maps|| "").trim() || null;
      const observaciones  = String(fila.observaciones  || "").trim() || null;
      const tipo           = String(fila.tipo           || "").trim() || null;
      const modalidad      = String(fila.modalidad      || "").trim() || null;
      const responsable_dg = String(fila.responsable_dg || "").trim() || null;
      /* Campos adicionales — mismos que altaObra */
      const identificador  = String(fila.identificador  || "").trim() || null;
      const anio           = fila.anio ? parseInt(fila.anio, 10) : null;
      const bloque_mundial = fila.bloque_mundial ? parseInt(fila.bloque_mundial, 10) : null;
      const clave_eje      = String(fila.clave_eje      || "").trim() || null;
      const nombre_eje     = String(fila.nombre_eje     || "").trim() || null;
      const clave_programa = String(fila.clave_programa || "").trim() || null;
      const monto          = fila.monto ? parseFloat(fila.monto) : null;

      const clave = await generarClave(client, dg, programa);

      /* Acepta WKT y EWKB hex (exportación QGIS) */
      const geomExpr = /^[0-9A-Fa-f]+$/.test(wkt.replace(/\s/g, "")) && wkt.length > 20
        ? "$17::geometry"
        : "ST_GeomFromText($17, 4326)";

      await client.query(`
        INSERT INTO "${SCHEMA}".${tabla} (
          "IDENTIFICADOR",
          clave_unica, "NOMBRE_OBRA", "PROGRAMA", "CLAVE_PROGRAMA",
          "DG", "SEGUIMIENTO", "ALCALDIA",
          "CLAVE_EJE", "NOMBRE_EJE", "BLOQUE_MUNDIAL",
          "YEAR", "COLONIA", "CALLE/DOMICILIO", "URL DE GOOGLE MAPS",
          "OBSERVACIONES", "TIPO", "MODALIDAD", "RESPONSABLE_DG", "MONTO",
          "ESTATUS", geom,
          estatus_registro, creado_por, fecha_creacion
        ) VALUES (
          $1,
          $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11,
          $12, $13, $14, $15,
          $16, $18, $19, $20, $21,
          $22, ${geomExpr},
          'ACTIVO', $23, NOW()
        )
      `, [
        identificador || clave,  /* $1  IDENTIFICADOR (NOT NULL) */
        clave,                   /* $2  */
        nombre_obra,             /* $3  */
        programa,                /* $4  */
        clave_programa,          /* $5  */
        dg,                      /* $6  */
        seguimiento,             /* $7  */
        alcaldia,                /* $8  */
        clave_eje,               /* $9  */
        nombre_eje,              /* $10 */
        bloque_mundial,          /* $11 */
        anio,                    /* $12 */
        colonia,                 /* $13 */
        calle,                   /* $14 */
        url,                     /* $15 */
        observaciones,           /* $16 */
        wkt,                     /* $17 (geom) */
        tipo,                    /* $18 */
        modalidad,               /* $19 */
        responsable_dg,          /* $20 */
        monto,                   /* $21 */
        ESTATUSES_VALIDOS.has(estatus) ? estatus : "SIN INICIAR", /* $22 */
        usuario,                 /* $23 */
      ]);

      await client.query(`
        INSERT INTO "${SCHEMA}".catalogo_obras
          (clave_unica, tipo_geometria, tabla_actual, estatus_registro, creado_por, fecha_creacion)
        VALUES ($1, $2, $3, 'ACTIVO', $4, NOW())
        ON CONFLICT (clave_unica) DO NOTHING
      `, [clave, tipo_geometria, tabla, usuario]);

      insertadas.push(clave);
    }

    /* ── Validación de integridad automática ── */
    const integridad = await client.query(`
      WITH esperadas AS (
        SELECT unnest($1::text[]) AS clave
      )
      SELECT
        COUNT(e.clave)                           AS total_esperadas,
        COUNT(co.clave_unica)                    AS en_catalogo,
        SUM(CASE WHEN ST_IsValid(op.geom) THEN 1 ELSE 0 END) AS geometrias_validas
      FROM esperadas e
      LEFT JOIN "${SCHEMA}".catalogo_obras co ON co.clave_unica = e.clave
      LEFT JOIN (
        SELECT clave_unica, geom FROM "${SCHEMA}".obras_puntos
        UNION ALL SELECT clave_unica, geom FROM "${SCHEMA}".obras_lineas
        UNION ALL SELECT clave_unica, geom FROM "${SCHEMA}".obras_poligonos
      ) op ON op.clave_unica = e.clave
    `, [insertadas]);

    const row = integridad.rows[0];
    const integridadOk =
      parseInt(row.total_esperadas)    === insertadas.length &&
      parseInt(row.en_catalogo)        === insertadas.length &&
      parseInt(row.geometrias_validas) === insertadas.length;

    if (!integridadOk) {
      await client.query("ROLLBACK");
      return res.status(500).json({
        success: false,
        message: "La validación de integridad falló. Ninguna obra fue importada.",
        integridad: {
          esperadas:          insertadas.length,
          en_catalogo:        parseInt(row.en_catalogo),
          geometrias_validas: parseInt(row.geometrias_validas),
        },
      });
    }

    /* Registrar el lote */
    await client.query(`
      INSERT INTO "${SCHEMA}".obras_importaciones
        (lote_id, usuario, nombre_archivo, total_enviadas, total_importadas, claves_insertadas)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [lote_id, usuario, nombre_archivo, filas.length, insertadas.length, insertadas]);

    await client.query("COMMIT");

    res.json({
      success:          true,
      lote_id,
      total_importadas: insertadas.length,
      integridad:       { ok: true, verificadas: insertadas.length },
      message:          `${insertadas.length} obras importadas y verificadas exitosamente.`,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

/* ════════════════════════════════════════════════
   GET /api/geoestadistica/importacion/plantilla
   Descarga CSV template con headers + 3 filas de ejemplo.
════════════════════════════════════════════════ */
exports.descargarPlantilla = (_req, res) => {
  /* Columnas en el mismo orden que el formulario de alta individual */
  const headers = [
    "tipo_geometria","identificador","nombre_obra","programa","clave_programa",
    "dg","seguimiento","alcaldia","estatus","anio",
    "bloque_mundial","clave_eje","nombre_eje",
    "wkt",
    "colonia","calle_domicilio","url_google_maps",
    "observaciones","tipo","modalidad","responsable_dg","monto",
  ];

  const anioActual = new Date().getFullYear();

  const ejemplos = [
    [
      "PUNTO","","CANCHA DEPORTIVA NORTE","EL BALON VUELVE AL BARRIO","",
      "DGPEST","DGPEST","IZTAPALAPA","EN PROCESO",anioActual,
      "","","",
      "POINT(-99.1019 19.3810)",
      "Colonia Obrera","Calle Principal 123","",
      "","CANCHA","CONTRATO","DGPEST","",
    ],
    [
      "LINEA","","AV PRINCIPAL ILUMINACION","CIUDAD ILUMINADA: COMUNIDAD SEGURA","",
      "DGSUS","DGSUS","CUAUHTÉMOC","SIN INICIAR",anioActual,
      "","","",
      "LINESTRING(-99.1590 19.4270, -99.1600 19.4280)",
      "Centro","Av. Insurgentes","",
      "","ILUMINACION","","DGSUS","",
    ],
    [
      "POLIGONO","","PARQUE RECREATIVO SUR","PARQUES ALEGRIA","",
      "DGSUS","DGSUS","COYOACÁN","TERMINADA",anioActual,
      "","","",
      "POLYGON((-99.1740 19.3680,-99.1730 19.3680,-99.1730 19.3690,-99.1740 19.3690,-99.1740 19.3680))",
      "Del Valle","","https://maps.google.com/?q=19.3685,-99.1735",
      "","PARQUE","","","",
    ],
  ];

  const csvLines = [
    headers.join(","),
    ...ejemplos.map((row) =>
      row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ),
  ];

  const csv = csvLines.join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="plantilla_importacion_obras.csv"');
  res.send("﻿" + csv); /* BOM para compatibilidad con Excel */
};
