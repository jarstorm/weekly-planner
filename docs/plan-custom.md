# Plan Custom — qué se puede cambiar y qué no

Referencia rápida para cuando un cliente pide algo fuera de los planes de catálogo (Equipo/Organización). El Plan Custom no pasa por Stripe Checkout — alta gestionada a mano (ver `docs/especificaciones-tecnicas.md`, paso 13 y `docs/mvp-resumen-semanal-equipos.md`, sección 11).

## Se puede ofrecer ya, sin tocar código

Estos campos son enteros libres por organización (`organizations.max_teams` / `organizations.max_members_per_team`), o `NULL` para "sin límite". Se ponen a mano en la base de datos al dar de alta la cuenta:

- **Número de equipos**: cualquier número, o sin límite. Ejemplo: 7 equipos.
- **Personas por equipo**: cualquier número, o sin límite. Ejemplo: 30 personas por equipo.
- **Resumen ejecutivo** (`has_executive_summary`): opción binaria, se activa o no. Ya soporta cualquier número de equipos (el constraint `org_exec_summary_plan_check` en `schema.sql` solo lo bloquea en Plan Equipo, nunca en Organización/Custom).
- **Encuesta mensual anónima** (`has_monthly_survey`): opción binaria, hasta 5 preguntas, un día del mes configurable (`survey_day_of_month`). Igual que el resumen ejecutivo, disponible sin cambios para Custom.
- **Idioma de la cuenta** (`organizations.language`, es/en): preguntas, encuesta e informes en ese idioma.
- **Retención del histórico** (`organizations.history_retention_months`): 1 mes en Equipo, 6 en Organización, `NULL` (sin límite) en Custom. `RetentionJob` borra checkins/informes/respuestas de encuesta más antiguos que ese corte, una vez al día.
- **Precio**: campo libre (`price_month`), a medida — no hay lógica de precio de catálogo para Custom.

**Cómo darlo de alta hoy:** no hay UI de autoservicio para esto. Se hace con una consulta directa a la organización ya creada (o insertando la fila a mano), fijando `plan='custom'`, `max_teams`, `max_members_per_team`, `price_month` y las opciones que aplique. No hay checklist automatizado — es trabajo manual del equipo, no del cliente.

## Decisión de producto: nunca más de una encuesta al mes

El diseño es deliberado — una única encuesta por cuenta, un solo `survey_day_of_month`, un solo set de preguntas (`organizations.survey_questions`). No se ofrece "dos encuestas al mes" ni frecuencias distintas ni aunque un cliente lo pida para Custom — no es un límite técnico a levantar más adelante, es la decisión tomada.

## Necesita desarrollo antes de poder ofrecerlo

- **Resumen ejecutivo con reglas propias** (p. ej. un resumen semanal Y otro mensual, o resumen por departamento en vez de por organización entera): el `ReportJob` solo genera un consolidado por organización y por semana. Cualquier variante de cadencia o de agrupación es desarrollo nuevo.
- **Límites distintos por equipo dentro de la misma cuenta** (p. ej. un equipo con 50 personas y otro con 10): hoy `max_members_per_team` es un único valor por organización, aplica igual a todos sus equipos. Límites por equipo individual requeriría mover ese campo a la tabla `teams`.
- **Canales de respuesta adicionales** (Slack, Microsoft Teams, etc.): el código ya está preparado para añadir conectores sin tocar el resto (`ChannelsService`, sección 3.1 de `especificaciones-tecnicas.md`), pero cada canal nuevo es una integración real, no una opción de configuración.
- **Self-servicio para Custom** (que el cliente configure sus propios límites desde el panel, o pague por Stripe con precio variable): no existe hoy. Todo Custom es alta y cambios gestionados a mano por el equipo.

  **Decisión de producto (2026-09-25): queda fuera del MVP a propósito.** No se va a construir por ahora — el volumen de clientes Custom no lo justifica todavía y la gestión manual es barata mientras sean pocos. Se deja visible en la landing y en `/app/billing` (tarjeta de Plan Custom con CTA de "Contactar") justamente para señalar que la opción existe y es viable de ofrecer, sin comprometer una fecha de autoservicio.

## Antes de prometer algo a un cliente

1. Si el pedido es solo números (equipos/personas/precio) o activar resumen ejecutivo/encuesta/idioma → se puede prometer y entregar el mismo día, es solo configuración.
2. Si el pedido cambia la FORMA del producto (frecuencia de encuesta, agrupación del resumen, límites por equipo, canal nuevo) → es desarrollo, no una llamada de ventas. No prometer fecha sin consultar con quien vaya a construirlo.
