# Facturación

Sistema de facturación para una tienda con varias cajas y roles `ADMIN` / `CAJERO`.
Incluye inventario, cierres de caja, reportes de ventas y estructura para
facturación electrónica DIAN.

---

## Estado actual

- **Fase 0 completada**: entorno verificado, base de datos creada y cargada.
- **Fase 1 completada**: scaffold TypeScript + Express + Prisma 7, lint, build y
  prueba de humo del endpoint `GET /health`.
- **Fase 2 completada**: Prisma configurado por introspección, cliente generado
  y conexión verificada contra PostgreSQL.
- **Fase 3 completada**: autenticación JWT con roles, middleware de autorización
  y CRUD de productos y clientes.
- **Fase 3.1 completada**: gestión de usuarios solo para `ADMIN`, cambio de
  contraseña propio y usuarios de prueba para la API.
- **Fase 4 completada**: facturación transaccional con numeración, descuento de
  stock, pagos parciales y anulación con reversión de inventario.
- **Fase 4.1 completada**: hardening de seguridad/rendimiento con revocación de
  tokens, CORS, rate limit, logs estructurados, idempotencia, topes de descuento,
  auditoría y consultas optimizadas.
- **Fase 5A completada**: gestión de cajas, cierre único por caja, arqueo de
  efectivo, asociación de ventas al cierre y bloqueo de operaciones posteriores.
- **Fase 6 completada**: inventario manual con entradas, salidas, ajustes y
  kardex; reportes administrativos de ventas, métodos de pago, productos y
  cierres con exportación CSV.
- **Fase 7 completada**: frontend React + Vite + TypeScript con login, panel,
  facturación, pagos, cajas, inventario y reportes con descarga CSV.
- Base `facturacion` en PostgreSQL 14.24 (puerto 5433) con `db/schema.sql`,
  `db/seed.sql` y los parches `db/patches/4.1-hardening.sql`,
  `db/patches/5A-cajas-cierres.sql` y `db/patches/6-reportes-inventario.sql`
  aplicados.
- Pendiente: facturación electrónica DIAN.

---

## Stack decidido

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 22.12 (ESM) |
| Lenguaje | TypeScript |
| Framework | Express |
| ORM | Prisma 7 (`prisma-client` Rust-free + `@prisma/adapter-pg`) |
| Base de datos | PostgreSQL 14.24 (puerto 5433) |
| Validación | zod |
| Autenticación | JWT + bcryptjs |
| Frontend | React 19 + Vite 8 + React Router 7 + TypeScript |
| Pruebas | Vitest + Supertest |

### ¿Por qué Prisma 7 + TypeScript?

Prisma 7 genera el cliente en **TypeScript** por defecto y su generador para
JavaScript (`prisma-client-js`) está en modo mantenimiento/deprecado. Para un
proyecto nuevo se eligió TypeScript y así evitar transpilaciones frágiles del
cliente generado.

### ¿Por qué introspección y no migraciones de Prisma?

`db/schema.sql` es la **fuente de verdad**. El flujo será:

```
modificar db/*.sql  ->  npx prisma db pull  ->  npx prisma generate
```

**No** se debe usar `prisma migrate dev` ni `prisma db push`: Prisma no
representa triggers, funciones ni vistas, y podría eliminarlos.

---

## Base de datos

Archivos:

- `db/schema.sql`: esquema completo.
- `db/seed.sql`: roles, usuario admin de demo, empresa, cajas, resolución y productos.
- `db/patches/4.1-hardening.sql`: parche idempotente de columnas, constraints e
  índices agregados en la Fase 4.1.
- `db/patches/5A-cajas-cierres.sql`: agrega `efectivo_contado` y el unique
  parcial que garantiza un solo cierre `ABIERTO` por caja.
- `db/patches/6-reportes-inventario.sql`: índices para reportes por fecha de pago
  y movimientos por tipo/fecha.

Tablas principales:

- `empresa`, `roles`, `usuarios`
- `clientes`
- `productos`, `inventario_movimientos`
- `cajas`, `cierres_caja`
- `resoluciones`
- `facturas`, `detalle_factura`, `pagos`
- `facturas_electronicas`
- `auditoria`

Enums nativos:

- `tipo_documento`: `CC`, `NIT`, `CE`, `PP`, `TI`
- `tipo_mov_inventario`: `ENTRADA`, `SALIDA`, `AJUSTE`
- `estado_factura`: `BORRADOR`, `EMITIDA`, `PAGADA`, `ANULADA`
- `metodo_pago`: `EFECTIVO`, `TARJETA`, `TRANSFERENCIA`, `NEQUI`, `DAVIPLATA`, `CREDITO`
- `estado_cierre`: `ABIERTO`, `CERRADO`
- `estado_dian`: `PENDIENTE`, `ENVIADA`, `ACEPTADA`, `RECHAZADA`, `ERROR`

