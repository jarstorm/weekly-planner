# Especificación de producto — MVP
## "El resumen semanal que se escribe solo"
### SaaS de resúmenes de progreso semanal para equipos, en español, por WhatsApp o Slack

---

## 1. Resumen ejecutivo

Un SaaS que cada semana pregunta a cada miembro de un equipo tres cosas cortas (qué hizo, qué hará, si tiene algún bloqueo) por el canal que ya usan a diario — WhatsApp o Slack — y devuelve un informe único, legible y en español, listo para leer en 30 segundos por quien dirige el equipo. Precio plano por equipo, no por persona.

**Por qué ahora:** la categoría de "resúmenes de standup con IA" existe y está bastante madura en inglés (Geekbot, Standuply, Spinach, StandIn, ZeroStandup), pero casi todos cobran por asiento y ninguno está pensado para el mercado hispanohablante ni para equipos que no viven dentro de Slack — que es la mayoría de las pymes en España. Ese es el hueco: no la idea, sino a quién y cómo se la vendes.

---

## 2. El problema

Cualquier responsable de equipo (de 3 a 20 personas) necesita saber semanalmente qué ha avanzado cada persona, sin tener que perseguir a nadie ni leer diez hilos de Slack sueltos. Hoy esto se resuelve de tres formas, todas malas:

- **Reunión semanal de status** — consume 30-60 minutos de todo el equipo para algo que se podría leer en un informe.
- **"Que cada uno escriba su update" en un canal** — nadie lo hace a tiempo, y el jefe tiene que leer y resumir 8 mensajes sueltos y mal escritos.
- **Herramientas de standup async existentes** — funcionan, pero están en inglés, cobran por asiento (a partir de ~5-8 $/usuario/mes, lo que en un equipo de 15 personas son 75-120 $/mes), y no encajan con equipos que trabajan por WhatsApp en vez de Slack.

---

## 3. La solución

Un bot que:

1. Pregunta a cada persona, una vez por semana, tres cosas cortas por el canal que ya usa.
2. Con las respuestas de todo el equipo, genera **un único informe narrativo** (no una lista pegada de respuestas) agrupado por proyecto, con logros, bloqueos destacados y prioridades de la semana siguiente.
3. Lo entrega automáticamente donde se necesita (canal del equipo, email al responsable) y lo guarda en un histórico donde se pueden ver patrones — por ejemplo, un bloqueo que lleva tres semanas repitiéndose.

**Propuesta de valor en una frase:** *"El informe semanal que tu equipo ya no tiene que escribir, y que tú ya no tienes que resumir."*

---

## 4. Público objetivo (ICP)

- Equipos de **5 a 20 personas**, dentro de pymes, startups, agencias o consultoras en España y LatAm.
- Responsable de equipo, founder o project manager que hoy pide el status "a mano" (por WhatsApp, por Slack, o en una reunión).
- Especialmente equipos que **no usan Slack** (agencias de marketing, estudios de diseño, consultoras, equipos de campo) y que hoy no tienen ninguna herramienta de este tipo a su alcance porque todo lo que existe asume Slack + inglés + precio por asiento.
- Segundo público, más adelante: equipos técnicos (dev) que sí usan Slack, donde ya hay competencia pero el precio plano y el idioma siguen siendo argumento.

---

## 5. Panorama competitivo (resumen)

| Herramienta | Canal | Precio | Idioma | Debilidad que aprovechamos |
|---|---|---|---|---|
| Geekbot | Slack/Teams | Por asiento (~$2,5-4/usuario/mes) | Inglés | No hay versión en español, no soporta WhatsApp |
| Standuply | Slack | Por asiento | Inglés | Igual, orientado a equipos dev |
| Spinach | Slack/Zoom | Por asiento, foco en reuniones | Inglés | Pensado para daily meetings, no para resumen semanal simple |
| StandIn / ZeroStandup | Slack | Por asiento | Inglés | Nicho técnico (ingeniería), complejo de configurar |
| Nada relevante | WhatsApp | — | — | **Canal completamente desatendido** |

