'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, ChannelName, Team } from '@/lib/api';

const DOW_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function OnboardingPage() {
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // datos del equipo
  const [name, setName] = useState('');
  const [companyContext, setCompanyContext] = useState('');
  const [deliveryChannel, setDeliveryChannel] = useState<ChannelName>('email');
  const [deliveryTarget, setDeliveryTarget] = useState('');
  const [reminderDow, setReminderDow] = useState(5);
  const [reminderTime, setReminderTime] = useState('10:00');
  const [cutoffTime, setCutoffTime] = useState('13:00');

  // alta de miembros, una vez el equipo existe
  const [memberName, setMemberName] = useState('');
  const [memberChannel, setMemberChannel] = useState<ChannelName>('email');
  const [memberContact, setMemberContact] = useState('');
  const [members, setMembers] = useState<string[]>([]);

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const created = await api.createTeam({
        name,
        company_context: companyContext,
        delivery_channel: deliveryChannel,
        delivery_target: deliveryTarget,
        reminder_dow: reminderDow,
        reminder_time: reminderTime,
        cutoff_time: cutoffTime,
      });
      setTeam(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el equipo');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!team) return;
    setError(null);
    setLoading(true);
    try {
      await api.addMember(team.id, { name: memberName, channel: memberChannel, contact: memberContact });
      setMembers((prev) => [...prev, memberName]);
      setMemberName('');
      setMemberContact('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo añadir el miembro');
    } finally {
      setLoading(false);
    }
  }

  if (!team) {
    return (
      <main className="page">
        <h1>Alta de equipo</h1>
        <div className="card">
        <form onSubmit={handleCreateTeam}>
          <label>
            Nombre del equipo
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Contexto de la empresa (opcional)
            <textarea value={companyContext} onChange={(e) => setCompanyContext(e.target.value)} />
          </label>
          <label>
            Canal de entrega del informe
            <select value={deliveryChannel} onChange={(e) => setDeliveryChannel(e.target.value as ChannelName)}>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="telegram">Telegram</option>
            </select>
          </label>
          <label>
            Destino del informe (email o teléfono)
            <input type="text" value={deliveryTarget} onChange={(e) => setDeliveryTarget(e.target.value)} required />
          </label>
          <label>
            Día del recordatorio
            <select value={reminderDow} onChange={(e) => setReminderDow(Number(e.target.value))}>
              {DOW_LABELS.map((label, i) => (
                <option key={i} value={i}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hora del recordatorio
            <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} required />
          </label>
          <label>
            Hora de corte
            <input type="time" value={cutoffTime} onChange={(e) => setCutoffTime(e.target.value)} required />
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Creando...' : 'Crear equipo'}
          </button>
        </form>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Miembros de {team.name}</h1>
      <div className="card">
      {members.length > 0 && (
        <ul className="member-list">
          {members.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAddMember}>
        <label>
          Nombre
          <input type="text" value={memberName} onChange={(e) => setMemberName(e.target.value)} required />
        </label>
        <label>
          Canal
          <select value={memberChannel} onChange={(e) => setMemberChannel(e.target.value as ChannelName)}>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="telegram">Telegram</option>
          </select>
        </label>
        <label>
          Contacto (email o teléfono +34...)
          <input type="text" value={memberContact} onChange={(e) => setMemberContact(e.target.value)} required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Añadiendo...' : 'Añadir miembro'}
        </button>
      </form>
      </div>
      <button type="button" onClick={() => router.push('/app')}>
        Terminar
      </button>
    </main>
  );
}
