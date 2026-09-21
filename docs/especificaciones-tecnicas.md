# WeeklyFeedback — Especificaciones técnicas y hoja de ruta

Este documento es el complemento técnico de `docs/mvp-resumen-semanal-equipos.md` (el spec de producto). Aquí está todo lo que hace falta reunir antes de escribir código, la estructura del proyecto, y el orden en que se va a construir cada funcionalidad — una detrás de otra, cada una probada antes de pasar a la siguiente.

---

## 0. Decisión de arquitectura: no usar n8n

Se evaluó n8n (u otra herramienta no-code tipo Make/Zapier) como orquestador del ciclo semanal, y se descartó:

- **La planificación por cliente ya es autoservicio sin necesidad de n8n**: cada `team` guarda su propio `dia_hora_recordatorio` en la base de datos (ver sección 9 de `docs/mvp-resumen-semanal-equipos.md`). No hace falta que el cliente entre a un editor de workflows — lo configura desde el panel web, como cualquier otro campo de su equipo.
- **Un único cron genérico basta**: el job de la sección 4.8 (cada 15 min) recorre la tabla `teams`, filtra los que tocan según su horario, y ejecuta la misma lógica para todos. Esto escala a cientos de equipos sin crear un flujo por cliente — que es justo el problema que n8n hubiera resuelto peor (habría que generar/clonar workflows por cliente vía su API, o exponerles el editor directamente, con el riesgo de seguridad y la mala UX que eso implica para un usuario no técnico).
- **No hay múltiples fuentes externas que agregar**: a diferencia de un caso con Slack + Jira + GitHub + forms, acá la única entrada es la respuesta del propio check-in (WhatsApp/Slack/email) — no hay conectores de terceros que justifiquen una herramienta de integración visual.
- **Coste y control**: n8n self-hosted es gratis pero suma una pieza de infraestructura más a mantener (otro contenedor, otro punto de fallo) sin aportar nada que el backend Node + Supabase (`pg_cron`/Edge Functions) no resuelva ya de forma más simple y barata.

**Excepción — prototipo desechable:** se permite usar n8n como banco de pruebas manual, solo en la Fase 0 (ver sección 4), para validar rápido que el envío/recepción por WhatsApp y email funciona de verdad (credenciales, plantillas aprobadas, formato de payload) antes de escribir el backend. No almacena datos de clientes reales ni queda corriendo en producción — cuando el flujo está validado, se apaga y la lógica se reimplementa en `services/channels/` (sección 3.1). Lo que se "porta" de n8n al backend no es el workflow en sí (no hay forma de convertir un workflow n8n en código Node automáticamente), sino lo que se aprendió montándolo: qué payload exacto espera la API de WhatsApp/Meta, qué plantilla de mensaje usar, cómo responde el webhook — eso se documenta en `docs/notas-flujo-mensajeria.md` mientras se prueba, y ese documento es lo que guía el `email.js`/`whatsapp.js` reales.
- **El canal por empleado también resuelve sin n8n**: `members.channel` (`supabase/schema.sql`) es un campo por persona, no por equipo — cada miembro elige `email` o `whatsapp` al darlo de alta, independiente del canal de entrega del equipo (`teams.delivery_channel`, que es solo para el informe final al responsable). Mismo canal sirve para enviar la pregunta semanal y recibir la respuesta (es una conversación, no un formulario aparte). El worker del cron simplemente lee `channel` por miembro y llama a `email.js` o `whatsapp.js` — no hace falta lógica especial ni n8n para esto. Slack no está en el `check` del enum todavía porque está fuera del MVP (ver roadmap, sección 15 de `docs/mvp-resumen-semanal-equipos.md`); se añade cuando se implemente esa integración.

### 0.1 Decisión: el frontend no habla directo con Supabase

El patrón estándar de Supabase (cliente en el navegador con la `anon key`, protegido por RLS) se descartó a favor de que **todo** — auth incluida — pase por el backend NestJS:

