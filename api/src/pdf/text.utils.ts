// Groq mete de vez en cuando variantes Unicode de espacio (narrow no-break
// space U+202F visto en producción, u otras del mismo bloque: U+00A0,
// U+2000-200A, U+205F, U+3000) que las fuentes estándar de pdfkit
// (Helvetica/AFM) no tienen glifo — sin normalizar, pdfkit renderiza un "/"
// visible en su lugar (bug real, detectado generando un informe de muestra
// para la landing: "Stripe /Tax", "cron de 15 /min"). Un espacio normal de
// menos no cambia el sentido del informe.
export function sanitizeText(text: string): string {
  return text.replace(/[  -   　]/g, ' ').replace(/[​﻿]/g, '');
}
