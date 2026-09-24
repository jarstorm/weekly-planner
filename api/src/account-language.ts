// Idioma de cuenta (organizations.language, migración 0012) — controla lo
// que ve el EMPLEADO (mensaje de recordatorio/encuesta, formulario público)
// y lo que genera la IA (informe semanal, resumen ejecutivo). No tiene nada
// que ver con el idioma de la interfaz del panel del admin, que sigue
// siendo el selector de next-intl (por navegador).
export type AccountLanguage = 'es' | 'en';

export function reminderMessage(language: AccountLanguage, memberName: string, teamName: string, link: string): string {
  if (language === 'en') {
    return `Hi ${memberName} 👋 Weekly summary for ${teamName}.\n1️⃣ What did you do this week?\n2️⃣ What will you do next week?\n3️⃣ Anything blocked, or that you need from someone?\n\nYou can also reply here: ${link}`;
  }
  return `Hola ${memberName} 👋 Resumen semanal de ${teamName}.\n1️⃣ ¿Qué has hecho esta semana?\n2️⃣ ¿Qué harás la semana que viene?\n3️⃣ ¿Algo bloqueado o que necesites de alguien?\n\nTambién puedes responder aquí: ${link}`;
}

export function surveyMessage(language: AccountLanguage, memberName: string, organizationName: string, link: string): string {
  if (language === 'en') {
    return `Hi ${memberName} 👋 ${organizationName}'s anonymous monthly survey. Your answers are never linked back to your name — no one at your company can see who answered what.\n\nAnswer here: ${link}`;
  }
  return `Hola ${memberName} 👋 Encuesta mensual anónima de ${organizationName}. Tus respuestas no quedan asociadas a tu nombre — nadie en tu empresa puede ver quién contestó qué.\n\nResponde aquí: ${link}`;
}

export interface ReportDelivery {
  title: string;
  filename: string;
  caption: string;
}

export function reportDeliveryText(language: AccountLanguage, teamName: string, weekStart: string): ReportDelivery {
  if (language === 'en') {
    return {
      title: `Weekly summary — ${teamName} — week of ${weekStart}`,
      filename: `weekly-summary-${weekStart}.pdf`,
      caption: `${teamName}'s weekly summary — week of ${weekStart}. Attached as PDF.`,
    };
  }
  return {
    title: `Resumen semanal — ${teamName} — semana del ${weekStart}`,
    filename: `resumen-semanal-${weekStart}.pdf`,
    caption: `Resumen semanal de ${teamName} — semana del ${weekStart}. Adjunto en PDF.`,
  };
}

export function executiveSummaryDeliveryText(
  language: AccountLanguage,
  organizationName: string,
  weekStart: string,
): ReportDelivery {
  if (language === 'en') {
    return {
      title: `Executive summary — ${organizationName} — week of ${weekStart}`,
      filename: `executive-summary-${weekStart}.pdf`,
      caption: `${organizationName}'s executive summary — week of ${weekStart}. Attached as PDF.`,
    };
  }
  return {
    title: `Resumen ejecutivo — ${organizationName} — semana del ${weekStart}`,
    filename: `resumen-ejecutivo-${weekStart}.pdf`,
    caption: `Resumen ejecutivo de ${organizationName} — semana del ${weekStart}. Adjunto en PDF.`,
  };
}

// next-intl usa localePrefix "as-needed" (web/src/i18n/routing.ts): es
// (default) sin prefijo, en con "/en" — así el link público al formulario
// (checkin o survey) abre directamente en el idioma de la cuenta.
export function localePrefix(language: AccountLanguage): string {
  return language === 'en' ? '/en' : '';
}
