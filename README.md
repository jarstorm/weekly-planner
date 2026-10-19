# WeeklyFeedback

"El resumen semanal que se escribe solo" — SaaS de resúmenes de progreso semanal para equipos, por WhatsApp o email. Ver `docs/mvp-resumen-semanal-equipos.md` para el spec de producto completo y `docs/especificaciones-tecnicas.md` para la arquitectura y el roadmap.

## Estructura

```
api/       backend NestJS (TypeScript)
web/       frontend Next.js (TypeScript)
supabase/  schema.sql — esquema de base de datos
docs/      spec de producto, especificaciones técnicas, economía del proyecto
```

## Arrancar en local

Requiere Node 20+.

### 1. Backend (`api/`)

```bash
cd api
npm install
cp .env.example .env   # completar con tus credenciales (ver docs/especificaciones-tecnicas.md, sección 1)
npm run start:dev
```

Sin `.env` completado, igual arranca: `GET /health` responde `{ ok: true, supabaseConfigured: false }`. Cada servicio (Supabase, Resend, WhatsApp, Anthropic) falla solo cuando se lo llama, no al arrancar.

### 2. Frontend (`web/`)

```bash
cd web
npm install
cp .env.local.example .env.local
npm run dev
```

Por defecto apunta a `http://localhost:3001/api` — el backend tiene que estar corriendo.

## Tests

```bash
cd api
npm test
```

Cubre lógica que no depende de servicios externos: cálculo de horarios/timezone (`src/jobs/date.utils.spec.ts`), el prompt de agregación con IA (`src/aggregate/aggregate.service.spec.ts`), los límites de plan (`src/teams/teams.service.spec.ts`), cambio de plan y borrado de equipos al bajar (`src/billing/billing.service.spec.ts`), retención del histórico (`src/jobs/retention.job.spec.ts`) y concatenación de mensajes entrantes (`src/checkins/checkins.service.spec.ts`).

```bash
cd web
npm test
```

Con Vitest + Testing Library: utilidades de fecha y estado de respuesta (`src/components/ResponseStatus.spec.tsx`) y el cliente de API (`src/lib/api.spec.ts`). Cobertura parcial — la mayoría de páginas todavía no tiene tests propios.

```bash
cd e2e
npm test
```

Test e2e completo con Playwright (`e2e/tests/full-flow.spec.ts`): registro, Stripe en modo test, equipos, check-ins, informes con Claude y encuesta anónima, de punta a punta. Usa la Supabase de `api/.env` y limpia lo que crea. Ver `e2e/README.md` antes de lanzarlo.

## CI

`.github/workflows/ci.yml` corre en cada push/PR a `main`: type-check + tests del backend, build del frontend.

## Qué falta

Ver la sección "Hoja de ruta" de `docs/especificaciones-tecnicas.md` para el estado real paso a paso. En resumen: los pasos 1-16 (incluidos el resumen ejecutivo y la encuesta mensual anónima) están verificados de punta a punta contra servicios reales (Supabase, Resend, Anthropic/Claude, Telegram, WhatsApp, Stripe). Ya no queda ningún canal ni cuenta externa pendiente: Anthropic migrado (2026-09-28, sustituyó a Groq para el texto de los informes — Groq se queda solo para transcripción de audio), dominio propio verificado en Resend (2026-09-29), y WhatsApp Business desbloqueado en producción (2026-10-02: empresa verificada, plantilla de recordatorio aprobada, método de pago añadido). El webhook real de Stripe y el registro fiscal de Stripe Tax también están completados (2026-09-28).