Nuestra cuña: español nativo + WhatsApp como canal de entrada + precio plano por equipo.

---

## 6. Cómo funciona — flujo detallado

### 6.1 Onboarding (una vez)

1. El responsable se registra en la web con email + nombre del equipo.
2. Añade a los miembros del equipo (nombre + número de WhatsApp o email de Slack).
3. Elige el día y la hora del recordatorio semanal (por defecto: viernes 10:00).
4. Elige dónde quiere recibir el informe final (el mismo canal, un canal de Slack distinto, o por email).
5. Opcional: pega 2-3 líneas de contexto de la empresa/objetivos del trimestre, para que el resumen no sea genérico ("estamos lanzando la v2 del producto en octubre").

### 6.2 Ciclo semanal (automático)

**Día D, hora H (ej. viernes 10:00)** — el sistema manda a cada miembro un mensaje:

> Hola Marta 👋 Resumen semanal de Studio Creativo.
> 1️⃣ ¿Qué has hecho esta semana?
> 2️⃣ ¿Qué harás la semana que viene?
> 3️⃣ ¿Algo bloqueado o que necesites de alguien?
> Contesta con un mensaje de voz o texto, lo que te sea más rápido.

**Recogida de respuestas** — cada persona contesta en texto libre (o nota de voz, transcrita automáticamente). No hay formulario que rellenar, es una conversación normal de WhatsApp/Slack.

**Hora de corte (ej. viernes 13:00)** — el sistema recoge todas las respuestas recibidas hasta ese momento. Si a alguien le falta por responder, se incluye igualmente el informe con una nota ("Pendiente de Marta").

**Generación del informe** — se llama a la IA con todas las respuestas + el contexto de empresa guardado en el onboarding, y se genera un informe estructurado (ver ejemplo en el punto 9).

**Entrega** — el informe se publica automáticamente en el canal elegido, con buen formato (títulos, negritas, emojis moderados si es WhatsApp).

**Histórico** — el informe queda guardado en el panel web, con buscador y con detección simple de bloqueos recurrentes (si la misma palabra clave de bloqueo aparece 2+ semanas seguidas, se resalta).

### 6.3 Ejemplo de informe generado

> **📋 Resumen semanal — Studio Creativo — 12-18 sept 2026**
>
> **Logros de la semana**
> - Cerrado el diseño final de la campaña de Cliente X (Marta, Iván)
> - Entregado el informe de resultados de octubre a Cliente Y (Laura)
> - Avanzada un 70% la propuesta para el nuevo cliente Z (Iván)
>
> **⚠️ Bloqueos**
> - Marta lleva 2 semanas esperando feedback del cliente X para poder avanzar con la siguiente fase — recurrente, conviene escalarlo.
>
> **Próxima semana**
> - Presentación final a Cliente X (Marta)
> - Empezar producción de contenido para Cliente Y (Laura, Iván)
>
> **Sin respuesta:** Diego.

### 6.4 Empresas con varios equipos (organizaciones) y el resumen ejecutivo

Una empresa de 20 personas casi nunca es "un equipo de 20" — normalmente son 4-5 equipos reales (marketing, desarrollo, ventas, soporte...), cada uno con su propio ritmo y sus propios bloqueos. Meter a los 20 en el mismo check-in produce un informe ilegible; la solución es que cada equipo tenga su propio ciclo independiente, y por encima se pueda generar un segundo informe que junta lo importante de todos: el **resumen ejecutivo** (también llamado informe consolidado).

El resumen ejecutivo es una **opción**, no algo que venga forzado por el plan: está disponible para Plan Organización y Plan Custom (nunca para Plan Equipo, que al tener un único equipo no tiene nada que consolidar), pero cada cuenta decide si lo activa. Una empresa con 2 equipos en Plan Organización puede perfectamente no querer todavía un resumen a nivel empresa y quedarse solo con los informes de cada equipo.

