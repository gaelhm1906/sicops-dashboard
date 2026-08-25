# Diseño del modelo de base de datos — PS_SICOPS_FINAL

Última actualización: 2026-08-19
Estado: **propuesta de diseño, sin ejecutar todavía.** Ningún código ni base de datos real ha sido modificado. Este documento es la base para revisión antes de construir nada.

## 1. Objetivo

Consolidar en una sola API bien documentada (`PS_SICOPS_FINAL`, puerto 3004) lo que hoy están resolviendo por separado `sicops-api` (3001) y `sigsobse-api` (3002), corrigiendo los problemas estructurales heredados del modelo actual, para que:

- Los tipos de dato sean correctos (dinero/avance en `numeric`, fechas en `date`/`timestamptz`, nunca `text`).
- Las relaciones sean llaves foráneas reales, no texto repetido.
- Exista una sola fuente de verdad por concepto (un solo lugar para "avance", uno para "auditoría"), no 3-4 intentos paralelos.
- El motor financiero (obra + supervisión + servicios + adquisiciones) funcione desde el modelo, no se calcule a mano.
- Cualquier persona del equipo pueda entender la estructura sin arqueología de código.

## 2. Diagnóstico del modelo actual (evidencia real, no supuesta)

Se inspeccionó en vivo, de solo lectura, el Postgres de producción (`sig_sobse`, 32 tablas) y la MySQL de captura de contratos en Hostinger (`u202398458_SICOPS_CAPTURA`, 13 tablas). Hallazgos que este diseño corrige:

### 2.1 "Avance" se guarda en al menos 8 lugares, con tipos inconsistentes entre sí
| Tabla.columna | Tipo | Filas |
|---|---|---|
| `obras_puntos."AVANCE REAL"` | numeric | 1,031 |
| `obras_lineas."AVANCE REAL"` | **text** | 306 |
| `obras_poligonos."AVANCE REAL"` | numeric | 96 |
| `frentes_obra.avance` | **text** | 1,477 |
| `snapshots_semanales.avance` y `.avance_real` | real + numeric (dos columnas en la misma tabla) | 23,652 |
| `snapshots_frentes_utopias.avance` | real | 2,784 |
| `uto_2025.avance_real/avance_programado/avance_semanal` | numeric ×3 | 195 |
| `historial_avances` / `historico_semanal` | double precision | 0 (nunca se usaron) |

El mismo campo conceptual es `numeric` en una tabla y `text` en la tabla hermana — es la causa raíz de las heurísticas de "adivinar columna" que hoy tiene el backend, y de casos como el de obra marcada 100% cuando no lo estaba.

### 2.2 Sistemas duplicados compitiendo entre sí
- **Auditoría por partida doble**: `auditoria` (4,680 filas) y `obras_auditoria` (7,038 filas, mejor diseñada con `jsonb` antes/después) — sin que quede claro cuál manda.
- **Historial de avance por triplicado**: `historial_avances` y `historico_semanal` (vacías) vs. `snapshots_semanales` (23,652 filas, la que sí sobrevivió).
- **"Frentes" por partida doble**: `frentes_obra` (1,477 filas) y `obras_tmp` (1,046 filas, casi idéntica, nombre "temporal" pero con datos reales permanentes).
- 8 de las 32 tablas de `sig_sobse` están en 0 filas — nunca se adoptaron (`incidencias` y sus 3 tablas hijas, `obras_solicitudes`, `obras_importaciones`, `historial_avances`, `historico_semanal`).

### 2.3 Sin llaves foráneas reales
Las relaciones (`frentes_obra` ↔ obra, `contratos` ↔ `dgs`/`catalogo_programas`) se resuelven por texto repetido (`nombre_obra`, `alcaldia`, `colonia` copiados en cada tabla) en vez de un ID relacionado. Esto permite datos huérfanos y desincronizados.

### 2.4 Dinero y fechas guardados como texto
`frentes_obra.monto`, `.monto_sup`, `.monto_contrato`, `.inicio_contr`, `.fin_contr`, `.year` — todos `text`. No se puede sumar ni filtrar por rango de fecha sin conversión, y nada garantiza formato consistente.

### 2.5 El modelo de contratos ya intentó separarse una vez, y no cuajó
En la MySQL de captura existen las tablas `contrato_obra` y `contrato_frente`, creadas para esto mismo, con **0 filas**. Confirma que vincular contratos con una interfaz real requiere desarrollo dedicado — se retoma aquí, no se repite el intento a medias.

## 3. Alcance de datos reales a incorporar (sin migración masiva — "reinicio" ya acordado)

| Fuente | Qué se trae | Volumen |
|---|---|---|
| `sig_sobse.obras_puntos/lineas/poligonos` con `YEAR = 2026` | Obras ya registradas este año, activas | 344 + 57 + 10 = **411 obras** |
| MySQL captura (`u202398458_SICOPS_CAPTURA`) | Contratos históricos + catálogos | **402 contratos**, 85 planteles, 8 DGs, 46 programas, 12 áreas responsables, 58 puestos |
| `sig_sobse` años anteriores (2024/2025) | Se **quedan** en el sistema actual hasta su cierre — no migran | ~1,022 obras |

Regla administrativa (ya acordada, no es lógica de fecha en código): todo lo que se capture de aquí en adelante se instruye como "obra 2026", y entra directo al modelo nuevo.

## 4. Modelo de datos propuesto

### 4.1 Núcleo: obra + geometría por tipo (reutiliza la idea de Conservación Vial, corregida)

```sql
CREATE TABLE obras (
  id                    BIGSERIAL PRIMARY KEY,
  clave_unica           TEXT UNIQUE NOT NULL,
  nombre_obra           TEXT NOT NULL,
  tipo_geometria        TEXT NOT NULL CHECK (tipo_geometria IN ('PUNTO','LINEA','POLIGONO')),
  anio                  INT  NOT NULL,                 -- "obra 2026", administrativo
  dg_id                 INT  REFERENCES catalogo_dgs(id),
  programa_id           INT  REFERENCES catalogo_programas(id),
  clave_eje             TEXT,
  nombre_eje            TEXT,
  bloque_mundial        INT,
  origen_compromiso     TEXT,
  estatus               TEXT NOT NULL DEFAULT 'ACTIVA', -- un solo campo, no 4
  motivo_baja           TEXT,
  fecha_baja            TIMESTAMPTZ,
  fecha_inauguracion    DATE,
  alcaldia              TEXT,   -- ver 4.4: se deriva automático, no se captura a mano
  colonia               TEXT,
  calle                 TEXT,
  url_google_maps       TEXT,
  material              TEXT,
  modalidad             TEXT,
  origen_recurso         TEXT,
  fondo_recurso          TEXT,
  capitulo_recurso       TEXT,
  superficie_m2          NUMERIC,
  longitud_km            NUMERIC,
  modo_calculo_avance    TEXT,
  responsable_dg          TEXT,
  contrato_obra_id        BIGINT REFERENCES contratos(id),  -- 1:1, ver 4.3
  creado_por              TEXT NOT NULL,
  fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por         TEXT,
  fecha_actualizacion     TIMESTAMPTZ
);

CREATE TABLE obra_geom_punto (
  obra_id BIGINT PRIMARY KEY REFERENCES obras(id) ON DELETE CASCADE,
  geom geometry(Point, 4326) NOT NULL
);
CREATE TABLE obra_geom_linea (
  obra_id BIGINT PRIMARY KEY REFERENCES obras(id) ON DELETE CASCADE,
  geom geometry(MultiLineString, 4326) NOT NULL
);
CREATE TABLE obra_geom_poligono (
  obra_id BIGINT PRIMARY KEY REFERENCES obras(id) ON DELETE CASCADE,
  geom geometry(MultiPolygon, 4326) NOT NULL
);
```

Por qué así y no como `obras_puntos/lineas/poligonos` actuales: la geometría vive tipada por separado (buena práctica PostGIS, igual que hoy), pero **todos los campos de negocio viven una sola vez** en `obras`, no triplicados con tipos distintos en cada tabla hermana.

> **Corrección aplicada durante la migración (2026-08-19)**: `obra_geom_linea`/`obra_geom_poligono` se definieron primero como `LineString`/`Polygon` simples, pero el dato real en `sig_sobse` usa `MultiLineString`/`MultiPolygon` (una obra puede cubrir varios tramos o zonas desconectadas — ej. una repavimentación en varias calles). Se corrigió a los tipos "Multi" para no perder esos tramos. `obra_geom_punto` sí se confirmó como `Point` simple (se verificó que ninguna obra tiene más de un punto antes de migrar).

### 4.2 Avance — una sola tabla de verdad, con historial real

```sql
CREATE TABLE avance_historico (
  id                 BIGSERIAL PRIMARY KEY,
  obra_id            BIGINT NOT NULL REFERENCES obras(id),
  fecha              DATE NOT NULL,
  semana             INT,
  anio               INT,
  avance_fisico      NUMERIC(5,2) NOT NULL CHECK (avance_fisico BETWEEN 0 AND 100),
  avance_financiero  NUMERIC(5,2),
  origen             TEXT NOT NULL CHECK (origen IN ('SUPERVISION_EXTERNA','INTERNO','CAPTURA_MANUAL')),
  reportado_por      TEXT,
  fecha_captura      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, fecha, origen)
);
```

Reemplaza a `historial_avances`, `historico_semanal`, `snapshots_semanales` y los campos de avance sueltos en cada tabla de geometría. El "avance oficial" de una obra siempre es una consulta (última fila por obra), no un campo que hay que mantener sincronizado a mano.

### 4.3 Motor de contratos (4 tipos, cardinalidades ya confirmadas contigo)