Lógica implementada en la base de datos:

- `fn_set_updated_at` + triggers en `usuarios` y `productos`.
- `fn_mov_inventario_stock`: al insertar un movimiento ajusta `productos.stock`.
- `fn_revertir_stock_anulacion`: al pasar una factura a `ANULADA` devuelve el stock.
- `CHECK productos_stock_no_negativo`: impide stock negativo a nivel de BD.
- `cierres_caja_abierto_unico`: índice único parcial; una caja no puede tener
  más de un cierre `ABIERTO`.
- Vistas: `v_ventas_diarias`, `v_ventas_mensuales`, `v_ventas_anuales`.
- Función: `fn_resumen_ventas(p_desde, p_hasta)`.

Reglas del proyecto:

- El dinero es `NUMERIC(14,2)`; en Prisma se usa `Decimal`, **nunca** `number`/float.
- El stock se modifica **solo** insertando movimientos; la app no actualiza
  `productos.stock` directamente.
- Las vistas de Prisma son de solo lectura.
- La numeración de facturas requiere transacción y `SELECT ... FOR UPDATE` sobre
  `resoluciones` para evitar números duplicados.

Usuario de demo del seed: `admin@demo.com` / `Admin123*`
(las contraseñas se almacenan con `pgcrypto`; bcryptjs puede verificarlas).

---

## Entorno detectado (2026-11-05)

- Node `v22.12.0`, npm `11.19.0`.
- PostgreSQL **18.6** en el puerto **5432** (servicio `postgresql-x64-18`), contraseña no disponible.
- PostgreSQL **14.24** en el puerto **5433** (servicio `postgresql-x64-14`), **instancia en uso** (`postgres` / `postgres`).
- `psql` no está en el `PATH`; binarios en `C:\Program Files\PostgreSQL\14\bin`.
- Docker no está instalado.
- `pg_hba.conf` usa `scram-sha-256`: se requiere contraseña del usuario.
- Se reintentó la instancia 18 con la contraseña `postgres` y siguió rechazando
  la autenticación; por eso se trabaja con la instancia 14 (5433).

---

## Configuración

`.env` ya creado (no se versiona):

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/facturacion?schema=public"
JWT_SECRET="<generado>"
PORT=3000
NODE_ENV=development
CORS_ORIGINS="http://localhost:5173,http://localhost:3000"
TRUST_PROXY=false
RATE_LIMIT_ENABLED=true
DB_POOL_MAX=10
BCRYPT_ROUNDS=10
MAX_DESCUENTO_CAJERO=10
LOG_LEVEL=info
```

`.env.example` contiene la plantilla sin credenciales reales. Las variables nuevas
tienen valores por defecto, por lo que un `.env` anterior sigue funcionando.

---

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor en desarrollo con recarga (`tsx watch`). |
| `npm run build` | Compila TypeScript a `dist/`. |
| `npm start` | Ejecuta la compilación (`node dist/server.js`). |
| `npm run typecheck` | Verifica tipos sin emitir. |
| `npm run lint` / `lint:fix` | ESLint (flat config). |
| `npm run format` / `format:check` | Prettier. |
| `npm test` / `test:watch` | Suite de integración con Vitest + Supertest. |
| `npm run db:pull` | Introspección de Prisma desde la base actual. |
| `npm run db:generate` | Genera Prisma Client en `src/generated/prisma`. |
| `npm run db:check` | Conecta a la BD e imprime conteos del seed. |
| `npm run db:seed:test` | Crea/restablece los usuarios de prueba locales. |
| `npm run db:studio` | Abre Prisma Studio. |
| `npm --prefix frontend install` | Instala dependencias del frontend. |
| `npm --prefix frontend run dev` | Vite en `http://localhost:5173` con proxy a la API. |
| `npm --prefix frontend run build` | Typecheck y build de producción en `frontend/dist/`. |
| `npm --prefix frontend run typecheck` | Verifica tipos del frontend. |

Comprobado: `typecheck`, `lint`, `format:check`, `build`, `test`, `db:check`,
`db:seed:test` y `GET /health` responden OK.

### Retomar el proyecto

1. Verificar la BD: `npm run db:check`.
2. Aplicar los parches si aún no están: `psql ... -f db/patches/4.1-hardening.sql`,
   `psql ... -f db/patches/5A-cajas-cierres.sql` y
   `psql ... -f db/patches/6-reportes-inventario.sql`.
3. Regenerar el cliente: `npm run db:generate`.
4. Ejecutar la suite: `npm test`.
5. Levantar la API: `npm run dev`.
6. Instalar y levantar el frontend: `npm --prefix frontend install` y
   `npm --prefix frontend run dev`.