- **Frontend no tiene ninguna dependencia de `@supabase/supabase-js` ni conoce `SUPABASE_URL`.** Solo conoce `NEXT_PUBLIC_API_BASE_URL`. Toda la superficie de Supabase queda encapsulada en `api/`.
- **Auth también pasa por el backend.** `POST /api/auth/register` y `POST /api/auth/login` usan Supabase Auth internamente (`SupabaseModule`, ver más abajo) y devuelven una cookie `httpOnly` propia (`wf_session`) con el access token — el navegador nunca ve ni maneja el token directamente, solo lo manda automáticamente en cada request. `GET /api/auth/me` resuelve la sesión.
- **La autorización se hace en el backend, no en RLS.** Como el backend siempre consulta con la `service_role` key (que bypasea RLS), cada servicio (`TeamsService`, `CheckinsService`) filtra manualmente por `organization_id` del usuario autenticado (`AuthGuard` + `@CurrentUser()`) antes de leer o escribir. Las políticas RLS de `schema.sql` quedan como defensa en profundidad (por si algo llega a consultar Supabase directo en el futuro, p. ej. una Edge Function), pero no son el mecanismo de autorización real hoy.
- **Por qué:** un solo punto de entrada (la API) simplifica el contrato con el frontend, evita duplicar lógica de autorización en dos sitios (RLS + backend), y deja abierta la puerta a cambiar de proveedor de datos/auth sin tocar el frontend.

Dos clientes de Supabase conviven en `SupabaseService` (`api/src/supabase/supabase.service.ts`): `db` (con `service_role`, para todas las tablas) y `authClient` (con `anon key`, solo para las llamadas de Auth — `signUp`/`signInWithPassword`/`getUser`, que es el uso previsto de esa key).

### 0.2 Sustituciones temporales de MVP: Telegram en vez de WhatsApp, Groq en vez de Claude

El producto sigue apuntando a **WhatsApp + Claude** (ver `docs/mvp-resumen-semanal-equipos.md`, secciones 3-5 y 10) — eso no cambia. Pero verificar una empresa en Meta Business Manager tarda días y la cuenta de Anthropic todavía no está disponible, así que mientras tanto el MVP se desarrolla y prueba con dos sustitutos gratuitos y sin fricción de alta:

- **Telegram en vez de WhatsApp.** `TelegramChannel` (`api/src/channels/telegram.channel.ts`) implementa la misma interfaz `Channel` que `WhatsappChannel` — se registra igual en `ChannelsService`, tiene su propio webhook (`POST /api/webhooks/telegram`, sin el paso de verificación `hub.challenge` de Meta; el alta del webhook se hace una vez llamando a `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<url pública>`). Se crea el bot hablando con **@BotFather** en Telegram — sin cuenta de empresa, sin plantillas aprobadas, token al instante. Diferencia a tener en cuenta: `contact` para Telegram es el `chat_id` numérico, no un teléfono, y solo se consigue después de que esa persona le escriba `/start` al bot (Telegram no permite que el bot inicie la conversación, al revés que WhatsApp). Quitar Telegram cuando WhatsApp esté verificado es borrar `telegram.channel.ts`, sacarlo del registry y del `check` de `schema.sql` — nada en `jobs/` cambia, es exactamente el escenario para el que se diseñó la interfaz `Channel` (sección 3.1).
- **Groq en vez de la API de Claude.** `AggregateService.generateReport()` llama a `https://api.groq.com/openai/v1/chat/completions` (formato compatible con OpenAI) en vez de `api.anthropic.com`. Cuenta gratis en console.groq.com, sin tarjeta. El prompt (`buildPrompt()`, literal de la sección 10 del doc de producto) no cambia nada — solo cambia a qué URL/formato se manda. Modelo usado: `openai/gpt-oss-120b` (revisar `GROQ_MODEL` si Groq cambia su catálogo — ya pasó una vez durante el desarrollo, los modelos de este proveedor rotan). Volver a Claude cuando la cuenta de Anthropic esté lista es cambiar el bloque de `fetch` de este único método, nada más se entera.

Ninguna de las dos sustituciones toca `jobs/`, `teams/`, `checkins/` ni el resto del dominio — quedaron aisladas exactamente donde ya estaban pensadas para aislarse.

---

## 1. Qué hace falta crear antes de tocar código

| Cuenta / servicio | Para qué | Coste al arrancar |
|---|---|---|
| **Supabase** (supabase.com) | Base de datos, autenticación de usuarios, cron interno | Gratis (plan Free) |
| **Cuenta de Anthropic / API key** (console.anthropic.com) | Generar el informe semanal con IA — canal definitivo | Pago por uso, céntimos al mes a esta escala |
| ~~**Groq** (console.groq.com)~~ | *Temporal* mientras no hay cuenta de Anthropic (ver 0.2) | Gratis |
| **Resend** (resend.com) | Enviar los recordatorios e informes por email | Gratis hasta 3.000 emails/mes |
| **Meta Business Manager** + número de WhatsApp | Canal WhatsApp (recordatorio + informe) — canal definitivo | Gratis la cuenta; los mensajes cuestan céntimos por envío |
| ~~**Bot de Telegram** (@BotFather)~~ | *Temporal* mientras no está verificado WhatsApp Business (ver 0.2) | Gratis, alta instantánea |
| **Stripe** | Cobrar la suscripción mensual | Gratis, solo comisión por cobro (~1,5% + 0,25€) |
| **Dominio propio** | Credibilidad, email desde tu propio dominio | ~1€/mes |
| **Vercel o Netlify** (para el frontend) | Hosting del panel web | Gratis en esta fase |