```sql
CREATE TABLE contratos (
  id                              BIGSERIAL PRIMARY KEY,
  id_institucional                TEXT UNIQUE NOT NULL,
  tipo_contrato                   TEXT NOT NULL CHECK (tipo_contrato IN ('OBRA','SUPERVISION','SERVICIOS','ADQUISICIONES')),
  numero_contrato                 TEXT,
  contratista                     TEXT,
  representante_legal             TEXT,
  rfc                              TEXT,
  domicilio_fiscal                 TEXT,
  procedimiento                    TEXT,
  numero_concurso                  TEXT,
  fecha_contrato                   DATE,
  fecha_inicio                     DATE,
  fecha_termino                    DATE,
  plazo_ejecucion                  TEXT,
  importe_sin_iva                  NUMERIC(18,2),
  iva                               NUMERIC(18,2),
  importe_total                    NUMERIC(18,2),
  anticipo                          NUMERIC(18,2),
  tipo_ejercicio                    TEXT CHECK (tipo_ejercicio IN ('ANUAL','MULTIANUAL')),
  objeto_contrato                   TEXT,
  dg_id                              INT REFERENCES catalogo_dgs(id),
  area_operativa                    TEXT,
  area_responsable                  TEXT,
  oficio_autorizacion               TEXT,
  numero_acuerdo                    TEXT,
  clave_programatica_presupuestal   TEXT,
  fondo_aportacion                  TEXT,
  obra_id_adquisicion               BIGINT REFERENCES obras(id), -- solo aplica si tipo_contrato='ADQUISICIONES' (1:N directo)
  creado_por                        TEXT,
  fecha_creacion                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Obra ↔ Supervisión: muchos a muchos (un contrato de supervisión puede cubrir varias obras)
CREATE TABLE obra_contrato_supervision (
  obra_id      BIGINT REFERENCES obras(id),
  contrato_id  BIGINT REFERENCES contratos(id),
  PRIMARY KEY (obra_id, contrato_id)
);

-- Obra ↔ Servicios: muchos a muchos
CREATE TABLE obra_contrato_servicio (
  obra_id      BIGINT REFERENCES obras(id),
  contrato_id  BIGINT REFERENCES contratos(id),
  PRIMARY KEY (obra_id, contrato_id)
);
```

Cardinalidades tal como las confirmaste: obra↔obra=1:1 (`obras.contrato_obra_id`), obra↔supervisión=N:M, obra↔servicios=N:M, obra↔adquisiciones=1:N (`contratos.obra_id_adquisicion`).

### 4.4 Ubicación derivada, no capturada a mano (idea de Conservación Vial, ya validada ahí)

`alcaldia`, `colonia` y `vialidad` en `obras` se calculan en el backend a partir de `geom` contra capas base (`alcaldias.geojson`, `colonias.geojson`, `vialidades-primarias.geojson`), reutilizando el algoritmo de `geoLookupService.ts` de Conservación Vial (point-in-polygon + coincidencia de vialidad más cercana). Reduce error de captura manual, tal como ya lo validaste ahí.

### 4.5 Catálogos y auditoría unificada

```sql
CREATE TABLE catalogo_dgs (
  id SERIAL PRIMARY KEY, clave TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL
);
CREATE TABLE catalogo_programas (
  id SERIAL PRIMARY KEY, clave TEXT, nombre TEXT NOT NULL, dg_id INT REFERENCES catalogo_dgs(id)
);
-- catalogo_alcances se reutiliza casi tal cual: ya está bien diseñada (410 filas, banderas booleanas por actividad)

CREATE TABLE auditoria (
  id             BIGSERIAL PRIMARY KEY,
  tabla          TEXT NOT NULL,
  registro_id    BIGINT NOT NULL,
  operacion      TEXT NOT NULL CHECK (operacion IN ('INSERT','UPDATE','DELETE')),
  usuario        TEXT NOT NULL,
  valores_antes  JSONB,
  valores_despues JSONB,
  motivo         TEXT,
  ip             TEXT,
  fecha          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Una sola tabla de auditoría (toma lo mejor de `obras_auditoria`: antes/después en `jsonb`), reemplaza los dos sistemas paralelos actuales.

### 4.6 Datos heredados — de solo consulta, separados del modelo operativo

```sql
CREATE SCHEMA legado_captura;   -- 402 contratos + catálogos, tal cual vienen de la MySQL de Hostinger
CREATE SCHEMA legado_sig_sobse; -- espejo de solo lectura de las obras 2024/2025 que siguen cerrando en el sistema actual
```

Nunca se escribe en estos esquemas desde la app nueva — son archivo, no operación.

## 5. Plan de incorporación de datos reales

1. **Contratos (402 + catálogos)**: exportar de MySQL (phpMyAdmin → SQL), importar a `legado_captura`. Clasificar por `tipo_contrato` y vincular a su obra usando el motor de contratos (4.3) — trabajo manual de las áreas, únicamente sobre obras que sigan abiertas.
2. **Obras 2026 (411)**: ya con acceso directo de lectura a `sig_sobse`, se migran con un script de transformación (no copiado tal cual) que reparte cada fila de `obras_puntos/lineas/poligonos` en `obras` + `obra_geom_*`, normalizando los tipos de dato inconsistentes detectados en 2.1.
3. **Endpoint automático de sincronización** (Opción 2, ya acordada): un PHP de solo lectura protegido con clave en Hostinger + un job programado en el VPS, para no depender de exportar a mano mientras el sistema viejo sigue vivo.

## 5.1 Módulo de clasificación y vinculación de contratos (diseño)

Objetivo: que los 402 contratos terminen como registros reales en `contratos` (público) — clasificados por tipo y vinculados a su(s) obra(s).

**Corrección al diseño original**: no tiene caso una pantalla que lea uno por uno desde `legado_captura` y los "promueva" — ya se resolvió el problema de exportar los datos (la sincronización automática). Es más simple, y sigue el mismo patrón que ya se usó con las 411 obras 2026: **una carga masiva primero** (los 402 entran de golpe a `contratos`, con `tipo_contrato` en blanco/pendiente), y **una sola pantalla después** que opera directo sobre la tabla real, mostrando solo los pendientes de clasificar.

Requiere un ajuste al esquema: `contratos.tipo_contrato` pasa de `NOT NULL` a admitir `NULL` (pendiente de clasificar) — el `CHECK` existente ya permite `NULL` sin cambios, Postgres solo valida el `CHECK` sobre valores no nulos.

```sql
ALTER TABLE contratos ALTER COLUMN tipo_contrato DROP NOT NULL;
```

### Paso 1 — Carga masiva (script, no pantalla) ✅ ejecutado 2026-08-19
Copia los 402 registros de `legado_captura.contratos` a `contratos` (público) de una sola vez, dejando `tipo_contrato = NULL`. Mapea lo que ya tiene sentido 1:1 (número, contratista, importes, fechas, objeto) y resuelve `dg_id` contra `catalogo_dgs` (creando el catálogo si hace falta, igual que en la migración de obras).

**Resultado**: 402/402 insertados, 0 errores, los 402 quedaron con `tipo_contrato IS NULL` (pendientes). `catalogo_dgs` se reutilizó sin duplicar (mismos 5 DGs con nombre completo ya cargados desde la migración de obras).

### Corrección de alcance (2026-08-19): esto NO es una pantalla de registro
El módulo de Contratos ya existe en la app actual (rol **Director de Concursos y Contratos**, captura ahí — no se duplica). Lo que se construye aquí es **solo clasificación + vinculación** de lo que ya se capturó, y el acceso es **por DG, no una bandeja global**: cada usuario (con credenciales reales que ya se están armando por DG, empezando por **DGCOP**) entra y ve únicamente los contratos de su propia DG.

```sql
-- Contratos de la DG del usuario en sesión, pendientes de clasificar
SELECT c.* FROM contratos c
JOIN catalogo_dgs d ON d.id = c.dg_id
WHERE d.clave = :dg_del_usuario_en_sesion
  AND c.tipo_contrato IS NULL