Para guardar la conversación de opencode (según la versión instalada):

```powershell
opencode session list
opencode export <sessionID> | Out-File -FilePath session.json -Encoding utf8
opencode import session.json
opencode --continue
```

---

## Estructura actual

```
src/
  config/env.ts              # validación de variables con zod
  db/prisma.ts               # PrismaClient + adapter pg (singleton)
  generated/prisma/          # cliente generado (ignorado por git)
  lib/
    http-error.ts            # error HTTP tipado
    jwt.ts                   # firmar/verificar tokens
    password.ts              # bcryptjs
    password-schema.ts       # política de contraseña compartida
    money.ts                 # operaciones Decimal (sumar, redondear)
    pagination.ts            # page/limit, meta y skip
    parse-id.ts              # IDs BigInt desde params
    fechas.ts                # rangos diarios y mes actual
    csv.ts                   # generación y descarga de CSV
    auditoria.ts             # registro de acciones críticas + IP
    logger.ts                # pino (nivel configurable, silencioso en tests)
    prisma-errors.ts         # detección de P2002/P2025/CHECK
  middlewares/
    authenticate.ts          # valida Bearer token y token_version en BD
    authorize.ts             # restringe por rol
    error-handler.ts         # ZodError, HttpError y JSON inválido
    rate-limit.ts            # límites para login y API
    request-id.ts            # X-Request-Id por solicitud
    request-logger.ts        # log estructurado de acceso
  modules/
    auth/                    # login, /me, cambio de contraseña y tipos
    productos/               # CRUD de productos
    clientes/                # CRUD de clientes
    usuarios/                # gestión de usuarios (ADMIN)
    cajas/                   # CRUD de cajas y cierre abierto actual
    cierres/                 # apertura, arqueo y cierre de caja
    facturas/                # emisión, pagos, anulación y selects optimizados
      facturas.selects.ts    # selects tipados sin password_hash
    inventario/              # movimientos, ajustes, stock bajo, valorización y kardex
    reportes/                # ventas, pagos, productos, cierres y CSV
  types/express.d.ts         # extensión de Request con user e id
  scripts/
    check-db.ts              # verificación de conexión y conteos
    seed-test-users.ts       # usuarios de prueba locales
  app.ts                     # configuración de Express + rutas
  server.ts                  # arranque y apagado ordenado
tests/
  health.test.ts             # prueba de humo con Supertest
  api.test.ts                # auth, roles, productos y clientes (BD real)
  usuarios.test.ts           # CRUD de usuarios y contraseñas (BD real)
  facturas.test.ts           # emisión, pagos, stock, idempotencia y carreras (BD real)
  cajas.test.ts              # cajas, cierres, arqueo y bloqueos (BD real)
  inventario.test.ts         # movimientos, kardex, stock bajo y valorización (BD real)
  reportes.test.ts           # resumen, ventas, pagos, productos, cierres y CSV (BD real)
  security.test.ts           # revocación, CORS, JSON inválido y health/ready
prisma/
  schema.prisma              # 14 modelos, 3 vistas, 6 enums
prisma.config.ts             # configuración del CLI de Prisma
frontend/
  src/
    auth/AuthContext.tsx     # sesión, token y cierre por expiración
    components/              # layout, feedback, modales y campos
    lib/                     # cliente API, formato, hooks y utilidades
    pages/                   # login, panel, productos, clientes, cajas,
                             # facturación, inventario y reportes
    types.ts                 # DTOs del API
  vite.config.ts             # proxy /api -> http://localhost:3000
```

Dependencias principales instaladas:

| Paquete | Versión |
|---|---|
| `express` | 5.3.0 |
| `prisma` / `@prisma/client` | 7.10.1 |
| `@prisma/adapter-pg` / `pg` | 7.10.1 / 8.23.1 |
| `zod` | 4.6.7 |
| `express-rate-limit` | 8.7.3 |
| `pino` | 10.4.0 |
| `typescript` | 6.0.3 |
| `vitest` / `supertest` | 5.1.0 / 7.3.1 |

Dependencias del frontend (`frontend/package.json`):

| Paquete | Versión |
|---|---|
| `react` / `react-dom` | 19.3.1 |
| `react-router-dom` | 7.18.5 |
| `vite` / `@vitejs/plugin-react` | 8.3.6 / 6.2.1 |
| `typescript` | 7.0.2 |

---

## Prisma (Fase 2)

- Configuración del CLI en `prisma.config.ts` (lee `DATABASE_URL` con dotenv).
- `prisma/schema.prisma`: 14 modelos, 3 vistas y 6 enums introspectados.
- Cliente generado en `src/generated/prisma`; **no se versiona**. Se regenera con
  `npm run db:generate`.