**Verificación de WhatsApp Business:** esto es lo que más tarda (puede llevar varios días), así que conviene iniciarlo pronto aunque el desarrollo use Telegram/email mientras tanto. Hace falta: una empresa verificable en Meta Business Manager, un número de teléfono que no esté ya en un WhatsApp personal, y — para mandar el recordatorio (mensaje que abre la conversación) — una plantilla de mensaje aprobada por Meta.

---

## 2. Variables de entorno

### `api/.env`
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=       # todas las tablas — bypasea RLS, la autorización la hace el backend (ver 0.1)
SUPABASE_ANON_KEY=               # solo para las llamadas de Auth (signUp/signInWithPassword/getUser)
GROQ_API_KEY=                    # temporal en vez de Anthropic (ver sección 0.2) — console.groq.com
GROQ_MODEL=                      # openai/gpt-oss-120b — Groq rota su catálogo, revisar si da 404 model_not_found
RESEND_API_KEY=
RESEND_FROM=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=
TELEGRAM_BOT_TOKEN=              # temporal en vez de WhatsApp (ver sección 0.2) — @BotFather en Telegram
STRIPE_SECRET_KEY=
PORT=3001
APP_BASE_URL=                    # URL pública del frontend (Next.js) — CORS y links en emails
```

### `web/.env.local`
```
NEXT_PUBLIC_API_BASE_URL=
```

El frontend no tiene ninguna variable de Supabase — solo conoce la URL del backend (ver sección 0.1). Las dos keys de Supabase (`service_role` y `anon`) viven únicamente en `api/.env` y nunca llegan al navegador.

---

## 3. Estructura del proyecto

```
weekly-feedback/
  docs/
    mvp-resumen-semanal-equipos.md     # spec de producto (ya existe)
    especificaciones-tecnicas.md       # este documento
  supabase/
    schema.sql                         # ya creado — tablas organizations, teams, members, checkins, reports
  api/                                  # backend Node.js/TypeScript (NestJS)
    src/
      config/            → ConfigModule, variables de entorno centralizadas
      supabase/          → SupabaseModule/Service (cliente service_role + cliente anon para auth, ver 0.1)
      auth/              → AuthModule: register/login/logout/me, AuthGuard, cookie httpOnly wf_session
      channels/          → interfaz común + un provider por canal (email.channel.ts, whatsapp.channel.ts, telegram.channel.ts [temporal, ver 0.2], [futuro] slack.channel.ts) + ChannelsService (dispatcher)
      teams/             → TeamsModule (equipos y miembros, protegido por AuthGuard): controller + service
      checkins/          → CheckinsModule: controller + service
      reports/           → ReportsModule: histórico de informes (GET /api/reports?teamId=)
      aggregate/         → AggregateModule/Service (llamada a la IA — Groq temporal, ver 0.2)
      jobs/              → ReminderJob, ReportJob (@nestjs/schedule, Cron)
      webhooks/          → WhatsappWebhookController, TelegramWebhookController (entrada de mensajes)
      app.module.ts, main.ts
  web/                                  # frontend Next.js/TypeScript
    src/
      app/               → login/, register/, onboarding/, page.tsx (dashboard) — App Router
      lib/api.ts         → cliente HTTP al backend (fetch con credentials: 'include', nunca supabase-js — ver sección 0.1)