```

DGCOP hoy: **68 contratos**, **62 obras** propias — el primer piloto real del flujo.

### Paso 2 — Pantalla única, pero DOS acciones guardadas por separado (corregido 2026-08-20)
Lista los contratos de la DG en sesión que aún no están "completos": sin `tipo_contrato`, o con `tipo_contrato` ya elegido pero sin ningún vínculo todavía según su tipo (`NOT EXISTS` contra la tabla que corresponde a cada tipo — no una sola columna genérica). Por cada uno se muestra lo necesario para decidir el tipo sin adivinar: `numero_contrato`, `contratista`, `objeto_contrato`, `importe_total`. Sugerencia automática de tipo por palabras clave en `objeto_contrato`/`procedimiento` — solo ayuda visual, nunca se guarda sin confirmación humana.

**Corrección de flujo**: originalmente "clasificar" y "vincular" eran un solo `POST` transaccional — si el área solo elegía el tipo y cerraba la pantalla sin llegar a elegir obra, no quedaba nada guardado en BD, solo en el estado de React. Se separó en dos llamadas independientes, cada una con su propia entrada de `auditoria`:
- `POST /api/contratos/:id/clasificar` — **Paso 1**, solo el tipo. Se guarda de inmediato, sin pedir obra. Editable después (mismo endpoint, re-clasifica): si el contrato ya estaba vinculado bajo el tipo anterior, ese vínculo se limpia automáticamente (`vinculoLimpiado: true` en la respuesta) — quedaría apuntando a una relación que ya no corresponde al nuevo tipo, así que el área tiene que volver a vincular.
- `POST /api/contratos/:id/vincular` — **Paso 2**, solo la obra. Requiere que el contrato ya tenga `tipo_contrato` (si no, `400 SIN_CLASIFICAR`). Puede ejecutarse en una sesión distinta a cuando se clasificó.
- `POST /api/contratos/:id/desvincular` (2026-08-20) — corrige un error de vinculación: quita el vínculo de UNA obra específica (no toca el tipo ya clasificado ni otros vínculos si el contrato cubre varias obras). El contrato vuelve a aparecer en "Por clasificar" con el Paso 2 pendiente — no hace falta reclasificarlo, solo volver a vincular. Expuesto en la UI como una "×" en cada chip de la pestaña "Vinculaciones", con confirmación antes de ejecutar. Antes de esto, corregir un error de vinculación solo era posible pidiéndome que lo revirtiera manualmente en la BD — ya pasó tres veces en pruebas reales del área.

En la UI, ambos pasos viven en el mismo panel de detalle: si el contrato no tiene tipo guardado (o se pulsó "Cambiar tipo"), se muestra el Paso 1; en cuanto el tipo ya está guardado, se muestra automáticamente el Paso 2. El comportamiento del Paso 2 cambia según el tipo, respetando las cardinalidades ya confirmadas:

| Tipo | Selector | Efecto |
|---|---|---|
| OBRA | Buscador de **una sola** obra (por `clave_unica`/nombre) | `UPDATE obras SET contrato_obra_id = ...` |
| SUPERVISION | Buscador **multi-obra** (checkboxes) | `INSERT` en `obra_contrato_supervision` por cada obra marcada — se puede volver a abrir después para agregar más obras sin perder las ya vinculadas |
| SERVICIOS | Buscador **multi-obra** | `INSERT` en `obra_contrato_servicio`, igual que supervisión |
| ADQUISICIONES | Buscador de **una sola** obra | `UPDATE contratos SET obra_id_adquisicion = ...` |

### Vista de pendientes (para las áreas)
Un panel simple: obras **activas** (no cerradas) sin `contrato_obra_id`, y obras activas sin ningún registro en `obra_contrato_supervision` — es literalmente la lista de "motor financiero incompleto", para que el equipo sepa qué falta enlazar sin tener que adivinar.

### Validaciones
- Un contrato legado solo se puede promover una vez (ya garantizado por `id_institucional UNIQUE`).
- Un contrato tipo OBRA no puede vincularse a más de una obra (ya lo garantiza ser una columna simple en `obras`, no una tabla de relación).
- Advertencia si se intenta vincular un contrato ya vinculado a otra obra cuando el tipo es 1:1.

## 5.2 Modelo de acceso y roles del módulo de contratos

Basado en el directorio real de DGCOP (`SICOPS_v2\CREDENCIALES\DGCOP - Hoja 1.csv`) — datos personales reales (nombres, celulares), no se publica ni se sube a ningún artefacto, solo referencia interna para este diseño.

**Jerarquía real de una DG (ejemplo DGCOP)**: Director General → **Director de Concursos, Contratos y Estimaciones** (1 por DG) → 4 Direcciones internas de Obras Públicas (A/B/C/D) → Subdirecciones → JUDs, cada una responsable de un subconjunto de las obras de la DG.

**Ya existe en el sistema actual** (`backend/data/usuarios.json`) un rol `DIRECTOR_CONCURSOS_CONTRATOS`, pero como cuenta única compartida para todo SICOPS, no por DG. El modelo nuevo necesita cuentas **por persona y por DG**.

**Permisos confirmados**:
| Rol | Alcance | Permisos |
|---|---|---|
| Director de Concursos y Contratos | Toda su DG (ej. DGCOP completo, 68 contratos / 62 obras) | Clasificar tipo + vincular a obra(s) — lectura y escritura |
| Director de Obras Públicas A/B/C/D | Solo las obras de su Dirección interna | **Solo consulta** — ve lo ya vinculado, no puede editar |

**Replicado a DGPEST (2026-08-20)**: cuenta real `dgpest_concursos` para **Karen Herrera Fuentes**, mismo rol `DIRECTOR_CONCURSOS_CONTRATOS`, mismo alcance (toda la DG, 53 contratos / 45 obras) — DGPEST ya tenía datos migrados y su catálogo de programas ya reconciliado (ver sección 6, fusión de "CANCHAS MUNDIALISTAS DGPEST"), así que no hizo falta preparación adicional, solo dar de alta la cuenta con `jobs/crear_usuarios_dgpest.js` (mismo patrón que `crear_usuarios_dgcop.js`). Confirmado funcionando en producción sin cambios de código — el backend ya era genérico por `dgId`.

**Gap detectado y resuelto**: `obras` hoy solo sabía su `dg_id` (DGCOP), no a cuál Dirección interna (A/B/C/D) pertenece — el Excel real solo tiene ese dato lleno para 1 de 62 obras (el ejemplo real y ya verificado: "Construcción del centro de resguardo temporal 1era etapa" → Dirección "D" → contratos `DGCOP-LPN-L-O-001-26` + `DGCOP-IR-L-S-004-26` de SESOCORT).

- ✅ `obras.direccion_interna` agregada (texto libre, nullable — no todas las DG tienen esta subdivisión) — 2026-08-19.
- **Decisión de captura**: no se llena por Excel. Se asigna **dentro de la propia pantalla de vinculación**: cuando Jacob (Director de Concursos y Contratos) vincula un contrato a una obra que todavía no tiene `direccion_interna`, la pantalla le pide elegirla ahí mismo (A/B/C/D) antes de confirmar — una sola vez por obra, se queda guardada para las siguientes vinculaciones.
- ✅ Tabla `usuarios` real creada — 2026-08-19, con `dg_id`, `direccion_interna` (nullable) y `rol` (`DIRECTOR_CONCURSOS_CONTRATOS` / `DIRECTOR_OBRAS_PUBLICAS` / `ADMIN`), y **`password_hash` en vez de texto plano** (corrige la práctica del `usuarios.json` actual, que guarda contraseñas legibles). `bcryptjs` ya instalado en `PS_SICOPS_FINAL/backend`.
- ✅ **5 cuentas reales de DGCOP creadas** — 2026-08-19, contraseñas generadas aleatoriamente (12 caracteres, guardadas solo como hash bcrypt costo 12): `dgcop_concursos` (Jacob Núñez, alcance toda la DG), `dgcop_obras_a/b/c/d` (Directores de Obras Públicas A/B/C/D, solo consulta). Script reutilizable en `PS_SICOPS_FINAL/backend/jobs/crear_usuarios_dgcop.js` — sirve de plantilla para las siguientes 7 DGs.

## 6. Próximos pasos (ejecución — pendiente de tu autorización para empezar a tocar código)

- [x] Crear la base/esquema nuevo en el Postgres del VPS (`CREATE DATABASE ps_sicops_final;`) — creada 2026-08-19
- [x] Ejecutar el DDL de este documento — ejecutado 2026-08-19, 11 tablas de negocio + esquemas `legado_captura`/`legado_sig_sobse`
- [x] Armar `backend/.env` del proyecto nuevo (puerto 3004) — creado en `C:\Users\Usuario\Desktop\PS_SICOPS_FINAL\backend\.env`
- [x] Construir el script de migración de las 411 obras 2026 — `PS_SICOPS_FINAL/backend/migrations/001_migrar_obras_2026.js`, ejecutado y verificado 2026-08-19:
  - **411/411 obras migradas** (344 puntos + 57 líneas + 10 polígonos), 0 sin geometría, 0 `clave_unica` duplicada
  - **411 filas en `avance_historico`** (100% con avance capturado)
  - 5 DGs y 12 programas poblados automáticamente en los catálogos a partir de los datos reales
  - Corrección aplicada en el camino: `obra_geom_linea`/`obra_geom_poligono` tuvieron que pasarse a `MultiLineString`/`MultiPolygon` (ver nota en sección 4.1) — 67 filas fallaron en el primer intento y se resolvieron en un reintento sin pérdida de datos
- [x] Cargar el respaldo de contratos en `legado_captura` — 2026-08-19, a partir de un export SQL manual de phpMyAdmin (`u202398458_SICOPS_CAPTURA (1).sql`), parseado con `node-sql-parser` y cargado de solo lectura:
  - **617 filas totales**: 402 `contratos`, 85 `planteles`, 58 `catalogo_puestos`, 46 `catalogo_programas`, 12 `catalogo_areas_responsables`, 8 `dgs`, 6 `consecutivos` — coincide exactamente con los conteos vistos en phpMyAdmin
  - Bonus: los nombres reales de las 5 Direcciones Generales de `dgs` (legado) se usaron para corregir `catalogo_dgs` (poblado automáticamente durante la migración de obras 2026, que solo tenía la clave como nombre)
- [x] Construir el endpoint PHP de exportación + job de sincronización de contratos — 2026-08-19, probado extremo a extremo:
  - `PS_SICOPS_FINAL/backend/deploy/export_legado_ps_sicops.php` subido a `sicops/captura/api/` en producción (Hostinger), protegido con clave secreta, solo lectura
  - `PS_SICOPS_FINAL/backend/jobs/sync_legado_captura.js` — jala el JSON y reemplaza `legado_captura` por completo en cada corrida (sin drift parcial)
  - Primera corrida real: **617/617 filas sincronizadas, 0 errores** — listo para programarse periódicamente (cron/PM2) mientras el sistema viejo de captura siga vivo
- [x] Construir el login real (JWT + bcrypt contra la tabla `usuarios`) — 2026-08-19, servidor corriendo en `http://localhost:3004`, probado extremo a extremo con las cuentas reales de DGCOP:
  - `POST /api/auth/login` — valida con `bcrypt.compare`, emite JWT con `{id, usuario, nombre, rol, dgId, dgClave, direccionInterna}`, actualiza `ultimo_acceso`
  - `GET /api/auth/me` — protegido por `authRequired`, sin bypass de desarrollo (a diferencia del backend viejo que aceptaba tokens `local-*`)
  - `utils/jwt.js` ya **no** trae secreto por default (el backend viejo sí, `"sicops_dev_secret"` hardcodeado) — revienta al arrancar si falta `JWT_SECRET`, evita repetir esa fuga
  - Probado: login correcto ✓, contraseña incorrecta → 401 sin filtrar si el usuario existe ✓, `/me` sin token → 401 ✓, cuenta de solo-consulta (Director A) con `direccionInterna` correcto en el token ✓
  - Archivos: `PS_SICOPS_FINAL/backend/{server.js, config/pg.js, controllers/authController.js, middleware/auth.js, routes/auth.js, utils/jwt.js}`
- [x] Construir la pantalla de vinculación de contratos — 2026-08-19, real y probada de punta a punta en el navegador (login → lista real de 68 contratos DGCOP → clasificar → vincular → confirmar), no solo por API:
  - Backend: `PS_SICOPS_FINAL/backend/{controllers,routes}/{contratos,obras}.js` — `GET /api/contratos/pendientes` (acotado a la DG del usuario), `POST /api/contratos/:id/clasificar` (transaccional, valida DG, resuelve las 4 cardinalidades, registra en `auditoria`), `GET /api/obras/buscar`
  - Frontend: nueva sección `/contratos-ps` dentro de esta misma app React (`src/pages/ContratosPS/`, `src/api/psContratosApi.js`), con su **propio login** (independiente del login principal — credenciales de `PS_SICOPS_FINAL`), enlazada desde el Sidebar como "Clasificar Contratos (piloto)"
  - **Caso real de punta a punta verificado**: contrato `DGCOP-LPN-L-O-001-26` (obra, $142M) → obra "Panteón Ministerial San Lorenzo Tezonco" (el sitio real del Centro de Resguardo Temporal) con Dirección interna **D** asignada en el mismo paso; contrato `DGCOP-IR-L-S-004-26` (SESOCORT, supervisión) → vinculado a la misma obra — reproduce exactamente el caso documentado en el directorio real de DGCOP
  - Bug encontrado y corregido en el camino: la lista de pendientes no se recargaba tras iniciar sesión (dependencia de `useEffect` incompleta)
  - `runtime-config.js` ahora expone `PS_API_URL` (local: `localhost:3004`; producción: `https://srv1574556.hstgr.cloud/ps-sicops`)

