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

### 0.2 Canal: WhatsApp reinstalado, verificado en vivo con cuenta de prueba (producción pendiente), Groq en vez de Claude

**WhatsApp se sacó del MVP y se volvió a meter.** Se sacó por decisión explícita (no un retraso técnico): el MVP se lanzó con Telegram como único canal conversacional + email, `WhatsappChannel`/`WhatsappWebhookController` se borraron del código (migración `0003_remove_whatsapp_channel.sql`), y quedó documentado acá el diseño para retomarlo. Ese momento llegó: `channels/whatsapp.channel.ts` y `WhatsappWebhookController` (en `webhooks.controller.ts`) están reconstruidos byte a byte a partir de lo que había antes de borrarse (`git show ffecdab^:api/src/channels/whatsapp.channel.ts`), `'whatsapp'` está de vuelta en `ChannelName`, en los `check` de `delivery_channel`/`channel` (migración `0008_reinstate_whatsapp_channel.sql`) y en los `<select>` del frontend (`onboarding`, `feedback` (config de cuenta, sección 0.12), `members/new`, `members/[memberId]/edit`).

**Actualizado (2026-09-27) — probado de punta a punta contra una cuenta de prueba real**: envío (recordatorio real vía `WhatsappChannel.send`) y recepción (webhook → `matchMemberAndSaveCheckin` → `checkins` real en Supabase) verificados con un número de teléfono real y un número de prueba de Meta. Detalle completo de cómo se montó, los tropiezos reales y qué falta para producción, en la guía de abajo.

`WhatsappChannel` implementa la interfaz `Channel` igual que `TelegramChannel` — Cloud API de Meta, `send`/`sendDocument` con `fetch` a `graph.facebook.com`, documentos en dos pasos (subir a `/media` → mandar mensaje `type: "document"` referenciando el media id), audio con el mismo patrón (media id → URL temporal → descarga con el access token), webhook con verificación `hub.challenge` (`WHATSAPP_VERIFY_TOKEN`).

**Guía: cómo se configuró la cuenta de prueba (reproducible), y qué cambia para producción**

*Cuenta de prueba (lo que ya está hecho, sirve para desarrollo):*

1. App en developers.facebook.com, caso de uso "Conectar con los clientes a través de WhatsApp", colgada de un Business Portfolio propio. *Tropiezo real:* Meta bloquea crear un Business Portfolio con una cuenta de Facebook recién creada ("cuenta demasiado nueva") — hay que esperar ~1h desde que se crea la cuenta.
2. Casos de uso → WhatsApp → "Paso 1. Probar" da un número de prueba gratis + `Phone Number ID` + `WhatsApp Business Account ID`, sin esperar verificación de empresa. Sirve para mandar a hasta 5 números de destinatario (hay que añadirlos y verificarlos con un código que llega por WhatsApp).
3. **Tropiezo real, el importante:** el "Identificador de acceso" que genera el botón "Generar identificador" de ese mismo panel (token de usuario, 24h) funciona para los botones del propio panel de Meta, pero al llamarlo directamente desde fuera (`curl`, o el backend) devuelve `403 (#131005) Access denied` — pese a que `debug_token` lo muestra válido, con los scopes correctos (`whatsapp_business_messaging`, `whatsapp_business_management`) y sin caducar. No quedó claro por qué (posible restricción de origen/Referer no documentada). *No perder tiempo ahí* — ir directo al token de System User (paso 5).
4. Webhook: en "Paso 2. Configuración de producción" → "Configurar Webhooks", con la URL pública (túnel en local, ver abajo) + `WHATSAPP_VERIFY_TOKEN` propio. Al guardar, Meta auto-suscribe algunos campos genéricos (`account_alerts`, `calls`, `security`...) pero **no** suscribe la app a la WhatsApp Business Account — sin ese paso, nunca llegan webhooks de mensajes aunque la URL/token estén bien. Hay que suscribirla a mano:
   ```
   curl -X POST "https://graph.facebook.com/v21.0/<WABA_ID>/subscribed_apps" \
     -H "Authorization: Bearer <ACCESS_TOKEN>"
   ```
   Verificable con `GET` al mismo endpoint (debe listar la propia app, no solo apps internas de Meta).
5. **Token que sí funciona para llamadas directas:** Business Settings → Usuarios del sistema → crear uno (rol Employee alcanza) → "Asignar activos": la app (acceso total) + la WhatsApp Business Account (permiso "Mensajes", y "Números de teléfono — solo ver" si hace falta leer metadatos) → "Generar identificador" en el usuario del sistema, con los permisos `whatsapp_business_management` + `whatsapp_business_messaging`, caducidad "Nunca". Este token permanente es el que va en `WHATSAPP_ACCESS_TOKEN` — funcionó de inmediato para `send()` vía API directa, a diferencia del token del paso 3.
6. Túnel para exponer el backend local: `ngrok` puede pedir cuenta/authtoken y este entorno bloquea levantar túneles de ingreso externo sin confirmación explícita; `localtunnel` (`npx localtunnel --port 3001`) es gratis pero se cae solo con frecuencia. Lo que funcionó estable: `cloudflared tunnel --url http://localhost:3001` (`brew install cloudflared`), sin cuenta, URL `https://<random>.trycloudflare.com`.

*Qué cambia para producción (número real de empresa, no de prueba):*

- **Verificación de la empresa** (Paso 3 del panel) — documentos fiscales de la empresa en Meta Business Manager, puede tardar días.
- **Migrar el número real de WhatsApp Business a la Cloud API** (Paso 2 → "Registrar tu número de teléfono de WhatsApp") — ese número deja de poder usarse desde la app móvil de WhatsApp Business normal, todo pasa por la API/backend a partir de ahí.
- **Plantilla de mensaje de recordatorio aprobada por Meta** — el recordatorio semanal es un mensaje que abre conversación (business-initiated); sin plantilla aprobada, `WhatsappChannel.send()` (texto libre) solo funciona dentro de la ventana de 24h después de que la persona escriba primero, no para arrancar la conversación.
- **Añadir método de pago** (Paso 2 → "Añade un método de pago para enviar mensajes iniciados por la empresa") — pasado el tier gratis, cada conversación iniciada por la empresa tiene coste.
- **Repetir el `POST /subscribed_apps`** (paso 4 de arriba) para la WhatsApp Business Account real — es un gotcha por WABA, no algo que se herede de la cuenta de prueba.
- **Webhook apuntando a la URL pública real** de producción (Hetzner/Clouding, dominio propio) en vez del túnel — mismo mecanismo, solo cambia la URL.
- **Nuevo `WHATSAPP_VERIFY_TOKEN`** por entorno (no reusar el de desarrollo), y `WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ACCESS_TOKEN` del número y System User reales.

**Groq en vez de la API de Claude** (esto sí sigue siendo una sustitución temporal, no una decisión de alcance): `AggregateService.generateReport()` llama a `https://api.groq.com/openai/v1/chat/completions` (formato compatible con OpenAI) en vez de `api.anthropic.com`. Cuenta gratis en console.groq.com, sin tarjeta. El prompt (`buildPrompt()`, literal de la sección 10 del doc de producto) no cambia nada — solo cambia a qué URL/formato se manda. Modelo usado: `openai/gpt-oss-120b` (revisar `GROQ_MODEL` si Groq cambia su catálogo — ya pasó una vez durante el desarrollo, los modelos de este proveedor rotan). Volver a Claude cuando la cuenta de Anthropic esté lista es cambiar el bloque de `fetch` de este único método, nada más se entera.

**Guía de migración Groq → Anthropic, cuando la cuenta esté lista:**

- *Requisito no técnico:* cuenta en console.anthropic.com con método de pago y `ANTHROPIC_API_KEY` generada.
- *Env vars:* añadir `ANTHROPIC_API_KEY` y `ANTHROPIC_MODEL` (p. ej. `claude-sonnet-5`) a `.env`/`.env.example`; `GROQ_API_KEY`/`GROQ_MODEL` no se borran (siguen haciendo falta para el audio, ver abajo).
- *Único método a tocar:* `AggregateService.callGroq()` (`api/src/aggregate/aggregate.service.ts`). No es un cambio de URL nada más — el formato de Anthropic no es compatible con el de OpenAI que usa Groq:
  - Endpoint: `https://api.anthropic.com/v1/messages` en vez de `.../chat/completions`.
  - Headers: `x-api-key: <ANTHROPIC_API_KEY>` + `anthropic-version: 2023-06-01`, en vez de `Authorization: Bearer`.
  - Body: mismo `model`/`max_tokens`/`messages`, pero la respuesta viene en `content[0].text`, no en `choices[0].message.content` — hay que ajustar el `return json.choices?.[0]?.message?.content` final.
  - `buildPrompt()`/`buildExecutiveSummaryPrompt()` no cambian — siguen devolviendo el string de prompt tal cual, agnóstico del proveedor.
  - `generateReport()`/`generateExecutiveSummary()` no cambian — ya llaman a `callGroq()` por nombre de método, no por proveedor; renombrar es opcional, cosmético.
