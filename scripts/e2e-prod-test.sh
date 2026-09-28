#!/bin/bash
# Ciclo de pruebas E2E contra producción (https://weeklyfeedback.com):
# login, crea equipos/miembros (si no existen ya), manda checkins manuales
# de la semana actual, dispara el cron (informes por equipo + resumen
# ejecutivo + encuesta mensual) y descarga los PDFs generados.
#
# Requiere que la cuenta YA esté en plan Organización con resumen ejecutivo
# y encuesta mensual activados — eso es un paso de un solo uso, ver
# scripts/e2e-setup-account.js. Este script es el que se repite.
#
# Uso:
#   E2E_EMAIL=... E2E_PASSWORD=... ./scripts/e2e-prod-test.sh
# (E2E_EMAIL por defecto javierabadrodriguez@gmail.com; E2E_PASSWORD es
# obligatoria, no se guarda en el repo — ver docs/pruebas-produccion.md)
#
# Ver docs/pruebas-produccion.md para explicación completa y avisos de
# seguridad (manda emails reales, cuesta tokens de Claude por informe).

set -euo pipefail

API_BASE="${API_BASE:-https://weeklyfeedback.com/api}"
E2E_EMAIL="${E2E_EMAIL:-javierabadrodriguez@gmail.com}"
if [ -z "${E2E_PASSWORD:-}" ]; then
  echo "ERROR: falta E2E_PASSWORD (no se guarda ninguna contraseña en este repo)." >&2
  echo "  Uso: E2E_PASSWORD=... ./scripts/e2e-prod-test.sh" >&2
  exit 1
fi
TEAM_NAMES=("Marketing" "Desarrollo" "Ventas" "Soporte" "Diseño")
MEMBERS_PER_TEAM=3
OUT_DIR="/tmp/wf-e2e-$(date +%Y%m%d-%H%M%S)"
COOKIES="$(mktemp)"

mkdir -p "$OUT_DIR"
echo "== Resultados en $OUT_DIR =="

echo "== 1. Login =="
curl -sS -c "$COOKIES" -X POST "$API_BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$E2E_EMAIL\",\"password\":\"$E2E_PASSWORD\"}" | tee "$OUT_DIR/login.json"
echo

ORG=$(curl -sS -b "$COOKIES" "$API_BASE/organizations/me")
echo "$ORG" > "$OUT_DIR/org.json"
PLAN=$(echo "$ORG" | python3 -c 'import json,sys; print(json.load(sys.stdin)["plan"])')
if [ "$PLAN" != "organizacion" ]; then
  echo "ERROR: la cuenta no está en plan organizacion (está en '$PLAN'). Corre scripts/e2e-setup-account.js primero." >&2
  exit 1
fi
TIMEZONE=$(echo "$ORG" | python3 -c 'import json,sys; print(json.load(sys.stdin)["timezone"])')