- `src/db/prisma.ts` crea un singleton con `PrismaPg` para evitar múltiples
  conexiones con la recarga en desarrollo.
- `npm run db:check` verifica la conexión y los conteos del seed.

Notas de introspección:

- Las vistas son de solo lectura; al paginar exigen `orderBy` porque no tienen
  identificador único definido en la BD.
- Los `CHECK` de PostgreSQL no se representan en Prisma: siguen vigentes en la
  base y deben replicarse en la validación con zod.
- Tras cambiar `db/*.sql`: ejecutar `npm run db:pull` y revisar el diff; luego
  `npm run db:generate`.
- Los modelos conservan el nombre de la tabla (`prisma.usuarios`,
  `prisma.facturas`) para no añadir mapeos innecesarios.
- Se mantiene Prisma **7.10.1** aunque exista Prisma 8 en release candidate.

## API (Fases 3, 4, 4.1, 5A y 6)

Todas las rutas (excepto `/health`, `/health/ready` y el login) requieren
`Authorization: Bearer <token>`. Login: `POST /api/auth/login` con
`{ "email", "password" }`; responde `{ token, user }`. En producción hay rate
limit en login (10 intentos/15 min) y en la API (300 solicitudes/min); en tests
se desactiva automáticamente.

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/health` | público | Liveness de la API |
| GET | `/health/ready` | público | Readiness con `SELECT 1` a la BD |
| GET | `/api/auth/me` | autenticado | Usuario del token |
| PATCH | `/api/auth/password` | autenticado | Cambia la contraseña propia |
| GET | `/api/usuarios` | ADMIN | Lista con `page`, `limit`, `search`, `activo`, `rol` |
| GET | `/api/usuarios/:id` | ADMIN | Detalle |
| POST | `/api/usuarios` | ADMIN | Crea usuario con `nombre`, `email`, `password`, `rol` |
| PATCH | `/api/usuarios/:id` | ADMIN | Actualiza datos, rol o estado |
| PATCH | `/api/usuarios/:id/password` | ADMIN | Restablece la contraseña |
| DELETE | `/api/usuarios/:id` | ADMIN | Desactiva lógicamente |
| GET | `/api/cajas` | autenticado | Lista con `page`, `limit`, `search`, `activo` |
| GET | `/api/cajas/:id` | autenticado | Detalle con `cierre_abierto` |
| POST | `/api/cajas` | ADMIN | Crea una caja |
| PATCH | `/api/cajas/:id` | ADMIN | Actualiza nombre o estado |
| DELETE | `/api/cajas/:id` | ADMIN | Desactiva si no tiene cierre abierto |
| GET | `/api/cierres` | autenticado | Lista con `page`, `limit`, `caja_id`, `estado` |
| GET | `/api/cierres/:id` | autenticado | Detalle del cierre y su arqueo |
| POST | `/api/cierres` | autenticado | Abre cierre con `caja_id` y `base_inicial` |
| POST | `/api/cierres/:id/cerrar` | ADMIN o CAJERO dueño | Cierra con `efectivo_contado` |
| GET | `/api/productos` | autenticado | Lista con `page`, `limit`, `search`, `activo` |
| GET | `/api/productos/:id` | autenticado | Detalle |
| POST | `/api/productos` | ADMIN | Crea; `stock_inicial` genera movimiento `ENTRADA` |
| PATCH | `/api/productos/:id` | ADMIN | Actualiza campos |
| DELETE | `/api/productos/:id` | ADMIN | Desactiva (`activo=false`) |
| GET | `/api/clientes` | autenticado | Lista con `page`, `limit`, `search`, `activo`, `tipo_doc` |
| GET | `/api/clientes/:id` | autenticado | Detalle |
| POST | `/api/clientes` | autenticado | Crea |
| PATCH | `/api/clientes/:id` | autenticado | Actualiza campos |
| DELETE | `/api/clientes/:id` | ADMIN | Desactiva |
| GET | `/api/facturas` | autenticado | Lista con paginación, `estado`, `cliente_id`, `caja_id`, `numero`, `desde`, `hasta` |
| GET | `/api/facturas/:id` | autenticado | Detalle con ítems y pagos |
| POST | `/api/facturas` | autenticado | Emite factura con `items` y `pagos` |
| POST | `/api/facturas/:id/pagos` | autenticado | Agrega un pago parcial o final |
| POST | `/api/facturas/:id/anular` | ADMIN | Anula con `motivo`; revierte stock |
| GET | `/api/inventario/movimientos` | ADMIN | Lista con `page`, `limit`, `producto_id`, `tipo`, `desde`, `hasta` |
| POST | `/api/inventario/movimientos` | ADMIN | Registra `ENTRADA`, `SALIDA` o `AJUSTE` con `motivo` |
| GET | `/api/inventario/stock-bajo` | ADMIN | Productos activos con `stock <= stock_minimo` |
| GET | `/api/inventario/valorizacion` | ADMIN | Unidades y valor de inventario a costo y venta |
| GET | `/api/inventario/productos/:id/kardex` | ADMIN | Movimientos con saldo acumulado y filtros de fecha |
| GET | `/api/reportes/resumen` | ADMIN | Facturas, facturado, cobrado, pendiente y ticket promedio |
| GET | `/api/reportes/ventas` | ADMIN | Ventas paginadas con filtros y saldo pendiente |
| GET | `/api/reportes/metodos-pago` | ADMIN | Totales y cantidad de pagos por método |
| GET | `/api/reportes/productos` | ADMIN | Unidades, venta y margen estimado por producto |
| GET | `/api/reportes/cierres` | ADMIN | Cierres con totales, arqueo y cantidad de facturas |

Convenciones:

- IDs `BigInt` y decimales se serializan como strings.
- Paginación responde `{ data, meta: { page, limit, total, totalPages } }`.
- `POST`/`PATCH` responden `{ data }`; errores `{ error, message, requestId, details? }`.
- `POST /api/facturas` y `POST /api/facturas/:id/pagos` aceptan el header
  `Idempotency-Key` (8–80 caracteres alfanuméricos, `.`, `-` o `:`); repetir la
  misma clave devuelve el mismo resultado sin duplicar efectos.
- El stock solo cambia con movimientos de inventario; `stock` no se edita por API.
- zod replica los `CHECK` de la base (precio ≥ 0, IVA 0–100, enum de documento).
- Las contraseñas usan bcrypt; nunca se devuelve `password_hash`.
- Un `ADMIN` no puede desactivarse ni quitarse el rol a sí mismo.
- En facturas, `precio_venta` es sin IVA: el IVA se calcula por línea.
- `CREDITO` no está disponible en el MVP; solo `EFECTIVO`, `TARJETA`,
  `TRANSFERENCIA`, `NEQUI` y `DAVIPLATA`.
- La factura nace `EMITIDA` o `PAGADA` (sin borradores); los pagos parciales
  dejan el estado en `EMITIDA` y el pago final en `PAGADA`.
- Si se envía `caja_id`, la caja debe estar activa y tener un cierre `ABIERTO`;
  la factura queda asociada a ese `cierre_id`.
- Solo puede existir un cierre `ABIERTO` por caja; el unique parcial de la BD y
  la transacción de apertura lo garantizan.
- Un cierre no se puede cerrar si quedan facturas `BORRADOR` o `EMITIDA`
  asociadas. Al cerrar se calculan ventas, pagos por método, efectivo esperado
  (`base_inicial + pagos EFECTIVO`) y diferencia (`efectivo_contado - esperado`).
- Una factura asociada a un cierre `CERRADO` no se puede anular. Un `CAJERO`
  solo puede cerrar el cierre que abrió; `ADMIN` puede cerrar cualquiera.
- No se puede desactivar una caja con un cierre `ABIERTO`.
- Un `CAJERO` solo puede consultar y pagar sus propias facturas y tiene un tope
  de descuento configurable (`MAX_DESCUENTO_CAJERO`, 10% por defecto).
- La emisión y la anulación usan transacción con `SELECT ... FOR UPDATE` para
  numerar y descontar/revertir stock sin carreras; los productos se bloquean en
  lote y en orden de ID.
- Los cambios de contraseña, rol o estado incrementan `token_version`, por lo que
  los tokens anteriores dejan de ser válidos.
- Las respuestas de auth, facturas y cierres usan `Cache-Control: no-store`.
- Se auditan login (fuera de tests), emisión/pago/anulación de facturas, apertura
  y cierre de caja, movimientos manuales de inventario y acciones administrativas
  sobre usuarios y cajas.
- Inventario manual solo para `ADMIN`: `ENTRADA` y `SALIDA` usan cantidad
  positiva; `AJUSTE` admite cantidad firmada distinta de cero. El movimiento
  bloquea el producto con `FOR UPDATE` y el trigger de la BD actualiza el stock.
- Una salida o ajuste que deje stock negativo responde
  `409 STOCK_INSUFICIENTE`; no se permiten movimientos sobre productos inactivos.
- El kardex calcula el saldo acumulado desde el primer movimiento del producto,
  aunque se filtren fechas o se pagine.
- Los reportes son solo para `ADMIN`, excluyen facturas `ANULADA` y aceptan
  `desde`, `hasta`, `caja_id`, `usuario_id` y `cliente_id`. Sin fechas usan el
  mes actual.
- `format=csv` exporta todas las filas del reporte (sin paginar), con BOM UTF-8,
  escape de comas/comillas y `Content-Disposition` de descarga.
- El margen por producto usa el costo histórico de los movimientos `SALIDA` de
  cada factura y cae al costo actual del producto si no hay movimiento.
- Los reportes de fecha usan límites inclusivos por día (`>= desde` y
  `< día siguiente a hasta`).

### Frontend (Fase 7)

El frontend está en `frontend/` y consume la API por `/api`. En desarrollo, Vite
hace proxy a `http://localhost:3000`, por lo que no requiere configurar CORS. Para
un despliegue separado se puede definir `VITE_API_URL` con la URL completa de la
API.