**Cómo funciona cuando está activado:**
1. Se crea una organización (la empresa) y, dentro, un equipo por departamento — cada uno con sus propios miembros, su propio recordatorio y su propio informe semanal, exactamente como en el flujo de un solo equipo.
2. Todos los equipos de una misma organización comparten el mismo día y la misma hora de corte (aunque cada uno tenga sus propias personas) — así el sistema sabe cuándo ya están todos los informes de equipo listos para hacer el resumen conjunto.
3. En cuanto el último equipo llega a su hora de corte, se genera el **resumen ejecutivo**: no repite el detalle de cada equipo (para eso está su informe individual), sino que saca un titular por equipo, señala si hay un bloqueo que cruza varios equipos, y las 2-3 cosas más urgentes de la semana a nivel empresa.
4. El resumen ejecutivo llega a quien dirige la empresa; los informes de equipo siguen llegando a cada responsable de equipo como siempre — nadie deja de recibir el suyo.

Si la cuenta no tiene activado el resumen ejecutivo (o está en Plan Equipo), el paso 3 simplemente no ocurre — cada equipo sigue recibiendo su informe individual con normalidad.

**Ejemplo de informe consolidado:**

> **🏢 Resumen semanal — Acme Estudio — 12-18 sept 2026**
>
> - **Marketing:** campaña de Cliente X cerrada, a la espera de feedback (bloqueo recurrente, 2ª semana).
> - **Desarrollo:** v2 del producto al 70%, sin bloqueos.
> - **Ventas:** 3 propuestas nuevas enviadas, 1 cerrada.
> - **Soporte:** semana tranquila, sin incidencias relevantes.
>
> **⚠️ Riesgo que cruza equipos:** el bloqueo de Marketing con Cliente X puede afectar también a la fecha de entrega que Desarrollo tiene comprometida con el mismo cliente — vale la pena juntarlos.
>
> **Lo más urgente esta semana:** desbloquear feedback de Cliente X (Marketing) y cerrar la propuesta en curso (Ventas).

Técnicamente esto es una segunda llamada a la IA, con los informes de equipo ya generados (no los check-ins en bruto) como entrada — más barato todavía que la primera agregación, porque el texto de partida ya viene resumido.

---

## 7. Alcance del MVP

**Dentro del MVP (v0):**
- Canal de entrada: WhatsApp (vía API oficial) como prioridad; email como alternativa simple desde el día uno.
- Preguntas fijas (las 3 del ejemplo), sin personalización todavía.
- Agregación con IA en español, tono profesional-cercano.
- Entrega por WhatsApp/email; panel web mínimo con histórico de informes.
- Gestión básica de equipo (añadir/quitar personas).
- Los 3 planes (Equipo / Organización / Custom) con sus límites de equipos y personas — es barato de construir desde el principio y evita el problema de migrar clientes existentes más adelante. El **resumen ejecutivo en sí** (el job que genera el consolidado) ya está construido (ver paso 15 de `docs/especificaciones-tecnicas.md`), adelantado respecto al plan original — pendiente de verificar en vivo contra una organización real con varios equipos.

**Fuera del MVP (v1.5 / v2):**
- Integración con Slack (se añade en cuanto haya 3-5 clientes validados que lo pidan).
- Integraciones "pull" con GitHub, Trello, Jira, Asana (enriquecimiento automático sin que nadie escriba nada).
- Personalización de las preguntas por equipo.
- Detección de sentimiento / alertas automáticas al responsable si hay un bloqueo grave.
- Multi-idioma (catalán, inglés, portugués) para abrir mercado — **el frontend ya tiene ES/EN** (se adelantó fuera de este orden porque se pidió durante el desarrollo, no por demanda real; ver `docs/especificaciones-tecnicas.md`, sección 3.2). El contenido generado por IA (el informe en sí) sigue siendo solo en español — traducirlo también es lo que queda pendiente de este punto.
- Analítica de tendencias más avanzada (velocidad del equipo, comparativa entre semanas).