- [x] **Desplegado al VPS en producción real** — 2026-08-19:
  - `/opt/ps-sicops-final/backend/`, proceso PM2 `ps-sicops-final`, puerto 3004 — corriendo junto a `sicops-api`/`sigsobse-api`/`conservacion-vial-api`, exactamente el mapa de puertos planeado desde el inicio de esta sesión
  - Apache: `/etc/apache2/conf-available/ps-sicops-final.conf` (proxy `/ps-sicops/` → `127.0.0.1:3004`), enganchado con una línea en el vhost compartido (con respaldo `.bak` hecho antes de tocarlo) — mismo patrón exacto que ya usa Conservación Vial
  - Verificado desde internet, fuera del VPS: `GET https://srv1574556.hstgr.cloud/ps-sicops/health` y `POST .../api/auth/login` con la cuenta real de Jacob — ambos responden correctamente
  - **Corrección de fondo (2026-08-19)**: la primera versión tenía un login separado dentro de `/contratos-ps` — se sentía como una demo pegada encima del sistema, no como parte de él. Se integró en el **login principal único**: `authAPI.login` ahora intenta el backend viejo primero y, si lo rechaza, prueba automáticamente contra `PS_SICOPS_FINAL` con las mismas credenciales — quien tenga cuenta ahí entra por la misma puerta, aterriza directo en `/contratos-ps` (no en el dashboard viejo), y el Sidebar le muestra solo su módulo. Un solo "Cerrar sesión" cierra ambos sistemas. Encontrado y corregido en el camino: `PublicRoute` en `App.js` tenía su propio redirect a `/dashboard` que competía con el de `Login.jsx`.
  - Build final generado y listo para subir a `plataformasobse.info/SICOPS/` (Hostinger) — reemplaza el build anterior que todavía tenía el login separado.
  - **Segunda corrección (2026-08-19)**: las páginas nuevas (`MisPendientes.jsx`, clasificación de contratos) se habían construido desde cero con un formato propio — bandeja plana de etiquetas, sin el Sidebar de la app. Se corrigió reutilizando las páginas **ya existentes y probadas** en vez de duplicar interfaz:
    - `ObraContext.jsx` (única fuente de obras de toda la app) ahora sabe traer el universo real de la DG desde `PS_SICOPS_FINAL` cuando la sesión es de ese sistema — sin el filtro `soloActivas` del modelo viejo (el trabajo de Concursos y Contratos no depende del estatus físico de la obra).
    - Con eso, **Home** (`Dashboard.jsx`) y **Mis Pendientes** (`ListadoObras.jsx`, ruta `/obras`) ya funcionan tal cual para cuentas de DGCOP, con la misma tarjeta de "Actividades de hoy", el mismo agrupado por programa y las mismas tarjetas de cierre — solo que con datos reales (62 obras, no de ejemplo).
    - Se eliminó la página bespoke `ContratosPS/MisPendientes.jsx` (redundante).
    - `ContratosPS/index.jsx` (clasificación/vinculación) ahora se envuelve en el mismo `<Sidebar />`/`<Footer />` que el resto de la app — antes se renderizaba sin navegación.
    - Sidebar para cuentas PS: mismo menú base que cualquier otra sesión (Home/Mis Pendientes/Visitas/Notificaciones), solo "Contratos" apunta a la versión nueva.
  - **Tercera corrección (2026-08-19)**: `utils/seguimiento.js` traía una semilla determinista que "inventaba" cumplidos/atrasados de fábrica por obra+requerimiento (pensada para que el demo se viera poblado). Para sesiones de `PS_SICOPS_FINAL` esto ya no aplica — todo requerimiento arranca genuinamente en `PENDIENTE`, sin fecha ni evidencia de ejemplo. El resto del sistema (demo/offline) conserva el comportamiento anterior.

- [x] **"Etapa 2" — familia completa de contratos por obra** — 2026-08-19: no basta con que cada contrato quede ligado a su obra; hace falta poder ver qué contrato de obra está conectado con cuál de supervisión/servicios/adquisiciones, y el monto total combinado (el propósito original del "motor financiero").
  - Backend: `GET /api/obras/vinculados` — para cada obra con contrato de obra ya clasificado, arma la familia completa (obra + supervisiones[] + servicios[] + adquisiciones[]) y suma `montoTotal`
  - Frontend: pestaña "Vinculaciones" dentro de `/contratos-ps` (junto a "Por clasificar"), tarjeta por obra con cada tipo de contrato en su color semántico y el total
  - Probado con el caso real: Centro de Resguardo Temporal → obra $142,357,216.17 + SESOCORT (supervisión) $7,496,519.98 = **$149,853,736.15**
  - Datos de prueba usados durante las pruebas (contrato 22 + 25 clasificados/vinculados, `auditoria`) revertidos por completo antes de entregar el acceso al área — quedó en 68/68 pendientes, 0 clasificados, para que la primera acción real la haga el área.

### Obras con continuidad hacia 2026 (fuera del filtro `YEAR=2026` original)
Algunas obras de `sig_sobse` siguen con año anterior (2025) en el registro pero continúan operando en 2026 (ej. una segunda etapa) — no entran en la migración automática por `YEAR`. Se agregan manualmente conforme se detectan, forzando `anio=2026` en `ps_sicops_final` sin importar el año de origen:
- **CLINICA CONDESA** (`PLATSOBSE_DGCOP_CLINICA_CONDESA_CLINICA_CONDESA_1`, DGCOP) — 2026-08-20, año original 2025 → forzado a 2026 por la segunda etapa (contrato `DGCOP-LPN-L-PI-002-26`). obra_id 479, con geometría y avance histórico (57.41%) migrados.

### `contratos.programa_id` — columna agregada y catálogo reconciliado (2026-08-20)
`contratos` se migró originalmente sin `programa_id` (el script `001_migrar_contratos` no lo contemplaba). Se agregó la columna (`ALTER TABLE contratos ADD COLUMN programa_id INT REFERENCES catalogo_programas(id)`) y se rellenaron los 402 contratos vía `legado_captura.contratos.id_institucional → legado_captura.catalogo_programas`, creando/reutilizando entradas en el `catalogo_programas` real por `dg_id` + nombre.

Ese backfill expuso el riesgo que ya se había anticipado: el catálogo de programas del lado de contratos (construido desde el legado de captura) y el del lado de obras (migrado de `sig_sobse`) nombran el mismo programa real de formas distintas. Se detectaron y fusionaron dos casos:
- **Clínica Condesa**: contratos traía "CONSTRUCCION DE CLINICA CONDESA" (singular, id=15) vs. obras con "CONSTRUCCION DE CLINICAS CONDESA" (plural, id=13, la correcta). 2 contratos movidos a id=13; id=15 eliminado.
- **Canchas Mundialistas por DG**: contratos traía una entrada de catálogo *por cada DG que atendió canchas* ("CANCHAS MUNDIALISTAS", "CANCHAS MUNDIALISTAS DGPEST", "... DGSUS", "... DGOIV"), en vez de reutilizar la entrada "EL BALON VUELVE AL BARRIO" que cada una de esas DG ya tenía del lado de obras para el mismo programa. Se fusionaron las 4: DG1 (45 contratos), DG3/DGPEST (27), DG4/DGSUS (23), DG5/DGOIV (46) → sus respectivos `programa_id` de "EL BALON VUELVE AL BARRIO"; las 4 entradas duplicadas se eliminaron del catálogo.
- **"CONSTRUCCION DE UTOPIAS"** (17 contratos, DGCOP) se revisó y se dejó tal cual — confirmado por el usuario que así es correcto, no corresponde fusionarlo con nada del lado de obras.
- **"CONSTRUCCION DE HOSPITALES"** (2 contratos, DGCOP) quedó sin tocar — el texto de `objeto_contrato` no corresponde claramente a ningún programa del lado de obras (habla de reubicación de módulos de policía), pendiente de revisar si aplica en el futuro.

Verificación tras la fusión: 0 contratos con `programa_id` nulo, 0 discrepancias entre el `programa_id` de un contrato y el de la obra a la que ya está vinculado (`contrato_obra_id`).

**Consecuencia en producto**: `GET /api/contratos/pendientes` ahora regresa `programa`/`programa_id` por contrato; la pantalla "Por clasificar" de `ContratosPS` los agrupa por programa (mismo criterio que `agruparPorPrograma` de "Mis Pendientes"). Al vincular, si el programa de la obra elegida no coincide con el del contrato, se muestra una advertencia no bloqueante (chip junto a la obra + aviso antes de confirmar) — no se impide la vinculación porque puede ser legítima, pero queda visible antes de confirmar y registrado en `auditoria` (`motivo = 'clasificacion_vinculacion_programa_distinto'`, respuesta incluye `programaMismatch`).

## 7. Etapa 1 — Persistencia real del seguimiento operativo (2026-08-20)

### 7.1 Estado real del sistema completo, no solo Contratos

Verificado directo en la BD (no supuesto): 5 DGs ya tienen obras migradas, 4 tienen contratos migrados, pero **solo DGCOP tiene cuentas reales** (5), y el `CHECK` de `usuarios.rol` solo admite `DIRECTOR_CONCURSOS_CONTRATOS`, `DIRECTOR_OBRAS_PUBLICAS`, `ADMIN`.

| DG | Obras | Contratos | Cuentas reales |
|---|---|---|---|
| DGCOP | 63 | 68 | 5 (1 Concursos y Contratos + 4 Direcciones internas) |
| DGOT | 64 | **0** | 0 |
| DGPEST | 45 | 53 | 0 |
| DGSUS | 94 | 24 | 0 |
| DGOIV | 146 | 257 | 0 |

Los 4 Directores de Obras Públicas (A/B/C/D) existen como cuentas pero **sin UI propia**: hoy verían el mismo `ContratosPS` que el Director de Concursos (que los rechaza al escribir) y el listado completo de obras de la DG, no uno filtrado por `direccion_interna`. No hay referencia a `DIRECTOR_OBRAS_PUBLICAS` en ningún archivo del frontend.