- *Lo que NO migra:* `AudioService` (`api/src/audio/audio.service.ts`) usa Groq Whisper (`https://api.groq.com/openai/v1/audio/transcriptions`) para transcribir notas de voz — Anthropic no tiene API de transcripción de audio. Esto se queda en Groq (o pasa a otro proveedor de Whisper) pase lo que pase con el punto anterior; `GROQ_API_KEY` sigue siendo obligatoria aunque el texto migre entero a Anthropic.
- *Verificación:* mismo criterio que cualquier cambio de proveedor de IA — generar un informe con datos reales y comprobar que el formato/tono sigue el de `buildPrompt()`, más confirmar que el límite de TPM de Anthropic (distinto al de Groq, ver bloque siguiente) no rompe `ReportJob` con varios equipos en la misma franja horaria.

**Límite de capacidad conocido, sin resolver todavía:** la cuenta gratis de Groq tiene un límite de 8000 tokens/minuto (TPM) por cuenta, compartido entre todos los clientes de WeeklyFeedback, no por cliente. Cada informe gasta ~1000-1500 tokens (prompt + respuesta), así que la cuenta aguanta ~5-6 informes por minuto antes de que Groq devuelva 429 — confirmado en vivo generando informes de ejemplo (5 llamadas seguidas ya dispararon el 429). `ReportJob.run()` (`api/src/jobs/report.job.ts`) recorre los equipos en un `for` secuencial sin backoff; el `try/catch` por equipo atrapa el 429, lo loguea y sigue — como el informe fallido no se marca en `reports`, se reintenta solo, pero en el siguiente tick del cron (15 min después), no en el mismo tick. Con pocos clientes no se nota; con muchos equipos compartiendo el mismo día/hora de corte (p. ej. "viernes 13:00"), los informes se van entregando en tandas de ~5-6 cada 15 min — sin pérdida de datos, solo con retraso acumulado. Arreglos posibles, ninguno implementado: subir a Groq Dev Tier (de pago, sin tocar código), migrar a la cuenta de Anthropic cuando esté lista (límites distintos), o meter backoff/retry dentro del propio tick del cron. Decisión explícita (2026-09-25): queda anotado, no se prioriza mientras el volumen de clientes sea bajo.

Ninguna de las dos cosas toca `jobs/`, `teams/`, `checkins/` ni el resto del dominio — quedaron aisladas exactamente donde ya estaban pensadas para aislarse.

### 0.3 Almacenamiento de ficheros: Supabase Storage

Cualquier fichero que el producto necesite guardar (notas de voz, adjuntos futuros, logo de organización, etc.) va a **Supabase Storage** — no S3, no disco local, no otro proveedor. Es la misma cuenta que ya se usa para DB y Auth, así que no suma una pieza de infraestructura nueva ni credenciales nuevas, y el control de acceso se puede resolver con políticas de bucket análogas a las RLS que ya existen para las tablas. Igual que con la DB (sección 0.1), el backend accede con la `service_role` key — el frontend nunca sube directo a Storage, pasa por la API.

### 0.7 Check-in por nota de voz (transcripción automática)

`docs/mvp-resumen-semanal-equipos.md` ya describía esto como parte del flujo (sección 6.2: "Contesta con un mensaje de voz o texto, lo que te sea más rápido"), inicialmente quedó en backlog fuera del MVP (sección 7) — se adelantó igual porque se pidió explícitamente durante el desarrollo, mismo patrón que el resto de los adelantos de esta lista.

- **Audio**: `TelegramChannel.parseIncoming()` detecta si el mensaje entrante es una nota de voz (`message.voice`) y baja el binario con `getFile` + descarga aparte. `Channel.parseIncoming` pasó a ser `async` por esto — antes era síncrono, ahora cualquier canal puede necesitar una llamada de red para resolver el mensaje entrante.
- **Storage**: `AudioService.store()` (`api/src/audio/audio.service.ts`) sube el audio al bucket privado `checkin-audio` de Supabase Storage (sección 0.3) — se guarda primero, así que si la transcripción falla después el audio original no se pierde. Se guarda el **path**, no una URL — el bucket es privado, nadie lo sirve directo.
- **Transcripción**: `AudioService.transcribe()` llama a `whisper-large-v3` de Groq — mismo proveedor que `AggregateService` (sección 0.2), sin alta nueva. Formato compatible con la API de transcripciones de OpenAI (multipart, `file` + `model`). Cuando se vuelva a Claude/Anthropic (que no transcribe audio), este servicio se queda igual, no depende de `AggregateService`.
- **Pipeline**: `webhooks.controller.ts` — si `parseIncoming` devuelve un `audio`, sube y transcribe antes de guardar el checkin; el texto transcrito entra a `checkins.raw_text` igual que un mensaje escrito, `AggregateService` no distingue el origen. `checkins.audio_paths` guarda la referencia a cada fichero.
- **Migración**: `checkins.audio_path` es una columna nueva — `supabase/migrations/0001_add_audio_path.sql`, aplicada sola al arrancar el backend (sección 0.8), no hizo falta pegar nada a mano.
- **Bucket**: `checkin-audio`, privado, creado una vez vía script con la `service_role` key (no hace falta tocar el dashboard de Supabase — `storage.createBucket()` del cliente ya alcanza).

**Actualizado — mensajes concatenados, no el último pisando al resto (pedido explícito, migración 0014).** Antes, cada mensaje entrante de Telegram/WhatsApp de la semana pisaba el `raw_text` anterior (`checkins.saveInternal`, upsert simple); si alguien mandaba dos mensajes o una nota de voz y luego un texto, solo sobrevivía el último. Ahora `webhooks.controller.ts` llama a `CheckinsService.appendIncoming` en vez de `saveInternal`: cada mensaje de texto (o transcripción) se concatena al `raw_text` existente con un separador (`\n\n`), y cada nota de voz se añade a `checkins.audio_paths` (antes `audio_path`, columna única) en vez de reemplazar la anterior — el nombre del fichero en Storage ahora lleva `Date.now()` para que dos notas de voz la misma semana no se pisen entre sí. El formulario web (`checkin-form`) y el endpoint manual de pruebas (`POST /checkins/manual`) siguen usando `saveInternal` sin cambios — son un envío único, no una conversación. *Límite conocido:* lectura-modificación-escritura, no atómico a nivel de base de datos — dos mensajes casi simultáneos del mismo miembro podrían perder uno en una condición de carrera, improbable en el uso real. *Verificado en vivo:* dos mensajes de texto seguidos por Telegram a un chat real quedaron concatenados en `raw_text` con el separador, confirmado consultando `GET /checkins/status` contra Supabase real.

### 0.5 El informe se entrega como PDF adjunto, en los tres canales

Decisión explícita (pedida durante el desarrollo, no estaba en el spec original): el informe semanal no se manda como texto plano en el chat — se genera un PDF y se manda como documento adjunto, en email, WhatsApp y Telegram por igual.

- `PdfService` (`api/src/pdf/pdf.service.ts`) convierte el markdown de `AggregateService` a PDF con `pdfkit` + `marked` — **sin Puppeteer/Chromium**: pdfkit dibuja el PDF directamente con sus fuentes estándar (Helvetica), nada de renderizar HTML en un navegador headless. Evaluado y descartado un microservicio aparte para esto (mismo argumento que la sección 0 — es JS puro, milisegundos, sin necesidad de escalar por separado).
- Todo PDF lleva un pie de página fijo: *"Generado por la IA de WeeklyFeedback a partir de la información de los empleados."* — transparencia sobre el origen del contenido, pedido explícitamente.
- `Channel` (sección 3.1) ganó un segundo método, `sendDocument(contact, file, filename, caption)`, junto al `send(contact, message)` que ya existía para el recordatorio (ese sigue siendo texto plano, no cambia). Implementado en los tres canales (WhatsApp pendiente de credenciales reales, sección 0.2):
  - **Email**: adjunto en base64 en el payload de Resend (`attachments`).
  - **Telegram**: `sendDocument` del Bot API, `multipart/form-data` con `FormData`/`Blob` (nativos de Node, sin librería extra).
  - **WhatsApp**: subida en dos pasos a la Cloud API de Meta (`/media` → mensaje `type: "document"` referenciando el media id), sin probar todavía contra una cuenta real (sección 0.2).

Verificado con servicios reales y con un chat real (no solo credenciales de sandbox): `EmailChannel.sendDocument` (PDF adjunto recibido por email) y `TelegramChannel.sendDocument` (PDF recibido como documento en el chat de Telegram, confirmado visualmente por el usuario).

### 0.6 Detección de bloqueos recurrentes: alimenta el prompt con los últimos informes

`AggregateService.buildPrompt` ya tenía un hueco para "bloqueos de semanas anteriores" (sección 10 del doc de producto) pero `ReportJob` lo mandaba vacío (`// TODO`). Implementado: antes de generar el informe de la semana, `ReportJob.fetchPastBlockers` trae los últimos 3 informes del mismo equipo (`reports`, ordenado por `week_start` descendente) y extrae la sección "Bloqueos" de cada uno (`api/src/jobs/blockers.utils.ts`, regex sobre el markdown — el formato es el que el propio prompt le exige a la IA, así que es fiable) descartando las semanas sin bloqueo real (filtro simple sobre frases tipo "no se reportaron"/"sin bloqueos"). Esa lista se pasa al prompt de la semana actual, y es la propia IA la que decide si algo es recurrente y lo señala en el informe.

Importante: esto **no** es lo mismo que la "detección simple de bloqueos recurrentes" del panel web descrita en `docs/mvp-resumen-semanal-equipos.md`, sección 6.2 (resaltar en el histórico si la misma palabra clave aparece 2+ semanas seguidas) — esa es una feature de UI, separada, todavía sin construir. Tampoco se popula la columna `reports.blockers_detected` (sigue en su default `[]`) — se re-parsea el markdown de los informes pasados en cada corrida en vez de guardar un campo estructurado aparte; se puede revisar si en algún momento resulta un cuello de botella (no debería, son 3 filas por equipo y semana).