---

## 8. Arquitectura técnica

**Frontend (panel web):** Next.js (React). Solo necesita: login, configuración de equipo, vista de histórico de informes. No hace falta nada vistoso todavía — funcional y claro.

**Backend:** Node.js (Express o Fastify) o Python (FastAPI) — lo que te resulte más cómodo, ninguna de las dos añade complejidad real a este proyecto.

**Base de datos y auth:** Supabase (Postgres + Auth + cron jobs vía `pg_cron` o Edge Functions programadas). Evita montar infraestructura propia para algo que en el MVP no necesita escalar. El frontend no habla directo con Supabase — todo pasa por el backend, incluida la autenticación (ver `docs/especificaciones-tecnicas.md`, sección 0.1).

**Canal WhatsApp:** WhatsApp Cloud API de Meta (directa) o un proveedor (BSP) como 360dialog, Twilio o WATI para simplificar el alta. Requiere verificar la empresa en Meta Business Manager y un número de teléfono dedicado. El coste es por mensaje y depende de la categoría (servicio/utilidad/marketing) y el país del destinatario — para un recordatorio semanal y su respuesta (mensajes de tipo "utilidad" dentro de la ventana de conversación de 24h) el coste por equipo y semana es mínimo, pero conviene confirmar la tarifa vigente en el momento de lanzar, porque Meta las revisa con frecuencia.

**Canal email (fallback/alternativa):** Resend o Postmark — trivial de integrar, sirve como plan B mientras se tramita la verificación de WhatsApp Business, que puede tardar unos días.

**IA:** API de Claude para la agregación semanal. Una sola llamada por equipo y semana — coste marginal, no es el cuello de botella económico del producto.

**Programación de tareas:** cron semanal (Supabase Edge Functions con `pg_cron`, o un servicio simple como Render Cron Jobs / GitHub Actions programado si se quiere evitar Supabase).

---

## 9. Modelo de datos (simplificado)

```
organizations                              (la cuenta que paga — TODO cliente tiene una, incluso Plan Equipo)
  id, nombre, canal_entrega, destino_entrega,
  plan (equipo/organizacion/custom), status (trial/active/canceled),
  max_equipos, max_miembros_por_equipo (NULL = sin límite, solo Custom),
  resumen_ejecutivo_activado (bool — opción de Organización/Custom),
  precio_mes (NULL en Custom, precio a medida), creado_en

teams
  id, organization_id, nombre, contexto_empresa, 
  canal_entrega, dia_hora_recordatorio, creado_en

members
  id, team_id, nombre, canal (whatsapp/email/slack), contacto (teléfono o email)

checkins
  id, team_id, member_id, semana (fecha lunes), 
  respuesta_hecho, respuesta_siguiente, respuesta_bloqueo, 
  recibido_en

reports                                     (de un equipo, O el resumen ejecutivo de una organización — nunca las dos cosas)
  id, team_id (opcional), organization_id (opcional), semana, contenido_markdown, 
  bloqueos_detectados (json), informes_origen (solo si es resumen ejecutivo), 
  generado_en, entregado_en
```

El esquema SQL completo, con las restricciones y la seguridad por fila, está en `supabase/schema.sql`.

---

## 10. El prompt de agregación (punto crítico del producto)

Este prompt es, en la práctica, el verdadero producto — vale la pena iterarlo más que cualquier otra parte del MVP.

