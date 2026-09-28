# Pruebas E2E contra producción

Cómo probar el flujo completo (equipos, miembros, checkins, informes,
resumen ejecutivo, encuesta mensual) contra `https://weeklyfeedback.com`
real, usando una cuenta de pruebas dedicada.

## Bugs encontrados en la primera corrida (2026-09-28)

Primera vez que se corrió el ciclo completo en producción (5 equipos, 13
miembros, checkins reales, tick de cron real). Salieron 3 problemas:

1. **Resumen ejecutivo entregado en blanco — CORREGIDO.**
   `AggregateService.callClaude` (`api/src/aggregate/aggregate.service.ts`)
   hacía `json.content?.[0]?.text ?? ''`: si Anthropic respondía 200 OK pero
   sin bloque de texto aprovechable en `content[0]`, esto devolvía `''` sin
   avisar. `ReportJob` lo trataba como éxito — insertó el resumen ejecutivo
   con `content_markdown` vacío en BD, generó el PDF en blanco y lo mandó
   igual por email (`id 577e1ea7-03f8-4ec6-b0df-1087fa24fdbf`, semana
   2026-09-28, `delivered_at` seteado). Los 5 informes de equipo que lo
   alimentaban tenían contenido real (2000-4300 caracteres cada uno,
   confirmado en BD) — el fallo fue específico de esa llamada a Claude, no
   de datos de entrada vacíos. Arreglado: ahora busca el primer bloque
   `type: 'text'` en vez de asumir que `content[0]` lo es, y **lanza error**
   si no encuentra texto utilizable — así el cron lo reintenta en el
   siguiente tick en vez de entregar algo vacío. Test de regresión en
   `aggregate.service.spec.ts`.

2. **`ReportJob.run()` se disparó dos veces en el mismo tick —
   MITIGADO, causa raíz sin confirmar.** Mismo tick, 2 de los 5 equipos
   dieron `23505 duplicate key value violates unique constraint
   "reports_team_week_unique"` — dos intentos de generar el mismo informe
   casi a la vez. Descartado que fuera un proceso duplicado en el VPS (un
   solo PID de node corriendo, confirmado con `ps aux` durante el
   incidente) y descartado que `ReportJob`/`JobsModule`/`ScheduleModule`
   estén registrados dos veces en el DI (revisado, cada uno se importa una
   sola vez). Sigue sin explicación confirmada por qué `run()` se ejecutó
   dos veces solapadas. Mitigado en `api/src/jobs/report.job.ts`: los
   `insert` de informe de equipo y de resumen ejecutivo ahora capturan el
   `23505` y lo tratan como "ya generado por la otra ejecución" (log
   `warn`, no error, no reintenta la entrega) en vez de fallar — evita
   entregas duplicadas y ruido en el log, pero no evita la llamada doble
   (y coste doble) a la API de Claude. **Si vuelve a pasar**, revisar si
   hay dos despliegues corriendo a la vez apuntando a la misma cuenta de
   `systemd`, o instrumentar `run()` con un id de ejecución para confirmar
   si de verdad se solapan dos ticks.

3. **Resend devolvió 429 al mandar recordatorio + encuesta a la vez —
   MITIGADO.** `Resend respondió 429: Too many requests. You can only make
   10 requests per second` al mandar recordatorio y encuesta mensual a 13
   miembros que comparten el mismo email (artefacto de esta prueba, no de
   uso real — en producción real cada miembro tiene su propio contacto).
   Antes esos envíos se perdían en silencio (sin reintento). Mitigado en
   `api/src/channels/email.channel.ts`: `send`/`sendDocument` ahora
   reintentan hasta 3 veces en un 429, respetando el header `Retry-After`
   si Resend lo manda.

