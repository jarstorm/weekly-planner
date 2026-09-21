const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

export type ChannelName = 'email' | 'whatsapp' | 'telegram';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include', // manda/recibe la cookie httpOnly wf_session — el front nunca toca el token
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? 'Error de red');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  register: (data: { email: string; password: string; orgName: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  me: () => request<{ userId: string; email: string; organizationId: string }>('/auth/me'),

  listTeams: () => request<Team[]>('/teams'),

  createTeam: (data: Partial<Team>) => request<Team>('/teams', { method: 'POST', body: JSON.stringify(data) }),

  addMember: (teamId: string, data: { name: string; channel: ChannelName; contact: string }) =>
    request(`/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify(data) }),

  listReports: (teamId: string) => request<Report[]>(`/reports?teamId=${teamId}`),

  checkinStatus: (teamId: string, weekStart: string) =>
    request<CheckinStatus[]>(`/checkins/status?teamId=${teamId}&weekStart=${weekStart}`),

  // Descargas (PDF del informe, export de conversaciones): navegación de
  // navegador directa a la API, no fetch — la cookie de sesión viaja igual
  // (SameSite=Lax cubre navegación top-level) y así el navegador maneja la
  // descarga solo, sin armar un blob a mano en el front.
  reportPdfUrl: (reportId: string) => `${API_BASE}/reports/${reportId}/pdf`,
  conversationsExportUrl: (teamId: string, weekStart?: string) =>
    `${API_BASE}/checkins/export?teamId=${teamId}${weekStart ? `&weekStart=${weekStart}` : ''}`,
};

export interface Team {
  id: string;
  name: string;
  company_context: string;
  delivery_channel: ChannelName;
  delivery_target: string;
  reminder_dow: number;
  reminder_time: string;
  cutoff_time: string;
  timezone: string;
}

export interface Report {
  id: string;
  week_start: string;
  content_markdown: string | null;
  generated_at: string | null;
  delivered_at: string | null;
}

export interface CheckinStatus {
  memberId: string;
  memberName: string;
  channel: ChannelName;
  responded: boolean;
  doneText: string | null;
  nextText: string | null;
  blockerText: string | null;
  rawText: string | null;
  receivedAt: string | null;
}
