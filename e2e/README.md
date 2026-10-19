# Test e2e completo

Un solo test de Playwright (`tests/full-flow.spec.ts`) que recorre la aplicación entera, de cero:

1. Registro de organización y verificación de email.
2. Login y plan Organización con Stripe Checkout (tarjeta de test 4242).
3. Alta de 2 equipos y 4 miembros.
4. Planificar el feedback (recordatorio, corte, resumen ejecutivo).
5. Recordatorio (job) y respuestas semanales por el formulario público (3 de 4).
6. Informes de equipo y resumen ejecutivo con Claude, y descarga de PDF.
7. Encuesta anónima: crear, enviar (job), responder (2 de 4), comprobar que no se repite y ver resultados.

Al terminar borra la organización, el usuario y el customer/suscripción de Stripe. `E2E_KEEP=1` los conserva.

## Ejecutar

```bash
cd e2e
npm install                      # solo la primera vez
npx playwright install chromium  # solo la primera vez
npm test                         # HEADED=1 npm test para ver el navegador
```

Tarda ~1,5 min. Levanta el backend (`api/dist`, lo compila antes) y el frontend si no están ya corriendo.

## Qué toca (leer antes de lanzar)

- **Supabase:** usa `api/.env`, o sea la misma BD que el resto. Crea y borra una cuenta `javierabadrodriguez+e2e<timestamp>@gmail.com`. Si la corrida muere a medias pueden quedar datos: buscar organizaciones `E2E Org %`.
- **Stripe:** solo claves `sk_test_`. `global-setup.ts` aborta si no, o si `APP_ENV=production`.
- **Claude:** 3 llamadas por corrida (2 informes de equipo y el resumen ejecutivo).
- **Emails:** con `EMAIL_DEV_OVERRIDE_TO` todo llega al buzón del desarrollador. El test no lee emails: firma los enlaces (verificación, check-in, encuesta) con el código del backend.

## Atajos conscientes

- **Webhook de Stripe:** el backend local no recibe webhooks reales. El test lee la sesión de Checkout real ya pagada y manda `checkout.session.completed` firmado con `STRIPE_WEBHOOK_SECRET` (`helpers/backend.ts`).
- **Jobs:** `helpers/run-job.cjs` ejecuta una vez ReminderJob, ReportJob o SurveyJob en vez de esperar al cron.
- **Fecha de la encuesta:** la UI solo admite fechas futuras; el test la pasa a ayer en BD para que el job la mande ya.
- **Resumen ejecutivo:** solo se genera con 2 o más equipos, por eso el test crea dos.

## Si falla

Playwright guarda captura y trace en `e2e/test-results/`. Los fallos típicos son selectores de Stripe Checkout (cambian de vez en cuando, ver `fillStripeCheckout`) y Supabase caído.
