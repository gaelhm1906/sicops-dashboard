/**
 * config/db.js
 * Capa de acceso a datos usando archivos JSON locales.
 * Simula una base de datos con operaciones CRUD básicas.
 */
const fs   = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");

const COLLECTIONS = {
  obras:           "obras.json",
  usuarios:        "usuarios.json",
  auditoria:       "auditoria.json",
  control_sistema: "control_sistema.json",
  historico:       "historico.json",
};

/**
 * Lee una colección del disco.
 * @param {string} collection - Nombre de la colección
 * @returns {Array|Object}
 */
function read(collection) {
  const file = COLLECTIONS[collection];
  if (!file) throw new Error(`Colección desconocida: ${collection}`);

  const filePath = path.join(DATA_DIR, file);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return collection === "control_sistema" ? {} : [];
    throw new Error(`Error leyendo ${collection}: ${err.message}`);
  }
}

/**
 * Escribe una colección completa al disco.
 * @param {string} collection
 * @param {Array|Object} data
 */
function write(collection, data) {
  const file = COLLECTIONS[collection];
  if (!file) throw new Error(`Colección desconocida: ${collection}`);

  const filePath = path.join(DATA_DIR, file);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/* ── Helpers de alto nivel ── */

function findById(collection, id) {
  const data = read(collection);
  return Array.isArray(data) ? data.find((item) => item.id === id) || null : null;
}

function findOne(collection, predicate) {
  const data = read(collection);
  return Array.isArray(data) ? data.find(predicate) || null : null;
}

function findMany(collection, predicate) {
  const data = read(collection);
  if (!Array.isArray(data)) return [];
  return predicate ? data.filter(predicate) : data;
}

function insert(collection, item) {
  const data = read(collection);
  if (!Array.isArray(data)) throw new Error(`${collection} no es un array`);
  const newId = data.length > 0 ? Math.max(...data.map((d) => d.id || 0)) + 1 : 1;
  const newItem = { id: newId, ...item };
  data.push(newItem);
  write(collection, data);
  return newItem;
}

function updateById(collection, id, updates) {
  const data = read(collection);
  if (!Array.isArray(data)) throw new Error(`${collection} no es un array`);
  const idx = data.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  data[idx] = { ...data[idx], ...updates };
  write(collection, data);
  return data[idx];
}

function updateSingle(collection, updates) {
  const current = read(collection);
  const updated = { ...current, ...updates };
  write(collection, updated);
  return updated;
}

module.exports = {
  read,
  write,
  findById,
  findOne,
  findMany,
  insert,
  updateById,
  updateSingle,
};
