/**
 * tests/obras.test.js
 * Tests de validaciones de obras, delta, sistema y flujo de confirmación.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_key";

const request = require("supertest");
const app     = require("../server");
const db      = require("../config/db");
const { saveAllSnapshots, restoreAllSnapshots, adminToken } = require("./helpers");

const TOKEN = adminToken();
const AUTH  = { Authorization: `Bearer ${TOKEN}` };

beforeAll(() => saveAllSnapshots());
afterAll(() => restoreAllSnapshots());
afterEach(() => restoreAllSnapshots());

/* ─────────────────────────────────────────────
   GET /api/obras
───────────────────────────────────────────── */
describe("OBRAS — GET /api/obras", () => {
  test("✓ Lista obras con paginación", async () => {
    const res = await request(app).get("/api/obras?pagina=1&limite=5").set(AUTH);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.paginas).toBeGreaterThanOrEqual(1);
  });

  test("✓ Filtra por estado", async () => {
    const res = await request(app).get("/api/obras?estado=actualizada").set(AUTH);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.every((o) => o.estado === "actualizada")).toBe(true);
  });

  test("✓ Filtra por programa", async () => {
    const programa = "Programa de Bienestar Social";
    const res = await request(app)
      .get(`/api/obras?programa=${encodeURIComponent(programa)}`)
      .set(AUTH);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.every((o) => o.programa === programa)).toBe(true);
  });
});

/* ─────────────────────────────────────────────
   GET /api/obras/:id
───────────────────────────────────────────── */
describe("OBRAS — GET /api/obras/:id", () => {
  test("✓ Obtiene una obra existente", async () => {
    const res = await request(app).get("/api/obras/1").set(AUTH);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(1);
  });

  test("✗ Obra inexistente devuelve 404", async () => {
    const res = await request(app).get("/api/obras/9999").set(AUTH);
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

/* ─────────────────────────────────────────────
   VALIDACIÓN: Delta negativo rechazado
───────────────────────────────────────────── */
describe("OBRAS — Validación de delta", () => {
  beforeEach(() => {
    /* Asegurar sistema abierto */
    db.updateSingle("control_sistema", { estado: "abierto", bloqueado_edicion: false });
  });

  test("✗ Delta negativo es rechazado con 400", async () => {
    const obra = db.findById("obras", 1); // porcentaje_avance: 45
    const res  = await request(app)
      .post("/api/obras/1/editar")
      .set(AUTH)
      .send({ porcentaje_nuevo: obra.porcentaje_avance - 10 }); // menor que el actual

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.codigo).toBe("DELTA_NEGATIVO");
  });

  test("✗ Mismo porcentaje rechazado (sin cambio)", async () => {
    const obra = db.findById("obras", 1);
    const res  = await request(app)
      .post("/api/obras/1/editar")
      .set(AUTH)
      .send({ porcentaje_nuevo: obra.porcentaje_avance });

    expect(res.statusCode).toBe(400);
    expect(res.body.codigo).toBe("SIN_CAMBIO");
  });

  test("⚠ Delta > 10% es aceptado pero incluye alerta", async () => {
    const obra = db.findById("obras", 1); // 45%
    const res  = await request(app)
      .post("/api/obras/1/editar")
      .set(AUTH)
      .send({ porcentaje_nuevo: obra.porcentaje_avance + 20 }); // +20%

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.validacion.tipo).toBe("advertencia");
    expect(res.body.validacion.alertas.length).toBeGreaterThan(0);
    expect(res.body.cambio_id).toBeDefined();
  });

  test("✓ Delta normal (≤10%) aceptado sin alertas", async () => {
    const obra = db.findById("obras", 1); // 45%
    const res  = await request(app)
      .post("/api/obras/1/editar")
      .set(AUTH)
      .send({ porcentaje_nuevo: obra.porcentaje_avance + 5 }); // +5%

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.validacion.tipo).toBe("ok");
    expect(res.body.validacion.alertas).toHaveLength(0);
    expect(res.body.cambio_id).toBeDefined();
  });

  test("✗ Porcentaje fuera de rango (>100) rechazado", async () => {
    const res = await request(app)
      .post("/api/obras/1/editar")
      .set(AUTH)
      .send({ porcentaje_nuevo: 150 });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("RANGO_INVALIDO");
  });

  test("✗ Porcentaje negativo rechazado", async () => {
    const res = await request(app)
      .post("/api/obras/1/editar")
      .set(AUTH)
      .send({ porcentaje_nuevo: -5 });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("RANGO_INVALIDO");
  });
});

/* ─────────────────────────────────────────────
   VALIDACIÓN: Sistema cerrado bloquea edición
───────────────────────────────────────────── */
describe("OBRAS — Sistema cerrado", () => {
  beforeEach(() => {
    db.updateSingle("control_sistema", { estado: "cerrado", bloqueado_edicion: true });
  });

  test("✗ Sistema cerrado bloquea la edición con 400", async () => {
    const res = await request(app)
      .post("/api/obras/1/editar")
      .set(AUTH)
      .send({ porcentaje_nuevo: 50 });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.codigo).toBe("SISTEMA_CERRADO");
  });
});

