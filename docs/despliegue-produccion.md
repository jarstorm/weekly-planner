# Arquitectura del servidor de producción

Estado: **desplegado y verificado en vivo (2026-09-27)**, sirviendo por IP sin dominio ni TLS todavía (ver sección "Lo que falta" al final).

## 1. Infraestructura

- **Proveedor:** Clouding.io (VPS/IaaS, no serverless).
- **Servidor:** `weekly-feedback-prod`, Ubuntu 24.04 LTS, 1GB RAM / 0.5 vCore / 5GB SSD NVMe — el plan más barato (~3€/mes), elegido a propósito para probar si alcanza antes de escalar.
- **IP pública:** `79.143.90.186` (fija mientras el servidor exista; sobrevive a un "Reinstalar").
- **Acceso SSH:** usuario `root` con llave RSA propia (`~/.ssh/clouding_rsa` en el Mac de Javier) — la llave "default" que genera Clouding automáticamente no es utilizable (su privada no es descargable después de la creación inicial), y el panel de Clouding **solo acepta llaves RSA subidas a mano**, rechaza ed25519 con el mensaje "El formato de la llave SSH pública debe ser: ssh-rsa key [comment]".
- **Firewall:** dos capas independientes, hay que abrir puertos en **ambas** o el tráfico no llega:
  1. `ufw` (a nivel de SO, dentro de la VPS): `22` (SSH), `80`, `443`, `8081` (analytics, ver sección 6) abiertos.
  2. **Firewall de plataforma de Clouding** ("Mis Firewalls" → perfil `default`, asignado al servidor) — capa aparte a nivel de red/hypervisor, con sus propias reglas por puerto/protocolo/IP de origen. Tiene un perfil de reglas típico de hosting genérico (FTP, IMAP, RDP, paneles de control...) que no usamos; solo `80`/`443` venían abiertos de fábrica, `8081` se añadió a mano. *Descubierto en vivo:* GoatCounter respondía en local (`curl 127.0.0.1:8081`) pero no desde fuera pese a `ufw` correcto — la causa era este firewall de plataforma, no el del SO.

## 2. Qué corre en el servidor

Dos procesos Node.js propios + nginx de reverse proxy, todo bajo `systemd` (no Docker, no PM2 — innecesario para este tamaño):

```
Internet ──80──> nginx ──┬──> /health, /api/*  ──> 127.0.0.1:3001  (wf-api,  backend NestJS)
                          └──> todo lo demás     ──> 127.0.0.1:3000  (wf-web,  frontend Next.js)
```

- **`wf-api.service`** — backend NestJS compilado (`node dist/main.js`), puerto 3001, usuario `deploy`. Variables de entorno vía `EnvironmentFile=/opt/weeklyfeedback/api/.env`.
- **`wf-web.service`** — frontend Next.js en modo `output: 'standalone'` (`node server.js`), puerto 3000, usuario `deploy`. `PORT=3000` y `NODE_ENV=production` fijados en la unit.
- **`nginx`** — reverse proxy en el puerto 80, sirve también los estáticos de Next directamente desde disco (`/opt/weeklyfeedback/web/.next/static/`, sin pasar por el proceso Node — más rápido y menos carga).

Las tres unidades tienen `Restart=always` y están `enabled` (arrancan solas si la VPS se reinicia).

### Por qué Node 22 y no Node 20

`@supabase/supabase-js` (usado por el backend) necesita `WebSocket` nativo del runtime para su cliente de Realtime, disponible recién desde Node 22. Con Node 20 el backend crasheaba en el arranque (`Error: Node.js detected but native WebSocket not found`). Instalado vía NodeSource (`setup_22.x`).

### Por qué `output: 'standalone'` en Next.js

Con 1GB de RAM, correr `npm install` + `next build` completo en la propia VPS es arriesgado (build de Next es memory-hungry). En su lugar:

1. El build de producción del frontend se hace **en local** (Mac de desarrollo), con `NEXT_PUBLIC_API_BASE_URL` apuntando a la IP pública del servidor.
2. `output: 'standalone'` (en `web/next.config.mjs`) genera un `server.js` autocontenido con solo los `node_modules` que realmente usa (tree-shaken), en `.next/standalone/`.
3. Se copia ese standalone + `.next/static/` + `public/` al servidor por `rsync` — sin `npm install` en la VPS para el frontend.