| Pantalla | Roles | Funcionalidad |
|---|---|---|
| Login | público | Inicio de sesión, persistencia del token y expiración automática |
| Panel | ambos | Resumen del mes, últimas facturas y estado del inventario |
| Productos | ambos | Búsqueda, paginación y CRUD solo `ADMIN` |
| Clientes | ambos | Búsqueda, paginación y edición; desactivación `ADMIN` |
| Cajas y cierres | ambos | Apertura, arqueo, cierre y administración de cajas |
| Facturación | ambos | Lista con filtros, emisión, detalle, pagos y anulación `ADMIN` |
| Inventario | ADMIN | Movimientos, stock bajo, valorización y kardex |
| Reportes | ADMIN | Resumen, ventas, métodos de pago, productos y cierres con CSV |

Detalles de implementación:

- React 19 + Vite + TypeScript, sin framework de UI adicional.
- Rutas protegidas por sesión y por rol; un `CAJERO` no puede abrir inventario ni
  reportes desde la interfaz.
- El token se guarda en `localStorage`; cualquier `401` de la API cierra la
  sesión y redirige al login.
- La emisión de facturas envía `Idempotency-Key` y los pagos también, evitando
  duplicados si se reintenta una solicitud.
- Los importes se muestran con `Intl.NumberFormat` para COP; el cálculo de la
  vista previa usa los precios e IVA del catálogo.