### 7.2 El seguimiento diario (REQ-02 a REQ-21 + visitas) vive entero en `localStorage`

Inventario completo (21 módulos en `src/utils/*.js` + `data/seguimientoCatalogo.js`), confirmado leyendo cada uno — no es un solo molde, son formas de dato genuinamente distintas, cada una con reglas de negocio reales ya definidas en minutas:

| REQ | Nombre | Responsable(s) | Forma del dato (hoy en localStorage) |
|---|---|---|---|
| REQ-02 | Entrega de proyecto ejecutivo | Director/Subdirector de Proyectos | 5 especialidades (entregado + archivo) + 2 planos sueltos |
| REQ-03 | Cambios de proyecto | Proyecto + Director de Obra | Lista de cambios (fecha, especialidad, descripción) |
| REQ-04/05 | Estudio ambiental / impacto urbano | Director de Obras Inducidas | Etapa (sin iniciar/en proceso/concluido) + hasta 3 documentos (acuse, oficio de observaciones, acuse de subsanación) |
| REQ-06 | Obras inducidas | Director de Obras Inducidas | Genérico tipo A (estatus + evidencia) |
| REQ-07/08 | Fotografía 360° / Video | Supervisión Externa | Genérico tipo B (multimedia) |
| REQ-09 | Fuerza de trabajo | Director General | Frentes (tipo obra/estudios) → oficios (texto libre + trabajadores), diario |
| REQ-10 | Turnos de trabajo | Director de Obra | 3 turnos/día, reporte adjunto, diario |
| REQ-11 | Verificación de insumos | Director General | Lista de insumos (proveedor, responsable de compra, costo, % pagado, factura) |
| REQ-12 | Generadores de obra | Director de Obra | Frentes → partidas fijas (Cimentación/Estructura/Albañilería/Instalaciones/Acabados), sí/no + fecha |
| REQ-13 | Catálogo de conceptos | JUD / Residente de Obra | Partidas propias por obra (monto inicial, monto modificado) + PDF + bandera de modificaciones |
| REQ-14 | Precios extraordinarios | Director de Concursos y Contratos | Lista de solicitudes (fecha ingreso, descripción, cantidad, monto, estatus, monto autorizado, fecha autorización) |
| REQ-15 | Avance físico (real) | Supervisión Externa | Fechas reales de ejecución + curva semanal con **dos fuentes** (supervisión / supervisión interna) y extensión automática por desfase |
| REQ-16 | Avance financiero (estimaciones) | Supervisión Externa | Curva de estimaciones semanal (deducciones/sanciones ya viven en la carátula del contrato) |
| REQ-17 | Concertación de obras públicas | Subdirección de Concertación | Casos (uno abierto a la vez) con bitácora de entradas — dos tipos: seguimiento / indicación del Secretario |
| REQ-18 | Informe de visitas de obra | Equipo Asesor Técnico | Visita realizada (sí/no) + reporte general + archivo |
| REQ-19 | Expediente único | Director de Concursos y Contratos | Checklist homologado de ~55 documentos fijos (sección → id → estatus 4 valores + archivo) |
| REQ-20 | Memoria fotográfica/video | Subdirección de Comunicación | Genérico tipo B, diario |
| REQ-21 | Calidad de la obra | Director de Obra | Genérico tipo A |
| — | Visitas obligadas (check-in) | Todos (cuota por rol) | Registro diario: hora, observaciones, avance observado, fotos |

**Además, tres capas transversales que no son "captura" y hoy tampoco tienen tabla:**
- **Verificación** (`utils/verificacion.js`): visto bueno independiente por (obra, req), normalmente JUD/Residente de Obra, configurable por requerimiento.
- **Evaluación del Secretario** (`utils/evaluaciones.js`): retroalimentación con bandeja de entrada, copia automática al Director General de la obra, estado de lectura — **histórico** (cada evaluación es una entrada nueva, no un solo valor que se sobreescribe).
- **Prioridad de visitas** (`utils/prioridadVisitas.js`): el Secretario marca obras prioritarias — bandera global, no por rol.

`utils/contratos.js` (legado, en localStorage) además tiene campos que la tabla `contratos` real de `ps_sicops_final` todavía no tiene si se quiere reemplazar también ese módulo: `representante_legal`, `rfc`, `domicilio_fiscal`, `numero_frentes`, `alcance_frentes`, `retencion_porcentaje`, y listas dinámicas de `deducciones[]`/`sanciones[]`/`observaciones[]`.

### 7.3 Patrón de modelo propuesto: núcleo + hijas específicas, todo colgado de `obras.id`

Como `obras` ya existe y ya trae `dg_id`/`direccion_interna`/`programa_id`, el scoping por DG/Dirección se hereda gratis — no hay que repetirlo en cada tabla nueva.

```sql
-- Encabezado de estatus, uno por (obra, requerimiento) — cubre por sí solo
-- los REQ genéricos tipo A/B; para los tabulares es el "resumen", el
-- detalle vive en su tabla hija.
CREATE TABLE seguimiento_captura (
  id                BIGSERIAL PRIMARY KEY,
  obra_id           BIGINT NOT NULL REFERENCES obras(id),
  req_id            TEXT NOT NULL,
  estatus           TEXT NOT NULL CHECK (estatus IN ('cumplido','pendiente','atrasado','no_aplica')),
  fecha_compromiso  DATE,
  fecha_real        DATE,
  motivo            TEXT,
  evidencia_url     TEXT,
  actualizado_por   TEXT,
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, req_id)
);

-- Verificación (JUD/Residente u otro rol configurable por REQ)
CREATE TABLE seguimiento_verificacion (
  id              BIGSERIAL PRIMARY KEY,
  obra_id         BIGINT NOT NULL REFERENCES obras(id),
  req_id          TEXT NOT NULL,
  verificado      BOOLEAN NOT NULL DEFAULT false,
  verificado_por  TEXT,
  notas           TEXT,
  fecha           TIMESTAMPTZ,
  UNIQUE (obra_id, req_id)
);

-- Evaluación del Secretario — histórico, NO único por (obra, req)
CREATE TABLE seguimiento_evaluacion (
  id           BIGSERIAL PRIMARY KEY,
  obra_id      BIGINT NOT NULL REFERENCES obras(id),
  req_id       TEXT NOT NULL,
  estado       TEXT NOT NULL CHECK (estado IN ('no_atendido','atendido_parcial','atendido')),
  observacion  TEXT,
  evaluado_por TEXT,
  leida        BOOLEAN NOT NULL DEFAULT false,
  fecha        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Visitas obligadas (check-in diario por rol)
CREATE TABLE seguimiento_visita (
  id               BIGSERIAL PRIMARY KEY,
  obra_id          BIGINT NOT NULL REFERENCES obras(id),
  rol              TEXT NOT NULL,
  usuario          TEXT,
  observaciones    TEXT,
  avance_observado NUMERIC(5,2),
  fecha            DATE NOT NULL DEFAULT CURRENT_DATE,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE seguimiento_visita_foto (
  id         BIGSERIAL PRIMARY KEY,
  visita_id  BIGINT NOT NULL REFERENCES seguimiento_visita(id) ON DELETE CASCADE,
  url        TEXT NOT NULL
);
```

Hijas específicas (patrón, no exhaustivo — se formalizan al construir cada REQ):
- `fuerza_trabajo_frente` (obra_id, fecha, nombre, tipo) + `fuerza_trabajo_oficio` (frente_id, nombre, trabajadores) — REQ-09.
- `obra_ejecucion` (obra_id, fecha_inicio_real, fecha_terminacion_real, diferimiento) + `programa_quincena` (obra_id, periodo_del, periodo_al, pct_acumulado) + `avance_semanal` (obra_id, numero_semana, fuente, pct_avance) — REQ-15. **Pendiente**: leer a fondo la mitad "financiero" de `avanceFisicoFinanciero.js` (solo se revisó la mitad física) antes de fijar el DDL de REQ-16.
- `precio_extraordinario` (obra_id, fecha_ingreso, descripcion, cantidad, monto, estatus, monto_autorizado, fecha_autorizacion) — REQ-14.
- `expediente_documento` (obra_id, doc_id, estatus, archivo_url) — REQ-19; el catálogo de ~55 documentos fijos puede quedarse como constante en código (no varía por obra, cambia por decisión de área).
- `catalogo_concepto_partida` (obra_id, nombre_partida, monto_inicial, monto_modificado) — REQ-13.
- `generador_frente` (obra_id, nombre) + `generador_partida` (frente_id, partida, entregado, fecha) — REQ-12.
- `insumo_entrega` (obra_id, nombre, proveedor, responsable_compra, costo_total, porcentaje_pago, factura_url) — REQ-11.
- `concertacion_caso` (obra_id, problema, estatus, fecha_creacion, fecha_cierre) + `concertacion_entrada` (caso_id, tipo, texto, autor, fecha) — REQ-17.
- `estudio_documento` (obra_id, req_id, tipo, archivo_url) + etapa en `seguimiento_captura` misma — REQ-04/05.
- `proyecto_especialidad_entrega` (obra_id, especialidad_id, entregado, archivo_url) — REQ-02; `cambio_proyecto` (obra_id, fecha, especialidad_id, descripcion) — REQ-03.
- Evidencias/archivos reales: hoy solo se guarda el *nombre* del archivo, nunca el contenido — falta decidir almacenamiento real (carpeta en el VPS servida por Apache, o equivalente) antes de que `evidencia_url`/`archivo_url` signifiquen algo real.

### 7.4 Decisión abierta antes de escribir el DDL final: modelo de roles

`ROLES_RESPONSABLE` (catálogo de requerimientos) define **17 puestos operativos** (Secretario, Director General, Director de Proyecto, Supervisión Externa, Residente de Obra, JUD, Subdirección de Concertación, etc.) que determinan quién ve qué en la bandeja y quién puede capturar/verificar/evaluar cada REQ. El backend nuevo hoy solo permite **3 roles de sistema** (`DIRECTOR_CONCURSOS_CONTRATOS`, `DIRECTOR_OBRAS_PUBLICAS`, `ADMIN`).