echo "== 2. Equipos (creando los que falten hasta 5) =="
EXISTING_TEAMS=$(curl -sS -b "$COOKIES" "$API_BASE/teams")
echo "$EXISTING_TEAMS" > "$OUT_DIR/teams_before.json"
EXISTING_COUNT=$(echo "$EXISTING_TEAMS" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')

TEAM_IDS=()
for name in "${TEAM_NAMES[@]}"; do
  if [ "$EXISTING_COUNT" -ge 5 ]; then break; fi
  existing_id=$(echo "$EXISTING_TEAMS" | python3 -c "
import json, sys
teams = json.load(sys.stdin)
match = [t['id'] for t in teams if t['name'] == '$name']
print(match[0] if match else '')
")
  if [ -n "$existing_id" ]; then
    TEAM_IDS+=("$existing_id")
    continue
  fi
  created=$(curl -sS -b "$COOKIES" -X POST "$API_BASE/teams" \
    -H 'Content-Type: application/json' \
    -d "{\"name\": \"$name\", \"report_recipients\": [\"$E2E_EMAIL\"]}")
  new_id=$(echo "$created" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))')
  if [ -z "$new_id" ]; then
    echo "  (no se pudo crear '$name', probablemente ya en el límite de plan): $created"
    continue
  fi
  TEAM_IDS+=("$new_id")
  EXISTING_COUNT=$((EXISTING_COUNT + 1))
  echo "  creado '$name' -> $new_id"
done

echo "== 3. Miembros por equipo (hasta $MEMBERS_PER_TEAM por equipo) =="
declare -A TEAM_MEMBER_IDS
for tid in "${TEAM_IDS[@]}"; do
  existing_members=$(curl -sS -b "$COOKIES" "$API_BASE/teams/$tid/members")
  existing_member_count=$(echo "$existing_members" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')
  member_ids=$(echo "$existing_members" | python3 -c 'import json,sys; print(",".join(m["id"] for m in json.load(sys.stdin)))')
  for i in $(seq 1 $MEMBERS_PER_TEAM); do
    if [ "$existing_member_count" -ge "$MEMBERS_PER_TEAM" ]; then break; fi
    created=$(curl -sS -b "$COOKIES" -X POST "$API_BASE/teams/$tid/members" \
      -H 'Content-Type: application/json' \
      -d "{\"name\": \"Miembro $i\", \"channel\": \"email\", \"contact\": \"$E2E_EMAIL\"}")
    new_id=$(echo "$created" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))')
    [ -n "$new_id" ] && member_ids="$member_ids,$new_id"
    existing_member_count=$((existing_member_count + 1))
  done
  TEAM_MEMBER_IDS["$tid"]="$member_ids"
done

echo "== 4. Checkins manuales de la semana actual (dejo al último miembro de cada equipo sin responder, para probar 'no respondió') =="
WEEK_START=$(python3 -c "
import datetime
today = datetime.date.today()
monday = today - datetime.timedelta(days=today.weekday())
print(monday.isoformat())
")
echo "week_start=$WEEK_START"
for tid in "${TEAM_IDS[@]}"; do
  IFS=',' read -ra mids <<< "${TEAM_MEMBER_IDS[$tid]}"
  count=${#mids[@]}
  for ((i=0; i<count-1; i++)); do
    mid="${mids[$i]}"
    [ -z "$mid" ] && continue
    curl -sS -b "$COOKIES" -X POST "$API_BASE/checkins/manual" \
      -H 'Content-Type: application/json' \
      -d "{\"team_id\":\"$tid\",\"member_id\":\"$mid\",\"week_start\":\"$WEEK_START\",\"done_text\":\"Tarea de prueba completada\",\"next_text\":\"Siguiente tarea de prueba\",\"blocker_text\":\"Ninguno\"}" > /dev/null
  done
done
echo "  checkins enviados"

echo "== 5. Ajusto reminder_dow/reminder_time/cutoff_time al próximo tick de cron (corre cada 15 min) =="
NEXT_TICK_INFO=$(TZ="$TIMEZONE" python3 -c "
import datetime
now = datetime.datetime.now()
total_min = now.hour * 60 + now.minute
next_tick_min = (total_min // 15 + 1) * 15
midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
tick = midnight + datetime.timedelta(minutes=next_tick_min)
dow = (tick.weekday() + 1) % 7  # 0=domingo, como dowInTimezone
print(dow)
print((tick + datetime.timedelta(minutes=1)).strftime('%H:%M'))
print((tick + datetime.timedelta(minutes=4)).strftime('%H:%M'))
print(tick.strftime('%H:%M:%S'))
")
DOW=$(echo "$NEXT_TICK_INFO" | sed -n 1p)
REMINDER_TIME=$(echo "$NEXT_TICK_INFO" | sed -n 2p)
CUTOFF_TIME=$(echo "$NEXT_TICK_INFO" | sed -n 3p)
TICK_CLOCK=$(echo "$NEXT_TICK_INFO" | sed -n 4p)
echo "  próximo tick: $TICK_CLOCK ($TIMEZONE), dow=$DOW, reminder_time=$REMINDER_TIME, cutoff_time=$CUTOFF_TIME"

curl -sS -b "$COOKIES" -X PATCH "$API_BASE/organizations/me" \
  -H 'Content-Type: application/json' \
  -d "{\"reminder_dow\": $DOW, \"reminder_time\": \"$REMINDER_TIME\", \"cutoff_time\": \"$CUTOFF_TIME\", \"survey_day_of_month\": $(TZ="$TIMEZONE" date +%-d)}" > "$OUT_DIR/org_scheduled.json"

echo "== 6. Esperando el tick de cron ($TICK_CLOCK $TIMEZONE + margen)... =="
until [ "$(TZ="$TIMEZONE" date +%H%M)" -ge "$(echo "$TICK_CLOCK" | tr -d ':' | cut -c1-4)" ]; do sleep 5; done
sleep 90  # margen para que el job termine de generar y mandar los PDFs

echo "== 7. Informes generados =="
for tid in "${TEAM_IDS[@]}"; do
  reports=$(curl -sS -b "$COOKIES" "$API_BASE/reports?teamId=$tid")
  echo "$reports" > "$OUT_DIR/reports_${tid}.json"
  latest_id=$(echo "$reports" | python3 -c "
import json, sys
r = json.load(sys.stdin)
print(r[0]['id'] if r else '')
")
  if [ -n "$latest_id" ]; then
    curl -sS -b "$COOKIES" "$API_BASE/reports/$latest_id/pdf" -o "$OUT_DIR/report_team_${tid}.pdf"
    echo "  equipo $tid -> $OUT_DIR/report_team_${tid}.pdf"
  else
    echo "  equipo $tid -> sin informe todavía (puede necesitar otro tick)"
  fi
done

exec_summary=$(curl -sS -b "$COOKIES" "$API_BASE/reports/executive-summary")
echo "$exec_summary" > "$OUT_DIR/executive_summary.json"
exec_id=$(echo "$exec_summary" | python3 -c "
import json, sys
r = json.load(sys.stdin)
print(r[0]['id'] if r else '')
")
if [ -n "$exec_id" ]; then
  curl -sS -b "$COOKIES" "$API_BASE/reports/$exec_id/pdf" -o "$OUT_DIR/executive_summary.pdf"
  echo "  resumen ejecutivo -> $OUT_DIR/executive_summary.pdf"
else
  echo "  resumen ejecutivo -> no generado (necesita informe de los 5 equipos en la misma semana)"
fi

echo "== 8. Encuesta mensual =="
curl -sS -b "$COOKIES" "$API_BASE/survey/results" > "$OUT_DIR/survey_results.json"
cat "$OUT_DIR/survey_results.json"
echo

rm -f "$COOKIES"
echo
echo "== Listo. Todo en $OUT_DIR =="