- La descarga CSV usa el endpoint de reportes con `format=csv` y conserva el
  nombre de archivo enviado por el backend.
- La ruta `frontend/dist/` se genera con `npm --prefix frontend run build`.

### Hardening y rendimiento (Fase 4.1)

- Autenticación con chequeo de `token_version` en cada request: un token viejo
  responde `401` después de resetear contraseña, cambiar rol o desactivar.
- CORS por allowlist (`CORS_ORIGINS`), `helmet`, rate limit y `X-Request-Id` en
  todas las respuestas.
- Logs JSON con `pino`; no se registran contraseñas ni tokens.
- `GET /health/ready` verifica la conexión con `SELECT 1`.
- Pool de PostgreSQL configurable con `DB_POOL_MAX`; costo de bcrypt con
  `BCRYPT_ROUNDS`.
- La emisión de facturas usa selects mínimos (sin `password_hash`), bloqueo de
  productos en lote y catch de `CHECK` para responder `409 STOCK_INSUFICIENTE`.
- Idempotencia en facturas y pagos; validación de `Idempotency-Key` antes de
  consumir la resolución.
- `CHECK productos_stock_no_negativo` como red de seguridad ante carreras.

### Usuarios de prueba

Ejecutar `npm run db:seed:test` (solo local; restablece estas contraseñas):

| Rol | Email | Contraseña | Uso |
|---|---|---|---|
| ADMIN | `admin@demo.com` | `Admin123*` | CRUD completo |
| CAJERO | `cajero@demo.com` | `Cajero123*` | Login, lectura, facturas propias y `403` al escribir |
| CAJERO inactivo | `inactivo@demo.com` | `Inactivo123*` | El login debe responder `401` |

---

## Bitácora

- **2026-11-05**
  - Revisión de `db/schema.sql` y `db/seed.sql`.
  - Elección de ORM: Prisma 7 con TypeScript e introspección.
  - Verificación del entorno: Node 22.12, PostgreSQL 18 en 5432 y 14 en 5433.
  - Se usó PostgreSQL 14.24 (5433) porque la instancia 18 (5432) no aceptó la
    contraseña disponible.
  - Base `facturacion` creada con `schema.sql` + `seed.sql` (sin errores).
  - Verificación: 14 tablas, 3 vistas, 4 triggers; seed con 2 roles, 1 usuario,
    3 productos y 2 cajas; contraseña del admin de demo validada con `pgcrypto`.
  - Creados `.env`, `.env.example` y `.gitignore` (`.env` y `src/generated`
    excluidos de git).
