# CONTEXTO — SICOPS / PS_SICOPS_FINAL, continuar desde una Mac nueva

Pega esto completo al inicio de una sesión de Claude Code nueva en la Mac para retomar el trabajo sin perder contexto.

## Qué es esto

Plataforma de seguimiento de obra pública para SOBSE CDMX (SICOPS). Hay **dos backends activos** para el mismo frontend:

1. **Backend legacy** (`backend/` dentro de este mismo repo) — el sistema original de SIG-SOBSE/porcentajes, en producción, sirve datos reales que el frontend sigue consultando para varias pantallas.
2. **PS_SICOPS_FINAL** (repo/carpeta aparte: `C:\Users\Usuario\Desktop\PS_SICOPS_FINAL\backend` en Windows) — el backend NUEVO, construido esta sesión desde cero, con PostgreSQL real, para reemplazar el modelo "todo en localStorage" del seguimiento de las 19 actividades de obra. **Este es donde ha estado casi todo el trabajo reciente.**

El frontend (este repo) vive en GitHub: `https://github.com/gaelhm1906/sicops-dashboard` (rama `main`). El commit más reciente antes de este documento incluye TODO el trabajo de la sesión — revísalo con `git log -1` en cuanto clones.

## Dónde está cada cosa en la Mac (después de clonar/copiar)

- **Frontend**: `git clone https://github.com/gaelhm1906/sicops-dashboard.git` — ya tiene todo el código hasta el último commit. Corre `npm install` (la carpeta `node_modules` no viaja, está en `.gitignore`).
- **PS_SICOPS_FINAL backend**: NO está en ese repo de GitHub — viaja aparte, en `PS_SICOPS_FINAL-para-mac.zip` (te lo dejé listo en el Desktop de Windows, cópialo a la Mac por donde prefieras — AirDrop, USB, Drive). Descomprímelo donde quieras trabajar (sugerido: `~/Desktop/PS_SICOPS_FINAL/backend`). **No trae `.env`** (nunca se empaqueta un secreto en un zip) — cópialo tú mismo aparte, es el mismo archivo que ya tienes en la máquina de Windows (`PS_SICOPS_FINAL\backend\.env`), con las credenciales reales de la base de datos y el `JWT_SECRET`. Tampoco trae `node_modules` — corre `npm install` ahí antes de usarlo.

## ⚠️ Aviso real que encontré al preparar esto (revísalo cuando puedas)

Al buscar cómo estaba versionado `PS_SICOPS_FINAL`, encontré que **toda la carpeta de usuario de Windows (`C:\Users\Usuario`) quedó accidentalmente inicializada como repositorio git**, con un `.env` de credenciales reales sin rastrear pero sin ignorar tampoco (riesgo si algún día alguien corre `git add .` ahí). No lo toqué ni lo usé para nada de este traslado — pero vale la pena que en algún momento lo revises y decidas si quitar ese `.git` de la raíz del usuario (probablemente fue un `git init` corrido sin querer en el lugar equivocado).

## Estado real del sistema (para no repetir preguntas ya resueltas)

**Real, con base de datos, en PS_SICOPS_FINAL** — fuerza de trabajo, turnos, verificación de insumos, generadores de obra, catálogo de conceptos, reporte fotográfico/video/memoria fotográfica (con subida real de archivos al servidor), calidad de obra, avance físico-financiero en modo "Contrato de obra", clasificación y vinculación de contratos (incluyendo multi-obra por contrato), Residente de Obra, Datos Contractuales Financieros, alta masiva de obras por GeoJSON (solo ADMIN por ahora).

**Todavía solo en localStorage del navegador** — proyecto ejecutivo, cambios de proyecto, estudios ambiental/impacto urbano, precios extraordinarios, concertación de obras, informe de visitas de asesor, expediente único.

**El hueco más importante pendiente**: el modo "Contrato de supervisión" del avance físico-financiero (REQ-15/16) sigue sin conectar a base de datos real — es el modo que usan TODAS las cuentas reales de Supervisión Externa que ya existen (4: SESOCORT, SANDALU de DGCOP; MOLING, OMIVAL de DGPEST). Lo que capturen ahí hoy no persiste en servidor.

**Cuentas reales ya creadas** — 33 de DGCOP, 10 de DGPEST (roles: Director General, Director de Obra, Director de Obras Inducidas, Director de Proyecto, Director de Concursos y Contratos, Jefe de Unidad de Obra, Supervisión Externa; DGPEST además tiene Subdirección de Concertación). Faltan cuentas para Asesores Estructuristas (REQ-18) y Subdirección de Comunicación (REQ-20) en ambas DG — nadie puede capturar esos dos requerimientos todavía aunque el backend de REQ-20 ya es real. Las contraseñas ya se entregaron por chat en su momento — si hace falta resetear alguna, los scripts están en `PS_SICOPS_FINAL/backend/jobs/`.

## Infraestructura del VPS (para desplegar desde la Mac)

- `srv1574556.hstgr.cloud` — SSH con password (no hay key configurada), mismo acceso desde cualquier máquina.
- PS_SICOPS_FINAL corre en el puerto **3004** (`https://srv1574556.hstgr.cloud/ps-sicops/`) — no confundir con PREDIOS (otro proyecto aparte, en el mismo VPS, puerto 3005, `/predios/`).
- Deploy: `scp` los archivos cambiados a `/opt/ps-sicops-final/backend/...`, luego `ssh ... "pm2 restart ps-sicops-final"`. El runbook completo con los problemas reales ya resueltos está en `backend/DISENO_BD_PS_SICOPS_FINAL.md` (dentro de este mismo repo del frontend).
- **En Mac esto va a ser MÁS fácil que en Windows** — `scp`/`ssh` nativos sin las rarezas de PowerShell, y los bloques `bash` multilínea (heredocs) funcionan directo sin pelear con comillas.

## ⚠️ Verifica esto ANTES de darle acceso a nadie más

Al cierre de esta sesión había cambios de backend construidos y probados, pero **sin confirmar si ya se desplegaron al VPS** — antes de avisarle a DGCOP/DGPEST que empiecen a capturar, corre `curl https://srv1574556.hstgr.cloud/ps-sicops/health` y compáralo contra lo último documentado en `DISENO_BD_PS_SICOPS_FINAL.md` para confirmar que el servidor tiene el código más reciente.

## Conversación en pausa (esperando información externa)

Hay un diseño de "Módulo 2 (alta de obras por Director General) y Módulo 3 (motor financiero: convenios, suspensiones, catálogos triples)" que quedó **en espera** — el usuario va a hablar directo con el área operativa antes de continuar. No retomar por iniciativa propia, esperar a que el usuario traiga las respuestas.
