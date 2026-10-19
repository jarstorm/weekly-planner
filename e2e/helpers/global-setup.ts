import { execSync } from 'child_process';
import { API_DIR, required } from './env';

// Red de seguridad antes de tocar nada: este test crea una cuenta real en
// la Supabase compartida (la misma que producción) y una suscripción en
// Stripe — solo es aceptable con claves de TEST y sin APP_ENV=production.
export default async function globalSetup() {
  if (!required('STRIPE_SECRET_KEY').startsWith('sk_test_')) {
    throw new Error('STRIPE_SECRET_KEY no es de test (sk_test_...). El e2e no corre contra Stripe live.');
  }
  if (process.env.APP_ENV === 'production') {
    throw new Error('APP_ENV=production en api/.env. El e2e no corre en modo producción.');
  }
  for (const name of [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CHECKIN_TOKEN_SECRET',
    'SURVEY_TOKEN_SECRET',
    'EMAIL_VERIFICATION_TOKEN_SECRET',
    'STRIPE_WEBHOOK_SECRET',
    'ANTHROPIC_API_KEY',
  ]) {
    required(name);
  }

  console.log('Compilando backend (api/dist) para el servidor y los jobs...');
  execSync('npm run build', { cwd: API_DIR, stdio: 'inherit' });
}
