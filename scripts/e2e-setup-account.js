// Bootstrap ÚNICO de la cuenta de pruebas E2E en producción — toca Supabase
// directo con la service role key (bypass de la app), así que solo se corre
// a mano cuando hace falta (cuenta nueva, contraseña olvidada, o el plan se
// cayó a Equipo tras un cambio de plan real). El ciclo normal de pruebas es
// scripts/e2e-prod-test.sh, que no necesita esto.
//
// Uso: E2E_PASSWORD=... node scripts/e2e-setup-account.js
// Requiere api/.env con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (los mismos
// de producción, ver docs/despliegue-produccion.md — local y prod comparten
// Supabase). Requiere permiso del clasificador de auto-mode para escribir en
// Supabase (categoría "Modify Shared Resources") — ver docs/pruebas-produccion.md.

const fs = require('fs');
const path = require('path');

const EMAIL = process.env.E2E_EMAIL || 'javierabadrodriguez@gmail.com';
const PASSWORD = process.env.E2E_PASSWORD;
if (!PASSWORD) {
  console.error('ERROR: falta E2E_PASSWORD (no se guarda ninguna contraseña en este repo).');
  console.error('  Uso: E2E_PASSWORD=... node scripts/e2e-setup-account.js');
  process.exit(1);
}

const envPath = path.join(__dirname, '..', 'api', '.env');
const envText = fs.readFileSync(envPath, 'utf8');
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const { createClient } = require(path.join(__dirname, '..', 'api', 'node_modules', '@supabase/supabase-js'));
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUser(email) {
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  let user = await findUser(EMAIL);

  if (!user) {
    console.log(`No existe usuario para ${EMAIL}, creando...`);
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    console.log('Usuario creado', user.id);
  } else {
    console.log('Usuario existente', user.id, '— reseteando contraseña');
    const { error } = await supabase.auth.admin.updateUserById(user.id, { password: PASSWORD });
    if (error) throw error;
  }

  const { data: orgs, error: orgErr } = await supabase
    .from('organizations')
    .select('id, plan')
    .eq('owner_id', user.id);
  if (orgErr) throw orgErr;

  if (!orgs.length) {
    console.log('El usuario no tiene organización — hay que pasar por POST /api/auth/register primero (ver docs/pruebas-produccion.md).');
    return;
  }

  const org = orgs[0];
  console.log('Organización', org.id, 'plan actual:', org.plan);

  const { data: updated, error: updErr } = await supabase
    .from('organizations')
    .update({
      plan: 'organizacion',
      status: 'active',
      max_teams: 5,
      max_members_per_team: 20,
      history_retention_months: 6,
      has_executive_summary: true,
      has_monthly_survey: true,
    })
    .eq('id', org.id)
    .select();
  if (updErr) throw updErr;

  console.log('Organización actualizada a plan organizacion:', JSON.stringify(updated, null, 2));
  console.log(`\nListo. Ahora: E2E_EMAIL=${EMAIL} E2E_PASSWORD=... ./scripts/e2e-prod-test.sh`);
}

main().catch((e) => {
  console.error('ERROR', e);
  process.exit(1);
});
