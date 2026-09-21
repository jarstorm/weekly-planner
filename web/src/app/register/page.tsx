'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.register({ email, password, orgName });
      router.push('/app/onboarding');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="card card-narrow">
        <h1>Crear cuenta</h1>
        <form onSubmit={handleSubmit}>
          <label>
            Nombre de la empresa/equipo
            <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Creando...' : 'Crear cuenta'}
          </button>
        </form>
        <p>
          ¿Ya tenés cuenta? <a href="/login">Entrá</a>
        </p>
      </div>
    </main>
  );
}