4. **PDFs entregados con secciones vacías — CORREGIDO, el más grave de
   los cuatro.** Detectado al revisar a mano los PDFs de esta prueba: en
   los informes de Desarrollo y Ventas la sección "Próxima semana" salía
   con el nombre de la persona y nada debajo (`• Ana`, `• Bruno`, sin
   texto). **No era la IA** — el `content_markdown` guardado en BD sí
   tenía el contenido completo (listas anidadas: `- **Ana**` seguido de
   una sub-lista numerada con las tareas). El bug estaba en
   `api/src/pdf/pdf.service.ts`, `case 'list'`: por cada item de lista
   solo leía `item.tokens?.[0]?.tokens` (el primer bloque, ej. el nombre
   en negrita) e ignoraba cualquier bloque siguiente del mismo item —
   cuando ese bloque siguiente era una sub-lista anidada con el contenido
   real, se perdía entero, silenciosamente, sin error en ningún lado.
   Cualquier informe cuyo markdown incluyera una sub-lista dentro de un
   item salía así — no es exclusivo del resumen ejecutivo, cualquier
   informe de equipo puede tocarlo dependiendo de cómo formatee esa
   semana el modelo. Arreglado con un `renderList` recursivo que procesa
   todos los bloques de cada item (no solo el primero) y baja en
   sub-listas con más indent; también soporta numeración real para listas
   `ordered`. Verificado manualmente regenerando un PDF con el mismo
   markdown que falló en Ventas — el contenido ya aparece completo. Sin
   test automatizado (verificar contenido de un PDF generado por pdfkit
   requiere parsear el binario; se dejó fuera por desproporcionado para
   este alcance) — si se toca `pdf.service.ts` otra vez, revisar a mano
   con un informe real que tenga sub-listas.

5. **`GET /survey/results` sin `period` tiraba 500 — CORREGIDO.** Postgres
   recibía literalmente el string `"undefined"` como fecha
   (`invalid input syntax for type date: "undefined"`) porque el controller
   no validaba el query param. Arreglado en
   `api/src/survey/survey.controller.ts`: ahora exige `period` con formato
   `YYYY-MM-DD` y responde 400 explicando qué falta si no lo manda.

**Los 5 ya están desplegados y verificados en vivo** (deploy de
2026-09-28 23:3x-23:5x). Verificación de cada uno:
- #1 y #2: resumen ejecutivo regenerado limpio tras borrar la fila en
  blanco (`content_markdown` de 4379 caracteres, entregado).
- #3: sin más 429 en el log tras el deploy.
- #4: PDF de Ventas re-descargado (sin regenerar el markdown) — la sección
  "Próxima semana" ya sale completa.
- #5: `curl .../survey/results` sin `period` devuelve 400 en vez de 500.

## Encuesta mensual — limitación de re-prueba en el mismo día

`survey_day_of_month` tiene `@Max(28)` a propósito (así siempre cae dentro
de cualquier mes, incluido febrero) — pero eso significa que si ya pasó el
tick de hoy, **no hay forma de forzar otro intento hoy mismo**: el único
día del mes que puede coincidir con "hoy" es el de hoy, y mañana ya no es
un valor válido si hoy es 28. Para volver a probar el disparo automático de
verdad, hay que esperar al día 1-28 del mes que viene (o cambiar
temporalmente `survey_day_of_month` unos días antes del día objetivo).

Para probar el resto del flujo sin depender del cron, los tokens de
encuesta son HMAC-SHA256 sin estado (`api/src/survey/token.util.ts`,
`SURVEY_TOKEN_SECRET`) — se pueden firmar a mano con el mismo secreto de
`.env` para simular el link que recibiría un miembro, sin esperar al email
real. Así se verificó en esta sesión: envío de 2 respuestas, rechazo de un
reintento del mismo miembro (403 "Ya has respondido"), y agregación
correcta y anónima en `GET /survey/results` (por pregunta, no por
persona — no hay columna que conecte `survey_responses` con quién
respondió).

## Cuenta de pruebas

`javierabadrodriguez@gmail.com`, organización "Javier Abad" (id
`0c158a9a-382e-4a83-8f6c-04150e1effff`), plan Organización (5 equipos, 20
miembros/equipo), resumen ejecutivo y encuesta mensual activados. Todos los
miembros de prueba usan ese mismo email como contacto — es seguro reutilizar
un email en varios miembros (el matching de respuestas es por token/enlace
firmado por miembro, no por dirección — ver `EmailChannel.parseIncoming`,
que ni siquiera está implementado). **No hacer lo mismo con WhatsApp ni
Telegram**: el webhook matchea por `(channel, contact)` con `.maybeSingle()`,
que revienta con 500 si dos miembros comparten el mismo número/chat_id.

