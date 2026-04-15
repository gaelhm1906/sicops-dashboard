/**
 * tests/auth.test.js
 * Tests de autenticación: login, logout, ruta protegida.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_key";

const request = require("supertest");
const app     = require("../server");
const { adminToken } = require("./helpers");

describe("AUTH — POST /api/auth/login", () => {
  test("✓ Login exitoso con credenciales correctas", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email:    "admin@obra.com",
      password: "123456",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user.email).toBe("admin@obra.com");
    expect(res.body.user.rol).toBe("DG");
    expect(res.body.user).not.toHaveProperty("password_hash");
  });

  test("✗ Login fallido con contraseña incorrecta", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email:    "admin@obra.com",
      password: "password_incorrecta",
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Credenciales inválidas/i);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
    expect(res.body.token).toBeUndefined();
  });

  test("✗ Login fallido con email inexistente", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email:    "noexiste@obra.com",
      password: "123456",
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  test("✗ Login sin email devuelve 400", async () => {
    const res = await request(app).post("/api/auth/login").send({ password: "123456" });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("MISSING_FIELDS");
  });

  test("✗ Login con email inválido devuelve 400", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email:    "no-es-un-email",
      password: "123456",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("INVALID_EMAIL");
  });
});

describe("AUTH — Rutas protegidas", () => {
  test("✗ Acceso sin token devuelve 401", async () => {
    const res = await request(app).get("/api/obras");
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("TOKEN_MISSING");
  });

  test("✗ Acceso con token inválido devuelve 401", async () => {
    const res = await request(app)
      .get("/api/obras")
      .set("Authorization", "Bearer token_invalido_xyz");
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("TOKEN_INVALID");
  });

  test("✓ Acceso con token válido permite la petición", async () => {
    const token = adminToken();
    const res   = await request(app)
      .get("/api/obras")
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("AUTH — GET /api/auth/me", () => {
  test("✓ Devuelve datos del usuario autenticado", async () => {
    const token = adminToken();
    const res   = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.email).toBe("admin@obra.com");
    expect(res.body.user.rol).toBe("DG");
  });
});
