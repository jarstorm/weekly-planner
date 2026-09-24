# Plan Custom — qué se puede cambiar y qué no

Referencia rápida para cuando un cliente pide algo fuera de los planes de catálogo (Equipo/Organización). El Plan Custom no pasa por Stripe Checkout — alta gestionada a mano (ver `docs/especificaciones-tecnicas.md`, paso 13 y `docs/mvp-resumen-semanal-equipos.md`, sección 11).

## Se puede ofrecer ya, sin tocar código

Estos campos son enteros libres por organización (`organizations.max_teams` / `organizations.max_members_per_team`), o `NULL` para "sin límite". Se ponen a mano en la base de datos al dar de alta la cuenta:

- **Número de equipos**: cualquier número, o sin límite. Ejemplo: 7 equipos.
- **Personas por equipo**: cualquier número, o sin límite. Ejemplo: 30 personas por equipo.
- **Resumen ejecutivo** (`has_executive_summary`): opción binaria, se activa o no. Ya soporta cualquier número de equipos (el constraint `org_exec_summary_plan_check` en `schema.sql` solo lo bloquea en Plan Equipo, nunca en Organización/Custom).
- **Encuesta mensual anónima** (`has_monthly_survey`): opción binaria, hasta 5 preguntas, un día del mes configurable (`survey_day_of_month`). Igual que el resumen ejecutivo, disponible sin cambios para Custom.
- **Idioma de la cuenta** (`organizations.language`, es/en): preguntas, encuesta e informes en ese idioma.
- **Precio**: campo libre (`price_month`), a medida — no hay lógica de precio de catálogo para Custom.

**Cómo darlo de alta hoy:** no hay UI de autoservicio para esto. Se hace con una consulta directa a la organización ya creada (o insertando la fila a mano), fijando `plan='custom'`, `max_teams`, `max_members_per_team`, `price_month` y las opciones que aplique. No hay checklist automatizado — es trabajo manual del equipo, no del cliente.

## Necesita desarrollo antes de poder ofrecerlo

- **Más de una encuesta al mes, o distinta frecuencia**: el diseño actual es una única encuesta por cuenta, con un solo `survey_day_of_month` y un solo set de preguntas (`organizations.survey_questions`). Pedir "dos encuestas al mes" o "una encuesta trimestral además de la mensual" no encaja en el modelo — haría falta una tabla de configuraciones de encuesta (varias por cuenta, cada una con su día/frecuencia/preguntas) en vez de columnas sueltas en `organizations`.
- **Resumen ejecutivo con reglas propias** (p. ej. un resumen semanal Y otro mensual, o resumen por departamento en vez de por organización entera): el `ReportJob` solo genera un consolidado por organización y por semana. Cualquier variante de cadencia o de agrupación es desarrollo nuevo.
- **Límites distintos por equipo dentro de la misma cuenta** (p. ej. un equipo con 50 personas y otro con 10): hoy `max_members_per_team` es un único valor por organización, aplica igual a todos sus equipos. Límites por equipo individual requeriría mover ese campo a la tabla `teams`.
- **Canales de respuesta adicionales** (Slack, Microsoft Teams, etc.): el código ya está preparado para añadir conectores sin tocar el resto (`ChannelsService`, sección 3.1 de `especificaciones-tecnicas.md`), pero cada canal nuevo es una integración real, no una opción de configuración.
- **Self-servicio para Custom** (que el cliente configure sus propios límites desde el panel, o pague por Stripe con precio variable): no existe hoy. Todo Custom es alta y cambios gestionados a mano por el equipo.

## Antes de prometer algo a un cliente

1. Si el pedido es solo números (equipos/personas/precio) o activar resumen ejecutivo/encuesta/idioma → se puede prometer y entregar el mismo día, es solo configuración.
2. Si el pedido cambia la FORMA del producto (frecuencia de encuesta, agrupación del resumen, límites por equipo, canal nuevo) → es desarrollo, no una llamada de ventas. No prometer fecha sin consultar con quien vaya a construirlo.
