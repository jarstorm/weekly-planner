import { test, expect, Page } from '@playwright/test';
import { TIMEZONE } from '../helpers/env';
import {
  db,
  runJob,
  currentWeekStart,
  emailVerifyToken,
  checkinToken,
  surveyToken,
  sendCheckoutCompletedWebhook,
  cleanup,
} from '../helpers/backend';

// Ciclo completo de la aplicación, de cero: registro → verificación de email
// → plan de pago (Stripe Checkout con tarjeta de test) → equipo y miembros →
// planificación → respuestas semanales → informe + resumen ejecutivo →
// encuesta anónima enviada, respondida y con resultados. Ver e2e/README.md.
//
// Lo que NO se prueba aquí: el envío real de emails/WhatsApp (con
// EMAIL_DEV_OVERRIDE_TO todo sale hacia el buzón del desarrollador, no hay
// forma de leerlo) — se prueba que los jobs corren sin error, y los enlaces
// de los emails se firman con el mismo código del backend.

const RUN_ID = Date.now();
const EMAIL = `javierabadrodriguez+e2e${RUN_ID}@gmail.com`;
const PASSWORD = `E2e-${RUN_ID}-pass`;
const ORG_NAME = `E2E Org ${RUN_ID}`;
const TEAM_NAME = 'E2E Equipo';
const TEAM2_NAME = 'E2E Equipo 2'; // el resumen ejecutivo solo se genera con 2 o más equipos
const MEMBER2 = { name: 'Diana E2E', email: `javierabadrodriguez+e2em4.${RUN_ID}@gmail.com` };
const MEMBERS = ['Ana E2E', 'Bruno E2E', 'Carla E2E'].map((name, i) => ({
  name,
  email: `javierabadrodriguez+e2em${i + 1}.${RUN_ID}@gmail.com`,
}));
const SURVEY_QUESTIONS = ['¿Cómo valoras el ambiente del equipo?', '¿Qué mejorarías?'];

let organizationId: string | undefined;

// "HH:MM" en Madrid, `plusMinutes` minutos en el futuro: el cron solo
// dispara dentro de [hora, hora+15min), mirando hacia adelante desde ahora.
function madridTime(plusMinutes: number): string {
  const d = new Date(Date.now() + plusMinutes * 60_000);
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
}

function madridDow(): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short' }).format(new Date());
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd as 'Sun']!;
}

async function fillStripeCheckout(page: Page) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
  // Checkout en acordeón: los campos de tarjeta solo existen tras elegir "Tarjeta".
  await page.locator('#payment-method-label-card').click({ force: true });
  await page.locator('#cardNumber').fill('4242424242424242');
  await page.locator('#cardExpiry').fill('12 / 34');
  await page.locator('#cardCvc').fill('123');
  const name = page.locator('#billingName');
  if (await name.count()) await name.fill('E2E Test');
  const country = page.locator('#billingCountry');
  if (await country.count()) await country.selectOption('ES');
  // Stripe recalcula impuestos al elegir país; enviar antes deja el pago colgado.
  await page.waitForTimeout(2000);
  const postal = page.locator('#billingPostalCode');
  if (await postal.count()) await postal.fill('28001');
  await page.getByTestId('hosted-payment-submit-button').click();
}

test.afterAll(async () => {
  if (process.env.E2E_KEEP) {
    console.log(`E2E_KEEP: cuenta conservada (${EMAIL}, org ${organizationId})`);
    return;
  }
  await cleanup(EMAIL, organizationId);
});

