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
    return `Hi ${memberName} 👋 ${organizationName}'s anonymous survey. Your answers are never linked back to your name — no one at your company can see who answered what.\n\nAnswer here: ${link}`;
  }
  return `Hola ${memberName} 👋 Encuesta anónima de ${organizationName}. Tus respuestas no quedan asociadas a tu nombre — nadie en tu empresa puede ver quién contestó qué.\n\nResponde aquí: ${link}`;
}

export function memberVerifyEmailMessage(
  language: AccountLanguage,
  memberName: string,
  teamName: string,
  link: string,
): string {
  if (language === 'en') {
    return `Hi ${memberName} 👋 You've been added to the ${teamName} team on WeeklyFeedback.\n\nConfirm this is your email so weekly check-in links and reports don't bounce:\n${link}\n\nThis link works for 7 days.`;
  }
  return `Hola ${memberName} 👋 Te han añadido al equipo ${teamName} en WeeklyFeedback.\n\nConfirma que este es tu email para que los enlaces del check-in semanal y los informes no reboten:\n${link}\n\nEste enlace funciona durante 7 días.`;
}

export function welcomeVerifyEmailMessage(language: AccountLanguage, orgName: string, link: string): string {
  if (language === 'en') {
    return `Welcome to WeeklyFeedback, ${orgName} 👋\n\nConfirm your email to activate your account:\n${link}\n\nThis link works for 7 days.`;
  }
  return `Bienvenido a WeeklyFeedback, ${orgName} 👋\n\nConfirma tu email para activar tu cuenta:\n${link}\n\nEste enlace funciona durante 7 días.`;
}

export function passwordResetMessage(language: AccountLanguage, link: string): string {
  if (language === 'en') {
    return `Reset your WeeklyFeedback password 👋\n\nOpen this link to set a new one:\n${link}\n\nThis link works for 1 hour. If you didn't request this, ignore this email.`;
  }
  return `Restablece tu contraseña de WeeklyFeedback 👋\n\nAbre este enlace para poner una nueva:\n${link}\n\nEste enlace funciona durante 1 hora. Si no has pedido esto, ignora este correo.`;
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
