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

  verifyEmail: (token: string) => request<{ ok: true }>('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),

  requestPasswordReset: (email: string) =>
    request<{ ok: true }>('/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token: string, password: string) =>
    request<{ ok: true }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  me: () => request<{ userId: string; email: string; organizationId: string }>('/auth/me'),

  listTeams: () => request<Team[]>('/teams'),

  getTeam: (teamId: string) => request<Team>(`/teams/${teamId}`),

  createTeam: (data: Partial<Team>) => request<Team>('/teams', { method: 'POST', body: JSON.stringify(data) }),

  updateTeam: (teamId: string, data: Partial<Team>) =>
    request<Team>(`/teams/${teamId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  listMembers: (teamId: string) => request<Member[]>(`/teams/${teamId}/members`),

  addMember: (teamId: string, data: { name: string; channel: ChannelName; contact?: string }) =>
    request<Member>(`/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify(data) }),

  updateMember: (
    teamId: string,
    memberId: string,
    data: Partial<{ name: string; channel: ChannelName; contact: string | null; active: boolean; team_id: string }>,
  ) => request<Member>(`/teams/${teamId}/members/${memberId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  removeMember: (teamId: string, memberId: string) =>
    request<Member>(`/teams/${teamId}/members/${memberId}`, { method: 'DELETE' }),

  resendMemberVerification: (teamId: string, memberId: string) =>
    request<{ ok: true }>(`/teams/${teamId}/members/${memberId}/resend-verification`, { method: 'POST' }),

  verifyMemberEmail: (token: string) =>
    request<{ ok: true }>('/members/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),

  listReports: (teamId: string) => request<Report[]>(`/reports?teamId=${teamId}`),

  // Resumen ejecutivo (paso 15) — histórico a nivel organización, no de
  // un equipo. Solo tiene datos si org.has_executive_summary está activo.
  listExecutiveSummaries: () => request<Report[]>('/reports/executive-summary'),

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
        | 'language'
        | 'reminder_dow'
        | 'reminder_time'
        | 'cutoff_time'
        | 'timezone'
        | 'has_executive_summary'
        | 'executive_summary_recipients'
        | 'has_monthly_survey'
        | 'survey_questions'
        | 'survey_day_of_month'
      >
    >,
  ) => request<Organization>('/organizations/me', { method: 'PATCH', body: JSON.stringify(data) }),

  // Formulario público de la encuesta mensual anónima — el token es la
  // credencial, no hay sesión de por medio (mismo criterio que checkins/form).
  getSurveyForm: (token: string) => request<SurveyFormInfo>(`/survey/form?token=${encodeURIComponent(token)}`),
  submitSurveyForm: (token: string, answers: string[]) =>
    request('/survey/form', { method: 'POST', body: JSON.stringify({ token, answers }) }),

  // Listado de todas las personas de la cuenta, de todos los equipos.
  listAllMembers: () => request<OrgMember[]>('/organizations/members'),

  listSurveyPeriods: () => request<string[]>('/survey/periods'),
  getSurveyResults: (period: string) =>
    request<SurveyResults>(`/survey/results?period=${encodeURIComponent(period)}`),

  getTelegramBotUsername: () => request<{ username: string | null }>('/telegram/bot-username'),
  getEnabledChannels: () => request<EnabledChannels>('/channels/enabled'),

  billingStatus: () => request<BillingStatus>('/billing/status'),
  createCheckoutSession: (plan: 'equipo' | 'organizacion') =>
    request<{ url: string }>('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
  // Cambio de plan con una suscripción ya activa: modifica la suscripción
  // en el sitio en vez de crear una sesión de Checkout nueva. Si la cuenta
  // todavía no tenía suscripción (checkout inicial cancelado), el backend
  // devuelve {url} igual que /billing/checkout — mismo shape de respuesta
  // que ChangePlanResult contempla.
  changePlan: (plan: 'equipo' | 'organizacion') =>
    request<ChangePlanResult>('/billing/change-plan', { method: 'POST', body: JSON.stringify({ plan }) }),
  createPortalSession: () => request<{ url: string }>('/billing/portal', { method: 'POST' }),
  applyPromoCode: (code: string) => request<{ ok: true }>('/billing/promo-code', { method: 'POST', body: JSON.stringify({ code }) }),
};

export interface Team {
  id: string;
  name: string;
  company_context: string;
  // Emails que reciben el informe semanal de este equipo (migración 0009).
  report_recipients: string[];
}

export interface Member {
  id: string;
  team_id: string;
  name: string;
  channel: ChannelName;
  // null mientras un miembro de canal telegram no ha vinculado el bot todavía.
  contact: string | null;
  active: boolean;
  // Solo tiene sentido para channel='email' — null si nunca hizo clic en
  // el link de verificación (o el miembro es de otro canal).
  email_verified_at: string | null;
}

// Fila del listado de personas de toda la cuenta (GET /organizations/members)
// — mismo Member más el nombre de su equipo ya resuelto.
export interface OrgMember {
  id: string;
  team_id: string;
  team_name: string;
  name: string;
  channel: ChannelName;
  contact: string | null;
  email_verified_at: string | null;
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
  // Una URL por nota de voz de la semana — antes una sola (migración 0014).
  audioUrls: string[];
}

export interface Organization {
  id: string;
  name: string;
  country: string | null;
  contact_name: string | null;
  email: string;
  plan: 'equipo' | 'organizacion' | 'custom';
  // Límites del plan (paso 14) — NULL en Plan Custom, sin límite.
  max_teams: number | null;
  max_members_per_team: number | null;
  // Configuración del "loop de feedback" — global para toda la cuenta
  // (migración 0006), no por equipo. El destino de cada informe pasó a ser
  // report_recipients por equipo (migración 0009).
  reminder_dow: number;
  reminder_time: string;
  cutoff_time: string;
  timezone: string;
  // Idioma de la cuenta (migración 0012) — preguntas del check-in, encuesta
  // mensual e informes con IA. No es el idioma de la interfaz del panel
  // (ese sigue siendo el selector de next-intl, por navegador).
  language: 'es' | 'en';
  // Resumen ejecutivo (paso 15) — opción, solo disponible en Plan
  // Organización/Custom (org_exec_summary_plan_check en schema.sql).
  has_executive_summary: boolean;
  executive_summary_recipients: string[];
  // Encuesta mensual anónima — opción, solo disponible en Plan
  // Organización/Custom (org_survey_plan_check en schema.sql). De cuenta,
  // no por equipo: mismas preguntas para todos los equipos.
  has_monthly_survey: boolean;
  survey_questions: string[];
  survey_day_of_month: number;
}

export interface SurveyFormInfo {
  memberName: string;
  organizationName: string;
  questions: string[];
  alreadySubmitted: boolean;
}

export interface SurveyResults {
  period: string;
  questions: string[];
  answersByQuestion: string[][];
  responseCount: number;
  submittedCount: number;
  totalActiveMembers: number;
}

// email siempre true (canal fijo) — telegram/whatsapp según ENABLE_*_CHANNEL
// en el backend (ver channels-info.controller.ts).
export interface EnabledChannels {
  email: true;
  telegram: boolean;
  whatsapp: boolean;
}

export type ChangePlanResult = { url: string } | { ok: true; isUpgrade: boolean };

export interface BillingStatus {
  plan: 'equipo' | 'organizacion' | 'custom';
  status: 'trial' | 'active' | 'canceled';
  price_month: number | null;
  max_teams: number | null;
  max_members_per_team: number | null;
  has_executive_summary: boolean;
}