### 0.8 Migraciones de esquema automáticas al levantar el backend

Cada cambio de esquema (agregar `telegram` a un `check`, la columna `audio_path` de la sección 0.7) requería antes pedirle al usuario que pegara SQL a mano en el SQL Editor de Supabase — pasó más de una vez durante el desarrollo. Automatizado con `MigrationRunnerService` (`api/src/supabase/migration-runner.service.ts`):

- Archivos `.sql` numerados en `supabase/migrations/` (p. ej. `0001_add_audio_path.sql`), cada uno con una sola responsabilidad, escritos de forma idempotente (`if not exists` / `if exists`) para poder reintentarse sin romper nada.
- Al arrancar (`OnModuleInit`), se conecta directo a Postgres con `DATABASE_URL` (el connection string real, **no** la `service_role` key de la API REST — esa no da SQL crudo/DDL), revisa una tabla `_migrations` (nombre + fecha aplicada) y corre las que falten, en orden, cada una en su propia transacción.
- `DATABASE_URL` es la **única** pieza del backend que usa una conexión directa a Postgres — todo lo demás sigue por `SupabaseService` (REST + `service_role`, sección 0.1). Por eso vive en su propio servicio, no en `SupabaseService`.
- Si falla (DB inalcanzable, credencial mala, lo que sea), **no tumba el backend** — solo loguea el error y la app sigue levantando; mismo criterio que `SupabaseService`, que avisa en vez de tirar si falta configuración. Se encontró este bug real probando: al principio un fallo acá crasheaba el proceso entero.
- **Nota de red**: el host de conexión directa de Supabase (`db.<ref>.supabase.co`) es IPv6-only en proyectos nuevos — en un entorno sin salida IPv6 (pasó durante el desarrollo) da `ENOTFOUND` aunque el DNS resuelva bien. Ahí hace falta el connection string del **pooler** (Supavisor, `Settings → Database → Connection pooling`), que sí tiene IPv4.

Para agregar un cambio de esquema nuevo: un archivo más en `supabase/migrations/`, numerado después del último. No hace falta tocar `schema.sql` (que queda como referencia de "esquema completo desde cero" para altas nuevas) ni pedirle nada al usuario — la próxima vez que arranque el backend, se aplica solo.

### 0.9 PDF del informe con diseño corporativo (logo, colores de marca)

El PDF que genera `PdfService` (sección 0.5) tenía formato genérico — sin logo, sin colores de marca, títulos de sección detectados mal para el markdown real de la IA. Rediseñado para que se vea como parte del mismo producto que la web:

- **Logo vectorial redibujado con pdfkit**, no una imagen rasterizada: `drawLogo` usa el mismo `path` SVG que `web/src/components/BrandMark.tsx` y `web/src/app/icon.svg` (burbuja + check), con `doc.linearGradient()` + `translate()/scale()` — los tres quedan sincronizados copiando el mismo path si el logo cambia algún día. A 22px de alto se veía en blanco (detalle perdido al escalar, no un bug de renderizado); a 30px se ve bien.
- **Paleta de marca** (mismos valores que `globals.css`) en vez de negro/gris plano: títulos de sección en verde de marca, pie de página en gris muted, regla divisoria bajo la cabecera.
- **Detección de "títulos de sección" en negrita**: el prompt de `AggregateService` genera los títulos como `**Logros de la semana**` seguido de un salto de línea duro (dos espacios), no un heading `##` real — `marked.lexer` tokeniza eso como un `strong` seguido de un token de texto residual (solo espacios), no un único token. La detección tolera ese texto en blanco después del `strong` (probado contra markdown real de un informe generado por Groq, no solo contra markdown de prueba a mano).
- Pie de página con disclaimer + paginación (`bufferedPageRange`), en todas las páginas.

Verificado end-to-end con datos reales: equipo de prueba, checkins guardados, `ReportJob` disparado (generación real con Groq), PDF descargado de `GET /api/reports/:id/pdf` y renderizado a PNG con `pdftoppm` para inspección visual — logo, títulos en verde, viñetas y pie de página correctos, en informes de una y de varias páginas.

**Bug real encontrado y arreglado generando el screenshot de muestra de la landing (sección 5):** Groq mete de vez en cuando espacios Unicode "raros" en su respuesta — ` ` (narrow no-break space) visto en producción, del mismo bloque que ` `/` - `/` `/`　` — para los que la fuente estándar de pdfkit (Helvetica/AFM) no tiene glifo: sin normalizar, pdfkit los pintaba como una "/" visible en medio de una palabra ("Stripe /Tax", "cron de 15 /min"), en cualquier informe real, no solo en el de muestra. `sanitizeText` (`api/src/pdf/text.utils.ts`, con test propio `text.utils.spec.ts` — se separó de `pdf.service.ts` porque `marked` es ESM-only y rompe Jest si se importa en el mismo archivo que el test) normaliza esas variantes a espacio normal antes de tokenizar el markdown. Repro mínimo confirmado con texto de prueba a mano (no reproducía) vs. markdown real de Groq (sí reproducía) — aislado por inspección de los bytes del string, no a ojo.

### 0.10 Panel: estadísticas del dashboard, ficha de la empresa, estados de carga con skeleton

Tres mejoras del panel autenticado (`AppShell`), pedidas juntas:

- **Dashboard con datos reales, no solo la lista de equipos** (`web/src/app/[locale]/app/page.tsx`): una fila de estadísticas agregadas (equipos, miembros totales, informes generados, % de respuesta de la semana) y, en cada card de equipo, el número de miembros, cuántos respondieron esta semana y un link directo para descargar el PDF del último informe (`api.reportPdfUrl`, con `stopPropagation` para no disparar la navegación de la card). Los datos por equipo (miembros, informes, estado de la semana) se piden en paralelo tras cargar la lista de equipos — no bloquean el render inicial de las cards.
- **Ficha de la empresa** (`web/src/app/[locale]/app/settings/page.tsx`, ruta `/app/settings`, nuevo `OrganizationsController`/`OrganizationsService` en el backend con `GET/PATCH /api/organizations/me`): nombre de la empresa editable, email de registro (de solo lectura, viene de `auth.users` vía el usuario autenticado, no se duplica en la tabla `organizations`), nombre de contacto y país. País guardado como ISO 3166-1 alpha-2 (`organizations.country`, migración `0004`; `contact_name`, migración `0005`) — el desplegable usa `Intl.DisplayNames` (nativo del navegador, sin librería ni lista de nombres mantenida a mano) para mostrar los ~249 países localizados en el idioma activo del panel, ordenados alfabéticamente en ese idioma.
- **Estados de carga con skeleton** (`web/src/components/Skeleton.tsx`) en vez de un `<p>Cargando...</p>` de texto plano, en todas las páginas del panel (dashboard, ficha de empresa, detalle de equipo, editar equipo, miembros, facturación) — cada skeleton calca la forma real de su página (misma grid de stats, misma lista de reports, etc.) para que no haya salto de layout cuando llegan los datos.

### 0.11 Vista de detalle de un informe: conversación completa por miembro

Desde el histórico de un equipo, la fecha de cada informe (`web/src/app/[locale]/app/team/[teamId]/page.tsx`) es un link a `/app/team/[teamId]/report/[reportId]` — página nueva con el listado de miembros de esa semana (quién respondió y quién no, reutilizando `checkinStatus`) y, por cada uno, su conversación completa:

- **Respuesta de texto** (formulario de 3 campos o mensaje único): campos "qué hizo"/"qué hará"/"bloqueo" si vinieron estructurados, o el texto plano si no.
- **Respuesta por nota de voz**: el audio original reproducible (`<audio controls>`) **y** la transcripción debajo — no solo una u otra. El audio ya se guardaba (`checkins.audio_path` en Supabase Storage, sección 0.7) y la transcripción ya se guardaba en `raw_text`, así que la vista es nueva pero los datos ya existían.
- `AudioService.getSignedUrl` (nuevo) genera un link firmado de 1h para reproducir el audio desde el bucket privado — se pide bajo demanda por `CheckinsService.statusForTeamWeek`, solo para los checkins que de verdad tienen `audio_path` (no genera signed URLs de más).

Verificado end-to-end con datos reales: equipo de prueba con un checkin de texto estructurado, un checkin de nota de voz (audio sintetizado subido al bucket `checkin-audio`) y uno sin responder — la página de detalle mostró los tres estados correctamente y el audio se reprodujo en el navegador desde el signed URL. Datos de prueba borrados (org, usuario, fichero de audio) al terminar.

### 0.12 Configuración del feedback: de cuenta, no por equipo

Decisión explícita del usuario: horario del recordatorio, hora de corte, timezone y canal/destino de entrega del informe dejan de configurarse por equipo — pasan a ser una única configuración de cuenta (`organizations`), que aplica a todos los equipos de esa organización. Antes cada equipo pedía estos 6 campos al darse de alta; con varios equipos, eso significaba repetir la misma configuración N veces (o, peor, dejarla inconsistente entre equipos sin querer).