/* ─────────────────────────────────────────────
   FLUJO COMPLETO: Edición → Confirm Step1 → Step2
───────────────────────────────────────────── */
describe("OBRAS — Flujo de confirmación", () => {
  beforeEach(() => {
    db.updateSingle("control_sistema", { estado: "abierto", bloqueado_edicion: false });
  });

  test("✓ Flujo completo de actualización exitosa", async () => {
    /* Paso 0: Iniciar edición */
    const r0 = await request(app)
      .post("/api/obras/1/editar")
      .set(AUTH)
      .send({ porcentaje_nuevo: 50, motivo: "avance físico" });

    expect(r0.statusCode).toBe(200);
    const cambioId = r0.body.cambio_id;
    expect(cambioId).toBeDefined();

    /* Paso 1: Confirmar step1 */
    const r1 = await request(app)
      .post("/api/obras/1/confirmar/step1")
      .set(AUTH)
      .send({ cambio_id: cambioId });

    expect(r1.statusCode).toBe(200);
    expect(r1.body.paso).toBe("requiere_verificacion");

    /* Paso 2: Confirmar step2 con código verbal correcto */
    const r2 = await request(app)
      .post("/api/obras/1/confirmar/step2")
      .set(AUTH)
      .send({ cambio_id: cambioId, codigo_verbal: "CONFIRMO" });

    expect(r2.statusCode).toBe(200);
    expect(r2.body.success).toBe(true);
    expect(r2.body.obra.porcentaje_avance).toBe(50);
    expect(r2.body.obra.confirmado_por).toBe("admin@obra.com");
  });

  test("✗ Código verbal incorrecto en step2 rechazado", async () => {
    const r0 = await request(app)
      .post("/api/obras/1/editar")
      .set(AUTH)
      .send({ porcentaje_nuevo: 50 });

    const cambioId = r0.body.cambio_id;

    await request(app).post("/api/obras/1/confirmar/step1").set(AUTH).send({ cambio_id: cambioId });

    const r2 = await request(app)
      .post("/api/obras/1/confirmar/step2")
      .set(AUTH)
      .send({ cambio_id: cambioId, codigo_verbal: "CONFIRMO_MAL" });

    expect(r2.statusCode).toBe(400);
    expect(r2.body.code).toBe("CODIGO_INCORRECTO");
  });

  test("✗ cambio_id inválido en step1 devuelve error", async () => {
    const res = await request(app)
      .post("/api/obras/1/confirmar/step1")
      .set(AUTH)
      .send({ cambio_id: "id_inexistente_xyz" });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("CAMBIO_EXPIRADO");
  });

  test("✗ Step2 sin pasar por step1 devuelve error", async () => {
    const r0 = await request(app)
      .post("/api/obras/1/editar")
      .set(AUTH)
      .send({ porcentaje_nuevo: 50 });

    const cambioId = r0.body.cambio_id;

    /* Sin hacer step1, intentar step2 directamente */
    const r2 = await request(app)
      .post("/api/obras/1/confirmar/step2")
      .set(AUTH)
      .send({ cambio_id: cambioId, codigo_verbal: "CONFIRMO" });

    expect(r2.statusCode).toBe(400);
    expect(r2.body.code).toBe("PASO_INCORRECTO");
  });
});

/* ─────────────────────────────────────────────
   CONTROL — Estado del sistema
───────────────────────────────────────────── */
describe("CONTROL — Estado del sistema", () => {
  test("✓ GET /api/control/estado devuelve estado actual", async () => {
    const res = await request(app).get("/api/control/estado").set(AUTH);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.abierto).toBe("boolean");
    expect(res.body.periodo_actual).toBeDefined();
  });

  test("✓ Abrir el sistema con rol DG", async () => {
    db.updateSingle("control_sistema", { estado: "cerrado", bloqueado_edicion: true });
    const res = await request(app).post("/api/control/abrir").set(AUTH);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("✓ Cerrar el sistema con rol DG genera snapshot", async () => {
    db.updateSingle("control_sistema", { estado: "abierto", bloqueado_edicion: false });
    const res = await request(app).post("/api/control/cerrar").set(AUTH);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.resumen.total_obras).toBeGreaterThan(0);
  });
});