Hay que decidir, antes de tocar el esquema de `usuarios` y las consultas de "mis pendientes" por rol:
- **Opción A** — ampliar `usuarios.rol` a los 17 puestos reales, con cuenta 1:1 por persona (correcto a largo plazo, pero implica credenciales reales para mucha más gente, no solo DGCOP).
- **Opción B** — el catálogo de 17 puestos se queda como metadata de "a quién le toca" (para mostrar el nombre correcto y filtrar la bandeja), pero las cuentas reales de login siguen siendo pocas por DG (ej. un solo login "Dirección de Obra" que ve todos los REQ de los puestos que le corresponden), sin llegar a 1 cuenta por puesto.

Sin esta decisión, `listarBandejaPara`, `puedeVerificar`, y el filtrado de "mis pendientes" por rol no tienen a quién autenticar del lado del backend nuevo.

### 7.5 Ejecutado (2026-08-20): migración 002 + backend de captura + conexión al frontend

**Migración 002** (`PS_SICOPS_FINAL/backend/migrations/002_expandir_usuarios_y_seguimiento.js`, aditiva, ya corrida en producción):
- `usuarios.rol` ampliado a los 16 códigos reales (los 3 que ya existían + 13 del catálogo de requerimientos; `DIRECTOR_OBRA` no se agregó — es `DIRECTOR_OBRAS_PUBLICAS`, ya existente, por la decisión de la sección anterior).
- `usuarios.alcance_tipo` / `obra_id` / `contrato_id` agregados; backfill automático para las 6 cuentas reales existentes (2 `DG`, 4 `DIRECCION_INTERNA`).
- Tablas núcleo creadas: `seguimiento_captura`, `seguimiento_verificacion`, `seguimiento_evaluacion`, `seguimiento_visita`, `seguimiento_visita_foto`.

**Backend de captura** (`controllers/seguimientoController.js`, `routes/seguimiento.js`):
- `GET /api/seguimiento/obras/:obraId/captura` y `POST /api/seguimiento/obras/:obraId/captura/:reqId`.
- `puedeAccederObra(user, obraId)` centraliza el control de acceso por `alcance_tipo` — probado end-to-end contra la BD real con cuentas reales (Jacob=DG concede en cualquier obra de su DG; Rafael=DIRECCION_INTERNA rechaza si la obra no es de su Dirección, concede si sí, `ON CONFLICT` actualiza sin duplicar). `CONTRATO` (Supervisión Externa) queda pendiente — sus obras se resuelven vía las tablas de vinculación, no por columna directa en `obras`.
- El JWT ahora incluye `alcanceTipo`/`obraId`/`contratoId` (antes solo `dgId`/`direccionInterna`).

**Conexión al frontend — patrón de bajo riesgo (no un refactor async completo)**: en vez de volver asíncronas `getRegistrosObra`/`actualizarRegistro` de `utils/seguimiento.js` (usadas por Dashboard, ListadoObras, misPendientes.js, NavegadorEjecutivo — todos los roles, no solo PS), se mantuvo su firma síncrona intacta y se agregó:
- `hidratarCapturaDesdeServidor(obraKey, obraId)` — al abrir `BandejaTareasObra` para una obra con `id` numérico (ya migrada a `ps_sicops_final`) en sesión PS real, trae el estado real del servidor y lo escribe como overrides locales antes del primer render. No hace nada para el resto de sesiones.
- `actualizarRegistro(obraKey, reqId, cambios, obraId)` — gana un 4º parámetro opcional. Sigue escribiendo a `localStorage` exactamente igual (comportamiento sin cambio para todos los que no pasan `obraId`); si es sesión PS real y hay `obraId`, además dispara en segundo plano (fire-and-forget, no bloquea la UI) el guardado real en `seguimiento_captura`.
- `localStorage` sigue siendo la fuente de lectura para toda la app (ningún componente cambió su forma de llamar a estas funciones) — para sesiones PS reales, ahora es un espejo hidratado desde el servidor al abrir cada obra, con el servidor como copia durable. Si la sincronización falla (sin conexión, etc.), el dato local no se pierde — se reintenta la próxima vez que se edite ese mismo requerimiento; no hay cola de reintentos todavía.

**Alcance de esta pasada**: solo el "núcleo" (estatus/fecha/motivo/evidencia, cubre REQ genéricos tipo A/B como REQ-21, ya con dueño real en DGCOP vía las 4 cuentas de Dirección interna). Los REQ con forma de dato propia (fuerza de trabajo, avance físico/financiero, expediente único, etc. — ver tabla de la sección 7.2) siguen en sus módulos `utils/*.js` de solo-localStorage; cada uno necesita su propia tabla hija y su propio endpoint antes de ser real, siguiendo el mismo patrón de hidratación + sync en segundo plano ya validado aquí.

### 7.5.1 Bug de seguridad real corregido (2026-08-21): fuga de alcance por `dg_id`

El área reportó que la cuenta de Supervisión Externa (SESOCORT) veía **todos los contratos de DGCOP**, no solo el suyo. Causa raíz: `listarPendientes`, `contratosVinculados`, `pendientesVinculacion` y `buscarObras` solo filtraban por `dg_id` — que un usuario con `alcance_tipo = 'CONTRATO'` también trae (heredado de su DG al crear la cuenta), sin que nadie revisara si su alcance real le daba derecho a ver TODA la DG o no.

Corregido con `utils/alcanceObras.js` — un único resolver (`resolverAlcanceObras(user)`) que traduce `alcance_tipo` a una condición real (`GLOBAL`/`DG`/`DIRECCION_INTERNA`/`OBRA`/`OBRA_IDS` — este último resuelto vía las tablas de vinculación para `CONTRATO`), usado ahora tanto por `obrasController.misObras` como por `seguimientoController.puedeAccederObra` (que además cierra el hueco que había quedado pendiente: Supervisión Externa ya puede capturar sobre sus propias obras, no solo se le bloqueaba todo). Los endpoints exclusivos de Contratos (`/api/contratos/*`, `/api/obras/vinculados`, `/api/obras/pendientes-vinculacion`, `/api/obras/buscar`, `/api/obras/:id/supervision-interna`) se restringieron además con `requireRole("DIRECTOR_CONCURSOS_CONTRATOS")` a nivel de ruta — nadie más debería poder verlos, sin importar el alcance.

Probado con las cuentas reales: SESOCORT ahora recibe 403 en los endpoints de Contratos, ve 0 obras en "Mis Pendientes" (su contrato no está vinculado a ninguna ahora mismo — correcto, antes hubiera visto las 63 de DGCOP igual), y se le bloquea (403 `FUERA_DE_ALCANCE`) intentar capturar sobre una obra que no es suya. Jacob (alcance DG) no se vio afectado — sigue viendo las 68/63 de su DG normalmente.

**Pendiente de probar**: la ruta se validó completa a nivel API (curl + tokens firmados directamente, nunca contraseñas reales) contra la BD de producción, y el build de frontend compila limpio, pero no se hizo clic-por-clic en navegador todavía — probar en producción abriendo la Bandeja de una obra de DGCOP con una cuenta real antes de darlo por completamente verificado.

### 7.5.2 Grupo 1 de REQ con forma propia conectado a BD real (2026-08-21)

REQ-09 (Fuerza de trabajo), REQ-10 (Turnos), REQ-11 (Verificación de insumos), REQ-12 (Generadores de obra) — los primeros con forma propia (no genérica tipo A/B) en pasar de `localStorage` a BD real. Migración 005: `fuerza_trabajo_frente/oficio`, `turno_trabajo`, `insumo_entrega`, `generador_frente/partida`.

Patrón de API: **"reemplazar el día/lista completa"** (DELETE + reinsert en una transacción) para REQ-09/11/12 — coincide con cómo ya trabaja cada pantalla (mantiene el arreglo completo en memoria y lo vuelve a guardar tras cada cambio), evita tener que diseñar ~20 endpoints granulares de alta/baja/edición. REQ-10 es distinto (bitácora que se acumula, nunca se edita) — un simple `POST` por turno.

Mismo patrón de hidratación de bajo riesgo que el resto de la Etapa 1: cada `utils/*.js` (`fuerzaTrabajo`, `turnosTrabajo`, `verificacionInsumos`, `generadoresObra`) gana `hidratar...DesdeServidor(obraKey, obraId)`, llamado una vez al abrir la pantalla. Truco nuevo aquí: en vez de pasar `obraId` a cada una de las 6 funciones de mutación de `fuerzaTrabajo.js` (rompería su firma pública), se registra `obraKey → obraId` en un `Map` a nivel de módulo al hidratar, y el único punto de guardado interno (`guardarFrentes`/`guardar`) lo consulta ahí — cero cambios en las funciones públicas que ya llamaban los componentes.

`puedeAccederObra` se reutiliza tal cual desde `utils/alcanceObras.js` (compartida con `seguimientoController`) — mismo control de acceso por alcance en los 4 endpoints nuevos.

Probado end-to-end contra producción con la cuenta real de Jacob: los 4 grupos (GET/PUT fuerza de trabajo, GET/POST turnos, GET/PUT insumos, GET/PUT generadores) guardan y devuelven exactamente lo esperado.

### 7.5.3 REQ-13 (Catálogo de conceptos, dueño: JUD) conectado (2026-08-21)

Migración 006: `catalogo_concepto_partida` (partida + monto inicial + monto modificado + orden) y `catalogo_concepto_meta` (pdf, si hubo modificaciones, en qué partidas, descripción) — dos piezas porque así ya vivía en `utils/catalogoConceptos.js` (`guardarPartidas` y `guardarCatalogo` son dos funnels de guardado distintos). Endpoints: `GET/PUT .../partidas` y `PUT .../catalogo`, con el mismo control de acceso (`puedeAccederObra`). Quitar una partida borra su monto en cascada (mismo comportamiento que ya tenía `eliminarPartida` en local). Probado end-to-end: alta de partidas, montos + metadatos, y limpieza al quitar una partida — los 23 JUD ya pueden usarlo real.

### 7.5.4 "Contratos" oculto para roles que no son Concursos y Contratos (2026-08-21)

Consecuencia directa del bug de la sección 7.5.1: aunque el backend ya bloqueaba a Supervisión Externa, el Sidebar seguía mostrándole el enlace "Contratos" (lo mismo para cualquier otra cuenta PS que no fuera `DIRECTOR_CONCURSOS_CONTRATOS` — Director General, JUD, Direcciones, etc.), lo que solo llevaba a una pantalla con errores 403. Se corrigió en dos lugares: `Sidebar.jsx` solo agrega el enlace si `user.rol === "DIRECTOR_CONCURSOS_CONTRATOS"`, y `ContratosPS/index.jsx` bloquea la pantalla (`SinAcceso`) para cualquier otro rol aunque alguien guarde/teclee la URL directa.