- **Migración `0006_feedback_config_to_organization.sql`**: `organizations` gana `reminder_dow`/`reminder_time`/`cutoff_time`/`timezone` (nuevas columnas); `delivery_channel`/`delivery_target` ya existían ahí (pensadas para el resumen ejecutivo futuro, sección 0.6 del doc de producto) y en ese momento se reutilizaron como el destino real de cada informe de equipo, no solo del consolidado. Los 6 campos se quitan de `teams` (`company_context` y `name` siguen siendo por equipo — el contexto de IA y el nombre sí varían por equipo). Backfill: cada organización existente hereda la configuración de uno de sus equipos, para no dejar cuentas ya creadas sin recordatorio. *Superado por la migración `0009` (paso 15, sección 4)*: `delivery_channel`/`delivery_target` se borraron — el destino pasó a ser `teams.report_recipients` (por equipo) y `organizations.executive_summary_recipients` (consolidado); el horario (`reminder_dow`/`reminder_time`/`cutoff_time`/`timezone`) sigue siendo de cuenta.
- `TeamsService.listAll()` (usado solo por los jobs internos) trae la configuración vía join con `organizations` y la aplana sobre cada equipo — `ReminderJob`/`ReportJob` siguen leyendo `team.timezone`/`team.reminder_dow`/etc sin cambios, solo cambia de dónde sale el dato.
- `OrganizationsController`/`OrganizationsService` (sección 0.10) ganan estos 6 campos en `GET/PATCH /api/organizations/me`. El formulario de "Alta de equipo" (`onboarding`) y "Configuración del equipo" (`team/[teamId]/edit`) se simplifican a solo nombre + contexto; la página de Ajustes de empresa (`/app/settings`) gana una segunda tarjeta, "Configuración del feedback", con los 6 campos — un único sitio para configurarlo, con una nota en el alta de equipo que enlaza ahí.

Verificado end-to-end: cuenta nueva registrada, formulario de alta de equipo confirmado sin los campos de horario/entrega, guardada la configuración de feedback en Ajustes con datos reales, confirmado en base de datos que `organizations.reminder_dow/reminder_time/cutoff_time/timezone/delivery_target` quedan con los valores correctos y `teams` ya no tiene esas columnas.

### 0.13 Añadir/editar miembro: pantalla propia, no inline en la lista

Pedido explícito: la página de "Gestionar miembros" (`team/[teamId]/members`) tenía el alta y la edición como formularios inline dentro de la propia lista (una fila se convertía en inputs al pulsar editar; el alta era un formulario pegado debajo) — cambiado a dos páginas propias, mismo patrón que ya usaban "Editar equipo" y el detalle de informe:

- `team/[teamId]/members/new` — alta.
- `team/[teamId]/members/[memberId]/edit` — edición; sin endpoint `GET` de un miembro suelto, cargado buscando por id en `listMembers(teamId)` (mismo truco que la página de detalle de informe con `listReports`, sección 0.11).
- La lista queda solo como lista: nombre/canal/contacto + icono de editar (link a la pantalla nueva) + borrar (se queda inline, es una acción destructiva de un click, no un formulario).

De paso, arreglado el link "volver" (`← Equipo`) de varias páginas de detalle: usaba la clase `btn-ghost` sola, sin la clase base `.btn` que le da el layout (`inline-flex`+`gap`) — sin eso el icono y el texto no se alineaban bien y el espaciado con el título de debajo dependía de un `style={{marginBottom}}` suelto y repetido en cada página. Nueva clase `.back-link` centraliza layout + espaciado, aplicada en las 4 páginas que tienen un link de "volver" (miembros, editar equipo, detalle de informe, y las 2 pantallas nuevas de miembros).

### 0.14 Página pública de ayuda para configurar Telegram

Página pública `/help/telegram` (`web/src/app/[locale]/help/telegram/page.tsx`, mismo patrón sin `AppShell` que `/legal/terms`|`/legal/privacy`) para quien nunca usó un bot de Telegram, tanto para quien gestiona la cuenta como para el propio miembro.

- El `@usuario` del bot no estaba expuesto en ningún sitio (solo el token, privado, vive en `TELEGRAM_BOT_TOKEN`) — en vez de dejarlo como placeholder entre corchetes (como los datos legales, sección 6) o hardcodeado, `TelegramChannel.getBotUsername()` (nuevo) lo pide a la propia API de Telegram (`getMe`) y lo cachea en memoria del proceso (el username de un bot no cambia en caliente). Expuesto público, sin `AuthGuard`, en `GET /api/telegram/bot-username` (`TelegramInfoController`) — es información que ya es pública dentro de Telegram, no hay nada que proteger.

### 0.16 Vinculación de Telegram automática por deep link (`/start <member_id>`)

La sección 5 dejaba anotada la alternativa a evaluar — implementada: ya no hace falta que nadie consiga un `chat_id` a mano vía `@userinfobot` ni lo pegue en "Contacto".

- **Alta de miembro Telegram sin contact.** `contact` pasa a ser nullable (migración `0007_telegram_contact_nullable.sql`, con un `check` que lo sigue exigiendo para canal `email`). `CreateMemberDto`/`UpdateMemberDto` usan `@ValidateIf(o => o.channel === 'email')` sobre `contact`. Las pantallas de alta (onboarding y `members/new`) no piden contacto cuando el canal es Telegram.
- **Deep link personal.** La ficha de edición de un miembro (`members/[memberId]/edit`) muestra un botón "Vincular Telegram" / "Volver a vincular Telegram" con `https://t.me/<bot>?start=<member.id>` (username real vía `getTelegramBotUsername`, sección 0.14). Quien gestiona la cuenta se lo pasa al miembro por el canal que sea (WhatsApp, email...).
- **Resolución automática del `chat_id`.** Telegram traduce ese deep link en un mensaje `/start <member_id>` en cuanto la persona pulsa "Iniciar". `TelegramChannel.parseIncoming` reconoce ese patrón (con o sin `@bot_username` de por medio) y devuelve `startParam` en vez de tratarlo como checkin. `TelegramWebhookController#linkMember` busca el member por id + `channel: 'telegram'`, guarda el `chat_id` como su `contact`, y contesta confirmando la vinculación (o avisando de enlace inválido si el member no existe).
- **Recordatorio no se manda a un Telegram sin vincular.** `ReminderJob` salta a los miembros con `contact` nulo (`if (!member.contact) continue`) — nada que enviar hasta que abran el bot.
- La página `/help/telegram` (sección 0.14) y el texto de las pantallas de alta/edición se actualizaron para explicar este flujo en vez del manual con `@userinfobot`.
- Cubierto con tests unitarios: `TelegramChannel.parseIncoming` (parseo de `/start`, con y sin `@bot_username`, con y sin parámetro) y `TelegramWebhookController` (vincula con member válido, avisa de enlace inválido, no toca `linkMember` en un checkin normal).
- Las pantallas de alta/edición de miembro (sección 0.13) muestran un link a esta página justo debajo del selector de canal, solo cuando se elige Telegram (`target="_blank"`, para no perder lo escrito en el formulario).

Verificado con el bot real de desarrollo: `GET /api/telegram/bot-username` devuelve el username correcto, la página pública lo usa para armar el link `t.me/<bot>`, y el link condicional aparece/desaparece al cambiar el canal en las pantallas de miembro.

### 0.15 Configuración del feedback: pantalla propia, banner en el dashboard

La "Configuración del feedback" (sección 0.12: horario + canal/destino de entrega, de cuenta desde esa sección) vivía como una segunda tarjeta dentro de `/app/settings`, junto a los datos de la empresa — pedido explícito: sacarla de ahí, pantalla propia, con visibilidad directa desde el dashboard en vez de quedar escondida dentro de "Empresa".

- Nueva ruta `/app/feedback` (`web/src/app/[locale]/app/feedback/page.tsx`) — el formulario que antes era la segunda tarjeta de `/app/settings`, movido tal cual (mismos campos, mismo `PATCH /api/organizations/me`). `/app/settings` vuelve a ser solo nombre/email/contacto/país.
- El dashboard (`/app/page.tsx`) muestra un banner clicable **arriba del todo**, antes incluso del título — pide `GET /api/organizations/me` en paralelo a los equipos (no bloquea el render si falla, igual que las estadísticas por equipo). Dos estados:
  - **Configurado**: `"{día} a las {hora de corte} · se entrega por {canal} a {destino}"`, tarjeta neutra.
  - **Sin `delivery_target`** (cuenta nueva, sección 0.12 — el registro no lo pide, hay que configurarlo alguna vez): tarjeta con fondo verde suave (`.schedule-banner-unset`) y texto de aviso — mismo patrón visual que usan otros CTA de "esto falta por hacer".
  - Todo el banner es un `<Link>` a `/app/feedback`.
- El aviso del alta de equipo (sección 0.12, "el horario y el destino son de cuenta, configúralos en...") ahora enlaza a `/app/feedback` en vez de `/app/settings`.

