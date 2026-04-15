/**
 * tests/cron.test.js
 * Tests del cierre automático y generación de snapshots.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_key";

const db   = require("../config/db");
const { ejecutarCierreAutomatico, ejecutarAperturaAutomatica, getPeriodo } = require("../utils/cron");
const { saveAllSnapshots, restoreAllSnapshots } = require("./helpers");

beforeAll(() => saveAllSnapshots());
afterAll(() => restoreAllSnapshots());
afterEach(() => restoreAllSnapshots());

describe("CRON — getPeriodo", () => {
  test("✓ Devuelve formato correcto YYYY-Www", () => {
    const periodo = getPeriodo(new Date("2025-01-07"));
    expect(periodo).toMatch(/^\d{4}-W\d{2}$/);
  });

  test("✓ Semana 1 de 2025 es 2025-W01", () => {
    expect(getPeriodo(new Date("2025-01-01"))).toBe("2025-W01");
  });
});

describe("CRON — ejecutarCierreAutomatico", () => {
  beforeEach(() => {
    db.updateSingle("control_sistema", {
      estado:            "abierto",
      bloqueado_edicion: false,
      periodo_actual:    "2025-test-W99",
      fecha_apertura:    new Date().toISOString(),
      proxima_clausura:  new Date().toISOString(),
    });
  });

  test("✓ Cierra el sistema (estado → cerrado)", () => {
    ejecutarCierreAutomatico();
    const control = db.read("control_sistema");
    expect(control.estado).toBe("cerrado");
    expect(control.bloqueado_edicion).toBe(true);
    expect(control.ultimo_cierre).toBeDefined();
  });

  test("✓ Genera snapshot en histórico", () => {
    const antesCount = db.read("historico").length;
    ejecutarCierreAutomatico();
    const despuesCount = db.read("historico").length;
    expect(despuesCount).toBeGreaterThanOrEqual(antesCount);
  });

  test("✓ Registra en auditoría", () => {
    const antesCount = db.read("auditoria").length;
    ejecutarCierreAutomatico();
    const despuesCount = db.read("auditoria").length;
    expect(despuesCount).toBeGreaterThan(antesCount);
    const ultimo = db.read("auditoria").reverse()[0];
    expect(ultimo.accion).toBe("cierre_automatico");
    expect(ultimo.usuario).toBe("sistema");
  });

  test("✓ No ejecuta si el sistema ya está cerrado", () => {
    db.updateSingle("control_sistema", { estado: "cerrado", bloqueado_edicion: true });
    const antesAuditoria = db.read("auditoria").length;
    ejecutarCierreAutomatico();
    expect(db.read("auditoria").length).toBe(antesAuditoria); // no agrega nada
  });

  test("✓ No duplica snapshot para el mismo período", () => {
    ejecutarCierreAutomatico(); // primer cierre
    db.updateSingle("control_sistema", { estado: "abierto", bloqueado_edicion: false });
    const count1 = db.read("historico").length;
    ejecutarCierreAutomatico(); // segundo cierre del mismo período
    const count2 = db.read("historico").length;
    expect(count2).toBe(count1); // no debe duplicar
  });
});

describe("CRON — ejecutarAperturaAutomatica", () => {
  beforeEach(() => {
    db.updateSingle("control_sistema", {
      estado:            "cerrado",
      bloqueado_edicion: true,
      cerrado_por:       "sistema",
    });
  });

  test("✓ Abre el sistema (estado → abierto)", () => {
    ejecutarAperturaAutomatica();
    const control = db.read("control_sistema");
    expect(control.estado).toBe("abierto");
    expect(control.bloqueado_edicion).toBe(false);
    expect(control.periodo_actual).toMatch(/^\d{4}-W\d{2}$/);
  });
});
