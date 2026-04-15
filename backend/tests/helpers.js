/**
 * tests/helpers.js
 * Utilidades compartidas para los tests.
 */
const fs   = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");

/* Snapshots de los datos originales */
let snapshots = {};

function saveSnapshot(collection) {
  const file = path.join(DATA_DIR, `${collection}.json`);
  if (fs.existsSync(file)) {
    snapshots[collection] = fs.readFileSync(file, "utf-8");
  }
}

function restoreSnapshot(collection) {
  if (snapshots[collection]) {
    fs.writeFileSync(path.join(DATA_DIR, `${collection}.json`), snapshots[collection], "utf-8");
  }
}

function saveAllSnapshots() {
  ["obras", "auditoria", "control_sistema", "historico"].forEach(saveSnapshot);
}

function restoreAllSnapshots() {
  ["obras", "auditoria", "control_sistema", "historico"].forEach(restoreSnapshot);
}

/* Token de admin para tests */
const { sign } = require("../utils/jwt");

function adminToken() {
  return sign({ id: 1, email: "admin@obra.com", nombre: "Administrador", rol: "DG", programa: null });
}

function userToken() {
  return sign({ id: 2, email: "juan@obra.com", nombre: "Juan Pérez", rol: "usuario", programa: "Programa de Seguridad Comunitaria" });
}

module.exports = { saveAllSnapshots, restoreAllSnapshots, adminToken, userToken };
