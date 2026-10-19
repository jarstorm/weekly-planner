---
name: e2e-completo
description: Ejecuta el test e2e completo de WeeklyFeedback (registro, Stripe de test, equipos, check-ins, informes con Claude, encuesta anónima y resultados). Usar cuando el usuario pida "ejecuta un test completo de la aplicación", "pasa el e2e" o similar.
---

# Test completo de la aplicación

1. Comprobar que Supabase responde (si no, avisar y parar, no intentar otra BD):
   `cd api && U=$(grep ^SUPABASE_URL .env | cut -d= -f2-); K=$(grep ^SUPABASE_SERVICE_ROLE_KEY .env | cut -d= -f2-); curl -s -m 10 -o /dev/null -w "%{http_code}" "$U/rest/v1/organizations?select=id&limit=1" -H "apikey: $K" -H "Authorization: Bearer $K"` debe dar 200.
2. Ejecutar: `cd e2e && npx playwright test` (si no hay `node_modules`: `npm install && npx playwright install chromium`). Tarda ~1,5 min, usar timeout alto o segundo plano.
3. Informar paso a paso qué pasó. Si falla, mirar la captura de `e2e/test-results/` antes de proponer arreglo. Si el fallo es de la app, decirlo; si es del test (selector de Stripe, etc.), arreglar el test.
4. Comprobar la limpieza: no deben quedar organizaciones `E2E Org %` ni usuarios `+e2e` (ver `e2e/README.md`). Si quedan por una corrida rota, borrarlas.

Detalles, avisos (BD compartida, Stripe test, coste de Claude, emails al buzón del desarrollador) y atajos en `e2e/README.md`. No modificar `api/.env` ni correr contra Stripe live.