- **2026-11-05 (Fase 1)**
  - Proyecto npm creado en modo ESM (`"type": "module"`).
  - Instaladas dependencias de Express 5, Prisma 7, zod 4, JWT/bcrypt, ESLint,
    Prettier, Vitest y Supertest.
  - Configurados `tsconfig.json` (NodeNext), `eslint.config.js`,
    `.prettierrc.json`, `.prettierignore` y `.editorconfig`.
  - Creados `env.ts`, manejo centralizado de errores, `app.ts`, `server.ts` y
    estructura de módulos vacía.
  - `GET /health` probado en ejecución real; `typecheck`, `lint`, `build` y
    `test` pasan sin errores.
  - Se reintentó PostgreSQL 18 (5432) con `postgres`: sigue rechazando la
    contraseña, así que se mantiene PostgreSQL 14 (5433).
- **2026-11-05 (Fase 2)**
  - Creado `prisma.config.ts` con `DATABASE_URL` desde `.env`.
  - `prisma db pull` introspectó 14 modelos, 3 vistas y 6 enums.
  - `prisma generate` generó el cliente en `src/generated/prisma` (ESM, TS).
  - Creados `src/db/prisma.ts` (adaptador pg + singleton) y
    `src/scripts/check-db.ts`.
  - `npm run db:check` conectó correctamente: 2 roles, 1 usuario, 3 productos,
    2 cajas y 0 ventas.
  - Advertencias asumidas: `CHECK` no soportados por Prisma y vistas sin
    identificador único (requieren `orderBy` al paginar).
- **2026-11-05 (Fase 3)**
  - Autenticación con `POST /api/auth/login` (JWT, 8h por defecto) y
    `GET /api/auth/me`; `authenticate` valida el Bearer token.
  - `authorize` restringe por rol: productos (escritura) y borrado de clientes
    solo para `ADMIN`; listados y edición de clientes para autenticados.
  - CRUD de productos con stock inicial mediante `inventario_movimientos`
    (el trigger de la BD actualiza `productos.stock`) y borrado lógico.
  - CRUD de clientes con unicidad `(tipo_doc, num_doc)` y borrado lógico.
  - Respuestas normalizadas: IDs/Decimal como string, paginación con `meta`,
    errores zod en 422 y `HttpError` para 401/403/404/409.
  - Pruebas de integración en `tests/api.test.ts` contra la BD real; `typecheck`,
    `lint`, `build` y `test` (7 pruebas) pasan.
- **2026-11-05 (Fase 3.1)**
  - Módulo `usuarios` con listado, detalle, creación, actualización, reset de
    contraseña y desactivación lógica; todas las rutas son solo para `ADMIN`.
  - Protección para no desactivarse ni quitarse el rol `ADMIN` a sí mismo y
    garantía de al menos un administrador activo.
  - `PATCH /api/auth/password` para que cada usuario cambie su contraseña.
  - Política común de contraseñas (8–72 caracteres, mayúscula, minúscula y
    número) y DTO de usuario sin `password_hash`.
  - `npm run db:seed:test` crea `admin@demo.com`, `cajero@demo.com` e
    `inactivo@demo.com` con contraseñas conocidas para pruebas manuales.
  - Pruebas de integración en `tests/usuarios.test.ts`; `typecheck`, `lint`,
    `build` y toda la suite pasan.
- **2026-11-06 (Fase 4)**
  - Emisión transaccional de facturas: bloqueo de la resolución con
    `SELECT ... FOR UPDATE`, asignación de número, bloqueo de productos por ID y
    validación de stock.
  - Cálculo con `Decimal` por línea (descuento en moneda e IVA), totales de la
    factura y estado inicial `EMITIDA` o `PAGADA`.
  - Movimientos de inventario `SALIDA` generados en la misma transacción; la
    anulación como `ADMIN` usa el trigger de la BD para revertir stock.
  - Pagos parciales/finales con control de saldo y sin método `CREDITO` en el MVP.
  - `CAJERO` limitado a sus propias facturas; `ADMIN` sin restricción.
  - Pruebas de integración en `tests/facturas.test.ts`; suite completa con
    **24 pruebas** en 4 archivos.
- **2026-11-06 (Fase 4.1)**
  - Parche `db/patches/4.1-hardening.sql`: `token_version`, claves de idempotencia,
    unique compuesto, `CHECK` de stock e índices de consulta.
  - `authenticate` ahora consulta la BD y valida usuario activo, rol y
    `token_version`; los cambios de credenciales/rol/estado revocan tokens.
  - CORS con allowlist, rate limit, request-id, logs con pino, `/health/ready`,
    errores JSON genéricos con `requestId` y shutdown con timeout.
  - Pool de Prisma configurable; bcrypt configurable; `Cache-Control: no-store`.
  - Facturas: selects tipados, bloqueo de productos en lote, idempotencia en
    emisión/pagos y tope de descuento para `CAJERO`.
  - Auditoría de login, facturas, pagos y acciones administrativas de usuarios.
  - Pruebas nuevas de seguridad, idempotencia, descuentos y concurrencia; suite
    completa con **32 pruebas** en 5 archivos.
  - Verificado: `format:check`, `typecheck`, `lint`, `build`, `test` y `db:check`.
