# WeeklyFeedback — Economía del proyecto

Este documento junta lo que ya habíamos calculado por separado (coste de infraestructura, precios, IVA) y le añade lo que de verdad decide si esto es viable: el coste de operar el negocio como autónomo en España, y en cuántos clientes se alcanza el punto de **ramen profitable** — que el negocio cubra tus gastos mínimos de vida, no un sueldo de verdad, solo lo justo para no depender de otro ingreso mientras esto crece.

---

## 1. Ingresos por cliente

Precios sin IVA (se factura aparte, 21% para clientes en España — ver `mvp-resumen-semanal-equipos.md`, sección 11).

| Plan | Precio/mes | Coste variable directo/mes | Margen de contribución/mes |
|---|---|---|---|
| **Equipo** (1 equipo, hasta 10 personas) | 49€ | ~1,63€ (WhatsApp ~0,60€ + Stripe ~0,98€ + IA ~0,05€ — cifra sin recalcular tras bajar el límite de 20 a 10, ver nota) | **~47,37€** |
| **Organización** (hasta 5 equipos) | 149€ | ~5,74€ (WhatsApp ~3€ + Stripe ~2,49€ + IA ~0,25€) | **~143,26€** |

El "margen de contribución" es lo que queda de cada cliente después de los costes que van directamente ligados a atenderlo (mensajes de WhatsApp, comisión de cobro, IA) — antes de restar los costes fijos del negocio, que son los mismos los tengas 1 cliente o 50.

*Nota:* el Plan Equipo bajó su límite de 20 a 10 personas (ver `mvp-resumen-semanal-equipos.md`, sección 11) después de calcular la tabla de arriba. El coste variable de WhatsApp escala con el número de personas, así que en realidad baja (el margen del Plan Equipo es mejor de lo que dice la tabla, no peor) — pendiente de recalcular con el desglose real de coste por mensaje.

---

## 2. Gastos planeados

### 2.1 Costes fijos del negocio (no dependen del número de clientes)

| Partida | Coste/mes | Nota |
|---|---|---|
| **Cuota de autónomo (RETA)** | **80€** | Tarifa plana 2026: 80€/mes los primeros 12 meses, prorrogable otros 12 si los ingresos netos quedan por debajo del SMI. Después, la cuota sube según tramos de ingresos reales — puede ser un salto considerable, hay que vigilarlo. |
| **Gestoría/asesoría fiscal** | ~50€ | Opcional pero recomendable: lleva el IVA trimestral y el IRPF. Se puede evitar los primeros meses haciéndolo tú mismo, a costa de tiempo. |
| **Dominio** | ~1€ | |
| **Infraestructura** (versión austera: Supabase Free + API de Meta directa, sin BSP) | ~0€ | Ver desglose completo en la conversación de "gastar lo mínimo posible en hosting" — con 360dialog como BSP en vez de la API directa, súmale 49€/mes fijos. |
| **Total costes fijos** | **~131€/mes** (con gestoría) / **~81€/mes** (sin gestoría) | |

Este es el número que de verdad importa: la cuota de autónomo es, con diferencia, el gasto fijo más grande del proyecto — muy por encima de todo lo que hemos calculado de hosting hasta ahora.

### 2.2 Gastos de arranque (una sola vez, no mensuales)

| Partida | Coste aproximado |
|---|---|
| Alta como autónomo | Gratis (trámite en Hacienda + Seguridad Social) |
| Dominio (primer año) | ~10-15€ |
| Sin necesidad de local, ni equipo, ni inventario — el negocio no tiene más gastos de arranque relevantes | — |

---

## 3. Dónde está el punto de ramen profitable

**Ramen profitable** = el beneficio neto mensual del negocio (ingresos − costes variables − costes fijos) cubre tu gasto mínimo de vida — alquiler, comida, suministros — sin necesidad de otro ingreso. No es un sueldo, es el umbral de supervivencia que te permite dedicarte a esto a tiempo completo sin quemar ahorros.

Fórmula:

```
nº clientes Plan Equipo necesarios = (gasto mínimo de vida + costes fijos del negocio) / 47,37€
```

No conozco tu cifra real de gasto mínimo mensual, así que aquí tienes la tabla con varios escenarios — localiza el tuyo y esa fila es tu objetivo:

| Gasto mínimo de vida/mes | Con gestoría (131€ fijos) | Sin gestoría (81€ fijos) |
|---|---|---|
| 900€ | 22 clientes Equipo | 21 clientes Equipo |
| 1.100€ | 26 clientes Equipo | 25 clientes Equipo |
| 1.300€ | 30 clientes Equipo | 29 clientes Equipo |
| 1.600€ | 37 clientes Equipo | 36 clientes Equipo |

Con el Plan Organización, el mismo umbral se alcanza con muchos menos clientes porque cada uno vale ~3 veces más:

| Gasto mínimo de vida/mes | Con gestoría (131€ fijos) |
|---|---|
| 900€ | 8 clientes Organización |
| 1.300€ | 10 clientes Organización |
| 1.600€ | 12 clientes Organización |

### Ejemplo mixto (el escenario más realista)

20 clientes Plan Equipo + 2 clientes Plan Organización:

```
Ingreso de contribución = 20 × 47,37€ + 2 × 143,26€ = 947,40€ + 286,52€ = 1.233,92€
Beneficio neto = 1.233,92€ − 131€ (costes fijos) ≈ 1.103€/mes
```

Con esa combinación —que no es descabellada como resultado de los primeros 2-3 meses de prospección activa— ya estarías en ramen profitable si tu gasto mínimo de vida está en torno a 1.100€/mes o por debajo.

---

## 4. Lo que este modelo NO incluye (y hay que vigilar aparte)

- **IRPF (impuesto sobre la renta):** este cálculo es de beneficio del negocio antes de tu declaración de la renta personal. Como autónomo nuevo hay reducciones el primer año, pero conviene que un gestor te confirme cuánto se lleva Hacienda una vez el negocio genere ingresos reales — no es lo mismo "ramen profitable" que "lo que te queda limpio".
- **El salto de la tarifa plana:** pasado el periodo de 80€/mes, la cuota de autónomo sube según tus ingresos reales — hay que revisar la tabla de tramos vigente cuando se acerque esa fecha, porque puede cambiar el punto de equilibrio.
- **Coste de adquisición de clientes (CAC):** este documento dice cuántos clientes hacen falta, no cuánto cuesta conseguirlos ni cuánto tiempo lleva. Eso se calcula aparte con el flujo de prospección que ya usas para Zaviren.
- **Tu propio tiempo:** ramen profitable no es "ganar dinero", es "no perderlo mientras dedicas tu tiempo a esto a jornada completa". El verdadero coste de oportunidad es lo que dejas de ganar haciendo otra cosa mientras tanto.
