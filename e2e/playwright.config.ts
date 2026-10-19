import { defineConfig } from '@playwright/test';
import path from 'path';

const root = path.resolve(__dirname, '..');

// Un solo test largo y en serie: cada paso depende del anterior (registro →
// plan → equipo → respuestas → informe → encuesta), no tiene sentido
// paralelizar ni reintentar a medias (cada intento crearía otra cuenta).
export default defineConfig({
  testDir: './tests',
  globalSetup: './helpers/global-setup.ts',
  timeout: 15 * 60 * 1000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    actionTimeout: 30_000,
    headless: !process.env.HEADED,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      // Backend ya compilado (global-setup hace `npm run build` antes).
      command: 'node dist/main.js',
      cwd: path.join(root, 'api'),
      url: 'http://localhost:3001/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run dev',
      cwd: path.join(root, 'web'),
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