Verificado end-to-end: cuenta nueva sin equipos muestra el banner en su variante "sin configurar" arriba del todo; al guardar el horario/destino en `/app/feedback` y volver al panel, el banner pasa a la variante configurada con los datos reales (`"Viernes a las 13:00 · se entrega por Email a ..."`); `/app/settings` confirmado sin ningún rastro de los campos de horario/entrega.

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
DATABASE_URL=                    # connection string directo de Postgres — SOLO para migraciones (ver 0.8), usar el del pooler si el directo da ENOTFOUND
GROQ_API_KEY=                    # temporal en vez de Anthropic (ver sección 0.2) — console.groq.com
GROQ_MODEL=                      # openai/gpt-oss-120b — Groq rota su catálogo, revisar si da 404 model_not_found
RESEND_API_KEY=
RESEND_FROM=
TELEGRAM_BOT_TOKEN=              # @BotFather en Telegram
WHATSAPP_PHONE_NUMBER_ID=        # Meta Business Manager, pendiente cuenta verificada (ver sección 0.2)
WHATSAPP_ACCESS_TOKEN=           # ídem
WHATSAPP_VERIFY_TOKEN=           # cualquier string random — se compara contra hub.verify_token al dar de alta el webhook en Meta
CHECKIN_TOKEN_SECRET=            # string largo random — firma los links de /checkin/<token> (sección 3.5)
SURVEY_TOKEN_SECRET=             # ídem, para los links de /survey/<token> (encuesta mensual, sección 0.17) — secreto propio, no reutiliza CHECKIN_TOKEN_SECRET
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
    schema.sql                         # esquema completo de referencia — tablas organizations, teams, members, checkins, reports
    migrations/                        # 0001_*.sql, 0002_*.sql... aplicadas solas al arrancar el backend (ver 0.8)
  api/                                  # backend Node.js/TypeScript (NestJS)
    src/
      config/            → ConfigModule, variables de entorno centralizadas
      supabase/          → SupabaseModule/Service (cliente service_role + cliente anon para auth, ver 0.1), MigrationRunnerService (ver 0.8)
      audio/             → AudioService: transcripción (Groq Whisper) + Storage del audio (bucket privado, ver 0.7)
      auth/              → AuthModule: register/login/logout/me, AuthGuard, cookie httpOnly wf_session
      channels/          → interfaz común + un provider por canal (email.channel.ts, telegram.channel.ts, whatsapp.channel.ts [pendiente cuenta Meta, ver 0.2], [futuro] slack.channel.ts) + ChannelsService (dispatcher) + ChannelsInfoController (GET /channels/enabled, ver 0.2)
      teams/             → TeamsModule (equipos y miembros, protegido por AuthGuard): controller + service
      checkins/          → CheckinsModule: controller + service (estado por semana, export de conversaciones — ver 3.3)
      checkin-form/      → CheckinFormModule: formulario público /checkin/<token>, sin AuthGuard (ver 3.5)
      reports/           → ReportsModule: histórico de informes (GET /api/reports?teamId=), descarga PDF
      aggregate/         → AggregateModule/Service (llamada a la IA — Groq temporal, ver 0.2)
      pdf/               → PdfService: markdown → PDF (pdfkit + marked, sin Chromium, ver 0.5)
      jobs/              → ReminderJob, ReportJob (@nestjs/schedule, Cron), blockers.utils.ts (recurrencia, ver 0.6)
      webhooks/          → TelegramWebhookController (entrada de mensajes; WhatsappWebhookController se suma cuando se retome WhatsApp, ver 0.2)
      app.module.ts, main.ts
  web/                                  # frontend Next.js/TypeScript
    messages/          → es.json, en.json (diccionarios de next-intl, ver sección 3.2)
    src/
      i18n/              → routing.ts, navigation.ts, request.ts (config de next-intl)
      middleware.ts      → detección/enrutado de locale
      components/        → LocaleSwitcher.tsx y demás componentes compartidos
      app/[locale]/      → page.tsx (landing), login/, register/, app/ (dashboard + onboarding, autenticado), checkin/[token]/ (formulario público, sin auth — ver 3.5) — App Router
      lib/api.ts         → cliente HTTP al backend (fetch con credentials: 'include', nunca supabase-js — ver sección 0.1)
