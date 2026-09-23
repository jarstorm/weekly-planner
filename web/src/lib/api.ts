const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

export type ChannelName = 'email' | 'telegram';

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

  getTeam: (teamId: string) => request<Team>(`/teams/${teamId}`),

  createTeam: (data: Partial<Team>) => request<Team>('/teams', { method: 'POST', body: JSON.stringify(data) }),

  updateTeam: (teamId: string, data: Partial<Team>) =>
    request<Team>(`/teams/${teamId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  listMembers: (teamId: string) => request<Member[]>(`/teams/${teamId}/members`),

  addMember: (teamId: string, data: { name: string; channel: ChannelName; contact: string }) =>
    request<Member>(`/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify(data) }),

  updateMember: (
    teamId: string,
    memberId: string,
    data: Partial<{ name: string; channel: ChannelName; contact: string; active: boolean }>,
  ) => request<Member>(`/teams/${teamId}/members/${memberId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  removeMember: (teamId: string, memberId: string) =>
    request<Member>(`/teams/${teamId}/members/${memberId}`, { method: 'DELETE' }),

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

  // Formulario público de checkin (sección 3.5) — el token es la
  // credencial, no hay sesión/cookie de por medio.
  getCheckinForm: (token: string) =>
    request<CheckinFormInfo>(`/checkins/form?token=${encodeURIComponent(token)}`),
  submitCheckinForm: (token: string, data: { doneText?: string; nextText?: string; blockerText?: string }) =>
    request('/checkins/form', { method: 'POST', body: JSON.stringify({ token, ...data }) }),

  getOrganization: () => request<Organization>('/organizations/me'),
  updateOrganization: (
    data: Partial<
      Pick<
        Organization,
        | 'name'
        | 'country'
        | 'contact_name'
        | 'delivery_channel'
        | 'delivery_target'
        | 'reminder_dow'
        | 'reminder_time'
        | 'cutoff_time'
        | 'timezone'
      >
    >,
  ) => request<Organization>('/organizations/me', { method: 'PATCH', body: JSON.stringify(data) }),

  getTelegramBotUsername: () => request<{ username: string | null }>('/telegram/bot-username'),

  billingStatus: () => request<BillingStatus>('/billing/status'),
  createCheckoutSession: (plan: 'equipo' | 'organizacion') =>
    request<{ url: string }>('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
  createPortalSession: () => request<{ url: string }>('/billing/portal', { method: 'POST' }),
  applyPromoCode: (code: string) => request<{ ok: true }>('/billing/promo-code', { method: 'POST', body: JSON.stringify({ code }) }),
};

export interface Team {
  id: string;
  name: string;
  company_context: string;
}

export interface Member {
  id: string;
  team_id: string;
  name: string;
  channel: ChannelName;
  contact: string;
  active: boolean;
}

export interface Report {
  id: string;
  week_start: string;
  content_markdown: string | null;
  generated_at: string | null;
  delivered_at: string | null;
}

export interface CheckinFormInfo {
  memberName: string;
  teamName: string;
  weekStart: string;
  alreadySubmitted: boolean;
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
  audioUrl: string | null;
}

export interface Organization {
  id: string;
  name: string;
  country: string | null;
  contact_name: string | null;
  email: string;
  // Configuración del "loop de feedback" — global para toda la cuenta
  // (migración 0006), no por equipo.
  delivery_channel: ChannelName;
  delivery_target: string | null;
  reminder_dow: number;
  reminder_time: string;
  cutoff_time: string;
  timezone: string;
}

export interface BillingStatus {
  plan: 'equipo' | 'organizacion' | 'custom';
  status: 'trial' | 'active' | 'canceled';
  price_month: number | null;
  max_teams: number | null;
  max_members_per_team: number | null;
  has_executive_summary: boolean;
}
