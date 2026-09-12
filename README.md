# Beacon Backend

API de [Beacon](https://github.com/gbaldessari/Beacon-App): autenticación, recordatorios, finanzas compartidas, notas, notificaciones y eventos en tiempo real.

Cliente web: [Beacon-Frontend-Web](https://github.com/gbaldessari/Beacon-Frontend-Web).

## Stack

- NestJS 11 + TypeScript
- PostgreSQL 16 y TypeORM
- JWT (access token) + cookie de refresh
- Socket.IO (`/realtime`)
- Resend (correo) y Web Push (VAPID)
- Docker (imagen de la API y Compose solo para Postgres)

## Módulos

| Módulo | Ruta | Responsabilidad |
| --- | --- | --- |
| Auth | `/auth` | Registro, login, refresh, perfil, roles y recuperación de contraseña |
| Calendarios | `/calendars` | Calendarios compartidos, miembros e invitaciones |
| Recordatorios | `/reminders` | Tareas, recurrencia, ocurrencias y completar eventos |
| Finanzas | `/finance` | Espacios, movimientos, presupuestos, metas, categorías y etiquetas |
| Notas | `/notes` | Notas, listas de chequeo, etiquetas, archivo y pines |
| Notificaciones | `/notifications` | Inbox in-app y suscripción Web Push |
| Tiempo real | namespace `/realtime` | Sincronización de calendarios, finanzas y avisos |

La API valida DTOs con `class-validator`, restringe CORS al origen de `FRONTEND_URL` y envía cookies de refresh con credenciales.

## Requisitos

- Node.js 20+
- Docker (recomendado para PostgreSQL)
- Cuentas opcionales: [Resend](https://resend.com) para correo y claves VAPID para push (`npx web-push generate-vapid-keys`)

## Configuración

```bash
copy .env.example .env
npm install
```

En macOS/Linux usa `cp .env.example .env`. Completa al menos:

- `JWT_SECRET` (mínimo 64 caracteres)
- `DB_*` (host, puerto, usuario, contraseña y nombre)
- `FRONTEND_URL` (origen exacto del cliente, p. ej. `http://localhost:5173`)
- `ADMIN_INITIAL_*` (usuario administrador creado por la migración inicial)

El resto de claves está documentado en [`.env.example`](./.env.example).

## Base de datos

Postgres local en el puerto **5433** (mapeado desde 5432 del contenedor):

```bash
npm run db:up      # levanta Postgres
npm run db:logs    # logs
npm run db:down    # detiene el contenedor
```

Con `DB_SYNC=true` TypeORM ajusta el schema en desarrollo. Las migraciones en `src/migrations` se ejecutan al arrancar (`migrationsRun: true`). En producción deja `DB_SYNC=false`.

## Scripts

```bash
npm run start:dev   # API con recarga (puerto 3000)
npm run build
npm run start:prod
npm run lint
npm test
npm run test:e2e
```

## Docker

Imagen de la API:

```bash
docker build -t beacon-backend .
```

Para levantar frontend + API + Postgres juntos, usa el Compose del monorepo [Beacon-App](https://github.com/gbaldessari/Beacon-App).

## Despliegue

Pensado para Railway (u otro host Node) con un plugin de PostgreSQL:

- `PORT` lo inyecta la plataforma
- `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` del plugin
- `FRONTEND_URL` = origen HTTPS del frontend (Vercel)
- `REFRESH_COOKIE_SECURE=true` y `DB_SYNC=false` en producción

## Licencia

[MIT](./LICENSE) © 2026 Giacomo Baldessari