```
Eres el asistente que redacta el resumen semanal del equipo "{nombre_equipo}".
Contexto de la empresa: {contexto_empresa}

Aquí tienes las respuestas individuales de esta semana:
{lista de respuestas por persona: qué hizo / qué hará / bloqueos}

Redacta un informe semanal en español, con este formato exacto:
1. "Logros de la semana" — agrupa por proyecto o cliente cuando sea posible,
   no repitas literalmente cada respuesta, sintetiza.
2. "Bloqueos" — solo si hay alguno. Si un bloqueo ya apareció en semanas
   anteriores (te lo indico abajo), señálalo como recurrente.
3. "Próxima semana" — prioridades agrupadas por persona.
4. Si alguien no ha respondido, indícalo al final en una línea, sin dramatizar.

Tono: profesional pero cercano, como lo escribiría un jefe de equipo que
respeta el tiempo de quien lo lee. Máximo 200 palabras. Nada de relleno
genérico tipo "gran trabajo en equipo esta semana".

Bloqueos de semanas anteriores para detectar recurrencia:
{lista de bloqueos de las últimas 3 semanas}
```

---

## 11. Modelo de precios

Tres planes, todos con la misma app y el mismo flujo por debajo — lo que cambia es cuánto caben (equipos, personas) y si incluye el resumen ejecutivo:

| Plan | Equipos | Personas | Resumen ejecutivo | Retención del histórico | Precio |
|---|---|---|---|---|---|
| **Equipo** | 1 | hasta 10 | No disponible | 1 mes | 49€/mes |
| **Organización** | hasta 5 | hasta 20 por equipo (100 en total) | Opcional, se puede activar o no | 6 meses | 149€/mes |
| **Custom** | sin límite | sin límite | Opcional, se puede activar o no | Sin límite | A medida |

- **Plan Equipo:** 49€/mes, un equipo, hasta 10 personas. Sin coste por asiento. Pensado para un equipo suelto o una empresa pequeña que funciona como un solo bloque. No incluye resumen ejecutivo — con un solo equipo no hay nada que consolidar.
- **Plan Organización:** 149€/mes, hasta 5 equipos dentro de la misma empresa, hasta 20 personas por equipo. Incluye la opción de activar el **resumen ejecutivo** (ver 6.4), que NO está disponible en el Plan Equipo. Sale a ~30€/equipo, un descuento real frente a pagar 5 planes Equipo sueltos (245€/mes), para que a una empresa con varios departamentos le compense estar en el plan que junta todo en vez de fragmentarse en equipos sueltos.
- **Plan Custom:** equipos y miembros ilimitados, para empresas más grandes que ya no encajan en el Plan Organización (6+ equipos, o equipos de más de 20 personas). Precio a medida, conversación comercial — no tiene sentido fijar un precio de catálogo hasta tener el primer cliente de este tamaño. Incluye la misma opción de resumen ejecutivo que el Plan Organización, y con varios equipos es habitual que sí les interese activarlo. Alta gestionada a mano (no hay flujo de autoservicio para este plan).
- **Retención del histórico:** `RetentionJob` (`api/src/jobs/retention.job.ts`, migración 0013) borra checkins, informes y respuestas de encuesta más antiguos que `organizations.history_retention_months` — 1 mes en Equipo, 6 en Organización, sin límite en Custom (`NULL`, la organización ni se consulta). Corre una vez al día. No borra los audios ya subidos a Supabase Storage que esos checkins pudieran referenciar — limpieza de Storage pendiente.
- Sin permanencia, cancelable en cualquier momento — reduce la fricción de la primera venta.
- Prueba gratuita de 3 semanas en el Plan Equipo, 4 semanas en el Plan Organización y Custom (hay más piezas moviéndose y conviene que les dé tiempo a ver el resumen ejecutivo un par de veces, si lo activan, antes de decidir).
- Cuando exista integración con Slack y personalización avanzada (v2), se puede revisar el precio de los planes, no antes.

**Sobre el IVA:** los precios de arriba son **sin IVA**, como es práctica estándar en SaaS B2B — a una empresa cliente el IVA le es deducible, así que se cotiza y se factura aparte (21% para clientes en España). Un cliente en España paga 49€ + 21% IVA = 59,29€/mes en su cargo real. Para clientes fuera de España (UE o fuera de la UE) el tratamiento del IVA cambia según el régimen (inversión del sujeto pasivo si es una empresa con NIF-IVA intracomunitario válido, OSS si es fuera de la UE, etc.) — esto conviene resolverlo con un gestor/asesor fiscal antes de facturar al primer cliente extranjero, no es algo que se deba improvisar.

