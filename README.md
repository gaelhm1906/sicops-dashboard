# SICOPS — Sistema de Control de Obras y Porcentajes

Sistema web para registrar y controlar el avance de obras públicas, con cierre automático semanal, historial de cortes y auditoría completa.

---

## Quick Start

### 1. Backend (API REST — puerto 3001)

```bash
cd backend
npm install
npm run dev        # nodemon — recarga en caliente
```

### 2. Frontend (React — puerto 3000)

```bash
# (desde la raíz del proyecto)
npm install
npm start
```

Ambos servicios deben estar corriendo simultáneamente.

---

## Credenciales demo

| Email | Contraseña | Rol |
|---|---|---|
| `admin@obra.com` | `123456` | DG (acceso total) |
| `carlos@obra.com` | `123456` | usuario (solo lectura de edición) |

---

## Características

- **Login seguro** — JWT con expiración de 8 h, contraseña hasheada con SHA-256
- **Listado de obras** — filtros por programa y estado, búsqueda, paginación, tabla + acordeón mobile
- **Actualización con 3 pasos** — editar → confirmar → verificar con código verbal "CONFIRMO"
- **Validaciones** — delta negativo rechazado, sin cambio rechazado, delta > 10 % con advertencia
- **Sistema abierto/cerrado** — cierre automático a las 12:00 (America/Santiago), apertura a las 00:00
- **Histórico de cortes** — snapshot semanal con estadísticas por programa y por usuario
- **Exportación** — CSV y JSON con metadatos del período
- **Asistente de consultas** — preguntas en lenguaje natural sobre las obras (panel en el Dashboard)
- **Auditoría** — registro de cada cambio con usuario, IP, delta y cambio_id

---

## Estructura del proyecto

```
PORCENTAJES_SIGSOBSE/
├── src/                        # Frontend React 18
│   ├── context/
│   │   ├── AuthContext.jsx     # Sesión, login, logout
│   │   └── ObraContext.jsx     # Obras, filtros, paginación, stats
│   ├── utils/
│   │   ├── api.js              # Cliente HTTP + normalizeObra
│   │   ├── orchestrator.js     # Motor de consultas en lenguaje natural
│   │   ├── exporters.js        # Exportación CSV / JSON
│   │   ├── validations.js      # Validaciones del frontend
│   │   └── formatters.js       # Formateadores de fecha / color / estado
│   ├── components/
│   │   ├── Layout/             # Header, Sidebar, Footer
│   │   ├── Shared/             # Button, Input, Table
│   │   ├── Cards/              # CardResumen, CardObra
│   │   ├── Modal/              # ModalActualizacion, ModalExito
│   │   └── OrchestradorPanel.jsx
│   └── pages/
│       ├── Login.jsx
│       ├── Dashboard.jsx
│       ├── ListadoObras.jsx
│       ├── VistaHistorico.jsx
│       └── NotFound.jsx
│
└── backend/                    # API Node.js + Express
    ├── config/db.js            # CRUD sobre archivos JSON
    ├── controllers/
    │   ├── authController.js
    │   ├── obrasController.js  # Flujo 3-pasos con cambiosPendientes Map
    │   ├── controlController.js
    │   └── reportesController.js
    ├── middleware/
    │   ├── auth.js             # JWT authRequired, requireRole
    │   ├── logger.js           # Colores en consola + archivo de log
    │   └── errorHandler.js
    ├── utils/
    │   ├── cron.js             # Cierre 12:00 / Apertura 00:00
    │   ├── jwt.js
    │   └── validators.js
    ├── data/                   # "Base de datos" en JSON
    │   ├── obras.json
    │   ├── usuarios.json
    │   ├── control_sistema.json
    │   ├── auditoria.json
    │   └── historico.json
    └── tests/                  # Jest + Supertest
        ├── auth.test.js
        ├── obras.test.js
        ├── validators.test.js
        └── cron.test.js
```

---

## API Endpoints

### Autenticación
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login con email y contraseña |
| POST | `/api/auth/logout` | Cerrar sesión |
| GET  | `/api/auth/me` | Usuario autenticado |

### Obras
| Método | Ruta | Descripción |
|---|---|---|
| GET  | `/api/obras` | Listar obras (filtros + paginación) |
| GET  | `/api/obras/historico` | Lista de períodos históricos |
| GET  | `/api/obras/historico?periodo=2025-W01` | Detalle de un corte |
| GET  | `/api/obras/:id` | Obra por ID |
| POST | `/api/obras/:id/editar` | Paso 0: registrar nuevo porcentaje |
| POST | `/api/obras/:id/confirmar/step1` | Paso 1: confirmar cambio pendiente |
| POST | `/api/obras/:id/confirmar/step2` | Paso 2: verificar con código "CONFIRMO" |

### Control del sistema
| Método | Ruta | Descripción |
|---|---|---|
| GET  | `/api/control/estado` | Estado actual (abierto/cerrado, período) |
| POST | `/api/control/abrir` | Abrir manualmente (rol DG) |
| POST | `/api/control/cerrar` | Cerrar y generar snapshot (rol DG) |
| GET  | `/api/control/auditoria` | Historial de auditoría paginado |

### Reportes
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/reportes/periodos` | Todos los períodos disponibles |
| GET | `/api/reportes/corte?periodo=X` | Reporte completo de un corte |
| GET | `/api/reportes/descargar?periodo=X&formato=csv` | Descargar CSV o JSON |

---

## Tests (backend)

```bash
cd backend
npm test
```

Cobertura: 47+ casos en 4 suites (auth, obras, validators, cron).

---

## Variables de entorno (backend/.env)

```env
PORT=3001
JWT_SECRET=sicops_clave_secreta_2025_no_usar_en_prod
JWT_EXPIRES_IN=8h
NODE_ENV=development
HORA_CIERRE=12
HORA_APERTURA=0
```

---

## Roadmap

- [ ] Migrar de JSON a PostgreSQL + PostGIS
- [ ] Autenticación OAuth (Google / LDAP)
- [ ] Dashboard en tiempo real con WebSockets
- [ ] Notificaciones push antes del cierre automático
- [ ] Integrar Claude API para orquestador con contexto semántico
- [ ] App móvil React Native
