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

Cubre lógica que no depende de servicios externos: cálculo de horarios/timezone (`src/jobs/date.utils.spec.ts`), el prompt de agregación con IA (`src/aggregate/aggregate.service.spec.ts`), y los límites de plan (`src/teams/teams.service.spec.ts`). El frontend no tiene tests todavía.

## CI

`.github/workflows/ci.yml` corre en cada push/PR a `main`: type-check + tests del backend, build del frontend.

## Qué falta

Ver la sección "Hoja de ruta" de `docs/especificaciones-tecnicas.md` para el estado real paso a paso. En resumen: los pasos 1-15 (incluido el resumen ejecutivo) están verificados de punta a punta contra servicios reales (Supabase, Resend, Groq, Telegram, Stripe). Queda pendiente solo lo que depende de cuentas que todavía no existen o no están del todo activas: la cuenta de Anthropic (se usa Groq de sustituto), la verificación de WhatsApp Business en Meta (paso 12, código ya reconstruido), verificar un dominio propio en Resend (la cuenta está en modo sandbox, solo entrega al email del titular — checklist en la sección 6), y completar el registro fiscal de Stripe Tax para que el IVA automático cobre de verdad.