El backend sí necesita un `npm ci --omit=dev` en el servidor (el build de NestJS con `tsc` se hace en local, pero los `node_modules` de producción se instalan en la VPS — es liviano, no requiere compilar nada).

## 3. Rutas de nginx

Config real en `/etc/nginx/sites-available/weeklyfeedback` (symlink en `sites-enabled`):

| Ruta | Destino | Motivo |
|---|---|---|
| `/health` | `127.0.0.1:3001` | El backend excluye `health` del prefijo global `/api` (`app.setGlobalPrefix('api', { exclude: ['health'] })`), así que vive en la raíz. |
| `/api/*` | `127.0.0.1:3001` | Todo lo demás del backend (auth, teams, checkins, webhooks de WhatsApp/Telegram/Stripe...) ya lleva el prefijo `/api` de fábrica. |
| `/_next/static/*` | Archivo directo en disco | Next standalone no sirve sus propios estáticos de forma óptima; nginx los sirve directo con cache de 365 días. |
| `/*` (resto) | `127.0.0.1:3000` | Frontend Next.js (SSR/páginas). |

## 4. Cómo desplegar una actualización

No hay CI/CD todavía — el proceso es manual, desde el Mac de desarrollo:

```bash
# 1. Build local del frontend (con la URL de producción del backend)
cd web
NEXT_PUBLIC_API_BASE_URL=http://79.143.90.186/api npm run build

# 2. Build local del backend
cd ../api
npm run build

# 3. Subir artefactos (no node_modules del frontend, standalone ya los trae)
rsync -az -e "ssh -i ~/.ssh/clouding_rsa" web/.next/standalone/ root@79.143.90.186:/opt/weeklyfeedback/web/
rsync -az -e "ssh -i ~/.ssh/clouding_rsa" web/.next/static/ root@79.143.90.186:/opt/weeklyfeedback/web/.next/static/
rsync -az -e "ssh -i ~/.ssh/clouding_rsa" web/public/ root@79.143.90.186:/opt/weeklyfeedback/web/public/
rsync -az -e "ssh -i ~/.ssh/clouding_rsa" api/dist/ root@79.143.90.186:/opt/weeklyfeedback/api/dist/

# 4. Si cambiaron dependencias del backend, reinstalar en el servidor
ssh -i ~/.ssh/clouding_rsa root@79.143.90.186 \
  "sudo -u deploy bash -c 'cd /opt/weeklyfeedback/api && npm ci --omit=dev'"

# 5. Reiniciar servicios
ssh -i ~/.ssh/clouding_rsa root@79.143.90.186 "systemctl restart wf-api wf-web"
```

Ver logs en vivo: `ssh ... "journalctl -u wf-api -f"` (o `wf-web`).

## 5. Analytics: GoatCounter (self-hosted)

Decisión (ver `especificaciones-tecnicas.md`, sección 6): nada de Google Analytics — exige banner de consentimiento GDPR por sus cookies no esenciales. GoatCounter no usa cookies, así que no hace falta banner.