test('ciclo completo de la aplicación', async ({ page, browser }) => {
  const supabase = db();
  let teamId = '';
  let memberIds: string[] = [];
  let team2Id = '';
  let member2Id = '';
  let surveyId = '';

  await test.step('1. Registro de organización', async () => {
    await page.goto('/register');
    await page.getByLabel('Nombre de la empresa').fill(ORG_NAME);
    await page.getByLabel('Email', { exact: true }).fill(EMAIL);
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Repite la contraseña').fill(PASSWORD);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByRole('heading', { name: 'Revisa tu email' })).toBeVisible();

    const { data: org } = await supabase.from('organizations').select('id, owner_id').eq('name', ORG_NAME).single();
    organizationId = org!.id;
  });

  await test.step('2. Verificación de email y login', async () => {
    const { data: org } = await supabase.from('organizations').select('owner_id').eq('id', organizationId!).single();
    await page.goto(`/verify-email/${emailVerifyToken(org!.owner_id)}`);
    await expect(page.getByText('Email confirmado')).toBeVisible();

    await page.goto('/login');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Contraseña').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
    // Sin plan elegido, la app obliga a pasar por Facturación.
    await page.waitForURL(/\/app\/billing/);
  });

  await test.step('3. Plan Organización con Stripe Checkout (tarjeta de test)', async () => {
    await page.locator('li', { hasText: 'Plan Organización' }).getByRole('button', { name: 'Suscribirse' }).click();
    await fillStripeCheckout(page);
    await page.waitForURL(/\/app\/billing\?checkout=success/, { timeout: 120_000 });
    await expect(page.getByText('Pago confirmado')).toBeVisible();

    await sendCheckoutCompletedWebhook(organizationId!);
    const { data: org } = await supabase.from('organizations').select('plan, status, plan_selected').eq('id', organizationId!).single();
    expect(org).toMatchObject({ plan: 'organizacion', status: 'active', plan_selected: true });

    await page.reload();
    await expect(page.getByText('Plan Organización').first()).toBeVisible();
  });

  await test.step('4. Alta de equipo y miembros', async () => {
    await page.goto('/app/onboarding');
    await page.getByLabel('Nombre del equipo').fill(TEAM_NAME);
    await page.getByLabel('Contexto de la empresa').fill('Equipo de pruebas automáticas, trabajo de desarrollo y soporte.');
    await page.getByRole('button', { name: 'Crear equipo' }).click();
    await expect(page.getByRole('heading', { name: `Miembros de ${TEAM_NAME}` })).toBeVisible();

    for (const m of MEMBERS) {
      await page.getByLabel('Nombre').fill(m.name);
      await page.getByPlaceholder('nombre@empresa.com').fill(m.email);
      await page.getByRole('button', { name: 'Añadir miembro' }).click();
      await expect(page.getByText(m.name)).toBeVisible();
    }
    await page.getByRole('button', { name: 'Terminar' }).click();
    await page.waitForURL(/\/app$/);

    const { data: team } = await supabase.from('teams').select('id').eq('organization_id', organizationId!).eq('name', TEAM_NAME).single();
    teamId = team!.id;
    const { data: members } = await supabase.from('members').select('id, name').eq('team_id', teamId).order('created_at');
    expect(members).toHaveLength(MEMBERS.length);
    memberIds = members!.map((m) => m.id);

    await page.goto('/app/onboarding');
    await page.getByLabel('Nombre del equipo').fill(TEAM2_NAME);
    await page.getByRole('button', { name: 'Crear equipo' }).click();
    await expect(page.getByRole('heading', { name: `Miembros de ${TEAM2_NAME}` })).toBeVisible();
    await page.getByLabel('Nombre').fill(MEMBER2.name);
    await page.getByPlaceholder('nombre@empresa.com').fill(MEMBER2.email);
    await page.getByRole('button', { name: 'Añadir miembro' }).click();
    await expect(page.getByText(MEMBER2.name)).toBeVisible();
    await page.getByRole('button', { name: 'Terminar' }).click();
    await page.waitForURL(/\/app$/);

    const { data: team2 } = await supabase.from('teams').select('id').eq('organization_id', organizationId!).eq('name', TEAM2_NAME).single();
    team2Id = team2!.id;
    const { data: m2 } = await supabase.from('members').select('id').eq('team_id', team2Id).single();
    member2Id = m2!.id;
  });

  await test.step('5. Planificar el feedback (recordatorio, corte, resumen ejecutivo)', async () => {
    await page.goto('/app/reports/schedule');
    await page.getByLabel('Día del recordatorio').selectOption(String(madridDow()));
    await page.getByLabel('Hora del recordatorio').fill(madridTime(3));
    await page.getByLabel('Hora de corte').fill(madridTime(3));
    await page.getByLabel('Zona horaria').selectOption(TIMEZONE);
    await page.getByLabel('Activar resumen ejecutivo').check();
    await page.getByPlaceholder('direccion@empresa.com').fill(EMAIL);
    await page.getByRole('button', { name: 'Añadir', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Cambios guardados.')).toBeVisible();
  });

  await test.step('6. Recordatorio semanal (job)', async () => {
    runJob('reminder');
  });

  await test.step('7. Respuestas semanales por el formulario público (3 de 4)', async () => {
    const weekStart = currentWeekStart();
    const answerers = [memberIds[0], memberIds[1], member2Id]; // Carla no responde
    for (const [i, memberId] of answerers.entries()) {
      const ctx = await browser.newContext({ locale: 'es-ES' });
      const p = await ctx.newPage();
      await p.goto(`/checkin/${checkinToken(memberId, weekStart)}`);
      await expect(p.getByRole('heading', { name: `Resumen semanal — ${TEAM_NAME}` })).toBeVisible();
      await p.getByLabel('¿Qué has hecho esta semana?').fill(`Terminé la integración número ${i + 1} y revisé los tests.`);
      await p.getByLabel('¿Qué harás la semana que viene?').fill('Empezar el módulo de facturación.');
      await p.getByLabel('¿Algo bloqueado').fill(i === 0 ? 'Espero credenciales del proveedor.' : 'Nada bloqueado.');
      await p.getByRole('button', { name: 'Enviar' }).click();
      await expect(p.getByText('Ya quedó registrada tu respuesta')).toBeVisible();
      await ctx.close();
    }
    const { data: rows } = await supabase.from('checkins').select('id').eq('team_id', teamId).eq('week_start', weekStart);
    expect(rows!.length).toBeGreaterThanOrEqual(2);
    const { data: rows2 } = await supabase.from('checkins').select('id').eq('team_id', team2Id).eq('week_start', weekStart);
    expect(rows2).toHaveLength(1);
  });

  await test.step('8. Generar informe de equipo y resumen ejecutivo (job + Claude)', async () => {
    runJob('report');
    const { data: teamReports } = await supabase.from('reports').select('id, content_markdown').eq('team_id', teamId);
    const { data: team2Reports } = await supabase.from('reports').select('id').eq('team_id', team2Id);
    expect(team2Reports, 'informe del equipo 2 generado').toHaveLength(1);
    const { data: orgReports } = await supabase.from('reports').select('id, content_markdown').eq('organization_id', organizationId!);
    const teamReport = teamReports![0];
    expect(teamReport, 'informe del equipo generado').toBeTruthy();
    expect(teamReport!.content_markdown.length).toBeGreaterThan(200);
    expect(teamReport!.content_markdown).toContain('Carla E2E'); // no respondió
    const exec = orgReports![0];
    expect(exec, 'resumen ejecutivo generado').toBeTruthy();
    expect(exec!.content_markdown.length).toBeGreaterThan(100);

    await page.goto('/app/reports');
    await expect(page.getByRole('cell', { name: TEAM_NAME, exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: TEAM2_NAME, exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Resumen ejecutivo' })).toBeVisible();

    // El PDF se descarga con la sesión del navegador y es un PDF de verdad.
    const href = await page.getByRole('link', { name: 'Descargar PDF' }).first().getAttribute('href');
    const pdf = await page.context().request.get(href!);
    expect(pdf.ok()).toBeTruthy();
    const body = await pdf.body();
    expect(body.subarray(0, 4).toString()).toBe('%PDF');
    expect(body.length).toBeGreaterThan(2_000);
  });

  await test.step('9. Crear encuesta anónima', async () => {
    await page.goto('/app/survey/new');
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel('Fecha').fill(tomorrow);
    await page.getByLabel('Hora', { exact: true }).fill('10:00');
    for (const q of SURVEY_QUESTIONS) {
      await page.getByPlaceholder('Escribe una pregunta').fill(q);
      await page.getByPlaceholder('Escribe una pregunta').press('Enter');
    }
    await page.getByRole('button', { name: 'Crear encuesta' }).click();
    await page.waitForURL(/\/app\/survey$/);
    await expect(page.getByText('Encuesta programada para el')).toBeVisible();

    const { data: survey } = await supabase.from('surveys').select('id').eq('organization_id', organizationId!).single();
    surveyId = survey!.id;
  });

  await test.step('10. Enviar la encuesta (job)', async () => {
    // La UI solo permite fechas futuras; para no esperar a mañana, la fecha
    // pasa a ayer directamente en BD — SurveyJob manda en el primer tick que
    // vea una encuesta vencida.
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await supabase.from('surveys').update({ scheduled_date: yesterday }).eq('id', surveyId);
    runJob('survey');
    const { data: survey } = await supabase.from('surveys').select('sent_at').eq('id', surveyId).single();
    expect(survey!.sent_at, 'encuesta marcada como enviada').toBeTruthy();
  });

  await test.step('11. Responder la encuesta (2 de 4) y comprobar que no se puede repetir', async () => {
    const answers = [
      ['Muy bueno, buen ambiente.', 'Menos reuniones.'],
      ['Regular, mucha carga.', 'Más tiempo para testear.'],
    ];
    for (const [i, memberId] of [memberIds[0], memberIds[1]].entries()) {
      const ctx = await browser.newContext({ locale: 'es-ES' });
      const p = await ctx.newPage();
      await p.goto(`/survey/${surveyToken(memberId, surveyId)}`);
      await expect(p.getByText('Tus respuestas son anónimas')).toBeVisible();
      for (const [j, q] of SURVEY_QUESTIONS.entries()) {
        await p.getByLabel(q).fill(answers[i][j]);
      }
      await p.getByRole('button', { name: 'Enviar' }).click();
      await expect(p.getByText('Gracias por tu respuesta.')).toBeVisible();
      await ctx.close();
    }

    // Segundo intento del mismo miembro: la página ya muestra "gracias", sin formulario.
    const ctx = await browser.newContext({ locale: 'es-ES' });
    const p = await ctx.newPage();
    await p.goto(`/survey/${surveyToken(memberIds[0], surveyId)}`);
    await expect(p.getByText('Gracias por tu respuesta.')).toBeVisible();
    await expect(p.getByRole('button', { name: 'Enviar' })).toHaveCount(0);
    await ctx.close();
  });

  await test.step('12. Resultados de la encuesta (agregados y anónimos)', async () => {
    await page.goto('/app/survey');
    await expect(page.getByText('2 de 4 personas respondieron')).toBeVisible();
    for (const q of SURVEY_QUESTIONS) await expect(page.getByText(q, { exact: true })).toBeVisible();
    await expect(page.getByText('Muy bueno, buen ambiente.')).toBeVisible();
    await expect(page.getByText('Más tiempo para testear.')).toBeVisible();

    // Anonimato: la tabla de respuestas no guarda quién contestó.
    const { data: rows } = await supabase.from('survey_responses').select('*').eq('survey_id', surveyId);
    expect(rows!.length).toBeGreaterThan(0);
    for (const row of rows!) {
      expect(Object.keys(row)).not.toContain('member_id');
      expect(Object.keys(row)).not.toContain('team_id');
    }
  });
});