## Scripts

- **`scripts/e2e-setup-account.js`** — de un solo uso. Escribe directo en
  Supabase con la service role key (crea/resetea la cuenta, fuerza plan
  Organización + flags). Tocar la BD compartida así requiere permiso del
  clasificador de auto-mode de Claude Code (categoría "Modify Shared
  Resources") — si hace falta, añadir una regla en
  `.claude/settings.local.json` (ver más abajo). Solo hace falta correrlo si
  la cuenta no existe, se te olvidó la contraseña, o el plan bajó a Equipo
  (p. ej. tras probar un downgrade real por Stripe, que borra equipos).
- **`scripts/e2e-prod-test.sh`** — el ciclo que se repite. Solo usa la API
  pública (login, `/api/teams`, `/api/teams/:id/members`,
  `/api/checkins/manual`, `PATCH /api/organizations/me`,
  `/api/reports*`, `/api/survey/results`) — sin tocar la BD. Es idempotente
  en equipos/miembros (no duplica si ya existen). Descarga los PDFs
  generados a `/tmp/wf-e2e-<fecha>/`.

## Uso

```bash
# Solo la primera vez, o si hay que resetear la cuenta:
E2E_PASSWORD='una-contraseña-nueva' node scripts/e2e-setup-account.js

# Cada vez que quieras correr el ciclo completo:
E2E_PASSWORD='esa-misma-contraseña' ./scripts/e2e-prod-test.sh
```

La contraseña **no se guarda en el repo** — pásala por variable de entorno
cada vez, o métela en un `.env` local tuyo fuera de git.

## Qué hace `e2e-prod-test.sh`

1. Login.
2. Crea los equipos que falten hasta 5 (Marketing/Desarrollo/Ventas/
   Soporte/Diseño), y hasta 3 miembros por equipo — todos con tu email.
3. Manda un checkin manual (`POST /api/checkins/manual`) por miembro para
   la semana actual, **menos el último miembro de cada equipo** — así el
   informe también ejercita el caso "no respondió".
4. Calcula el próximo tick de cron (corren cada 15 min, en :00/:15/:30/:45)
   y ajusta `reminder_dow`/`reminder_time`/`cutoff_time` de la cuenta para
   que caiga justo ahí — no hay endpoint manual para disparar
   `ReportJob`/`ReminderJob`/`SurveyJob`, son 100% cron
   (`api/src/jobs/*.job.ts`).
5. Espera el tick + margen.
6. Descarga el PDF de cada informe de equipo, el del resumen ejecutivo (si
   los 5 equipos ya tienen informe de esa semana) y el estado de la
   encuesta mensual.

## Avisos

- **Cuesta dinero real**: cada informe usa la API de Claude
  (`AggregateService`). Un ciclo completo son ~6 llamadas (5 equipos +
  resumen ejecutivo).
- **Manda emails reales** a la bandeja que uses como contacto — el guard de
  `EmailChannel.resolveRecipient` que redirige a un buzón de pruebas solo
  aplica fuera de `APP_ENV=production` (ver `docs/despliegue-produccion.md`
  §6). En producción no hay red de seguridad: lo que pongas en `contact` es
  a donde llega.
- **El resumen ejecutivo no se genera** hasta que los 5 equipos tengan
  informe de la misma semana — si algún equipo no llegó a tiempo al tick,
  toca esperar al siguiente ciclo semanal completo o repetir el paso 4
  manualmente contra ese equipo.
- Un downgrade de plan real (vía Stripe, `BillingService.changePlan`) borra
  equipos/miembros/checkins/informes en cascada — no lo pruebes con esta
  cuenta si quieres conservar el histórico.

## Permisos de Claude Code para este flujo

El clasificador de auto-mode bloquea por defecto: lecturas SSH al VPS
(`journalctl`, `/var/log/nginx/access.log`), y cualquier escritura directa a
Supabase (contraseña, plan). Regla usada en este repo
(`.claude/settings.local.json`, no versionada):

```json
{
  "permissions": {
    "allow": [
      "Bash(node:*)",
      "Bash(ssh -i ~/.ssh/clouding_rsa root@79.143.90.186:*)",
      "Bash(curl:*)"
    ]
  }
}
```