- **2026-11-06 (Fase 5A)**
  - Parche `db/patches/5A-cajas-cierres.sql`: `efectivo_contado`, unique parcial
    `cierres_caja_abierto_unico` e índices de consulta.
  - CRUD de cajas (`ADMIN` para escritura) y listado con el cierre abierto actual.
  - Apertura transaccional de cierres con bloqueo de la caja; un solo cierre
    `ABIERTO` por caja.
  - Facturas con `caja_id` exigen cierre abierto y guardan `cierre_id`; venta y
    apertura/cierre se serializan con locks.
  - Cierre bloqueado con facturas pendientes; calcula ventas, efectivo, otros
    medios, efectivo esperado y diferencia; bloquea anulación de facturas de
    cierres cerrados y desactivación de cajas con cierre abierto.
  - Auditoría de apertura/cierre y acciones sobre cajas; pruebas en
    `tests/cajas.test.ts`; suite completa con **36 pruebas** en 6 archivos.
  - Verificado: `format:check`, `typecheck`, `lint`, `build` y `test`.
- **2026-11-06 (Fase 6)**
  - Parche `db/patches/6-reportes-inventario.sql` con `idx_pagos_fecha` e
    `idx_mov_tipo_fecha`; esquema y Prisma actualizados.
  - Módulo `inventario`: movimientos manuales `ENTRADA`/`SALIDA`/`AJUSTE`, stock
    bajo, valorización, kardex con saldo acumulado y auditoría con stock
    antes/después; escritura y consulta solo para `ADMIN`.
  - Módulo `reportes`: resumen, ventas, métodos de pago, productos con margen
    estimado y cierres; filtros comunes y exportación CSV.
  - `src/lib/csv.ts` genera y descarga CSV con escape y protección básica contra
    fórmulas; `src/lib/fechas.ts` centraliza rangos diarios y mes actual.
  - Rutas registradas en `/api/inventario` y `/api/reportes` con `no-store`.
  - Pruebas en `tests/inventario.test.ts` y `tests/reportes.test.ts`; suite
    completa con **46 pruebas** en 8 archivos.
  - Verificado: `format:check`, `typecheck`, `lint`, `build`, `test` y `db:check`.
- **2026-11-06 (Fase 7)**
  - Creado `frontend/` con React 19, Vite 8, React Router 7 y TypeScript.
  - Implementados login con sesión persistente, layout por rol, panel, productos,
    clientes, cajas/cierres, facturación, detalle, pagos, anulación, inventario y
    reportes con descarga CSV.
  - Cliente API tipado con manejo de errores, cierre automático por `401`,
    `Idempotency-Key` en facturas/pagos y proxy `/api` en desarrollo.
  - Estilos responsivos propios, sin librería de UI adicional.
  - Verificado: `frontend` `typecheck` y `build`; backend `lint` y
    `format:check` siguen pasando.
- **2026-11-06 (Fase 7.1)**
  - POS rápido en “Nueva factura”: búsqueda modal de productos con `N`, líneas
    editables, atajo `Supr` para eliminar y `P` para cobrar e imprimir.
  - La caja se resuelve automáticamente desde el cierre `ABIERTO` del usuario;
    `CAJERO` no puede facturar usando el cierre abierto de otro usuario.
  - Cobro rápido con método, efectivo recibido, cambio y faltante; los pagos
    mixtos y abonos siguen disponibles desde el detalle.
  - Tirilla térmica de 80 mm con vista previa e impresión/Guardar como PDF del
    navegador; botón de reimpresión en el detalle y atajo `P`.
  - Cola local de pendientes de impresión por usuario en `localStorage`, visible
    en panel y facturas, con reimpresión, eliminación y limpieza.
  - Cierre de caja simplificado: muestra solo el total vendido del turno y el
    arqueo se registra automáticamente con el efectivo esperado.
  - `GET /api/cierres` y `GET /api/cierres/:id` calculan dinámicamente ventas,
    efectivo, otros medios y efectivo esperado para cierres abiertos.
  - Verificado: backend `typecheck`, `lint` y `test` (46 pruebas); frontend
    `typecheck` y `build`.

---

## Próximos pasos

1. Facturación electrónica DIAN (estructura, XML/PDF, envío y estados).
