import dotenv from 'dotenv';
import path from 'path';

export const ROOT = path.resolve(__dirname, '..', '..');
export const API_DIR = path.join(ROOT, 'api');

// Mismo .env que usa el backend — el e2e firma tokens y habla con Supabase
// y Stripe con las mismas credenciales.
dotenv.config({ path: path.join(API_DIR, '.env') });

export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} en api/.env`);
  return value;
}

export const API_URL = 'http://localhost:3001/api';
export const TIMEZONE = 'Europe/Madrid';