### 7.5.5 REQ-15/16 (Avance físico/financiero, Supervisión Externa) conectado (2026-08-21)

El más complejo hasta ahora — pero casi toda su lógica (curvas, IVA, extensión por desfase, saldo pendiente) es **pura** (`utils/avanceFisicoFinanciero.js`), no toca storage. Solo hizo falta persistir los datos crudos: migración 007 — `avance_ejecucion` (fechas reales, 1 fila por obra), `avance_semanal_real` (avance real por semana, **dos fuentes independientes** `supervision`/`supervision_interna`, nunca mezcladas), `programa_quincena` (el programa de obra que declara la contratista), `avance_estimacion` (REQ-16, monto crudo — IVA/líquido/acumulado se siguen calculando en el cliente).

**Wrinkle real encontrado y resuelto con cuidado, no ignorado**: la pantalla tiene un switch "Contrato de obra" / "Contrato de supervisión" — en modo obra, la clave de seguimiento es la obra (numérica, encaja con el modelo nuevo); en modo supervisión, la clave es el **id del contrato de supervisión** (para que una supervisión que atiende varias obras comparta un solo avance) — eso no es un `obra_id`, no encaja con las tablas nuevas (todas `REFERENCES obras(id)`). Se resolvió acotando la conexión real a "Contrato de obra" únicamente por ahora (`obraIdSync` solo trae valor en ese modo; en modo supervisión sigue 100% local, sin romper nada de lo que ya funcionaba). **Pendiente real**: modelar el seguimiento por-contrato para que el modo "Contrato de supervisión" también sea real — necesita sus propias tablas keyed por `contrato_id`, no una adaptación de las actuales.

Probado end-to-end contra producción: ejecución, avance real con las dos fuentes en la misma semana, quincenas, y estimaciones — todo guarda y lee correctamente.

### 7.6 Carátula del contrato — mismo patrón de hidratación (2026-08-20)

Al probar con la cuenta real de Supervisión Externa (SESOCORT), `CapturaAvanceFisico`/`CapturaAvanceFinanciero`/`ModalInformeSupervisionExterna` pedían "completar la Carátula del contrato" aunque esos datos ya existen reales y migrados en `ps_sicops_final.contratos` — porque esas pantallas leen `utils/caratulaContrato.js` → `utils/contratos.js`, un módulo **enteramente independiente** en `localStorage` (el "paso 1" original de captura de contratos, previo a que existiera Contratos real), no conectado a la BD nueva.

Mismo patrón que la sección 7.5 (hidratar hacia el mismo storage que ya leen las pantallas, sin tocarlas):
- `GET /api/obras/vinculados` se amplió con los campos completos de la carátula (`objeto_contrato`, `procedimiento`, `fecha_inicio`, `fecha_termino`, `plazo_ejecucion`, `importe_sin_iva`, `iva`, `rfc`, `representante_legal`, etc. — antes solo traía numero/contratista/importe para la pestaña "Vinculaciones"). Al extenderlo se corrigió de paso una colisión de alias (`o.id` vs `c.id` sin distinguir — Postgres solo conserva la última columna con el mismo nombre) que habría hecho que `obraId` devolviera el id del contrato en vez de la obra; se resolvió con `o.id AS obra_id_pk`.
- `utils/caratulaContrato.js` gana `hidratarCaratulaDesdeServidor(obraKey, obraId)` — llama a `obtenerVinculados()`, y con los datos reales del contrato de obra (y de supervisión, si ya está vinculada) construye un registro en el formato de `utils/contratos.js` con un id local determinista (`srv-<id-real>`) y lo vincula — `guardarContrato`/`vincularObraContrato`/`vincularContratoSupervision` ya existentes, sin tocar su lógica. Idempotente: llamarlo de nuevo actualiza el mismo registro, no duplica.
- Se llama desde `BandejaTareasObra.jsx` (junto con la hidratación de captura ya existente) y desde `ModalInformeSupervisionExterna.jsx` (que se abre también fuera de la Bandeja, desde `ListadoObras.jsx`).

Probado end-to-end contra producción con el token real de Jacob: `GET /api/obras/vinculados` devuelve la carátula completa (objeto, RFC, fechas, importes) tanto del contrato de obra como del de supervisión ya vinculados sobre `PANTEON MINISTERIAL SAN LORENZO TEZONCO`.

### 7.7 Supervisión Interna (2026-08-21) — solicitud real del área de Contratos

Algunas obras no tienen (ni van a tener) contrato de supervisión externa — las supervisa personal de SOBSE directamente. Sin una forma de marcarlo, esas obras quedaban para siempre en "falta vincular supervisión" en `pendientes-vinculacion`, un hueco que nunca se iba a cerrar con un contrato real.

- Migración 003 (aditiva): `obras.supervision_interna BOOLEAN NOT NULL DEFAULT false`.
- `POST /api/obras/:id/supervision-interna` (`{ interna: true|false }`) — marca o quita, mismo patrón de auditoría y validación de DG que el resto del módulo. Reversible: quitar la marca no borra nada, solo regresa la obra a "sin vincular".
- `GET /api/obras/vinculados` regresa `supervisionInterna` por obra; `GET /api/obras/pendientes-vinculacion` excluye del listado `sinSupervision` a las obras marcadas.
- UI: en la pestaña "Vinculaciones", la columna de Supervisión de cada obra muestra "+ Marcar Supervisión Interna" cuando no hay ningún contrato de supervisión vinculado; una vez marcada, se ve como un chip verde "✓ Supervisión Interna" con un enlace "quitar" para corregir si fue un error.

## 8. Alta masiva de obras desde GeoJSON (2026-08-21)

Módulo de administración (solo rol `ADMIN`) para dar de alta obras nuevas a partir de un GeoJSON — mismo patrón de resolución de ubicación que Conservación Vial (`services/geoLookupService.ts`: contención de polígono contra capas reales de la Ciudad), pero implementado con PostGIS del lado del servidor en vez de reimplementar ray-casting en el navegador.

**Capas de referencia** (provistas por el usuario, `SICOPS_v2/GEOJSON/`): `ALCALDIAS.geojson` (propiedad `NAME`), `COLONIAS.geojson` (`NOMBRE`+`DEM_TERRIT`), `CUADRANTES.geojson` (`NAME`, 5 sectores). Cargadas una sola vez a 3 tablas nuevas (`ref_alcaldias`, `ref_colonias`, `ref_cuadrantes`, todas con `geom geometry(MultiPolygon,4326)` + índice GIST) vía `jobs/cargar_capas_referencia.js` — 16 alcaldías, 1851 colonias, 5 cuadrantes cargados. Se agregó `obras.sector` (no existía columna para esto).

**`clave_eje`/`nombre_eje`/`bloque_mundial`**: se investigó si se podían derivar del programa — **no hay de dónde**: `catalogo_programas` no tiene relación con ningún catálogo de ejes (los valores que sí existen en las 411 obras migradas vinieron directo de `sig_sobse`, no son derivables). Se dejan como campos manuales opcionales en el formulario (decisión del usuario, 2026-08-21) — aplican al lote completo, no por obra.

**Flujo (2 pasos, sin escribir hasta confirmar)**:
- `POST /api/admin/obras/previsualizar` — recibe el GeoJSON completo (como JSON en el body, los archivos son chicos — no hace falta multipart) + `dgId`/`programaId`. Por cada feature: toma `nombre` de `properties.name`, resuelve alcaldía/colonia/sector con `ST_Contains` contra las 3 tablas de referencia (usando el centroide para líneas/polígonos), genera la clave única con el mismo algoritmo de slug que `GestionObras/FormularioAlta.jsx` (`PLATSOBSE_<DG>_<PROGRAMA>_<OBRA>`, deduplicada dentro del lote), y marca advertencias (sin nombre, geometría no soportada, no cayó en ninguna alcaldía) — nunca bloquea, el admin revisa y corrige en pantalla.
- `POST /api/admin/obras/confirmar` — recibe las filas (posiblemente editadas) + los datos del lote (dg, programa, año, estatus, dirección interna, ejes opcionales) y escribe todo en una transacción (`obras` + `obra_geom_punto/linea/poligono` según el tipo + una fila de `auditoria` por obra, `motivo='alta_masiva_geojson'`). Todo o nada.

**Probado end-to-end contra producción** con los 2 archivos reales de DGPEST: `MODULOS - DGPEST.geojson` (22 obras, 0 advertencias, alcaldía/colonia/sector resueltos en el 100%) y `ESCUELAS 2026 DGPEST - GRUPOS.geojson` (133 obras, 1 advertencia real — una escuela cuyas coordenadas no caen en ninguna alcaldía, señal correcta de que hay que revisarla a mano). El guardado se probó con una obra sintética de prueba (creada, verificada, eliminada) — **ninguna de las 155 obras reales de DGPEST se ha importado todavía**, queda pendiente de que el usuario lo confirme desde la pantalla.

**Backend**: `controllers/adminObrasController.js`, `routes/admin.js` (gateado con `requireRole("ADMIN")`), montado en `/api/admin`. **Frontend**: `pages/AdminImportarObras.jsx` (subir archivo → previsualizar en tabla editable → confirmar), enlace "Importar Obras" en el Sidebar solo visible para `user.rol === "ADMIN"` en sesión PS.

### 8.1 Ajustes tras la primera prueba real (2026-08-21)

Se probó con las 22 obras reales de `MODULOS - DGPEST.geojson` — el `confirmar` falló con 500. Causa: los puntos del GeoJSON traen una 3ra coordenada de elevación (`[-99.08, 19.49, 0]`), `ST_GeomFromGeoJSON` los toma como geometría 3D, pero `obra_geom_*` es estrictamente 2D. Se corrigió envolviendo con `ST_Force2D(...)`. Las 22 obras de esa primera prueba se eliminaron (obra + geometría + auditoría) antes de los siguientes cambios.