---

## 12. Plan de lanzamiento (4-6 semanas)

| Semana | Objetivo |
|---|---|
| 1 | Backend + base de datos + integración WhatsApp Cloud API (o email como plan B mientras se verifica la cuenta de empresa en Meta) |
| 2 | Prompt de agregación + generación y entrega del informe funcionando de punta a punta con datos de prueba |
| 3 | Panel web mínimo (alta de equipo, histórico) + pruebas internas con 1-2 equipos reales (el tuyo propio, o algún conocido) |
| 4 | Ajustes según feedback real, landing de venta simple, mensaje de venta claro |
| 5-6 | Primeros 5-10 clientes piloto, usando el mismo canal de prospección que ya usas para Zaviren, apuntando a agencias y consultoras pequeñas en español |

### Oferta de lanzamiento para la primera cohorte

Para los primeros 10-15 equipos/empresas interesados:

- **Piloto gratuito de 4 semanas** (una más que la prueba estándar) para que les dé tiempo a ver 3-4 informes reales, no solo el primero.
- A cambio: una llamada corta de 15 minutos al terminar el piloto para feedback, y permiso para usarles como caso de referencia si están contentos con el resultado.
- **Precio de "socio fundador" al convertir:** 50% de descuento de por vida si pasan a pagar dentro de los 7 días siguientes al final del piloto — 24,50€/mes + IVA (Plan Equipo) o 74,50€/mes + IVA (Plan Organización), en vez del precio normal. Solo para esta primera cohorte; quien llegue después entra directamente al precio de catálogo.
- **Por qué no gratis indefinido:** un piloto sin fecha de fin no da una señal real de si alguien pagaría — y es mucho más difícil convertir a pago a alguien que lleva meses gratis que a alguien que decide dentro de una ventana corta mientras el valor todavía está fresco.
- **Programa de referidos** (una vez haya clientes de pago reales): un cliente que trae a otra empresa que se convierte en cliente de pago recibe un mes gratis — y el referido también, como incentivo de entrada.

---

## 13. Métricas para validar que funciona

- **Tasa de respuesta semanal por equipo** (objetivo: >70% de los miembros responde sin recordatorio extra).
- **Retención mes 2** — si un equipo sigue pagando después del primer mes, la propuesta de valor es real.
- **Tiempo hasta el primer "wow"** — si el responsable del equipo no reacciona positivamente al primer o segundo informe, algo falla en el prompt o el formato, no en la idea.

---

## 14. Riesgos y cómo mitigarlos

- **Alta de WhatsApp Business tarda o se complica** → empezar con email como canal por defecto y añadir WhatsApp en cuanto esté verificado, sin bloquear el lanzamiento.
- **Los informes suenan genéricos** → es el riesgo más probable y el más fácil de arreglar: iterar el prompt con datos reales, no con datos de prueba inventados.
- **La gente no responde a tiempo** → un segundo recordatorio automático 2h antes de la hora de corte, y aceptar informes parciales en vez de bloquear la entrega.
- **Slack se vuelve imprescindible antes de lo previsto** → si los primeros interesados son equipos técnicos, adelantar la integración de Slack en el roadmap sin esperar a v2.

---

## 15. Roadmap después del MVP

1. Integración con Slack (canal adicional, mismo backend).
2. Integraciones "pull" ligeras: número de commits/PRs de GitHub, tarjetas movidas en Trello — como enriquecimiento opcional, nunca como requisito.
3. Alertas en tiempo real al responsable si alguien reporta un bloqueo grave (no esperar al informe semanal).
4. Multi-idioma para abrir mercado más allá de España/LatAm.
5. Comparativa de tendencias entre semanas (velocidad, bloqueos recurrentes, carga de trabajo por persona).