- **Por qué GoatCounter y no Plausible:** Plausible CE (la opción self-host oficial) corre sobre Docker + Postgres + **ClickHouse**, que recomienda mínimo 2GB RAM — inviable junto al resto en esta VPS de 1GB. GoatCounter es un único binario Go con SQLite embebido, sin Docker, sin base de datos aparte: ~38MB de RAM en reposo.
- **Instalación:** binario en `/usr/local/bin/goatcounter` (descargado de GitHub releases, sin compilar), corre como usuario propio `goatcounter` (sin privilegios), base de datos SQLite en `/opt/goatcounter/db/goatcounter.sqlite3`.
- **Servicio:** `goatcounter.service` (systemd), escucha en `127.0.0.1:8082`.
- **Exposición:** GoatCounter enruta internamente por el header `Host` (vhost), no por path de URL — no se puede colgar de un subpath de nginx en el mismo puerto 80 que ya usan frontend/backend (todos compartirían el mismo `Host: 79.143.90.186`, sin forma de diferenciar). Solución: puerto propio. Nginx tiene un `server` aparte escuchando en `8081` que hace de proxy a `127.0.0.1:8082`; el sitio en GoatCounter está dado de alta con `-vhost 79.143.90.186` (sin puerto — GoatCounter valida que el vhost sea un dominio válido y rechaza el `:8081` con un error explícito, pero igual matchea bien porque compara el `Host` sin el puerto).
- **Dashboard:** `http://79.143.90.186:8081/` — login con el email `javierabadrodriguez@gmail.com` y la contraseña generada en el momento de crear el sitio (visible en el historial de esta sesión; cambiarla desde el propio dashboard tras el primer login, GoatCounter no tiene flujo de "olvidé mi contraseña" por email configurado).
- **Tracking en la web:** `web/src/app/[locale]/layout.tsx` carga el script (`next/script`, `strategy="afterInteractive"`) solo si `NEXT_PUBLIC_GOATCOUNTER_URL` está seteada en build time — en local dev queda desactivado. En producción se builda con `NEXT_PUBLIC_GOATCOUNTER_URL=http://79.143.90.186:8081`.
- **Cuando haya dominio:** dar de alta un site nuevo en GoatCounter con `-vhost stats.tudominio.com` (o el que sea), certbot para TLS en ese vhost también, y reconstruir la web con la nueva URL.

## 6. Lo que falta (conocido, no bloqueante para probar)

- **Sin dominio ni TLS.** Se sirve por HTTP plano sobre la IP. Efecto real: la cookie de sesión (`wf_session`) se marca `Secure` cuando `NODE_ENV=production` (`api/src/auth/auth.controller.ts:46`) — por eso **`wf-api.service` deliberadamente NO tiene `NODE_ENV=production`** todavía, para que la cookie no lleve `Secure` y el login funcione sobre HTTP. En cuanto haya dominio + Let's Encrypt, hay que añadir `Environment=NODE_ENV=production` a `wf-api.service` para que la cookie vuelva a ser `Secure` como corresponde en HTTPS real.
- **Certificado TLS** — pendiente de dominio (ver checklist de producción en `especificaciones-tecnicas.md`, sección 6). Con dominio: `certbot --nginx`.
- **Webhook de WhatsApp roto (2026-09-28).** Apuntaba al túnel de `cloudflared` de las pruebas (sección 0.2 de `especificaciones-tecnicas.md`), que era efímero y se cayó al cerrarse la terminal donde corría. *Intentado y confirmado que no sirve:* re-apuntar el webhook a `http://79.143.90.186/api/webhooks/whatsapp` (HTTP plano) — Meta lo rechaza en la verificación ("No se ha podido validar la URL de devolución de llamada", `#N/A:WBxP--1243469951-1566723421`) porque **exige HTTPS con certificado válido**, no acepta HTTP ni certificados autofirmados. Sin dominio no hay Let's Encrypt, así que esto no tiene arreglo hasta comprar uno. Verificado con `GET /{waba-id}/phone_numbers?fields=webhook_configuration` que Meta se quedó con la config anterior (el intento fallido no sobrescribió nada) — sigue apuntando al túnel muerto, o sea el canal WhatsApp no recibe nada en este momento. El resto de la app (web, backend, analytics) no depende de esto y sigue funcionando normal.
- **Webhook de Stripe** — el `STRIPE_WEBHOOK_SECRET` en `/opt/weeklyfeedback/api/.env` es el de `stripe listen` (desarrollo local), no uno real apuntando a este servidor. Sin resolver todavía.
- **Disco ajustado** — 5GB total, ~61% usado ya solo con el sistema + las dos apps. Vigilar si crece (logs, más dependencias).
- **RAM ajustada** — 1GB total, ~340MB en uso con los tres servicios (api + web + goatcounter) corriendo en reposo. Sin margen para picos grandes (muchos checkins/informes a la vez); si se nota lento, subir a más vCores/RAM en el mismo panel de Clouding (redimensionar, no hace falta recrear el servidor).
- **Sin backups activados** (se desactivaron al crear el servidor para abaratar costo).