Pedido del área tras esa prueba:
- **Programa: "ver todos"** — un programa puede cambiar de DG de un año a otro (ej. Mantenimiento de módulos de policías). `GET /api/admin/programas?todos=1` lista los de TODAS las DG con su DG de origen; `previsualizar`/`confirmar` ya NO exigen que el programa pertenezca a la DG del lote (antes bloqueaba con 400) — si el programa elegido es de otra DG, se muestra un aviso no bloqueante.
- **Catálogos ampliados** (`GET /api/admin/catalogos-obra`, antes `/api/admin/ejes`): además de clave/nombre de eje y bloque mundial, ahora también sugiere valores ya usados de `origen_compromiso` y `modalidad` (datalist, sigue siendo texto libre).
- **Manuales obligatorios, por obra**: `calle`, `url_google_maps`, `responsable_dg` — no se derivan de nada, se capturan en la tabla de revisión (Paso 3), una columna por cada uno, con validación que bloquea "Confirmar" (cliente y servidor) si falta alguno en cualquier fila. `supervision_interna` igual, por obra, con checkbox — y un campo "Responsable DG (para todas)" con botón "Aplicar" para no repetirlo obra por obra cuando es el mismo (calle y URL nunca se ofrecen en lote, cada obra tiene la suya).
- **Explícitamente fuera de este módulo** (decisión del usuario): `origen_recurso`, `fondo_recurso`, `capitulo_recurso` son datos contractuales — se capturan cuando se vincula el contrato a la obra (módulo de Contratos), no al dar de alta la obra. **Pendiente**: extender el paso de vinculación (`contratosController.vincular`) para pedir estos 3 campos y escribirlos en `obras` en ese momento.

**Decisión (2026-08-20): Opción A** — cuenta real 1:1 por puesto. Consecuencia inmediata: `usuarios` necesita un concepto de **alcance** más rico que `dg_id`/`direccion_interna`, porque los 17 puestos no viven todos en el mismo nivel:

| Alcance | Puestos |
|---|---|
| Global (toda la Secretaría) | Secretario, ADMIN, Equipo Asesor Técnico (a confirmar) |
| Por Dirección General | Director General, Director de Concursos y Contratos, Subdirección de Concertación, Subdirección de Comunicación, Director de Obras Inducidas, Director de Proyecto/Subdirector de Proyectos |
| Por Dirección interna (A/B/C/D) | Director de Obra / JUD — **posible mismo puesto que `DIRECTOR_OBRAS_PUBLICAS`** (rol ya existente en el backend nuevo para Contratos), pendiente de confirmar si son el mismo o dos roles distintos |
| Por obra individual | Residente de Obra |
| Por contrato | Supervisión Externa — login externo real para la empresa (decidido 2026-08-20), scopeada a los contratos de supervisión que tiene asignados |

**Decisiones (2026-08-20):**
- `DIRECTOR_OBRA` (catálogo de requerimientos) y `DIRECTOR_OBRAS_PUBLICAS` (rol ya creado en el backend nuevo) son **el mismo puesto**. Las 4 cuentas A/B/C/D de DGCOP ya existentes pasan a ser también responsables reales de REQ-03/10/12/21 en su Dirección interna — no se crea un rol nuevo aparte.
- Supervisión Externa recibe **login externo real** (credenciales propias para la empresa contratada), con `alcance_tipo = 'CONTRATO'` — captura directo REQ-07/08/15/16 sobre los contratos de supervisión que tiene asignados. Implica: la empresa entra a un sistema de gobierno con su propia cuenta — dejar esto explícito para cualquier revisión de seguridad/institucional posterior, y aplicar el mismo estándar de contraseñas hasheadas + auditoría que ya rige para el resto de `usuarios`.

**Precisión importante (2026-08-20)**: el catálogo de 17 puestos (`ROLES_RESPONSABLE`) es el **formato base** que pidió el Secretario, construido sobre DGCOP — no es un molde que las demás Direcciones Generales vayan a tener idéntico. Cada DG entrega su propio listado real de a qué puesto le corresponde cada tarea. Consecuencia directa para la Etapa 3 (replicar a DGOT/DGPEST/DGSUS/DGOIV): antes de crear cuentas reales para una DG nueva, hay que recibir de esa DG su propio listado de responsables — no asumir que replica la estructura de DGCOP. El esquema de `usuarios` (con `alcance_tipo`) ya queda preparado para eso (no depende de que los 17 códigos se repitan igual en cada DG), pero el *proceso* de alta de cuentas sí necesita ese insumo por DG antes de ejecutarse.

Propuesta de columna de alcance en `usuarios` (en vez de forzar todo a `dg_id`):
```sql
ALTER TABLE usuarios ADD COLUMN alcance_tipo TEXT CHECK (alcance_tipo IN ('GLOBAL','DG','DIRECCION_INTERNA','OBRA','CONTRATO'));
ALTER TABLE usuarios ADD COLUMN obra_id BIGINT REFERENCES obras(id);       -- solo si alcance_tipo = 'OBRA'
ALTER TABLE usuarios ADD COLUMN contrato_id BIGINT REFERENCES contratos(id); -- solo si alcance_tipo = 'CONTRATO'
-- dg_id y direccion_interna (ya existentes) se usan cuando alcance_tipo = 'DG' / 'DIRECCION_INTERNA'
```

## 9. Residente de Obra por contrato de obra (2026-08-21)

Pedido real del área: si ya se sabe quién va a ser el Residente de Obra al momento de vincular el contrato, poder capturarlo ahí para vincularlo más adelante con el seguimiento (antes de que exista una cuenta real de esa persona).

`obras.residente_obra TEXT` (migración `008_residente_obra.js`) — texto libre, no FK a `usuarios` todavía (esa cuenta puede no existir aún). Editable desde la pestaña "Vinculaciones" de Clasificación y vinculación de contratos, tarjeta por obra (`ResidenteObraEditor` en `ContratosPS/index.jsx`), mismo patrón visual que el toggle de Supervisión Interna. Endpoint `POST /api/obras/:id/residente-obra` (gateado `DIRECTOR_CONCURSOS_CONTRATOS`, mismo candado de DG, auditoría motivo `residente_obra`).

## 10. Evidencia real (fotos/video) para el seguimiento — REQ-07/08/20 (2026-08-21)

Hasta hoy `CapturaTipoB.jsx` (el componente genérico de tipo B: reporte fotográfico 360° REQ-07, video REQ-08, memoria fotográfica REQ-20) nunca subía nada — solo "recordaba" el `File.name` elegido en el estado de React y lo mandaba como si fuera la evidencia (`evidencia_url` en `seguimiento_captura` terminaba con un nombre de archivo, nunca una URL real; el archivo en sí se perdía al cerrar el modal). Se construyó la infraestructura real que faltaba, replicando el protocolo ya probado en el proyecto hermano **Conservación Vial**:

- **Disco, no BD**: los archivos viven en `backend/storage/evidencia/<año>/<mes>/<uuid>.ext` (configurable vía `EVIDENCIA_UPLOADS_DIR` / `EVIDENCIA_PUBLIC_PREFIX`); la BD (`seguimiento_evidencia_archivo`, migración `009_evidencia_seguimiento.js`) solo guarda la ruta pública + metadatos. Tabla aparte y no una sola columna porque un requerimiento admite VARIOS archivos (una "memoria fotográfica" es una galería) — `seguimiento_captura.evidencia_url` no se toca, sigue siendo un resumen de texto (mismo criterio que ya usan el resto de capturas — CapturaFuerzaTrabajo, CapturaGeneradoresObra, etc.).
- **Fotos**: se comprimen EN EL NAVEGADOR antes de subir (`utils/imageCompression.js`, resize a 1400px de lado + JPEG 0.72 — código casi calcado de `imageCompression.ts` de Conservación Vial). Miniatura generada en el servidor con **jimp** (no `sharp`: `sharp` moderno exige Node ≥20.9, el VPS corre Node 18 — bajar de versión trae una vulnerabilidad ALTA sin parchar en su libvips), fire-and-forget, derivada dinámicamente en cada lectura comprobando si el archivo `_thumb` ya existe en disco (mismo criterio que `conservacion-vial-api/utils/images.js`).
- **Video**: no se recomprime (exigiría ffmpeg, costoso de CPU) — se acepta lo que entregue el celular, solo se topa el tamaño (80MB) antes de intentar subir.
- **Límites**: 10MB/foto, 80MB/video, hasta 20 archivos por carga. Multer valida el tipo real (`image/*`/`video/*`) y el tamaño se revalida por tipo en el controller (multer solo permite un límite único de tamaño por request).
- **Servido**: `express.static` en `server.js` (funciona en local y producción sin depender de Apache); si más adelante se agrega un alias de Apache como el de Conservación Vial, simplemente adelanta la respuesta sin romper nada.

**Backend**: `utils/uploadsEvidencia.js` (multer + jimp + helpers), `controllers/evidenciaController.js` (`listarEvidencia`/`subirEvidencia`/`eliminarEvidencia`, acceso vía `puedeAccederObra` — no por rol fijo, distintos roles capturan evidencia según el requerimiento), `routes/evidencia.js` (montado en `/api/evidencia`, con traducción de errores de multer — archivo muy pesado / tipo no soportado — a JSON legible en vez del 500 genérico).

**Frontend**: `utils/imageCompression.js`, `api/psEvidenciaApi.js` (multipart — no reusa `psFetch`, que fuerza JSON), `CapturaTipoB.jsx` reescrito: en sesión PS real con obra migrada sube de verdad y pinta una galería con miniaturas (clic para ver original, video con controles, botón eliminar); fuera de sesión PS real conserva el comportamiento de antes sin cambios (demo/localStorage, nunca sube nada). `RegistrarTareaWizardContenido.jsx` ahora pasa `obra` a todos los componentes de captura (antes solo `obraKey`) para que `CapturaTipoB` tenga el `obra.id` real.

**Probado end-to-end contra producción** (JWT de prueba firmado para la cuenta real `ps_admin`, nunca contraseñas): subida de foto de prueba → miniatura generada → servido estático (foto y miniatura, 200) → rechazo correcto de un `.txt` (`TIPO_NO_SOPORTADO`) → acceso denegado correcto para un usuario fuera de alcance (403 `FUERA_DE_ALCANCE`) → eliminación (borra fila + archivo + miniatura del disco, verificado con 404 posterior). Sin residuos de prueba en producción.

**Pendiente**: no se generó thumbnail/poster de video (el navegador ya muestra el primer frame con un `<video>` normal); si más adelante hace falta uno explícito para listados, requeriría `ffmpeg` en el VPS (no instalado todavía).