```

El esquema de base de datos (`supabase/schema.sql`) ya está escrito: tablas `organizations` (la cuenta que paga, con su plan — equipo/organización/custom — y sus límites), `teams`, `members`, `checkins`, `reports`, con seguridad por fila (RLS) para que cada responsable solo vea sus propios equipos y, si tiene el resumen ejecutivo activado, el consolidado de su organización (ver `docs/mvp-resumen-semanal-equipos.md`, sección 6.4 y 11).

### 3.2 Frontend: rutas públicas vs. autenticadas, e i18n (ES/EN)

`/` es la landing pública (marketing, precios, CTA); `/app` es el dashboard autenticado y `/app/onboarding` el alta de equipo — separado de la landing para que login/registro puedan redirigir a un espacio claramente "detrás del login", sin mezclar contenido de venta con la aplicación.

**Multi-idioma (ES/EN):** fuera del alcance del MVP según el roadmap del documento de producto (sección 15) — se adelantó igual porque se pidió explícitamente durante el desarrollo, no porque haya demanda de un cliente real. Implementado con `next-intl`:
- `src/i18n/routing.ts` define los locales (`es` por defecto, `en`) con `localePrefix: 'as-needed'` — español sin prefijo (`/login`), inglés prefijado (`/en/login`). Así las URLs que ya se habían probado en español no cambian.
- `src/middleware.ts` detecta el idioma (cookie `NEXT_LOCALE` si ya eligió antes, si no `Accept-Language` del navegador) y redirige/reescribe.
- Todas las cadenas de texto de la UI viven en `messages/es.json` y `messages/en.json`, organizadas por página (`Landing`, `Login`, `Register`, `Onboarding`, `Dashboard`) más `Nav`/`Channel`/`Day` compartidos — nada de texto hardcodeado en los componentes.
- `src/components/LocaleSwitcher.tsx` es el selector ES·EN que aparece en cada página; usa el `Link` de `src/i18n/navigation.ts` (no el de `next/navigation`) para no perder el idioma actual al navegar entre páginas.
- Añadir un tercer idioma es: nuevo `messages/<locale>.json` con las mismas claves, sumarlo a `routing.ts`, y una entrada más en `LOCALES` de `LocaleSwitcher.tsx`.

Probado en navegador de punta a punta en ambos idiomas: landing, registro, alta de equipo (con los labels de día de la semana traducidos), dashboard — incluido el cambio de idioma en caliente con el switcher.

### 3.3 El dashboard muestra quién respondió y quién no, y permite descargar

Pedido explícito: el responsable del equipo (el único que entra al panel — ver el punto siguiente) tiene que poder ver, tanto de la semana en curso como de cada informe pasado, qué miembros contestaron y cuáles no; y descargar tanto el informe (PDF) como las conversaciones completas.

- `GET /api/checkins/status?teamId=&weekStart=` (`CheckinsService.statusForTeamWeek`) — un array con cada miembro activo del equipo y si respondió esa semana, calculado sobre `members` + `checkins`, no sobre lo que dice el texto del informe (más fiable: el modelo podría formatear distinto la línea de "no respondió", el join no falla nunca). El dashboard lo usa dos veces: para la semana en curso (calculada en el propio navegador, solo para este widget — la fuente de verdad de semanas cerradas sigue siendo `report.week_start`) y para cada informe del histórico.
- `GET /api/checkins/export?teamId=&weekStart=` — conversaciones completas en texto plano, descargable. Sin `weekStart` trae el historial entero del equipo; con `weekStart`, solo esa semana. `Content-Disposition: attachment`, así que un simple `<a href>` alcanza — no hace falta fetch+blob en el frontend, la cookie de sesión viaja igual en la navegación (SameSite=Lax cubre navegación top-level).
- `GET /api/reports/:id/pdf` — el mismo PDF que se manda automáticamente por `ReportJob` (sección 0.5), pero regenerado al vuelo a partir de `content_markdown` cuando el jefe lo pide desde el panel, no un binario guardado aparte.

### 3.4 Los empleados no tienen cuenta ni acceso al panel

Esto ya era así, no es un cambio: solo se registra/loguea quien da de alta el equipo (el responsable, dueño de la `organization`). Los miembros (`members`) no tienen fila en Supabase Auth, ni password, ni sesión — interactúan únicamente por WhatsApp/Telegram/email, de forma conversacional, nunca entran a `/app`. `AuthGuard` protege todo lo que hay bajo `/api/teams`, `/api/checkins` y `/api/reports`; no existe ningún login para miembros porque no hace falta — no hay nada en el panel que un empleado necesite ver o hacer.

### 3.5 Checkin por email: formulario con link único, no hay a qué "responder"

Gap real encontrado durante el desarrollo: a diferencia de WhatsApp/Telegram, que son conversacionales (la persona responde al mismo chat), un email de recordatorio no tiene una vuelta natural — `EmailChannel.parseIncoming()` ni siquiera está implementado (sección 0.1 original del canal). Sin esto, un miembro con canal `email` no tenía ninguna forma de dejar su checkin salvo que el jefe se lo pasara a mano.

Solución: cada recordatorio (`ReminderJob`, los tres canales, no solo email) incluye un link a un formulario público, `/checkin/<token>` en el frontend. El token es la credencial — no hay cuenta, no hay contraseña:

- `CheckinFormService.buildLink()` firma un token stateless (HMAC-SHA256, `api/src/checkin-form/token.util.ts`) con `memberId` + `weekStart` — no hace falta guardar nada nuevo en la base de datos, ni tabla ni columna. `CHECKIN_TOKEN_SECRET` (cualquier string largo random) es la única pieza nueva de configuración.
- `GET /api/checkins/form?token=` y `POST /api/checkins/form` (`CheckinFormModule`) — **sin `AuthGuard`**, a propósito: mismo criterio de confianza que los webhooks de mensajería (el token/número de teléfono ya resuelve quién es, no hace falta login). El `POST` reusa `CheckinsService.saveInternal()`, el mismo camino que usan los webhooks.
- El formulario (`web/src/app/[locale]/checkin/[token]/page.tsx`) es una página pública, sin `AppShell` ni sesión — si el token ya tiene una respuesta guardada esa semana, muestra un mensaje de agradecimiento en vez del formulario (evita duplicar/pisar sin querer).

**Bug real encontrado probando en navegador:** el formato inicial del token usaba `.` como separador (`<payload>.<firma>`), y el matcher del middleware de next-intl excluye del enrutado cualquier path con un punto (asumiendo que es un archivo estático — `.*\\..*` en `web/src/middleware.ts`), así que la URL del checkin devolvía 404 antes de llegar a la página. Cambiado el separador a `~`, que no forma parte del alfabeto base64url ni choca con esa regla. Hay un test (`token.util.spec.ts`) que falla si vuelve a colarse un punto en el token.

Sin expiración todavía: el token es válido indefinidamente para esa semana concreta (no hay lógica que rechace un link viejo). Limitación conocida, aceptable para el MVP — si alguien reusa un link de hace un mes, el checkin quedaría atribuido a la semana original del token, no a la actual.

### 3.6 Editar equipo y gestionar miembros: páginas propias, no inline en el dashboard

Pedido explícito: en vez de un `<select>` de equipo con todo apilado debajo en una sola página, cada equipo tiene su propio espacio:

- `/app` es ahora una grilla de cards, una por equipo, cada una lleva a `/app/team/[teamId]`.
- `/app/team/[teamId]` es el dashboard de ESE equipo (estado de la semana, histórico, descargas) — lo que antes vivía todo en `/app`.
- `/app/team/[teamId]/edit` — formulario de edición del equipo, precargado (`GET /api/teams/:id`, nuevo endpoint — antes solo existía el listado).
- `/app/team/[teamId]/members` — alta/edición/baja de miembros, cada fila editable inline.

Backend nuevo en `TeamsController`/`TeamsService`: `getOwn` (`GET /api/teams/:id`), `updateTeam` (`PATCH /api/teams/:id`), `updateMember`/`removeMember` (`PATCH`/`DELETE /api/teams/:id/members/:memberId`), `listMembersForOwner` (`GET /api/teams/:id/members`). Todos con el mismo doble chequeo de propiedad que ya usaba `addMember`: el equipo tiene que ser de la organización que llama, y (para miembros) el miembro tiene que ser de ese equipo — dos saltos, no uno, para que no se pueda editar/borrar un miembro ajeno mezclando un `team_id` propio con un `member_id` de otro equipo.

**Baja de miembro = soft delete**, no `DELETE` de la fila: `removeMember` pone `active = false`, no borra. El historial de checkins/informes ya generados sigue haciendo referencia a ese miembro por nombre — borrarlo de verdad no aporta nada y rompería esa trazabilidad. `listMembers`/`statusForTeamWeek` ya filtraban por `active = true`, así que no hizo falta tocar nada ahí. Reactivar a alguien (`PATCH` con `active: true`) vuelve a contar contra `max_members_per_team` — sin este chequeo, borrar y reactivar habría sido una forma de saltarse el límite del plan.

### 3.1 Conectores de canal — preparado para añadir Slack sin tocar el resto

Slack queda fuera del MVP, pero `email`, `telegram` y `whatsapp` (pendiente cuenta Meta, sección 0.2) se construyen detrás de la misma interfaz, para que añadir un canal nuevo más adelante sea solo sumar un archivo, no tocar `jobs/` ni la lógica de negocio:

```ts
// channels/channel.interface.ts — cada provider implementa el mismo contrato
interface Channel {
  send(contact: string, message: string): Promise<void>;       // manda el recordatorio o el informe
  parseIncoming(payload: unknown): { contact: string; rawText: string }; // normaliza la respuesta entrante
}
```

`ReminderJob` y `ReportJob` no conocen el canal — llaman a `channelsService.get(member.channel).send(...)`, elegido por el `channel` de cada `member` (o `delivery_channel` del `team`/`organization` para el informe). `ChannelsService` es el dispatcher, con un mapa `{ email, whatsapp, telegram }` inyectado por DI — añadir un canal nuevo (Slack) es: crear `channels/<nombre>.channel.ts` implementando `Channel`, registrarlo como provider en `ChannelsModule`, sumar el nombre al `check` de `channel`/`delivery_channel` en `schema.sql` (con una migración), y un endpoint en `WebhooksController` si el canal recibe mensajes. Nada en `jobs/` cambia.

Cada canal opcional (no `email`, que es fijo) se puede ocultar de los `<select>` del frontend sin tocar código, con una env var: `ChannelsInfoController` (`GET /channels/enabled`, público, sin `AuthGuard`) devuelve `{ email: true, telegram, whatsapp }` leyendo `ENABLE_TELEGRAM_CHANNEL`/`ENABLE_WHATSAPP_CHANNEL` (`.env.example`) — así WhatsApp puede quedar en el código pero invisible para quien da de alta un miembro hasta que la cuenta de Meta esté operativa. El hook `useEnabledChannels` (`web/src/lib/useEnabledChannels.ts`) lo consulta una vez y filtra las `<option>` en `onboarding`, `members/new`, `members/[memberId]/edit` y `feedback` — con fallback optimista (`{ telegram: true, whatsapp: false }`) mientras carga o si el backend no responde.

Esto es intencional, no sobre-ingeniería: la interfaz ya fuerza tener dos canales reales (email y telegram) desde el MVP — no es una abstracción especulativa para un caso hipotético, es la misma forma que ya toman los dos canales que sí se construyen ahora.

---

## 4. Hoja de ruta — una funcionalidad detrás de otra

Cada punto se construye, se prueba, y solo entonces se pasa al siguiente. Los primeros puntos no necesitan frontend ni WhatsApp — se prueban con `curl` o Postman contra el backend.

**Estado actual:** pasos 1 a 13 **verificados de punta a punta contra servicios reales** (Supabase, Resend, Groq, Telegram, Stripe), salvo lo que depende de una cuenta que todavía no existe (Anthropic, paso 7, sustituida por Groq; WhatsApp, paso 12, código reconstruido pero sin cuenta de Meta verificada todavía — ver detalle abajo). Encontrados y arreglados varios bugs reales en el camino, ninguno cosmético:

- Usuario de Supabase Auth huérfano si fallaba el insert de `organizations` durante el registro (`AuthService.register` ahora compensa borrando el usuario si el segundo paso falla).
- `currentWeekStart` calculaba mal el lunes de la semana en cualquier timezone adelantado a UTC — incluido Europe/Madrid, el timezone por defecto del producto (mezclaba `Date` en hora local con `toISOString()`, que es siempre UTC).
- `isWithinWindow` (ventana del cron) era simétrica (±15min) — con una hora configurada que no cae en múltiplo de 15 (p. ej. `10:07`), el recordatorio se mandaba dos veces en dos ticks consecutivos. Cambiado a ventana hacia adelante, cada hora objetivo cae en exactamente un tick.
- Webhook de Telegram devolvía 500 (no 400) con un payload sin mensaje reconocible — el filtro de excepciones por defecto de Nest convertía el `Error` genérico de `parseIncoming` en 500; ahora se captura y se relanza como `BadRequestException`.

**Ciclo de cron completo probado en vivo contra un chat de Telegram real (no de test), sin disparar nada a mano** más que el mensaje del propio usuario: equipo de prueba con `reminder_time`/`cutoff_time` a pocos minutos en el futuro → `ReminderJob` disparó solo desde el `@Cron` de Nest, recordatorio confirmado recibido en Telegram → el usuario respondió por Telegram de verdad → el mensaje se capturó con `getUpdates` (no hay URL pública para que Telegram llame directo a nuestro webhook en este entorno) y se reenvió tal cual a `POST /api/webhooks/telegram` → quedó guardado como checkin real → `ReportJob` disparó solo, generó el informe con Groq, lo convirtió a PDF y lo entregó por Telegram — confirmado recibido por el usuario.

Entrega del informe como PDF (sección 0.5) verificada con servicios reales en los dos canales del MVP: `EmailChannel.sendDocument` (adjunto recibido por email) y `TelegramChannel.sendDocument` (documento recibido en el chat, confirmado por el usuario).

Sin probar: la cuenta de Anthropic (paso 7, sustituida por Groq). El paso 0 (n8n) no se hizo — no hizo falta, se validó todo directo contra los servicios reales.

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

12. **Canal WhatsApp** — código reconstruido (`WhatsappChannel`, `WhatsappWebhookController`, migración `0008`, sección 0.2). *Verificado en vivo (2026-09-27)* contra una cuenta de prueba real de Meta: recordatorio real enviado con `WhatsappChannel.send()` a un número real, y la respuesta (incluida una nota de voz, transcrita por Groq Whisper) quedó guardada en `checkins` vía webhook — mismo flujo que Telegram. Pendiente solo lo que depende de la empresa verificada (sección 0.2): número de producción, plantilla de recordatorio aprobada, método de pago.

13. **Cobro con Stripe** — implementado: `BillingModule` (`api/src/billing/`) con Stripe Checkout hospedado (no Elements a medida), un customer/subscription por organización, Billing Portal para autogestión, y un webhook (`POST /webhooks/stripe`, sin `AuthGuard` — confianza vía firma `Stripe-Signature`, mismo patrón que los webhooks de canal) que marca `organizations.status` en `active`/`canceled` según `checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted`. Precios (Equipo 49€, Organización 149€) creados como Product+Price reales en el Stripe sandbox — ids en `STRIPE_PRICE_EQUIPO`/`STRIPE_PRICE_ORGANIZACION`. Frontend: página `/app/billing` con las 2 cards de plan y botón de gestión de suscripción. *Verificado de punta a punta:* `DATABASE_URL` migrado al connection pooling de Supabase (host `db.<ref>.supabase.co` es IPv6-only y no era accesible desde este entorno; el pooler `aws-1-eu-west-1.pooler.supabase.com` sí). Con eso aplicada la migración `0002_add_stripe_subscription.sql`. Se hizo un pago real en modo test (tarjeta 4242 4242 4242 4242) contra una organización de prueba vía `stripe listen --forward-to`: `checkout.session.completed` pasó `organizations.status` de `trial` a `active`, y cancelar la suscripción (`customer.subscription.deleted`) lo pasó a `canceled`. También verificado en el navegador: login → `/app/billing` muestra el plan activo, y "Manage subscription" abre el Billing Portal real de Stripe. Organizaciones de prueba borradas al terminar.

**Trial de 30 días con tarjeta** — decisión: pedir tarjeta desde el alta (`trial_period_days: 30` en `subscription_data` del Checkout Session, `BillingService.TRIAL_PERIOD_DAYS`) en vez de un trial sin tarjeta y sin fecha de corte. Motivo: `organizations.status` arrancaba en `trial` sin vencimiento y sin ninguna fricción — cero forcing function para convertir, y cero señal de qué leads tenían intención real de pagar. Con tarjeta puesta desde el día 1, Stripe cobra solo al día 30 (evento `invoice.payment_succeeded`/`customer.subscription.updated` con `status: active`, ya cubierto por `mapSubscriptionStatus`) sin que el backend tenga que hacer nada — y el que llega hasta ahí ya pasó el filtro de "puso la tarjeta", así que la conversión trial→pago debería ser mejor que con un trial sin tarjeta. Contrapartida asumida: menos volumen de registro que un trial sin tarjeta (fricción de pedir la tarjeta al alta). El frontend avisa del trial en `/app/billing` (solo mientras `status === 'trial'`, no se repite para quien ya se suscribió). *Guarda contra abuso:* `createCheckoutSession` solo manda `trial_period_days` si la organización todavía no tiene `stripe_customer_id` — ese campo nunca se borra al cancelar, así que sirve como señal de "ya tuvo una suscripción antes". Cancelar y volver a suscribirse ya no regala otro trial.

**Resuelto — el registro real nunca pasaba por Checkout.** Este trial con tarjeta estaba descrito arriba pero no conectado al alta real: `POST /api/auth/register` solo crea la `organization` en `plan: 'equipo'`/`status: 'trial'` (sin tocar Stripe) y el frontend (`RegisterPage`) redirigía directo a `/app/onboarding` — Checkout solo era alcanzable si el usuario visitaba `/app/billing` a mano después, algo que nadie hacía. `RegisterPage` (`web/src/app/[locale]/register/page.tsx`) ahora pide el plan (Equipo/Organización, mismo picker que `/app/billing`) en el propio formulario de alta, y al enviarlo encadena `api.register()` con `api.createCheckoutSession(plan)`, redirigiendo directo a Stripe Checkout — mismo mecanismo de trial con tarjeta, ahora en el camino real. *Verificado en vivo:* alta de una cuenta de prueba eligiendo Plan Organización, redirige de verdad a una `checkout.stripe.com/c/pay/cs_test_...` con el precio de 149€/mes — sin completar el pago (no se introduce ninguna tarjeta desde acá). Si el checkout se cancela, el usuario cae en `/app/billing?checkout=cancel`, donde puede reintentar con cualquiera de los dos planes (fallback ya existente). El botón "Terminar" de `/app/onboarding` (alta de equipo, después del checkout) vuelve a llevar a `/app`, no a billing — el plan ya se eligió antes. `/app/billing?checkout=success` suma un enlace a "Crear tu primer equipo" para no dejar al usuario sin saber qué sigue.

**Códigos promocionales** — dos caminos, según si la organización ya está suscripta o todavía no:

- **Al suscribirse:** `allow_promotion_codes: true` en la Checkout Session (`BillingService.createCheckoutSession`). Stripe muestra el campo "Add promotion code" nativo en su propia página de Checkout, valida el código y aplica el cupón — cero código propio de descuentos acá.
- **Con una suscripción ya activa:** el Billing Portal de Stripe no trae un flujo propio para esto, así que `BillingService.applyPromoCode` (`POST /billing/promo-code`, autenticado) lo resuelve con dos llamadas a la API: `stripe.promotionCodes.list({ code, active: true })` para validar el código, y `stripe.subscriptions.update(subscriptionId, { discounts: [{ promotion_code }] })` para aplicarlo. En `/app/billing` hay un campo "Promo code" + botón "Apply" junto a "Manage subscription" (solo visible con `status !== 'trial'`, porque hace falta un `stripe_subscription_id` ya existente).

Los cupones/códigos en sí se crean en el dashboard de Stripe (Coupons → Promotion codes), no hay UI propia para crearlos — X meses gratis es `duration: repeating` + `duration_in_months`, gratis para siempre es `duration: forever`, ambos con `percent_off: 100`, y `max_redemptions: 1` para que sea de un solo uso (código único por cliente).

*Verificado en vivo, los dos caminos:* checkout real con un código de prueba (100% off, 3 meses) — el campo aparece, el código se valida contra la API real de Stripe y el desglose de precio se actualiza al aplicarlo. Y por separado, con una organización ya suscripta de verdad (pago real completado, `stripe_subscription_id` real): aplicar un código distinto desde `/app/billing` y confirmar contra la API de Stripe que el `discounts` de la suscripción quedó con el id del descuento real — no solo que el frontend mostró "aplicado".

**IVA automático (Stripe Tax)** — `automatic_tax: { enabled: true }` en la Checkout Session. Antes el checkout no calculaba impuesto ninguno (precio mostrado "sin IVA" tal cual, sin desglose) — hueco real para un cliente de la UE, donde hay que cobrar IVA local a un consumidor o aplicar reverse-charge a una empresa con VAT ID. *Requisito no técnico, pendiente:* Stripe Tax no cobra nada en una jurisdicción donde la cuenta no tenga un registro fiscal activo — hay que completarlo en el dashboard de Stripe (Settings → Tax: dirección de origen de la empresa + al menos una jurisdicción registrada, España como mínimo). *Verificado en vivo:* con el registro fiscal todavía incompleto (`tax.settings.status: "pending"`, falta `head_office`), un checkout real con `automatic_tax` activado no rompió — Stripe calculó el impuesto en 0€ en vez de fallar, exactamente el comportamiento esperado (no cobra un impuesto para el que la cuenta no está habilitada). El código ya está listo; en cuanto se complete el registro en el dashboard, empieza a cobrar el IVA correcto sin tocar nada más.

14. **Límites de plan (Equipo / Organización / Custom)** — Plan Equipo baja de 20 a 10 miembros por equipo (`PLAN_CONFIG` en `api/src/billing/billing.service.ts`, valor por defecto en `AuthService.register`, migración `0011_team_plan_max_members_10.sql` para las cuentas ya existentes en ese plan — no expulsa a nadie, solo impide dar de alta o reactivar por encima de 10 a partir de ahora). Organización/Custom sin cambios. Implementado en `TeamsService` (`api/src/teams/teams.service.ts`): `assertTeamLimit` (antes de `createTeam`) y `assertMemberLimit` (antes de `addMember`, y antes de reactivar un miembro con `updateMember({ active: true })` — sin ese segundo chequeo, borrar y reactivar saltaba el límite) comparan contra `organizations.max_teams`/`max_members_per_team`; `NULL` (Plan Custom) siempre pasa. Cubierto por `teams.service.spec.ts` (9 tests): crea por debajo del límite, rechaza al alcanzarlo, sin límite con `NULL`, y el caso de reactivación. *Pendiente:* verificar en vivo contra una organización real en Plan Equipo/Organización (el roadmap original pedía probar el 2º equipo y el 21º miembro reales, no solo el test unitario).

15. **Resumen ejecutivo (varios equipos + informe consolidado)** — código construido (adelantado respecto al criterio original de "solo cuando aparezca un lead real", porque de paso hacía falta resolver quién recibe el informe con más de un equipo). Migración `0009_report_recipients.sql`: `teams.report_recipients` (lista de emails, reemplaza el `delivery_channel`/`delivery_target` único de cuenta de la migración 0006 — con varios equipos no tiene sentido un solo destino) y `organizations.executive_summary_recipients` (lista de emails para el consolidado). `has_executive_summary` (interruptor, sección 6.4 del doc de producto) editable desde `/app/feedback`, solo visible si el plan es Organización/Custom (`org_exec_summary_plan_check` en `schema.sql` lo rechaza a nivel de base de datos igual). `ReportJob.maybeGenerateExecutiveSummary` corre después del loop de equipos: si `has_executive_summary` está activo, la organización tiene más de un equipo, y TODOS sus equipos ya generaron su informe de esta semana, genera el consolidado con `AggregateService.generateExecutiveSummary` (segunda llamada a Groq, toma los informes de equipo ya generados como entrada, no los checkins en bruto — más barata todavía) y lo entrega en PDF a `executive_summary_recipients`. Se guarda en `reports` con `organization_id` (en vez de `team_id`) y `source_report_ids` apuntando a los informes de equipo que lo componen — el `reports_scope_check` de `schema.sql` ya obligaba a que sea uno u otro, nunca los dos. Expuesto en el panel vía `GET /reports/executive-summary` y una sección propia en el dashboard (`/app`), visible solo si `has_executive_summary` está activo. *Verificado en vivo:* organización de prueba en Plan Organización con 2 equipos (Producto, Ventas), 2 miembros cada uno, checkins reales guardados por `POST /api/checkins/manual`. El cron (`@Cron('*/15 * * * *')`) disparó solo con `reminder_dow`/`cutoff_time` de la cuenta a pocos minutos en el futuro: generó los 2 informes de equipo (Groq real) y, al ver que ambos equipos ya tenían informe de esta semana, generó el consolidado (`organization_id` seteado, `source_report_ids` apuntando a los 2 informes de equipo) — contenido con sentido, agrupado por equipo. La entrega por email falló en el primer intento por un motivo ajeno al código: el destinatario de prueba usaba un alias `+tag` de Gmail y la cuenta de Resend está en modo sandbox (dominio sin verificar en resend.dev) — sandbox solo entrega a la dirección exacta del titular de la cuenta, no a alias. Confirmado llamando a la API de Resend directo: 403 con el alias, 200 con la dirección exacta — el código de `EmailChannel.sendDocument` no tiene bug, es una limitación de la cuenta de Resend (ver punto nuevo en la sección 6, checklist antes de producción). Organización de prueba borrada al terminar (fila de `organizations` + usuario de Supabase Auth).

---

16. **Encuesta mensual anónima (Plan Organización/Custom)** — pedido explícito: el admin define hasta 5 preguntas de texto libre, de cuenta (no por equipo, `organizations.survey_questions`/`has_monthly_survey`/`survey_day_of_month`, migración 0010, mismo criterio de disponibilidad por plan que `has_executive_summary`/`org_survey_plan_check`). `SurveyJob` (`api/src/jobs/survey.job.ts`, cron cada 15 min como el resto) manda el link a todos los miembros activos de todos los equipos de la organización el día del mes configurado, a la hora del recordatorio de la cuenta — mismos tres canales que el check-in semanal. Anonimato real, no solo de cara al frontend: `survey_responses` (el contenido) no tiene columna `member_id` ni `team_id` — nada en la base de datos conecta una respuesta con quién la mandó. La única protección contra doble respuesta es `survey_submissions`, una tabla separada que solo guarda member_id+período (sin contenido); el insert ahí usa su unique constraint para rechazar un segundo envío, y el contenido no se guarda si ese insert falla. El aviso de anonimato es explícito en el formulario público (`/survey/[token]`, sección `SurveyForm.anonymityNotice`) — pedido explícito para que el feedback sea más honesto. Panel de resultados (`/app/survey`) agrupa las respuestas por pregunta y por mes, nunca por persona, y muestra cuántos de los miembros activos respondieron (participación) sin decir quién. Añadido el comparador de planes en la landing (sección "Compara los planes", debajo de las tarjetas de precio). *Verificado en vivo, contra Supabase real:* organización de prueba en Plan Organización con 1 equipo/1 miembro, `has_monthly_survey` activado por API con 2 preguntas; token de encuesta firmado con `SURVEY_TOKEN_SECRET` real; `GET /survey/form` devolvió las preguntas, `POST /survey/form` guardó la respuesta, un segundo intento fue rechazado (403, "Ya has respondido la encuesta de este mes"); `GET /survey/results` (con sesión del owner) devolvió las respuestas agrupadas por pregunta y la participación (1/1), sin ningún campo de identidad; confirmado además a nivel de esquema que `survey_responses` no tiene `member_id` ni `team_id` (consulta directa a `information_schema`). Organización de prueba borrada al terminar (equipo/miembro/respuestas en cascada + usuario de Supabase Auth). *Disparo por cron, verificado en vivo (2026-09-25):* organización de prueba (Plan Organización, `has_monthly_survey` activado, 2 preguntas, `survey_day_of_month` = hoy, `reminder_time` fijada ~15 min en el futuro), 1 equipo, 1 miembro con canal email real. Se esperó al tick del cron correspondiente sin llamar a ningún endpoint a mano — `SurveyJob.run()` detectó la organización, coincidió día+ventana horaria, y mandó el email real vía Resend; confirmado por recepción directa en la bandeja del destinatario (asunto "WeeklyFeedback"). Organización de prueba borrada al terminar (equipo/miembro en cascada). Ya no queda ningún job de los pasos 9/15/16 sin probar en vivo contra servicios reales.

## 5. Qué NO se construye todavía

Para no perder tiempo antes de validar lo esencial: sin integraciones con GitHub/Jira/Trello, sin analítica de tendencias, sin multi-idioma. Los límites de plan (paso 14) se construyen con el MVP porque son baratos y evitan sorpresas; el resumen ejecutivo (paso 15) se adelantó también (ver detalle ahí), pero sigue sin probarse contra una organización real con varios equipos. Todo lo demás vive en el roadmap post-MVP del documento de producto.

**Resuelto — screenshot real del producto en la landing (`web/src/app/[locale]/page.tsx`), en vez del mock armado a mano.** El hero y la sección "Así se ve tu informe" mostraban un `.report-mock` construido en HTML/CSS con contenido de ejemplo (marcado "Example"). Reemplazado por un screenshot real: informe generado de verdad (`AggregateService.generateReport` contra Groq real, equipo "Producto" con Ana/Bruno/Carla — mismos nombres que ya usaba el mock en la lista de miembros que respondieron) → PDF real (`PdfService.fromMarkdown`, con el fix de espacios Unicode de la sección 0.9 ya aplicado) → renderizado a PNG con `pdftoppm` a 300dpi → recortado (Pillow) en dos versiones — teaser compacto para el hero (`report-sample-hero.png`, corta antes de "Próxima semana", igual que el mock original) y completo para la sección de detalle (`report-sample-full.png`) — servidas desde `web/public/landing/`. CSS nuevo `.report-mock-photo`/`.report-mock-photo-frame` (`globals.css`) para que la imagen llegue a los bordes de la tarjeta `.report-mock` sin el padding pensado para texto. Las claves de traducción `sample*` que solo alimentaban el mock (`sampleBadge`, `sampleWinsTitle`, etc.) se borraron de `en.json`/`es.json`; queda `sampleAlt` para el `alt` de la imagen. Verificado en el navegador (`next build` + `next start`), en `/es` y `/en`, sin artefactos visuales.

**Resuelto — vinculación de Telegram automática por deep link, ver sección 0.16.** La alternativa anotada acá (`/start CODIGO`) se implementó usando el propio `member.id` como código, sin generar uno aparte. *Verificado end-to-end contra Telegram real* (mismo patrón que el paso 9 del roadmap, sección 4): migración `0007` aplicada de verdad en Supabase (columna `contact` nullable + check constraint confirmados por consulta directa a `information_schema`); member de prueba puesto a `contact = null`, deep link abierto de verdad desde Telegram, `/start <member_id>` capturado con `getUpdates` (no hay URL pública para webhook en este entorno) y reenviado a `POST /api/webhooks/telegram` — el member quedó vinculado (`contact` restaurado al `chat_id` real) y el mensaje de confirmación llegó de verdad al chat.

## 6. Checklist antes de producción

Cosas que están hechas pero no listas para un usuario real todavía — no son bugs, son huecos conocidos que hay que cerrar antes de lanzar de verdad:

- **Dominio propio verificado en Resend.** La cuenta de Resend está en modo sandbox (`RESEND_FROM=onboarding@resend.dev`, dominio sin verificar): solo entrega a la dirección exacta del titular de la cuenta, cualquier otro destinatario devuelve 403 (`validation_error`, confirmado en vivo probando la API directo — ver punto 15 de la sección 4). En este estado ningún cliente real recibiría un recordatorio o informe por email. *Hecho cuando:* un dominio propio está verificado en resend.com/domains, `RESEND_FROM` usa ese dominio, y un email de prueba llega a una dirección que no sea la del titular de la cuenta.
- **Resuelto — Términos de servicio y Política de privacidad con datos reales.** `/legal/terms` y `/legal/privacy` (`web/src/app/[locale]/legal/`) tenían placeholders entre corchetes (`[NOMBRE COMPLETO]`, `[NIF]`, `[DOMICILIO FISCAL]`, `[EMAIL DE CONTACTO]`) y un aviso visible de que faltaban por completar. Rellenados los datos legales reales del titular del servicio y quitado el aviso (`web/messages/es.json`/`en.json`, `legal/privacy/page.tsx`, `legal/terms/page.tsx`).
- **Resuelto — Analítica de la landing.** Se descartó Google Analytics (exige banner de consentimiento GDPR) y también Plausible self-host (necesita Docker+Postgres+ClickHouse, mínimo 2GB RAM — no cabe en la VPS de 1GB). Montado **GoatCounter** self-hosted (un binario Go, SQLite embebido, ~38MB RAM) en la misma VPS — detalle completo en `despliegue-produccion.md`, sección 5. Script cargado en `web/src/app/[locale]/layout.tsx`, condicional a `NEXT_PUBLIC_GOATCOUNTER_URL`.