```

El esquema de base de datos (`supabase/schema.sql`) ya está escrito: tablas `organizations` (la cuenta que paga, con su plan — equipo/organización/custom — y sus límites), `teams`, `members`, `checkins`, `reports`, con seguridad por fila (RLS) para que cada responsable solo vea sus propios equipos y, si tiene el resumen ejecutivo activado, el consolidado de su organización (ver `docs/mvp-resumen-semanal-equipos.md`, sección 6.4 y 11).

### 3.1 Conectores de canal — preparado para añadir Slack sin tocar el resto

Slack queda fuera del MVP, pero `email` y `whatsapp` se construyen desde el día uno detrás de la misma interfaz, para que añadir un canal nuevo más adelante sea solo sumar un archivo, no tocar `jobs/` ni la lógica de negocio:

```ts
// channels/channel.interface.ts — cada provider implementa el mismo contrato
interface Channel {
  send(contact: string, message: string): Promise<void>;       // manda el recordatorio o el informe
  parseIncoming(payload: unknown): { contact: string; rawText: string }; // normaliza la respuesta entrante
}
```

`ReminderJob` y `ReportJob` no conocen el canal — llaman a `channelsService.get(member.channel).send(...)`, elegido por el `channel` de cada `member` (o `delivery_channel` del `team`/`organization` para el informe). `ChannelsService` es el dispatcher, con un mapa `{ email, whatsapp }` inyectado por DI — añadir Slack cuando toque es: crear `channels/slack.channel.ts` implementando `Channel`, registrarlo como provider en `ChannelsModule`, sumar `'slack'` al `check` de `channel` en `schema.sql`, y un endpoint en `WebhooksController`. Nada en `jobs/` cambia.

Esto es intencional, no sobre-ingeniería: la interfaz ya la fuerza tener dos canales reales (email y whatsapp) desde el MVP — no es una abstracción especulativa para un caso hipotético, es la misma forma que ya toman los dos canales que sí se construyen ahora.

---

## 4. Hoja de ruta — una funcionalidad detrás de otra

Cada punto se construye, se prueba, y solo entonces se pasa al siguiente. Los primeros puntos no necesitan frontend ni WhatsApp — se prueban con `curl` o Postman contra el backend.

**Estado actual:** pasos 1 a 4 y 6 (base de datos, backend, auth, equipos/miembros, checkin manual), 9 (frontend: registro/login/onboarding) y 11 (histórico de informes) **verificados de punta a punta contra el Supabase real del proyecto** — `schema.sql` corrido, backend probado con `curl` y el frontend probado de verdad en navegador (registro → alta de equipo → alta de miembro → dashboard → logout → login, ciclo completo). Al probar salió un bug real (usuario de Supabase Auth huérfano si fallaba el insert de `organizations` durante el registro — ya arreglado, `AuthService.register` compensa borrando el usuario si el segundo paso falla). Pasos 5 (email, con Resend), 7 (IA, con Groq — sustituto temporal de Anthropic, sección 0.2) y 12-envío (con Telegram como sustituto de WhatsApp — `TelegramChannel.send()` mandó un mensaje real a un chat real, confirmado recibido) también verificados con servicios reales. Falta probar: paso 8 (entrega del informe generado por IA, encadenada con el 5 — cada mitad ya funciona sola), el cron automático de punta a punta (`ReminderJob`/`ReportJob` corriendo solos, sin disparar nada a mano) y la recepción de respuesta por Telegram/WhatsApp (el webhook, `POST /api/webhooks/telegram`, todavía sin probar con un payload real). El paso 0 (n8n) sigue sin empezar, ya no hace falta para validar mensajería porque los pasos 5/7/12 se están probando directo contra los servicios reales.

0. **Prototipo de mensajería en n8n (desechable)** — montar a mano, sin base de datos ni backend todavía, un workflow n8n que: mande un mensaje de WhatsApp (o email) de prueba, reciba la respuesta por webhook, y la deje ver en un nodo. Objetivo único: validar credenciales (Meta/WhatsApp Cloud API o Resend), formato del payload y, si es WhatsApp, que la plantilla de mensaje está aprobada — antes de escribir una sola línea del backend real. *Hecho cuando:* llega un mensaje de prueba real y su respuesta se recibe en n8n. En ese momento se anota en `docs/notas-flujo-mensajeria.md` lo aprendido (payloads, IDs de plantilla, headers) y se apaga n8n — no pasa a producción (ver sección 0 de este documento).

1. **Base de datos** — ejecutar `supabase/schema.sql` en un proyecto de Supabase real. *Hecho cuando:* las 4 tablas existen y se puede insertar un equipo de prueba a mano desde el panel de Supabase.

2. **Backend base** — proyecto NestJS con endpoint `/health` y `SupabaseService` conectado. *Hecho cuando:* `GET /health` responde `{ ok: true }` y el backend puede leer/escribir en Supabase.

3. **Auth** — `POST /api/auth/register` (crea el usuario en Supabase Auth + su `organization`), `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, con la cookie `httpOnly wf_session` (ver sección 0.1). *Hecho cuando:* se puede registrar un usuario de prueba por API, hacer login, y `GET /api/auth/me` devuelve sus datos usando la cookie — sin cookie, da 401.

