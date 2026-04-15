/**
 * tests/validators.test.js
 * Tests unitarios de las funciones de validación.
 */
const {
  validarRangoPorcentaje,
  evaluarDelta,
  validarCodigoVerbal,
  validarSistemaAbierto,
} = require("../utils/validators");

describe("VALIDATORS — validarRangoPorcentaje", () => {
  test("✓ Valor 0 válido",   () => expect(validarRangoPorcentaje(0).valido).toBe(true));
  test("✓ Valor 100 válido", () => expect(validarRangoPorcentaje(100).valido).toBe(true));
  test("✓ Valor 50 válido",  () => expect(validarRangoPorcentaje(50).valido).toBe(true));
  test("✗ Valor -1 inválido",   () => expect(validarRangoPorcentaje(-1).valido).toBe(false));
  test("✗ Valor 101 inválido",  () => expect(validarRangoPorcentaje(101).valido).toBe(false));
  test("✗ Texto inválido",      () => expect(validarRangoPorcentaje("abc").valido).toBe(false));
  test("✗ Undefined inválido",  () => expect(validarRangoPorcentaje(undefined).valido).toBe(false));
});

describe("VALIDATORS — evaluarDelta", () => {
  test("✓ Delta positivo normal retorna valido=true", () => {
    const r = evaluarDelta(45, 50);
    expect(r.valido).toBe(true);
    expect(r.delta).toBe(5);
    expect(r.tipo).toBe("ok");
    expect(r.alertas).toHaveLength(0);
  });

  test("✓ Delta > 10 retorna valido=true con alerta", () => {
    const r = evaluarDelta(45, 60);
    expect(r.valido).toBe(true);
    expect(r.delta).toBe(15);
    expect(r.tipo).toBe("advertencia");
    expect(r.alertas.length).toBeGreaterThan(0);
    expect(r.codigo).toBe("DELTA_GRANDE");
  });

  test("✗ Delta negativo retorna valido=false", () => {
    const r = evaluarDelta(50, 40);
    expect(r.valido).toBe(false);
    expect(r.delta).toBe(-10);
    expect(r.codigo).toBe("DELTA_NEGATIVO");
  });

  test("✗ Delta cero retorna valido=false", () => {
    const r = evaluarDelta(50, 50);
    expect(r.valido).toBe(false);
    expect(r.codigo).toBe("SIN_CAMBIO");
  });

  test("✓ De 0 a 100 es delta válido con alerta grande", () => {
    const r = evaluarDelta(0, 100);
    expect(r.valido).toBe(true);
    expect(r.delta).toBe(100);
    expect(r.tipo).toBe("advertencia");
  });
});

describe("VALIDATORS — validarCodigoVerbal", () => {
  test('✓ "CONFIRMO" exacto es válido',        () => expect(validarCodigoVerbal("CONFIRMO").valido).toBe(true));
  test('✗ "confirmo" minúsculas es inválido',   () => expect(validarCodigoVerbal("confirmo").valido).toBe(false));
  test('✗ "CONFIRMO " con espacio es inválido', () => expect(validarCodigoVerbal("CONFIRMO ").valido).toBe(false));
  test('✗ "" vacío es inválido',               () => expect(validarCodigoVerbal("").valido).toBe(false));
  test('✗ "CONF" parcial es inválido',          () => expect(validarCodigoVerbal("CONF").valido).toBe(false));
});

describe("VALIDATORS — validarSistemaAbierto", () => {
  test("✓ Sistema abierto y no bloqueado es válido", () => {
    const r = validarSistemaAbierto({ estado: "abierto", bloqueado_edicion: false });
    expect(r.valido).toBe(true);
  });

  test("✗ Sistema cerrado es inválido", () => {
    const r = validarSistemaAbierto({ estado: "cerrado", bloqueado_edicion: true });
    expect(r.valido).toBe(false);
    expect(r.codigo).toBe("SISTEMA_CERRADO");
  });

  test("✗ Sistema abierto pero bloqueado es inválido", () => {
    const r = validarSistemaAbierto({ estado: "abierto", bloqueado_edicion: true });
    expect(r.valido).toBe(false);
  });

  test("✗ null devuelve inválido", () => {
    const r = validarSistemaAbierto(null);
    expect(r.valido).toBe(false);
  });
});