4. **Alta de equipo y miembros** — endpoints `POST /api/teams` y `POST /api/teams/:id/members`, protegidos por `AuthGuard` (el `organization_id` sale de la sesión, no lo manda el cliente). *Hecho cuando:* con la cookie de un usuario logueado se puede crear un equipo de prueba con 2-3 miembros por API, sin frontend todavía.

5. **Envío de recordatorio por email** — `EmailChannel` + un disparo manual (sin cron aún) que manda el recordatorio a los miembros de un equipo. *Hecho cuando:* llega el email de verdad a una bandeja de entrada real.

6. **Recepción de respuesta (fallback manual)** — endpoint `POST /api/checkins/manual` que guarda un check-in en la tabla `checkins`. *Hecho cuando:* se puede simular la respuesta de 2-3 personas y quedan guardadas correctamente, asociadas a la semana correcta.

7. **Generación del informe con IA** — `AggregateService`, probado con los check-ins guardados en el paso anterior. *Hecho cuando:* el informe generado tiene sentido, agrupa bien, y detecta si alguien no respondió.

8. **Entrega del informe por email** — entrega vía `EmailChannel`. *Hecho cuando:* el informe llega por email con buen formato.

9. **Cron automático** — job que cada 15 minutos revisa si algún equipo tiene que recibir recordatorio o informe según su horario configurado. *Hecho cuando:* el ciclo completo (recordatorio → respuesta manual → informe) ocurre solo, sin disparar nada a mano.

10. **Frontend: registro/login + alta de equipo (onboarding)** — formularios Next.js que llaman a los endpoints de los puntos 3 y 4. *Hecho cuando:* se puede registrar, entrar, y dar de alta un equipo entero desde el navegador, sin tocar la base de datos a mano.

11. **Frontend: histórico de informes** — panel que lista los informes generados por semana. *Hecho cuando:* el responsable del equipo puede entrar, ver el informe de esta semana y los anteriores.

12. **Canal WhatsApp** — verificación en Meta, plantilla de recordatorio aprobada, webhook de entrada/salida. Se añade cuando el flujo por email ya funciona de punta a punta y hay al menos un cliente piloto pidiéndolo. *Hecho cuando:* un número de prueba recibe el recordatorio y su respuesta se guarda igual que en el flujo de email.

13. **Cobro con Stripe** — se añade cuando haya clientes reales dispuestos a pagar, no antes. *Hecho cuando:* un cliente de prueba puede suscribirse y su `organizations.status` pasa de `trial` a `active`.

14. **Límites de plan (Equipo / Organización / Custom)** — validar en la capa de aplicación, al crear un equipo o un miembro, que no se superen `max_teams` y `max_members_per_team` de la organización (en Plan Custom ambos son `NULL`, sin límite). *Hecho cuando:* una organización en Plan Equipo no puede crear un segundo equipo, y una en Plan Organización no puede crear un 6º equipo ni un 21º miembro en uno existente.

15. **Resumen ejecutivo (varios equipos + informe consolidado)** — solo se construye cuando aparezca el primer lead real con varios equipos, no antes: alta de `organizations` en Plan Organización o Custom, vincular sus equipos, un interruptor para activar/desactivar `has_executive_summary` (es una opción, no algo automático por plan — ver sección 6.4 del documento de producto), y el job que genera el informe consolidado a partir de los informes de equipo ya generados esa semana, solo si la opción está activada. *Hecho cuando:* una organización de prueba con 2-3 equipos y el resumen ejecutivo activado genera su informe de equipo individual Y su resumen ejecutivo, cada uno al destinatario correcto — y una organización con la opción desactivada no genera el consolidado.

---

## 5. Qué NO se construye todavía

Para no perder tiempo antes de validar lo esencial: sin integraciones con GitHub/Jira/Trello, sin analítica de tendencias, sin multi-idioma. Los límites de plan (paso 13) se construyen con el MVP porque son baratos y evitan sorpresas, pero el resumen ejecutivo (paso 14) se deja para cuando haya demanda real de un cliente con varios equipos, no se construye especulativamente junto con el resto del MVP. Todo lo demás vive en el roadmap post-MVP del documento de producto.
